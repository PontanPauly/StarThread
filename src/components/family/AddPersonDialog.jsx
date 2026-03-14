import React, { useState, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMyPerson } from "@/hooks/useMyPerson";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  X,
  Star,
  Users,
  Heart,
  Shield,
  AlertTriangle,
  UserPlus,
  ArrowLeft,
  Loader2,
} from "lucide-react";

const RELATIONSHIP_TYPES = [
  { type: "parent", label: "Parent", icon: Users, reciprocal: "child" },
  { type: "partner", label: "Partner", icon: Heart, reciprocal: "partner" },
  { type: "child", label: "Child", icon: Star, reciprocal: "parent" },
  { type: "sibling", label: "Sibling", icon: Users, reciprocal: "sibling" },
  { type: "grandparent", label: "Grandparent", icon: Users, reciprocal: "grandchild" },
  { type: "grandchild", label: "Grandchild", icon: Star, reciprocal: "grandparent" },
  { type: "aunt_uncle", label: "Aunt / Uncle", icon: Users, reciprocal: "niece_nephew" },
  { type: "niece_nephew", label: "Niece / Nephew", icon: Star, reciprocal: "aunt_uncle" },
  { type: "cousin", label: "Cousin", icon: Users, reciprocal: "cousin" },
  { type: "in_law", label: "In-Law", icon: Users, reciprocal: "in_law" },
  { type: "step_parent", label: "Step-Parent", icon: Users, reciprocal: "step_child" },
  { type: "step_child", label: "Step-Child", icon: Star, reciprocal: "step_parent" },
  { type: "step_sibling", label: "Step-Sibling", icon: Users, reciprocal: "step_sibling" },
  { type: "half_sibling", label: "Half-Sibling", icon: Users, reciprocal: "half_sibling" },
  { type: "guardian", label: "Guardian", icon: Shield, reciprocal: "ward" },
  { type: "godparent", label: "Godparent", icon: Heart, reciprocal: "godchild" },
  { type: "chosen_family", label: "Chosen Family", icon: Heart, reciprocal: "chosen_family" },
  { type: "extended", label: "Extended", icon: Users, reciprocal: "extended" },
];

