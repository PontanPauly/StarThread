import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function MyPackingList({ tripId, myPerson, allPeople }) {
  const [selectedPersonId, setSelectedPersonId] = useState(myPerson?.id);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  // Get people I can pack for (me + my children/teens as guardian)
  const peopleICanPackFor = allPeople.filter(p => {
    if (p.id === myPerson?.id) return true;
    if (p.guardian_ids?.includes(myPerson?.id)) return true;
    return false;
  });

  const activePersonId = selectedPersonId || myPerson?.id;

  const { data: packingItems = [] } = useQuery({
    queryKey: ['packingItems', tripId, activePersonId],
    queryFn: () => base44.entities.PackingItem.filter({ 
      trip_id: tripId,
      person_id: activePersonId 
    }),
    enabled: !!tripId && !!activePersonId,
  });

  const togglePacked = useMutation({
    mutationFn: ({ id, is_packed }) => base44.entities.PackingItem.update(id, { is_packed }),
    onSuccess: () => queryClient.invalidateQueries(['packingItems']),
  });

  const deleteItem = useMutation({
    mutationFn: (id) => base44.entities.PackingItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['packingItems']),
  });

  const activePerson = allPeople.find(p => p.id === activePersonId);
  const packedCount = packingItems.filter(i => i.is_packed).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">My Packing List</h3>
          <p className="text-sm text-slate-500">
            {packedCount} of {packingItems.length} items packed
          </p>
        </div>
        <div className="flex items-center gap-3">
          {peopleICanPackFor.length > 1 && (
            <Select value={activePersonId} onValueChange={setSelectedPersonId}>
              <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {peopleICanPackFor.map(person => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name} {person.id === myPerson?.id && '(Me)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setShowForm(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-900">
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {packingItems.length > 0 ? (
        <div className="glass-card rounded-xl p-4">
          <div className="space-y-2">
            {packingItems.map(item => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors",
                  item.is_packed && "opacity-60"
                )}
              >
                <button
                  onClick={() => togglePacked.mutate({ id: item.id, is_packed: !item.is_packed })}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    item.is_packed
                      ? "bg-green-500 border-green-500"
                      : "border-slate-600 hover:border-slate-500"
                  )}
                >
                  {item.is_packed && <Check className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1">
                  <p className={cn("text-slate-200", item.is_packed && "line-through")}>
                    {item.item}
                  </p>
                  <Badge className="mt-1 text-xs">{item.category}</Badge>
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
            ))}
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-12 text-center">
          <Package className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No items yet. Start adding things to pack!</p>
        </div>
      )}

      {showForm && (
        <PackingItemForm
          tripId={tripId}
          personId={activePersonId}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries(['packingItems']);
          }}
        />
      )}
    </div>
  );
}

function PackingItemForm({ tripId, personId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    item: '',
    category: 'other',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await base44.entities.PackingItem.create({
      item: formData.item,
      category: formData.category,
      trip_id: tripId,
      person_id: personId,
    });
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Add Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-slate-300">Item Name</Label>
            <Input
              value={formData.item}
              onChange={(e) => setFormData({ ...formData, item: e.target.value })}
              className="bg-slate-800 border-slate-700 text-slate-100"
              placeholder="e.g., Sunscreen, Jacket, Phone charger"
              required
            />
          </div>

          <div>
            <Label className="text-slate-300">Category</Label>
            <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="clothing">Clothing</SelectItem>
                <SelectItem value="toiletries">Toiletries</SelectItem>
                <SelectItem value="electronics">Electronics</SelectItem>
                <SelectItem value="documents">Documents</SelectItem>
                <SelectItem value="activities">Activities</SelectItem>
                <SelectItem value="food">Food</SelectItem>
                <SelectItem value="other">Other</SelectItem>
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