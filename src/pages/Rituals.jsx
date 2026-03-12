import React, { useState } from "react";
import ParentalGate from "@/components/ParentalGate";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Calendar,
  Plus,
  Users,
  RotateCcw,
  Edit,
  Trash2,
  Flame
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const frequencyLabels = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  annually: 'Annually',
  custom: 'Custom'
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function Rituals() {
  const [showRitualForm, setShowRitualForm] = useState(false);
  const [editingRitual, setEditingRitual] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: rituals = [], isLoading } = useQuery({
    queryKey: ['rituals'],
    queryFn: () => base44.entities.Ritual.list(),
  });

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  const { data: households = [] } = useQuery({
    queryKey: ['households'],
    queryFn: () => base44.entities.Household.list(),
  });

  const deleteRitual = useMutation({
    mutationFn: (id) => base44.entities.Ritual.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['rituals']),
  });

  const getPersonName = (personId) => {
    const person = people.find(p => p.id === personId);
    return person?.name || "Unknown";
  };

  const getHouseholdName = (householdId) => {
    const household = households.find(h => h.id === householdId);
    return household?.name || "Unknown";
  };

  const getCurrentHost = (ritual) => {
    if (!ritual.host_rotation?.length) return null;
    const index = ritual.current_host_index || 0;
    const personId = ritual.host_rotation[index % ritual.host_rotation.length];
    return getPersonName(personId);
  };

  const getNextHost = (ritual) => {
    if (!ritual.host_rotation?.length || ritual.host_rotation.length < 2) return null;
    const nextIndex = ((ritual.current_host_index || 0) + 1) % ritual.host_rotation.length;
    const personId = ritual.host_rotation[nextIndex];
    return getPersonName(personId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (<ParentalGate featureKey="traditions">
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Flame className="w-6 h-6 text-amber-400" />
            Traditions
          </h1>
          <p className="text-slate-500 mt-1">The practices that make your family unique</p>
        </div>
        
        <Button 
          onClick={() => setShowRitualForm(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Tradition
        </Button>
      </div>

      {/* Rituals Grid */}
      {rituals.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-6">
          {rituals.map((ritual) => {
            const currentHost = getCurrentHost(ritual);
            const nextHost = getNextHost(ritual);
            
            return (
              <div 
                key={ritual.id}
                className="glass-card rounded-2xl overflow-hidden group"
              >
                {/* Cover */}
                <div className="relative h-40 bg-gradient-to-br from-purple-900/50 to-indigo-900/50">
                  {ritual.cover_image_url ? (
                    <img 
                      src={ritual.cover_image_url} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Calendar className="w-16 h-16 text-purple-500/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent" />
                  
                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="absolute top-3 right-3 bg-black/30 text-white hover:bg-black/50 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                      <DropdownMenuItem 
                        onClick={() => {
                          setEditingRitual(ritual);
                          setShowRitualForm(true);
                        }}
                        className="text-slate-200 focus:bg-slate-700"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => deleteRitual.mutate(ritual.id)}
                        className="text-red-400 focus:bg-slate-700 focus:text-red-400"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {/* Title */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-xl font-semibold text-white">{ritual.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-purple-500/30 text-purple-300 border border-purple-500/40">
                        <Calendar className="w-3 h-3 mr-1" />
                        {frequencyLabels[ritual.frequency]}
                      </Badge>
                      {ritual.typical_month && (
                        <Badge className="bg-slate-700/50 text-slate-300 border border-slate-600">
                          {monthNames[ritual.typical_month - 1]}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-5">
                  {ritual.description && (
                    <p className="text-slate-400 text-sm mb-4 line-clamp-2">{ritual.description}</p>
                  )}
                  
                  {/* Host Rotation */}
                  {ritual.host_rotation?.length > 0 && (
                    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide mb-2">
                        <RotateCcw className="w-3 h-3" />
                        Host Rotation
                      </div>
                      <div className="space-y-1">
                        {currentHost && (
                          <p className="text-sm">
                            <span className="text-slate-500">This year:</span>{' '}
                            <span className="text-amber-400 font-medium">{currentHost}</span>
                          </p>
                        )}
                        {nextHost && (
                          <p className="text-sm">
                            <span className="text-slate-500">Next:</span>{' '}
                            <span className="text-slate-300">{nextHost}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Participating Galaxies */}
                  {ritual.typical_participant_household_ids?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {ritual.typical_participant_household_ids.map(hId => (
                        <Badge key={hId} variant="outline" className="border-slate-700 text-slate-400">
                          <Users className="w-3 h-3 mr-1" />
                          {getHouseholdName(hId)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Calendar className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-200 mb-2">Start Your Family Traditions</h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Document the traditions that bring your family together – from annual reunions to weekly calls.
          </p>
          <Button 
            onClick={() => setShowRitualForm(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add First Tradition
          </Button>
        </div>
      )}

      {/* Ritual Form Dialog */}
      <Dialog open={showRitualForm || !!editingRitual} onOpenChange={(open) => {
        if (!open) {
          setShowRitualForm(false);
          setEditingRitual(null);
        }
      }}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {editingRitual ? 'Edit Tradition' : 'Add New Tradition'}
            </DialogTitle>
          </DialogHeader>
          <RitualForm 
            ritual={editingRitual}
            people={people}
            households={households}
            onSuccess={() => {
              setShowRitualForm(false);
              setEditingRitual(null);
              queryClient.invalidateQueries(['rituals']);
            }}
            onCancel={() => {
              setShowRitualForm(false);
              setEditingRitual(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  </ParentalGate>);
}

function RitualForm({ ritual, people, households, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    name: ritual?.name || "",
    description: ritual?.description || "",
    frequency: ritual?.frequency || "annually",
    custom_frequency: ritual?.custom_frequency || "",
    typical_month: ritual?.typical_month || "",
    typical_participant_household_ids: ritual?.typical_participant_household_ids || [],
    host_rotation: ritual?.host_rotation || [],
    current_host_index: ritual?.current_host_index || 0,
    cover_image_url: ritual?.cover_image_url || "",
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dataToSave = {
      ...formData,
      typical_month: formData.typical_month ? Number(formData.typical_month) : null,
      current_host_index: Number(formData.current_host_index) || 0,
    };

    if (ritual?.id) {
      await base44.entities.Ritual.update(ritual.id, dataToSave);
    } else {
      await base44.entities.Ritual.create(dataToSave);
    }

    setLoading(false);
    onSuccess();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFormData({ ...formData, cover_image_url: file_url });
    setUploading(false);
  };

  const adultPeople = people.filter(p => p.role_type === 'adult');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label className="text-slate-300">Tradition Name *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="e.g., Thanksgiving Dinner, Weekly Family Call"
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Story & Meaning</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="What makes this tradition special? How did it start?"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Frequency *</Label>
          <Select value={formData.frequency} onValueChange={(value) => setFormData({ ...formData, frequency: value })}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="annually">Annually</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {formData.frequency === 'annually' && (
          <div className="space-y-2">
            <Label className="text-slate-300">Typical Month</Label>
            <Select 
              value={formData.typical_month?.toString() || ""} 
              onValueChange={(value) => setFormData({ ...formData, typical_month: value })}
            >
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {monthNames.map((month, i) => (
                  <SelectItem key={i} value={(i + 1).toString()}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {formData.frequency === 'custom' && (
        <div className="space-y-2">
          <Label className="text-slate-300">Custom Frequency</Label>
          <Input
            value={formData.custom_frequency}
            onChange={(e) => setFormData({ ...formData, custom_frequency: e.target.value })}
            className="bg-slate-800 border-slate-700 text-slate-100"
            placeholder="e.g., Every other month, First Sunday of each season"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-slate-300">Participating Galaxies</Label>
        <Select 
          value="" 
          onValueChange={(value) => {
            if (!formData.typical_participant_household_ids.includes(value)) {
              setFormData({ 
                ...formData, 
                typical_participant_household_ids: [...formData.typical_participant_household_ids, value] 
              });
            }
          }}
        >
          <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
            <SelectValue placeholder="Add household" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            {households.filter(h => !formData.typical_participant_household_ids.includes(h.id)).map(h => (
              <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2 mt-2">
          {formData.typical_participant_household_ids.map(hId => {
            const household = households.find(h => h.id === hId);
            return (
              <Badge key={hId} className="bg-slate-700 text-slate-300">
                {household?.name}
                <button 
                  type="button" 
                  onClick={() => setFormData({
                    ...formData,
                    typical_participant_household_ids: formData.typical_participant_household_ids.filter(id => id !== hId)
                  })}
                  className="ml-1"
                >
                  ×
                </button>
              </Badge>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Host Rotation (order)</Label>
        <Select 
          value="" 
          onValueChange={(value) => {
            if (!formData.host_rotation.includes(value)) {
              setFormData({ 
                ...formData, 
                host_rotation: [...formData.host_rotation, value] 
              });
            }
          }}
        >
          <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
            <SelectValue placeholder="Add to rotation" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            {adultPeople.filter(p => !formData.host_rotation.includes(p.id)).map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2 mt-2">
          {formData.host_rotation.map((pId, index) => {
            const person = people.find(p => p.id === pId);
            return (
              <Badge 
                key={pId} 
                className={cn(
                  "border",
                  index === formData.current_host_index 
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30" 
                    : "bg-slate-700 text-slate-300 border-slate-600"
                )}
              >
                {index + 1}. {person?.name}
                <button 
                  type="button" 
                  onClick={() => setFormData({
                    ...formData,
                    host_rotation: formData.host_rotation.filter(id => id !== pId)
                  })}
                  className="ml-1"
                >
                  ×
                </button>
              </Badge>
            );
          })}
        </div>
        {formData.host_rotation.length > 0 && (
          <p className="text-xs text-slate-500">The highlighted name is the current host</p>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-700">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-slate-400">
          Cancel
        </Button>
        <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900" disabled={loading}>
          {loading ? "Saving..." : (ritual ? "Update Tradition" : "Create Tradition")}
        </Button>
      </div>
    </form>
  );
}