function firstNameSimilarity(a, b) {
  if (!a || !b) return 0;
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 0;
  const matrix = Array.from({ length: la.length + 1 }, (_, i) =>
    Array.from({ length: lb.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= la.length; i++) {
    for (let j = 1; j <= lb.length; j++) {
      matrix[i][j] = la[i - 1] === lb[j - 1]
        ? matrix[i - 1][j - 1]
        : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
    }
  }
  return Math.max(0, 1 - matrix[la.length][lb.length] / maxLen);
}

export default function AddPersonDialog({ open, onOpenChange, households = [], onSuccess, defaultRelType = null }) {
  const { data: myPerson } = useMyPerson();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState(defaultRelType ? "form" : "pick-type");
  const [relType, setRelType] = useState(defaultRelType || "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [email, setEmail] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [householdId, setHouseholdId] = useState("");
  const [saving, setSaving] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [showDuplicates, setShowDuplicates] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(defaultRelType ? "form" : "pick-type");
      setRelType(defaultRelType || "");
      setFirstName("");
      setLastName("");
      setMiddleName("");
      setEmail("");
      setBirthYear("");
      setHouseholdId("");
      setSaving(false);
      setCheckingDuplicates(false);
      setDuplicateMatches([]);
      setShowDuplicates(false);
    }
  }, [open, defaultRelType]);

  const resetForm = useCallback(() => {
    setStep(defaultRelType ? "form" : "pick-type");
    setRelType(defaultRelType || "");
    setFirstName("");
    setLastName("");
    setMiddleName("");
    setEmail("");
    setBirthYear("");
    setHouseholdId("");
    setSaving(false);
    setCheckingDuplicates(false);
    setDuplicateMatches([]);
    setShowDuplicates(false);
  }, [defaultRelType]);

  const handleOpenChange = (open) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const selectRelType = (type) => {
    setRelType(type);
    setStep("form");
  };

  const searchDuplicates = async (name) => {
    if (!name || name.trim().length < 2) return [];
    try {
      const params = new URLSearchParams({ q: name.trim() });
      if (birthYear) params.set("birth_year", birthYear);
      const response = await fetch(`/api/entities/Person/search?${params}`, { credentials: "include" });
      if (!response.ok) return [];
      const data = await response.json();
      const results = data.matches || data;
      const searchFirstName = name.trim().split(/\s+/)[0];
      return results.filter((p) => {
        if (p.id === myPerson?.id) return false;
        if (p.score >= 75) return true;
        const candidateFirst = p.first_name || (p.name ? p.name.split(" ")[0] : "");
        return firstNameSimilarity(searchFirstName, candidateFirst) >= 0.5;
      });
    } catch {
      return [];
    }
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) return;

    setCheckingDuplicates(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const matches = await searchDuplicates(fullName);
      if (matches.length > 0 && !showDuplicates) {
        setDuplicateMatches(matches);
        setShowDuplicates(true);
        setCheckingDuplicates(false);
        return;
      }
    } catch {
    } finally {
      setCheckingDuplicates(false);
    }

    await createPersonAndRelationship(null);
  };

  const linkExistingPerson = async (existingPerson) => {
    await createPersonAndRelationship(existingPerson);
  };

  const createPersonAndRelationship = async (existingPerson) => {
    if (!myPerson) return;
    setSaving(true);
    try {
      let personId = existingPerson?.id;

      if (!personId) {
        const personData = {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          linked_user_email: email.trim() || null,
          role_type: relType === "child" ? "child" : "adult",
        };
        if (middleName.trim()) personData.middle_name = middleName.trim();
        if (birthYear) personData.birth_year = parseInt(birthYear, 10) || null;
        if (householdId) personData.household_id = householdId;
        const newPerson = await base44.entities.Person.create(personData);
        personId = newPerson.id;
      } else if (householdId && !existingPerson.household_id) {
        await base44.entities.Person.update(personId, { household_id: householdId });
      }

      const reciprocal = RELATIONSHIP_TYPES.find((r) => r.type === relType)?.reciprocal || relType;

      await base44.entities.Relationship.create({
        person_id: myPerson.id,
        related_person_id: personId,
        relationship_type: reciprocal,
        status_from_person: "confirmed",
        status_from_related: "pending",
      });

      await base44.entities.Relationship.create({
        person_id: personId,
        related_person_id: myPerson.id,
        relationship_type: relType,
        status_from_person: "pending",
        status_from_related: "confirmed",
      });

      queryClient.invalidateQueries(["universe-members"]);
      queryClient.invalidateQueries(["galaxy"]);
      toast({ title: `${existingPerson ? "Linked" : "Added"} ${existingPerson?.name || `${firstName.trim()} ${lastName.trim()}`}` });
      resetForm();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Failed to add person:", err);
      toast({ title: "Failed to add person", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const relLabel = RELATIONSHIP_TYPES.find((r) => r.type === relType)?.label || relType;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-100">
            {step === "pick-type" ? "Add to Your Family" : `Add a ${relLabel}`}
          </DialogTitle>
        </DialogHeader>

        {step === "pick-type" && (
          <div className="grid grid-cols-3 gap-1.5 max-h-72 overflow-y-auto pr-1 py-2">
            {RELATIONSHIP_TYPES.map((rt) => {
              const Icon = rt.icon;
              return (
                <Button
                  key={rt.type}
                  variant="outline"
                  onClick={() => selectRelType(rt.type)}
                  className="border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-amber-500/10 hover:border-amber-500/50 hover:text-amber-300 h-auto py-2.5 text-xs px-2"
                >
                  <Icon className="w-3 h-3 mr-1 shrink-0" />
                  <span className="truncate">{rt.label}</span>
                </Button>
              );
            })}
          </div>
        )}

        {step === "form" && (
          <div className="space-y-3 py-2">
            <button
              onClick={() => { setStep("pick-type"); setShowDuplicates(false); setDuplicateMatches([]); }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Change relationship type
            </button>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">First Name *</label>
                <Input
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setShowDuplicates(false); }}
                  placeholder="First name"
                  className="bg-slate-800/50 border-slate-700 text-slate-100"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Last Name *</label>
                <Input
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); setShowDuplicates(false); }}
                  placeholder="Last name"
                  className="bg-slate-800/50 border-slate-700 text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Middle Name</label>
              <Input
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Optional"
                className="bg-slate-800/50 border-slate-700 text-slate-100 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Their Email</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Optional - for sending an invite"
                type="email"
                className="bg-slate-800/50 border-slate-700 text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Birth Year</label>
                <Input
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  placeholder="Optional"
                  type="number"
                  min="1900"
                  max={new Date().getFullYear()}
                  className="bg-slate-800/50 border-slate-700 text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Galaxy</label>
                <Select value={householdId || "none"} onValueChange={(v) => setHouseholdId(v === "none" ? "" : v)}>
                  <SelectTrigger className="bg-slate-800/50 border-slate-700 text-slate-100">
                    <SelectValue placeholder="No galaxy" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="none" className="text-slate-300">No galaxy</SelectItem>
                    {households.map((h) => (
                      <SelectItem key={h.id} value={h.id} className="text-slate-300">
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {showDuplicates && duplicateMatches.length > 0 && (
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
                      onClick={() => linkExistingPerson(match)}
                      disabled={saving}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/50 border transition-all text-left ${
                        match.confidence === "high"
                          ? "border-amber-500/50 hover:border-amber-400"
                          : match.confidence === "medium"
                          ? "border-slate-600/50 hover:border-amber-500/50"
                          : "border-slate-700/30 hover:border-slate-500/50"
                      } hover:bg-amber-500/10`}
                    >
                      <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center overflow-hidden shrink-0">
                        {match.photo_url ? (
                          <img src={match.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Star className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-slate-200 font-medium truncate">{match.name}</p>
                          {match.confidence === "high" && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold shrink-0">Strong match</span>
                          )}
                          {match.confidence === "medium" && (
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
                      <span className="text-xs text-amber-400 shrink-0">Link</span>
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() => createPersonAndRelationship(null)}
                  variant="ghost"
                  disabled={saving}
                  className="w-full text-slate-400 hover:text-slate-200 text-xs mt-1"
                >
                  {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                  Not a match - add as new person
                </Button>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!firstName.trim() || !lastName.trim() || saving || checkingDuplicates}
              className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</>
              ) : checkingDuplicates ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking...</>
              ) : (
                <><UserPlus className="w-4 h-4 mr-2" />Add {relLabel}</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
