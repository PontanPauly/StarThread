import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function SharedItemsManager({ tripId, people }) {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ['sharedTripItems', tripId],
    queryFn: () => base44.entities.SharedTripItem.filter({ trip_id: tripId }),
  });

  const toggleConfirmed = useMutation({
    mutationFn: ({ id, is_confirmed }) => base44.entities.SharedTripItem.update(id, { is_confirmed }),
    onSuccess: () => queryClient.invalidateQueries(['sharedTripItems', tripId]),
  });

  const deleteItem = useMutation({
    mutationFn: (id) => base44.entities.SharedTripItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['sharedTripItems', tripId]),
  });

  const confirmedCount = items.filter(i => i.is_confirmed).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Shared Items</h3>
          <p className="text-sm text-slate-500">
            {confirmedCount} of {items.length} items confirmed
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-900">
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      {items.length > 0 ? (
        <div className="glass-card rounded-xl p-4">
          <div className="space-y-2">
            {items.map(item => {
              const assignedTo = people.find(p => p.id === item.assigned_to_person_id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors",
                    item.is_confirmed && "opacity-80"
                  )}
                >
                  <button
                    onClick={() => toggleConfirmed.mutate({ id: item.id, is_confirmed: !item.is_confirmed })}
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                      item.is_confirmed
                        ? "bg-green-500 border-green-500"
                        : "border-slate-600 hover:border-slate-500"
                    )}
                  >
                    {item.is_confirmed && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <div className="flex-1">
                    <p className={cn("text-slate-200", item.is_confirmed && "line-through")}>
                      {item.item}
                    </p>
                    {assignedTo && (
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs text-slate-500">
                          {assignedTo.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteItem.mutate(item.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-12 text-center">
          <Package className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No shared items yet</p>
          <p className="text-xs text-slate-600 mt-1">Add items like bowls, blender, plates, etc.</p>
        </div>
      )}

      {showForm && (
        <SharedItemForm
          tripId={tripId}
          people={people}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries(['sharedTripItems', tripId]);
          }}
        />
      )}
    </div>
  );
}

function SharedItemForm({ tripId, people, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    item: '',
    assigned_to_person_id: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await base44.entities.SharedTripItem.create({
      item: formData.item,
      assigned_to_person_id: formData.assigned_to_person_id || null,
      trip_id: tripId,
    });
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Add Shared Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-slate-300">Item Name</Label>
            <Input
              value={formData.item}
              onChange={(e) => setFormData({ ...formData, item: e.target.value })}
              className="bg-slate-800 border-slate-700 text-slate-100"
              placeholder="e.g., Blender, Plates, Cooler"
              required
            />
          </div>

          <div>
            <Label className="text-slate-300">Who Will Bring It</Label>
            <Select value={formData.assigned_to_person_id || "none"} onValueChange={(val) => setFormData({ ...formData, assigned_to_person_id: val === "none" ? "" : val })}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue placeholder="Select person (optional)" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="none">No one assigned</SelectItem>
                {people.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900">
              Add Item
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}