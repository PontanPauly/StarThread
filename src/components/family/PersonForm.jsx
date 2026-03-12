import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { X, Plus, AlertCircle, Upload, Sparkles, User, Star, Search, Check } from "lucide-react";
import StarEditor from "./StarEditor";
import { DEFAULT_STAR_PROFILE } from "@/lib/starConfig";

function PersonSearchPicker({ people, excludeIds = [], onSelect, placeholder = "Search people..." }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = people.filter(p =>
    !excludeIds.includes(p.id) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-start bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200 font-normal"
        >
          <Search className="w-4 h-4 mr-2 flex-shrink-0" />
          {placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-slate-800 border-slate-700" align="start">
        <Command className="bg-slate-800" shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
            className="text-slate-100"
          />
          <CommandList className="max-h-48">
            <CommandEmpty className="py-3 text-center text-sm text-slate-500">No one found</CommandEmpty>
            {filtered.map(p => (
              <CommandItem
                key={p.id}
                value={p.id}
                onSelect={() => {
                  onSelect(p.id);
                  setSearch("");
                  setOpen(false);
                }}
                className="text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                <User className="w-4 h-4 mr-2 text-slate-400" />
                {p.name}
                {p.role_type && <span className="ml-auto text-xs text-slate-500 capitalize">{p.role_type}</span>}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
import { useToast } from "@/components/ui/use-toast";

function getAgeFromBirthDate(birthDate) {
  if (!birthDate) return null;
  const bd = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  const m = now.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
  return age;
}

function getRoleFromAge(age) {
  if (age === null) return null;
  if (age >= 18) return 'adult';
  if (age >= 13) return 'teen';
  return 'child';
}

export default function PersonForm({ person, households, people, onSuccess, onCancel, defaultAsChild, parentPersonId }) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const defaultRole = defaultAsChild ? 'child' : (person?.birth_date && person?.role_type !== 'ancestor'
    ? getRoleFromAge(getAgeFromBirthDate(person.birth_date)) || person?.role_type
    : person?.role_type) || 'adult';
  const parentPerson = parentPersonId ? people?.find(p => p.id === parentPersonId) : null;
  const [formData, setFormData] = useState({
    first_name: person?.first_name || "",
    middle_name: person?.middle_name || "",
    last_name: person?.last_name || "",
    nickname: person?.nickname || "",
    birth_date: person?.birth_date ? person.birth_date.split('T')[0] : "",
    role_type: defaultRole,
    is_deceased: person?.is_deceased || false,
    death_date: person?.death_date || "",
    household_id: person?.household_id || (defaultAsChild && parentPerson?.household_id ? parentPerson.household_id : ""),
    guardian_ids: person?.guardian_ids || (defaultAsChild && parentPersonId ? [parentPersonId] : []),
    photo_url: person?.photo_url || "",
    allergies: person?.allergies || [],
    dietary_preferences: person?.dietary_preferences || [],
    medical_notes: person?.medical_notes || "",
    about: person?.about || "",
    star_pattern: person?.star_pattern || "classic",
    star_intensity: person?.star_intensity || 5,
    star_flare_count: person?.star_flare_count || 8,
    star_profile: person?.star_profile || { ...DEFAULT_STAR_PROFILE },
  });
  
  const [newAllergy, setNewAllergy] = useState("");
  const [newDietPref, setNewDietPref] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const markDirty = () => { if (!isDirty) setIsDirty(true); };
  const handleFormChange = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
    markDirty();
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      onCancel();
    }
  };

  // Relationship state
  const [parentIds, setParentIds] = useState(defaultAsChild && parentPersonId ? [parentPersonId] : []);
  const [partnerId, setPartnerId] = useState("");
  const [childrenIds, setChildrenIds] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [additionalRelationships, setAdditionalRelationships] = useState([]);
  const [newRelType, setNewRelType] = useState("");

  // Load relationships when editing
  React.useEffect(() => {
    if (person?.id) {
      loadRelationships();
    }
  }, [person?.id]);

  React.useEffect(() => {
    if (defaultAsChild && parentPersonId && !person?.id) {
      inferRelationshipsFromParent(parentPersonId);
    }
  }, [defaultAsChild, parentPersonId]);

  const inferRelationshipsFromParent = async (parentId) => {
    try {
      const parentRels1 = await base44.entities.Relationship.filter({ person_id: parentId });
      const parentRels2 = await base44.entities.Relationship.filter({ related_person_id: parentId });
      const parentAllRels = [...parentRels1, ...parentRels2];

      const inferredMap = new Map();
      const addedParents = [parentId];

      const addInferred = (type, personId) => {
        const key = `${type}:${personId}`;
        if (!inferredMap.has(key)) {
          inferredMap.set(key, { type, personId });
        }
      };

      for (const rel of parentAllRels) {
        const otherPersonId = rel.person_id === parentId ? rel.related_person_id : rel.person_id;
        const relType = rel.relationship_type;

        if (relType === 'partner' || relType === 'spouse') {
          if (!addedParents.includes(otherPersonId)) {
            addedParents.push(otherPersonId);
          }
        } else if (relType === 'parent') {
          if (rel.person_id === parentId) {
            addInferred('sibling', rel.related_person_id);
          }
        } else if (relType === 'child') {
          if (rel.person_id === parentId) {
            addInferred('grandparent', rel.related_person_id);
          } else if (rel.related_person_id === parentId) {
            addInferred('sibling', rel.person_id);
          }
        } else if (relType === 'grandparent') {
          addInferred('grandparent', otherPersonId);
        } else if (relType === 'sibling') {
          addInferred('aunt_uncle', otherPersonId);
        }
      }

      setParentIds(addedParents);
      setFormData(prev => ({ ...prev, guardian_ids: addedParents }));
      setAdditionalRelationships([...inferredMap.values()]);
    } catch (err) {
      console.error('Failed to infer relationships:', err);
    }
  };

  const CORE_TYPES = ['parent', 'child', 'partner', 'spouse'];

  const CLIENT_RECIPROCALS = {
    parent: 'child', child: 'parent',
    sibling: 'sibling', spouse: 'spouse',
    grandparent: 'grandchild', grandchild: 'grandparent',
    aunt_uncle: 'niece_nephew', niece_nephew: 'aunt_uncle',
    cousin: 'cousin', in_law: 'in_law',
    step_parent: 'step_child', step_child: 'step_parent',
    step_sibling: 'step_sibling',
    chosen_family: 'chosen_family', extended: 'extended',
  };
  const EXTENDED_RELATIONSHIP_TYPES = [
    { value: 'sibling', label: 'Sibling', group: 'Direct Family' },
    { value: 'spouse', label: 'Spouse', group: 'Direct Family' },
    { value: 'grandparent', label: 'Grandparent', group: 'Extended Family' },
    { value: 'grandchild', label: 'Grandchild', group: 'Extended Family' },
    { value: 'aunt_uncle', label: 'Aunt/Uncle', group: 'Extended Family' },
    { value: 'niece_nephew', label: 'Niece/Nephew', group: 'Extended Family' },
    { value: 'cousin', label: 'Cousin', group: 'Extended Family' },
    { value: 'in_law', label: 'In-Law', group: 'Extended Family' },
    { value: 'step_parent', label: 'Step-Parent', group: 'Blended Family' },
    { value: 'step_child', label: 'Step-Child', group: 'Blended Family' },
    { value: 'step_sibling', label: 'Step-Sibling', group: 'Blended Family' },
    { value: 'chosen_family', label: 'Chosen Family', group: 'Chosen Family' },
    { value: 'extended', label: 'Extended', group: 'Chosen Family' },
  ];

  const loadRelationships = async () => {
    const rels = await base44.entities.Relationship.filter({ person_id: person.id });
    const rels2 = await base44.entities.Relationship.filter({ related_person_id: person.id });
    const allRels = [...rels, ...rels2];
    setRelationships(allRels);

    const parents = rels2.filter(r => r.relationship_type === 'parent').map(r => r.person_id);
    setParentIds(parents);

    const partner = rels.find(r => r.relationship_type === 'partner');
    if (partner) setPartnerId(partner.related_person_id);

    const children = rels.filter(r => r.relationship_type === 'parent').map(r => r.related_person_id);
    setChildrenIds(children);

    const additional = allRels.filter(r => !CORE_TYPES.includes(r.relationship_type)).map(r => ({
      id: r.id,
      type: r.relationship_type,
      personId: r.person_id === person.id ? r.related_person_id : r.person_id,
      direction: r.person_id === person.id ? 'outgoing' : 'incoming',
    }));
    setAdditionalRelationships(additional);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSave = {
        ...formData,
        birth_date: formData.birth_date || null,
        death_date: formData.death_date || null,
      };

      let personId = person?.id;
      try {
        if (person?.id) {
          await base44.entities.Person.update(person.id, dataToSave);
        } else {
          const newPerson = await base44.entities.Person.create(dataToSave);
          personId = newPerson.id;
        }
      } catch (err) {
        console.error('Failed to save person:', err);
        toast({ title: "Saving person failed", description: err?.message || "Unknown error", variant: "destructive" });
        return;
      }

      if (personId) {
        try {
          await saveRelationships(personId);
          await saveAdditionalRelationships(personId);
        } catch (err) {
          console.error('Failed to save relationships:', err);
          toast({ title: "Saving relationships failed", description: err?.message || "Unknown error", variant: "destructive" });
          return;
        }
      }

      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const saveRelationships = async (personId) => {
    const existing = await base44.entities.Relationship.filter({ person_id: personId });
    const existing2 = await base44.entities.Relationship.filter({ related_person_id: personId });
    const allExisting = [...existing, ...existing2];

    for (const parentId of parentIds) {
      if (parentId === personId) {
        throw new Error('A person cannot be their own parent');
      }
    }

    const existingParents = allExisting.filter(r => r.relationship_type === 'parent' && r.related_person_id === personId);
    const existingParentIds = existingParents.map(r => r.person_id);

    for (const parentId of existingParentIds) {
      if (!parentIds.includes(parentId)) {
        // Delete parent→child direction
        const rel = existingParents.find(r => r.person_id === parentId);
        if (rel) await base44.entities.Relationship.delete(rel.id);
        // Delete child→parent reciprocal
        const reciprocal = await base44.entities.Relationship.filter({
          person_id: personId,
          related_person_id: parentId,
        });
        const childRel = reciprocal.find(r => r.relationship_type === 'child');
        if (childRel) await base44.entities.Relationship.delete(childRel.id);
      }
    }

    for (const parentId of parentIds) {
      if (!existingParentIds.includes(parentId)) {
        // Create parent→child direction
        await base44.entities.Relationship.create({
          person_id: parentId,
          related_person_id: personId,
          relationship_type: 'parent',
          status_from_person: 'confirmed',
          status_from_related: 'confirmed',
        });
        // Create child→parent reciprocal so child sees parent in galaxy
        const existing = await base44.entities.Relationship.filter({
          person_id: personId,
          related_person_id: parentId,
        });
        if (!existing.find(r => r.relationship_type === 'child')) {
          await base44.entities.Relationship.create({
            person_id: personId,
            related_person_id: parentId,
            relationship_type: 'child',
            status_from_person: 'confirmed',
            status_from_related: 'confirmed',
          });
        }
      }
    }

    const existingPartner = allExisting.find(r => r.relationship_type === 'partner' && 
      (r.person_id === personId || r.related_person_id === personId));

    if (existingPartner && !partnerId) {
      await base44.entities.Relationship.delete(existingPartner.id);
      const reverseRel = await base44.entities.Relationship.filter({ 
        person_id: existingPartner.related_person_id === personId ? existingPartner.person_id : existingPartner.related_person_id,
        related_person_id: personId,
        relationship_type: 'partner'
      });
      if (reverseRel[0]) await base44.entities.Relationship.delete(reverseRel[0].id);
    } else if (partnerId && (!existingPartner || 
      (existingPartner.person_id !== partnerId && existingPartner.related_person_id !== partnerId))) {
      if (existingPartner) {
        await base44.entities.Relationship.delete(existingPartner.id);
        const reverseRel = await base44.entities.Relationship.filter({ 
          person_id: existingPartner.related_person_id === personId ? existingPartner.person_id : existingPartner.related_person_id,
          related_person_id: personId,
          relationship_type: 'partner'
        });
        if (reverseRel[0]) await base44.entities.Relationship.delete(reverseRel[0].id);
      }
      await base44.entities.Relationship.create({
        person_id: personId,
        related_person_id: partnerId,
        relationship_type: 'partner',
        status_from_person: 'confirmed',
        status_from_related: 'confirmed',
      });
      await base44.entities.Relationship.create({
        person_id: partnerId,
        related_person_id: personId,
        relationship_type: 'partner',
        status_from_person: 'confirmed',
        status_from_related: 'confirmed',
      });
    }
  };

  const addParent = (parentId) => {
    if (!parentIds.includes(parentId) && parentId !== person?.id) {
      setParentIds([...parentIds, parentId]);
      markDirty();
    }
  };

  const removeParent = (parentId) => {
    setParentIds(parentIds.filter(id => id !== parentId));
    markDirty();
  };

  const addChild = async (childId) => {
    if (person?.id && childId !== person.id) {
      await base44.entities.Relationship.create({
        person_id: person.id,
        related_person_id: childId,
        relationship_type: 'parent',
        status_from_person: 'confirmed',
        status_from_related: 'confirmed',
      });
      // Reciprocal: child sees parent in their galaxy
      const existing = await base44.entities.Relationship.filter({
        person_id: childId,
        related_person_id: person.id,
      });
      if (!existing.find(r => r.relationship_type === 'child')) {
        await base44.entities.Relationship.create({
          person_id: childId,
          related_person_id: person.id,
          relationship_type: 'child',
          status_from_person: 'confirmed',
          status_from_related: 'confirmed',
        });
      }
      await loadRelationships();
    }
  };

  const saveAdditionalRelationships = async (personId) => {
    const existing = await base44.entities.Relationship.filter({ person_id: personId });
    const existing2 = await base44.entities.Relationship.filter({ related_person_id: personId });
    const allExisting = [...existing, ...existing2];
    const existingAdditional = allExisting.filter(r => !CORE_TYPES.includes(r.relationship_type));

    const currentIds = new Set(additionalRelationships.filter(r => r.id).map(r => r.id));

    // Delete removed relationships + their reciprocals
    for (const rel of existingAdditional) {
      if (!currentIds.has(rel.id)) {
        await base44.entities.Relationship.delete(rel.id);
        // Also delete the reciprocal direction
        const reciprocalType = CLIENT_RECIPROCALS[rel.relationship_type] || rel.relationship_type;
        const recipSide = rel.person_id === personId ? rel.related_person_id : rel.person_id;
        const reciprocals = await base44.entities.Relationship.filter({
          person_id: recipSide,
          related_person_id: rel.person_id === personId ? personId : rel.related_person_id,
        });
        const recipRel = reciprocals.find(r => r.relationship_type === reciprocalType);
        if (recipRel) await base44.entities.Relationship.delete(recipRel.id);
      }
    }

    // Create new relationships + reciprocals
    const refreshed = await base44.entities.Relationship.filter({ person_id: personId });
    const refreshed2 = await base44.entities.Relationship.filter({ related_person_id: personId });
    const allRefreshed = [...refreshed, ...refreshed2];

    for (const rel of additionalRelationships) {
      if (!rel.id) {
        const alreadyExists = allRefreshed.find(r =>
          r.relationship_type === rel.type &&
          ((r.person_id === personId && r.related_person_id === rel.personId) ||
           (r.related_person_id === personId && r.person_id === rel.personId))
        );
        if (!alreadyExists) {
          await base44.entities.Relationship.create({
            person_id: personId,
            related_person_id: rel.personId,
            relationship_type: rel.type,
            status_from_person: 'confirmed',
            status_from_related: 'confirmed',
          });
        }
        const reciprocalType = CLIENT_RECIPROCALS[rel.type] || rel.type;
        const reciprocals = await base44.entities.Relationship.filter({
          person_id: rel.personId,
          related_person_id: personId,
        });
        if (!reciprocals.find(r => r.relationship_type === reciprocalType)) {
          await base44.entities.Relationship.create({
            person_id: rel.personId,
            related_person_id: personId,
            relationship_type: reciprocalType,
            status_from_person: 'confirmed',
            status_from_related: 'confirmed',
          });
        }
      }
    }
  };

  const addAdditionalRelationship = (type, personId) => {
    if (personId === person?.id) return;
    const alreadyExists = additionalRelationships.some(
      r => r.personId === personId && r.type === type
    );
    if (alreadyExists) return;
    setAdditionalRelationships([...additionalRelationships, { type, personId, direction: 'outgoing' }]);
    markDirty();
  };

  const removeAdditionalRelationship = (index) => {
    setAdditionalRelationships(additionalRelationships.filter((_, i) => i !== index));
    markDirty();
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, photo_url: file_url });
    } catch (err) {
      console.error('Photo upload failed:', err);
      toast({ title: "Photo upload failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const addAllergy = () => {
    if (newAllergy.trim()) {
      setFormData({
        ...formData,
        allergies: [...formData.allergies, newAllergy.trim()]
      });
      setNewAllergy("");
    }
  };

  const removeAllergy = (index) => {
    setFormData({
      ...formData,
      allergies: formData.allergies.filter((_, i) => i !== index)
    });
  };

  const addDietPref = () => {
    if (newDietPref.trim()) {
      setFormData({
        ...formData,
        dietary_preferences: [...formData.dietary_preferences, newDietPref.trim()]
      });
      setNewDietPref("");
    }
  };

  const removeDietPref = (index) => {
    setFormData({
      ...formData,
      dietary_preferences: formData.dietary_preferences.filter((_, i) => i !== index)
    });
  };

  const adultPeople = people.filter(p => p.role_type === 'adult' && p.id !== person?.id);

  return (
    <form onSubmit={handleSubmit} onChange={markDirty} className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
          <TabsTrigger value="details" className="data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100">
            <User className="w-4 h-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="star" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
            <Star className="w-4 h-4 mr-2" />
            Customize Star
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6 mt-6">
      {/* Photo */}
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-slate-700">
          {formData.photo_url ? (
            <img src={formData.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl text-slate-500">{formData.first_name?.charAt(0) || "?"}</span>
          )}
        </div>
        <div>
          <input 
            ref={inputRef}
            type="file" 
            accept="image/*" 
            onChange={handlePhotoUpload} 
            className="hidden" 
          />
          <Button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            variant="ghost" 
            size="sm" 
            className="bg-slate-700 border border-amber-500/50 text-slate-100 hover:bg-amber-500/20 hover:border-amber-500" 
            disabled={uploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Uploading..." : "Upload Photo"}
          </Button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label className="text-slate-300">First Name *</Label>
          <Input
            value={formData.first_name}
            onChange={(e) => { handleFormChange({ first_name: e.target.value }); }}
            className="bg-slate-800 border-slate-700 text-slate-100"
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Middle Name</Label>
          <Input
            value={formData.middle_name}
            onChange={(e) => { handleFormChange({ middle_name: e.target.value }); }}
            className="bg-slate-800 border-slate-700 text-slate-100"
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Last Name *</Label>
          <Input
            value={formData.last_name}
            onChange={(e) => { handleFormChange({ last_name: e.target.value }); }}
            className="bg-slate-800 border-slate-700 text-slate-100"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Nickname</Label>
          <Input
            value={formData.nickname}
            onChange={(e) => { handleFormChange({ nickname: e.target.value }); }}
            className="bg-slate-800 border-slate-700 text-slate-100"
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">
            Role Type *
            {formData.birth_date && formData.role_type !== 'ancestor' && (
              <span className="text-xs text-slate-500 ml-2">(auto from age)</span>
            )}
          </Label>
          <Select
            value={formData.role_type}
            onValueChange={(value) => { setFormData({ ...formData, role_type: value }); markDirty(); }}
            disabled={!!formData.birth_date && formData.role_type !== 'ancestor'}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="adult">Adult (18+)</SelectItem>
              <SelectItem value="teen">Teen (13–17)</SelectItem>
              <SelectItem value="child">Child (under 13)</SelectItem>
              <SelectItem value="ancestor">Ancestor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Galaxy</Label>
          <Select 
            value={formData.household_id || "none"} 
            onValueChange={(value) => { setFormData({ ...formData, household_id: value === "none" ? "" : value }); markDirty(); }}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue placeholder="Select galaxy" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="none">No galaxy</SelectItem>
              {households.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Birth Date</Label>
          <Input
            type="date"
            value={formData.birth_date}
            onChange={(e) => {
              const newDate = e.target.value;
              const age = getAgeFromBirthDate(newDate);
              const autoRole = getRoleFromAge(age);
              setFormData({
                ...formData,
                birth_date: newDate,
                ...(autoRole && formData.role_type !== 'ancestor' ? { role_type: autoRole } : {}),
              });
            }}
            className="bg-slate-800 border-slate-700 text-slate-100"
          />
        </div>
      </div>

      {/* Deceased toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
        <div>
          <Label className="text-slate-300">Deceased</Label>
          <p className="text-sm text-slate-500">Mark if this person has passed away</p>
        </div>
        <Switch
          checked={formData.is_deceased}
          onCheckedChange={(checked) => { setFormData({ ...formData, is_deceased: checked }); markDirty(); }}
        />
      </div>

      {formData.is_deceased && (
        <div className="space-y-2">
          <Label className="text-slate-300">Date of Passing</Label>
          <Input
            type="date"
            value={formData.death_date}
            onChange={(e) => setFormData({ ...formData, death_date: e.target.value })}
            className="bg-slate-800 border-slate-700 text-slate-100"
          />
        </div>
      )}

      {/* Guardians for children/teens */}
      {(formData.role_type === 'child' || formData.role_type === 'teen') && (
        <div className="space-y-2">
          <Label className="text-slate-300">Guardian(s)</Label>
          <PersonSearchPicker
            people={adultPeople}
            excludeIds={formData.guardian_ids}
            onSelect={(id) => {
              if (!formData.guardian_ids.includes(id)) {
                setFormData({ ...formData, guardian_ids: [...formData.guardian_ids, id] });
                markDirty();
              }
            }}
            placeholder="Search for a guardian..."
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.guardian_ids.map((gId) => {
              const guardian = people.find(p => p.id === gId);
              return (
                <Badge key={gId} className="bg-slate-700 text-slate-200">
                  {guardian?.name || gId}
                  <button type="button" onClick={() => setFormData({
                    ...formData,
                    guardian_ids: formData.guardian_ids.filter(id => id !== gId)
                  })}>
                    <X className="w-3 h-3 ml-1" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Allergies */}
      <div className="space-y-2">
        <Label className="text-slate-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          Allergies
        </Label>
        <div className="flex gap-2">
          <Input
            value={newAllergy}
            onChange={(e) => setNewAllergy(e.target.value)}
            placeholder="Add allergy"
            className="bg-slate-800 border-slate-700 text-slate-100"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAllergy())}
          />
          <Button type="button" onClick={addAllergy} variant="outline" className="border-slate-700">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.allergies.map((allergy, i) => (
            <Badge key={i} className="bg-red-500/20 text-red-400 border border-red-500/30">
              {allergy}
              <button type="button" onClick={() => removeAllergy(i)}>
                <X className="w-3 h-3 ml-1" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Dietary Preferences */}
      <div className="space-y-2">
        <Label className="text-slate-300">Dietary Preferences</Label>
        <div className="flex gap-2">
          <Input
            value={newDietPref}
            onChange={(e) => setNewDietPref(e.target.value)}
            placeholder="e.g., Vegetarian, Kosher"
            className="bg-slate-800 border-slate-700 text-slate-100"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDietPref())}
          />
          <Button type="button" onClick={addDietPref} variant="outline" className="border-slate-700">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.dietary_preferences.map((pref, i) => (
            <Badge key={i} className="bg-slate-700 text-slate-300">
              {pref}
              <button type="button" onClick={() => removeDietPref(i)}>
                <X className="w-3 h-3 ml-1" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Medical Notes */}
      <div className="space-y-2">
        <Label className="text-slate-300">Medical Notes</Label>
        <Textarea
          value={formData.medical_notes}
          onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="Private medical information"
          rows={2}
        />
      </div>

      {/* About */}
      <div className="space-y-2">
        <Label className="text-slate-300">About</Label>
        <Textarea
          value={formData.about}
          onChange={(e) => setFormData({ ...formData, about: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="A few words about this person..."
          rows={3}
        />
      </div>

      {/* Family Links */}
      <div className="space-y-4 pt-4 border-t border-slate-700">
        <Label className="text-slate-300 text-base font-semibold">Family Links</Label>

        {/* Parents */}
        <div className="space-y-2">
          <Label className="text-slate-300">Parents</Label>
          <PersonSearchPicker
            people={people.filter(p => p.role_type === 'adult' && p.id !== person?.id)}
            excludeIds={parentIds}
            onSelect={addParent}
            placeholder="Search for a parent..."
          />
          <div className="flex flex-wrap gap-2">
            {parentIds.map(pId => {
              const parent = people.find(p => p.id === pId);
              return (
                <Badge key={pId} className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  {parent?.name || pId}
                  <button type="button" onClick={() => removeParent(pId)} className="ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Partner */}
        {formData.role_type === 'adult' && (
          <div className="space-y-2">
            <Label className="text-slate-300">Partner</Label>
            <Select value={partnerId || "none"} onValueChange={(val) => { setPartnerId(val === "none" ? "" : val); markDirty(); }}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue placeholder="Select partner" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="none">No partner</SelectItem>
                {people.filter(p => p.role_type === 'adult' && p.id !== person?.id).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Children */}
        {(formData.role_type === 'adult' && person?.id) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300">Children</Label>
              <Select value="" onValueChange={addChild}>
                <SelectTrigger className="w-32 h-8 text-xs bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue placeholder="Add child" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {people.filter(p => 
                    p.id !== person.id && 
                    !childrenIds.includes(p.id)
                  ).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {childrenIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {childrenIds.map(cId => {
                  const child = people.find(p => p.id === cId);
                  return (
                    <Badge key={cId} className="bg-green-500/20 text-green-400 border-green-500/30">
                      {child?.name || cId}
                    </Badge>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No children linked yet</p>
            )}
          </div>
        )}

        {/* Additional Relationships */}
        <div className="space-y-3">
          <Label className="text-slate-300">Additional Relationships</Label>
          <div className="grid grid-cols-2 gap-2">
            <Select value={newRelType} onValueChange={(val) => setNewRelType(val)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue placeholder="Relationship type" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {['Direct Family', 'Extended Family', 'Blended Family', 'Chosen Family'].map(group => (
                  <React.Fragment key={group}>
                    <SelectItem value={`__group_${group}`} disabled className="text-xs text-slate-500 font-semibold">
                      {group}
                    </SelectItem>
                    {EXTENDED_RELATIONSHIP_TYPES.filter(t => t.group === group).map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
            <PersonSearchPicker
              people={people.filter(p => p.id !== person?.id)}
              excludeIds={[]}
              onSelect={(personId) => {
                if (!newRelType || newRelType.startsWith('__group_')) {
                  toast({ title: "Select a relationship type first", variant: "destructive" });
                  return;
                }
                addAdditionalRelationship(newRelType, personId);
                setNewRelType("");
              }}
              placeholder={newRelType && !newRelType.startsWith('__group_') ? "Search person..." : "Pick type first..."}
            />
          </div>
          {additionalRelationships.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {additionalRelationships.map((rel, i) => {
                const relPerson = people.find(p => p.id === rel.personId);
                const typeLabel = EXTENDED_RELATIONSHIP_TYPES.find(t => t.value === rel.type)?.label || rel.type;
                return (
                  <Badge key={i} className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    {typeLabel}: {relPerson?.name || rel.personId}
                    <button type="button" onClick={() => removeAdditionalRelationship(i)} className="ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Warning for children without parents */}
        {(formData.role_type === 'child' || formData.role_type === 'teen') && parentIds.length === 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-400">This {formData.role_type} has no parents linked yet.</p>
          </div>
        )}
      </div>

        </TabsContent>

        <TabsContent value="star" className="mt-6">
          <StarEditor
            value={formData.star_profile}
            onChange={(starProfile) => { setFormData({ ...formData, star_profile: starProfile }); markDirty(); }}
          />
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-700">
        <Button type="button" variant="ghost" onClick={handleCancel} className="text-slate-400">
          Cancel
        </Button>
        <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900" disabled={loading}>
          {loading ? "Saving..." : (person ? "Update Person" : "Add Person")}
        </Button>
      </div>

      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Discard Changes?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-400">You have unsaved changes. Are you sure you want to discard them?</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowDiscardDialog(false)} className="text-slate-400">
              Keep Editing
            </Button>
            <Button variant="destructive" onClick={() => { setShowDiscardDialog(false); onCancel(); }}>
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}