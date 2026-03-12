import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function HouseholdForm({ household, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    name: household?.name || "",
    description: household?.description || "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (household?.id) {
      await base44.entities.Household.update(household.id, formData);
    } else {
      await base44.entities.Household.create(formData);
    }

    setLoading(false);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label className="text-slate-300">Household Name *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="e.g., The Smith Family"
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="Optional description..."
          rows={3}
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-700">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-slate-400">
          Cancel
        </Button>
        <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900" disabled={loading}>
          {loading ? "Saving..." : (household ? "Update Household" : "Create Household")}
        </Button>
      </div>
    </form>
  );
}