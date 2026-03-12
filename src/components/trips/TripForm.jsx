import React, { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { X, Upload, Users } from "lucide-react";

export default function TripForm({ trip, people, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    name: trip?.name || "",
    location: trip?.location || "",
    start_date: trip?.start_date || "",
    end_date: trip?.end_date || "",
    description: trip?.description || "",
    cover_image_url: trip?.cover_image_url || "",
    planner_ids: trip?.planner_ids || [],
    visibility: trip?.visibility || "family_wide",
    status: trip?.status || "planning",
  });
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (trip?.id) {
      await base44.entities.Trip.update(trip.id, formData);
    } else {
      await base44.entities.Trip.create(formData);
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

  const addPlanner = (personId) => {
    if (!formData.planner_ids.includes(personId)) {
      setFormData({ ...formData, planner_ids: [...formData.planner_ids, personId] });
    }
  };

  const removePlanner = (personId) => {
    setFormData({ 
      ...formData, 
      planner_ids: formData.planner_ids.filter(id => id !== personId) 
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Cover Image */}
      <div>
        <Label className="text-slate-300 mb-2 block">Cover Image</Label>
        <div className="relative h-40 rounded-xl bg-slate-800 overflow-hidden border border-slate-700">
          {formData.cover_image_url ? (
            <>
              <img 
                src={formData.cover_image_url} 
                alt="" 
                className="w-full h-full object-cover"
              />
              <button 
                type="button"
                onClick={() => setFormData({ ...formData, cover_image_url: "" })}
                className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700/50 transition-colors">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="hidden" 
              />
              <Upload className="w-8 h-8 text-slate-500 mb-2" />
              <span className="text-sm text-slate-500">
                {uploading ? "Uploading..." : "Click to upload cover image"}
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Basic Info */}
      <div className="space-y-2">
        <Label className="text-slate-300">Trip Name *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="e.g., Summer Beach Week 2025"
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Location *</Label>
        <Input
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="e.g., Cape Cod, MA"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Start Date *</Label>
          <Input
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            className="bg-slate-800 border-slate-700 text-slate-100"
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">End Date *</Label>
          <Input
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            className="bg-slate-800 border-slate-700 text-slate-100"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="What's the occasion? Any special plans?"
          rows={3}
        />
      </div>

      {/* Planners */}
      <div className="space-y-2">
        <Label className="text-slate-300 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Trip Planners
        </Label>
        <Select onValueChange={addPlanner}>
          <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
            <SelectValue placeholder="Add a planner" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            {adultPeople.filter(p => !formData.planner_ids.includes(p.id)).map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {person.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2 mt-2">
          {formData.planner_ids.map((pId) => {
            const person = people.find(p => p.id === pId);
            return (
              <Badge key={pId} className="bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {person?.name || pId}
                <button type="button" onClick={() => removePlanner(pId)}>
                  <X className="w-3 h-3 ml-1" />
                </button>
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Visibility */}
      <div className="space-y-2">
        <Label className="text-slate-300">Visibility</Label>
        <Select 
          value={formData.visibility} 
          onValueChange={(value) => setFormData({ ...formData, visibility: value })}
        >
          <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="family_wide">Family-wide (everyone can see)</SelectItem>
            <SelectItem value="private">Private (invite only)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-700">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-slate-400">
          Cancel
        </Button>
        <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900" disabled={loading}>
          {loading ? "Saving..." : (trip ? "Update Trip" : "Create Trip")}
        </Button>
      </div>
    </form>
  );
}