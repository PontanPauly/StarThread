import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useMyPerson } from "@/hooks/useMyPerson";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Camera,
  Star,
  Users,
  Shield,
  Share2,
  Plus,
  X,
  Check,
  ArrowRight,
  ArrowLeft,
  Copy,
  UserPlus,
  Heart,
  MapPin,
  Pencil,
  Trash2,
  AlertTriangle,
} from "lucide-react";

function AddressAutocomplete({ value, onChange, onSelect, placeholder, className }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us&limit=5&q=${encodeURIComponent(query)}`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 400);
  };

  const handleSelect = (item) => {
    const addr = item.address || {};
    const houseNumber = addr.house_number || "";
    const road = addr.road || "";
    const streetAddress = [houseNumber, road].filter(Boolean).join(" ");
    const city = addr.city || addr.town || addr.village || addr.hamlet || "";
    const state = addr.state || "";

    onSelect({
      address: streetAddress,
      city,
      state,
    });
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={value}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {loading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {suggestions.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-cyan-500/20 transition-colors flex items-start gap-2"
            >
              <MapPin className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{item.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AnimatedStarfield({ canvasRef }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let stars = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const STAR_COUNT = 200;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.8 + 0.3,
        alpha: Math.random() * 0.6 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 1.2,
        color: Math.random() > 0.7
          ? "rgba(251,191,36,"
          : Math.random() > 0.5
          ? "rgba(245,158,11,"
          : "rgba(255,255,255,",
      });
    }

    const draw = (time) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        const flicker = Math.sin(time * 0.001 * s.speed + s.phase) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = s.color + (s.alpha * flicker).toFixed(2) + ")";
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef]);

  return null;
}

const STEP_LABELS = ["Your Profile", "Add Family", "Trusted Contacts", "Invite"];

const RELATIONSHIP_TYPES = [
  { type: "parent", label: "Parent", icon: Users, reciprocal: "child" },
  { type: "partner", label: "Spouse / Partner", icon: Heart, reciprocal: "partner" },
  { type: "child", label: "Child", icon: Star, reciprocal: "parent" },
  { type: "sibling", label: "Sibling", icon: Users, reciprocal: "sibling" },
];

export default function Onboarding() {
  const { user } = useAuth();
  const { data: myPerson, refetch: refetchMyPerson } = useMyPerson();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canvasRef = useRef(null);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [profileData, setProfileData] = useState({
    photo_url: "",
    birth_date: "",
    about: "",
    address: "",
    city: "",
    state: "",
  });

  const [addedMembers, setAddedMembers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormType, setAddFormType] = useState("parent");
  const [addFormFirstName, setAddFormFirstName] = useState("");
  const [addFormLastName, setAddFormLastName] = useState("");
  const [addFormEmail, setAddFormEmail] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);

  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [showDuplicatePrompt, setShowDuplicatePrompt] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const [trustedContacts, setTrustedContacts] = useState([]);

  const [inviteLink, setInviteLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (myPerson) {
      setProfileData({
        photo_url: myPerson.photo_url || "",
        birth_date: myPerson.birth_date ? myPerson.birth_date.split("T")[0] : "",
        about: myPerson.about || "",
        address: myPerson.address || "",
        city: myPerson.city || "",
        state: myPerson.state || "",
      });
    }
  }, [myPerson]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setProfileData((prev) => ({ ...prev, photo_url: file_url }));
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  };

  const saveProfile = async () => {
    if (!myPerson) return;
    if (!profileData.birth_date) {
      toast({ title: "Birthday is required", variant: "destructive" });
      return;
    }
    if (!profileData.address.trim() || !profileData.city.trim() || !profileData.state.trim()) {
      toast({ title: "Address, city, and state are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Person.update(myPerson.id, {
        photo_url: profileData.photo_url || null,
        birth_date: profileData.birth_date || null,
        about: profileData.about || null,
        address: profileData.address || null,
        city: profileData.city || null,
        state: profileData.state || null,
      });
      await refetchMyPerson();
      setStep(2);
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getFullName = (first, last) => [first, last].filter(Boolean).join(' ');

  const searchDuplicates = async (name) => {
    if (!name || name.trim().length < 2) return [];
    try {
      const params = new URLSearchParams({ q: name.trim() });
      if (myPerson?.city) params.set('city', myPerson.city);
      if (myPerson?.state) params.set('state', myPerson.state);
      if (addFormBirthYear) params.set('birth_year', addFormBirthYear);
      const existingIds = addedMembers.map((m) => m.existingId).filter(Boolean);
      if (existingIds.length > 0) params.set('context_person_ids', existingIds.join(','));

      const response = await fetch(`/api/entities/Person/search?${params}`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      const data = await response.json();
      const results = data.matches || data;
      const alreadyAdded = addedMembers.map((m) => m.existingId).filter(Boolean);
      return results.filter(
        (p) => p.id !== myPerson?.id && !alreadyAdded.includes(p.id)
      );
    } catch {
      return [];
    }
  };

  const handleAddMember = async () => {
    if (!addFormFirstName.trim() || !addFormLastName.trim()) return;

    if (editingMemberId) {
      setAddedMembers((prev) =>
        prev.map((m) =>
          m.tempId === editingMemberId
            ? { ...m, firstName: addFormFirstName.trim(), lastName: addFormLastName.trim(), name: getFullName(addFormFirstName.trim(), addFormLastName.trim()), type: addFormType, email: addFormEmail.trim() }
            : m
        )
      );
      setEditingMemberId(null);
      setAddFormFirstName("");
      setAddFormLastName("");
      setAddFormEmail("");
      setShowAddForm(false);
      toast({ title: "Family member updated" });
      return;
    }

    setCheckingDuplicates(true);
    try {
      const fullName = getFullName(addFormFirstName, addFormLastName);
      const matches = await searchDuplicates(fullName);
      if (matches.length > 0) {
        setDuplicateMatches(matches);
        setShowDuplicatePrompt(true);
      } else {
        addStagedMember(null);
      }
    } catch {
      addStagedMember(null);
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const addStagedMember = (existingPerson) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const firstName = existingPerson ? existingPerson.name.split(' ')[0] : addFormFirstName.trim();
    const lastName = existingPerson ? existingPerson.name.split(' ').slice(-1)[0] : addFormLastName.trim();
    setAddedMembers((prev) => [
      ...prev,
      {
        tempId,
        existingId: existingPerson?.id || null,
        firstName,
        lastName,
        name: existingPerson?.name || getFullName(addFormFirstName.trim(), addFormLastName.trim()),
        type: addFormType,
        email: addFormEmail.trim(),
        isExisting: !!existingPerson,
      },
    ]);
    setAddFormFirstName("");
    setAddFormLastName("");
    setAddFormEmail("");
    setShowAddForm(false);
    setShowDuplicatePrompt(false);
    setDuplicateMatches([]);
    const displayName = existingPerson?.name || getFullName(addFormFirstName.trim(), addFormLastName.trim()) || "Member";
    toast({
      title: existingPerson
        ? `Linked ${displayName} as ${addFormType}`
        : `${displayName} added as ${addFormType}`,
    });
  };

  const removeStagedMember = (tempId) => {
    setAddedMembers((prev) => prev.filter((m) => m.tempId !== tempId));
    setTrustedContacts((prev) => prev.filter((id) => id !== tempId));
  };

  const startEditMember = (member) => {
    if (member.isExisting) return;
    setEditingMemberId(member.tempId);
    setAddFormFirstName(member.firstName || "");
    setAddFormLastName(member.lastName || "");
    setAddFormEmail(member.email || "");
    setAddFormType(member.type);
    setShowAddForm(true);
    setShowDuplicatePrompt(false);
  };

  const persistStagedMembers = async () => {
    if (!myPerson || addedMembers.length === 0) return {};

    const idMap = {};

    for (const member of addedMembers) {
      let relatedPersonId = member.existingId;
      const matchedExisting = !!member.existingId;

      if (!relatedPersonId) {
        const newPerson = await base44.entities.Person.create({
          first_name: member.firstName,
          last_name: member.lastName,
          linked_user_email: member.email || null,
          role_type: member.type === "child" ? "child" : "adult",
        });
        relatedPersonId = newPerson.id;
      }

      idMap[member.tempId] = relatedPersonId;

      const reciprocal = RELATIONSHIP_TYPES.find((r) => r.type === member.type)?.reciprocal || member.type;

      await base44.entities.Relationship.create({
        person_id: myPerson.id,
        related_person_id: relatedPersonId,
        relationship_type: member.type,
        status_from_person: "confirmed",
        status_from_related: matchedExisting ? "pending" : "unaware",
      });

      await base44.entities.Relationship.create({
        person_id: relatedPersonId,
        related_person_id: myPerson.id,
        relationship_type: reciprocal,
        status_from_person: matchedExisting ? "pending" : "unaware",
        status_from_related: "confirmed",
      });
    }

    return idMap;
  };

  const toggleTrustedContact = (memberId) => {
    setTrustedContacts((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const saveTrustedContacts = async () => {
    setStep(4);
  };

  const generateInviteLink = async () => {
    if (!myPerson) return;
    setGeneratingLink(true);
    try {
      const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      await base44.entities.InviteLink.create({
        code,
        created_by_person_id: myPerson.id,
        relationship_type: "chosen_family",
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const baseUrl = window.location.origin;
      setInviteLink(`${baseUrl}/login?invite=${code}`);
    } catch (err) {
      toast({ title: "Failed to generate link", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const completeOnboarding = async () => {
    if (!myPerson) return;
    setSaving(true);
    try {
      const persistedIds = await persistStagedMembers();

      if (trustedContacts.length > 0 && persistedIds) {
        for (const tempId of trustedContacts) {
          const realId = persistedIds[tempId];
          if (realId) {
            try {
              await base44.entities.TrustedContact.create({
                person_id: myPerson.id,
                trusted_person_id: realId,
              });
            } catch (err) {
              console.error(`Failed to save trusted contact:`, err);
            }
          }
        }
      }

      await base44.entities.Person.update(myPerson.id, { onboarding_complete: true });
      await queryClient.invalidateQueries(["my-person"]);
      await queryClient.refetchQueries(["my-person"]);
      navigate("/home", { replace: true });
    } catch (err) {
      toast({ title: "Failed to complete", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const stepIcons = [Star, Users, Shield, Share2];

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950">
      <canvas ref={canvasRef} className="fixed inset-0 z-0" />
      <AnimatedStarfield canvasRef={canvasRef} />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8">
        <div className="flex items-center gap-2 mb-8">
          <img src="/logo.png" alt="StarThread" className="w-10 h-10 object-contain" />
          <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            StarThread
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 mb-8">
          {STEP_LABELS.map((label, i) => {
            const Icon = stepIcons[i];
            const isActive = step === i + 1;
            const isDone = step > i + 1;
            return (
              <div key={i} className="flex items-center gap-1.5 sm:gap-2">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? "bg-cyan-500/30 border-2 border-cyan-400 text-cyan-400 scale-110"
                      : isDone
                      ? "bg-cyan-500/20 border-2 border-cyan-500 text-cyan-300"
                      : "bg-slate-800/50 border border-slate-700 text-slate-500"
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                {i < 3 && (
                  <div
                    className={`w-5 sm:w-8 h-0.5 ${isDone ? "bg-cyan-500" : "bg-slate-700"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="w-full max-w-md">
          <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 sm:p-8 shadow-2xl">
            {step === 1 && (
              <div className="space-y-5">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-slate-100">Set Up Your Profile</h2>
                  <p className="text-sm text-slate-400 mt-1">Tell your family a bit about yourself</p>
                </div>

                <div className="flex justify-center">
                  <label className="relative cursor-pointer group">
                    <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden group-hover:border-cyan-400 transition-colors">
                      {profileData.photo_url ? (
                        <img src={profileData.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-8 h-8 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                      )}
                    </div>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                </div>

                <div>
                  <Label className="text-slate-300 text-sm">Birthday <span className="text-red-400">*</span></Label>
                  <Input
                    type="date"
                    value={profileData.birth_date}
                    onChange={(e) => setProfileData((p) => ({ ...p, birth_date: e.target.value }))}
                    className="bg-slate-800/50 border-slate-700 text-slate-100 mt-1"
                  />
                </div>

                <div>
                  <Label className="text-slate-300 text-sm">About You</Label>
                  <Textarea
                    value={profileData.about}
                    onChange={(e) => setProfileData((p) => ({ ...p, about: e.target.value }))}
                    placeholder="A few words about yourself..."
                    className="bg-slate-800/50 border-slate-700 text-slate-100 mt-1 resize-none"
                    rows={3}
                  />
                </div>

                <div>
                  <Label className="text-slate-300 text-sm">Address <span className="text-red-400">*</span></Label>
                  <AddressAutocomplete
                    value={profileData.address}
                    onChange={(val) => setProfileData((p) => ({ ...p, address: val }))}
                    onSelect={({ address, city, state }) =>
                      setProfileData((p) => ({ ...p, address, city, state }))
                    }
                    placeholder="Start typing your address..."
                    className="bg-slate-800/50 border-slate-700 text-slate-100 mt-1 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-slate-300 text-xs">City <span className="text-red-400">*</span></Label>
                    <Input
                      value={profileData.city}
                      onChange={(e) => setProfileData((p) => ({ ...p, city: e.target.value }))}
                      className="bg-slate-800/50 border-slate-700 text-slate-100 mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-xs">State <span className="text-red-400">*</span></Label>
                    <Input
                      value={profileData.state}
                      onChange={(e) => setProfileData((p) => ({ ...p, state: e.target.value }))}
                      className="bg-slate-800/50 border-slate-700 text-slate-100 mt-1 text-sm"
                    />
                  </div>
                </div>

                <Button
                  onClick={saveProfile}
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-semibold"
                >
                  {saving ? "Saving..." : "Continue"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-semibold text-slate-100">Add Your Family</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Connect with family members — you can always add more later
                  </p>
                </div>

                {addedMembers.length > 0 && (
                  <div className="space-y-2">
                    {addedMembers.map((m) => (
                      <div
                        key={m.tempId}
                        className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50"
                      >
                        <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                          <Star className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 font-medium truncate">{m.name}</p>
                          <p className="text-xs text-slate-500 capitalize">
                            {m.type}
                            {m.isExisting && <span className="ml-1 text-cyan-500">(linked)</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!m.isExisting && (
                            <button
                              type="button"
                              onClick={() => startEditMember(m)}
                              className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-cyan-400 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeStagedMember(m.tempId)}
                            className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!showAddForm ? (
                  <div className="grid grid-cols-2 gap-2">
                    {RELATIONSHIP_TYPES.map((rt) => (
                      <Button
                        key={rt.type}
                        variant="outline"
                        onClick={() => {
                          setAddFormType(rt.type);
                          setEditingMemberId(null);
                          setAddFormFirstName("");
                          setAddFormLastName("");
                          setAddFormEmail("");
                          setShowAddForm(true);
                          setShowDuplicatePrompt(false);
                        }}
                        className="border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-cyan-500/10 hover:border-cyan-500/50 hover:text-cyan-300 h-auto py-3"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {rt.label}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-cyan-400 font-medium capitalize">
                        {editingMemberId ? "Edit" : "Add a"}{" "}
                        {RELATIONSHIP_TYPES.find((r) => r.type === addFormType)?.label}
                      </span>
                      <button onClick={() => {
                        setShowAddForm(false);
                        setEditingMemberId(null);
                        setShowDuplicatePrompt(false);
                        setDuplicateMatches([]);
                      }}>
                        <X className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={addFormFirstName}
                        onChange={(e) => setAddFormFirstName(e.target.value)}
                        placeholder="First name"
                        className="bg-slate-800/50 border-slate-700 text-slate-100"
                      />
                      <Input
                        value={addFormLastName}
                        onChange={(e) => setAddFormLastName(e.target.value)}
                        placeholder="Last name"
                        className="bg-slate-800/50 border-slate-700 text-slate-100"
                      />
                    </div>
                    <Input
                      value={addFormEmail}
                      onChange={(e) => setAddFormEmail(e.target.value)}
                      placeholder="Their email (optional)"
                      type="email"
                      className="bg-slate-800/50 border-slate-700 text-slate-100"
                    />
                    <Button
                      onClick={handleAddMember}
                      disabled={!addFormFirstName.trim() || !addFormLastName.trim() || checkingDuplicates}
                      className="w-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30"
                    >
                      {checkingDuplicates
                        ? "Checking..."
                        : editingMemberId
                        ? "Save Changes"
                        : "Add"}
                      <UserPlus className="w-4 h-4 ml-2" />
                    </Button>

                    {showDuplicatePrompt && duplicateMatches.length > 0 && (
                      <div className="space-y-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Is this someone already in StarThread?</span>
                        </div>
                        <div className="space-y-1.5">
                          {duplicateMatches.map((match) => (
                            <button
                              key={match.id}
                              type="button"
                              onClick={() => addStagedMember(match)}
                              className={`w-full flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/50 border transition-all text-left ${
                                match.confidence === 'high' ? 'border-amber-500/50 hover:border-amber-400' :
                                match.confidence === 'medium' ? 'border-slate-600/50 hover:border-cyan-500/50' :
                                'border-slate-700/30 hover:border-slate-500/50'
                              } hover:bg-cyan-500/10`}
                            >
                              <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center overflow-hidden shrink-0">
                                {match.photo_url ? (
                                  <img src={match.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Star className="w-3.5 h-3.5 text-cyan-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-slate-200 font-medium truncate">{match.name}</p>
                                  {match.confidence === 'high' && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold shrink-0">Strong match</span>
                                  )}
                                  {match.confidence === 'medium' && (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-600/30 text-slate-300 text-[10px] font-semibold shrink-0">Possible match</span>
                                  )}
                                </div>
                                {match.explanations && match.explanations.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {match.explanations.slice(0, 3).map((exp, i) => (
                                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/50 text-slate-400">{exp}</span>
                                    ))}
                                  </div>
                                )}
                                {!match.explanations && match.role_type && (
                                  <p className="text-xs text-slate-500 capitalize">{match.role_type}</p>
                                )}
                              </div>
                              <span className="text-xs text-cyan-400 shrink-0">Link</span>
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => addStagedMember(null)}
                          className="w-full text-center text-xs text-slate-400 hover:text-slate-200 py-1.5 transition-colors"
                        >
                          No, create a new person
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(1)}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-semibold"
                  >
                    {addedMembers.length === 0 ? "Skip for Now" : "Continue"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-semibold text-slate-100">Trusted Contacts</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Select people you trust to manage sensitive family matters
                  </p>
                </div>

                {addedMembers.length === 0 ? (
                  <div className="text-center py-6">
                    <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">
                      No family members added yet. You can set trusted contacts later.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {addedMembers.map((m) => {
                      const isSelected = trustedContacts.includes(m.tempId);
                      return (
                        <button
                          key={m.tempId}
                          onClick={() => toggleTrustedContact(m.tempId)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                            isSelected
                              ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-300"
                              : "bg-slate-800/50 border-slate-700/50 text-slate-300 hover:border-slate-600"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? "border-cyan-400 bg-cyan-400" : "border-slate-600"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-slate-900" />}
                          </div>
                          <span className="text-sm font-medium">{m.name}</span>
                          <span className="text-xs text-slate-500 capitalize ml-auto">{m.type}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(2)}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <Button
                    onClick={saveTrustedContacts}
                    disabled={saving}
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-semibold"
                  >
                    {saving ? "Saving..." : addedMembers.length === 0 ? "Skip" : "Continue"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-semibold text-slate-100">Invite Family</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Share a link so family members can join StarThread
                  </p>
                </div>

                {!inviteLink ? (
                  <div className="text-center py-4">
                    <Share2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <Button
                      onClick={generateInviteLink}
                      disabled={generatingLink}
                      className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30"
                    >
                      {generatingLink ? "Generating..." : "Generate Invite Link"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={inviteLink}
                        readOnly
                        className="bg-slate-800/50 border-slate-700 text-slate-300 text-sm flex-1"
                      />
                      <Button
                        onClick={copyInviteLink}
                        variant="ghost"
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500 text-center">
                      This link expires in 30 days
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(3)}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <Button
                    onClick={completeOnboarding}
                    disabled={saving}
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-semibold"
                  >
                    {saving ? "Finishing..." : inviteLink ? "Finish Setup" : "Skip for Now"}
                    <Star className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-slate-600 text-xs mt-4">
            Step {step} of 4 — {STEP_LABELS[step - 1]}
          </p>
        </div>
      </div>
    </div>
  );
}
