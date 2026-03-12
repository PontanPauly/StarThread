import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { 
  CalendarDays, 
  Plus, 
  Edit,
  Trash2,
  MapPin,
  Clock,
  User,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

export default function ActivityManager({ tripId, trip, activities, people }) {
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  
  const queryClient = useQueryClient();

  const tripDays = trip?.start_date && trip?.end_date 
    ? eachDayOfInterval({ start: parseISO(trip.start_date), end: parseISO(trip.end_date) })
    : [];

  const getActivitiesForDay = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return activities.filter(a => a.date === dateStr).sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
  };

  const getPersonName = (personId) => {
    const person = people.find(p => p.id === personId);
    return person?.name || "Unknown";
  };

  const deleteActivity = async (activityId) => {
    await base44.entities.Activity.delete(activityId);
    queryClient.invalidateQueries(['trip-activities', tripId]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-amber-400" />
          Activities & Itinerary
        </h2>
        <Button 
          onClick={() => setShowActivityForm(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Activity
        </Button>
      </div>

      {/* Activities by Day */}
      <div className="space-y-4">
        {tripDays.map((day) => {
          const dayActivities = getActivitiesForDay(day);
          
          return (
            <div key={day.toString()} className="glass-card rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
                <h3 className="font-medium text-slate-200">
                  {format(day, 'EEEE, MMMM d')}
                </h3>
              </div>
              
              <div className="p-4">
                {dayActivities.length > 0 ? (
                  <div className="space-y-3">
                    {dayActivities.map((activity) => (
                      <div 
                        key={activity.id}
                        className="flex items-start justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700/50"
                      >
                        <div className="flex-1">
                          <div className="flex items-start gap-3">
                            {activity.time && (
                              <Badge variant="outline" className="border-slate-600 text-slate-400 shrink-0">
                                <Clock className="w-3 h-3 mr-1" />
                                {activity.time}
                              </Badge>
                            )}
                            <div>
                              <h4 className="font-medium text-slate-200">{activity.name}</h4>
                              
                              {activity.location && (
                                <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {activity.location}
                                </p>
                              )}
                              
                              {activity.organizer_ids?.[0] && (
                                <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  Organized by {getPersonName(activity.organizer_ids?.[0])}
                                </p>
                              )}
                              
                              {activity.description && (
                                <p className="text-sm text-slate-400 mt-2">{activity.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 ml-4">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-500 hover:text-slate-300"
                            onClick={() => {
                              setEditingActivity(activity);
                              setShowActivityForm(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-500 hover:text-red-400"
                            onClick={() => deleteActivity(activity.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm text-center py-4">No activities planned</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {tripDays.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <CalendarDays className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">Set trip dates to start adding activities</p>
        </div>
      )}

      {/* Activity Form Dialog */}
      <Dialog open={showActivityForm} onOpenChange={(open) => {
        setShowActivityForm(open);
        if (!open) setEditingActivity(null);
      }}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {editingActivity ? 'Edit Activity' : 'Add Activity'}
            </DialogTitle>
          </DialogHeader>
          <ActivityForm 
            activity={editingActivity}
            tripId={tripId}
            tripDays={tripDays}
            people={people}
            onSuccess={() => {
              setShowActivityForm(false);
              setEditingActivity(null);
              queryClient.invalidateQueries(['trip-activities', tripId]);
            }}
            onCancel={() => {
              setShowActivityForm(false);
              setEditingActivity(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActivityForm({ activity, tripId, tripDays, people, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    trip_id: tripId,
    name: activity?.name || "",
    date: activity?.date || (tripDays[0] ? format(tripDays[0], 'yyyy-MM-dd') : ""),
    time: activity?.time || "",
    location: activity?.location || "",
    description: activity?.description || "",
    organizer_id: activity?.organizer_ids?.[0] || "",
  });
  const [hasBudget, setHasBudget] = useState(false);
  const [budgetData, setBudgetData] = useState({
    cost: "",
    paid_by: "",
    split_among_ids: people.map(p => p.id),
  });
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const toggleBudgetSplit = (personId) => {
    const current = budgetData.split_among_ids;
    if (current.includes(personId)) {
      setBudgetData({ ...budgetData, split_among_ids: current.filter(id => id !== personId) });
    } else {
      setBudgetData({ ...budgetData, split_among_ids: [...current, personId] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSave = {
        trip_id: formData.trip_id,
        name: formData.name,
        date: formData.date,
        time: formData.time || null,
        location: formData.location || null,
        description: formData.description || null,
        organizer_ids: formData.organizer_id ? [formData.organizer_id] : null,
      };

      let savedActivity;
      if (activity?.id) {
        savedActivity = await base44.entities.Activity.update(activity.id, dataToSave);
      } else {
        savedActivity = await base44.entities.Activity.create(dataToSave);
      }

      const costAmount = parseFloat(budgetData.cost);
      if (hasBudget && costAmount > 0 && budgetData.paid_by && budgetData.split_among_ids.length > 0 && !activity?.id) {
        await base44.entities.Expense.create({
          trip_id: tripId,
          description: formData.name,
          amount: costAmount,
          paid_by_person_id: budgetData.paid_by,
          split_among_ids: budgetData.split_among_ids,
          category: 'activities',
          date: formData.date || null,
          activity_id: savedActivity.id,
        });
        queryClient.invalidateQueries(['expenses', tripId]);
      }

      setLoading(false);
      onSuccess();
    } catch (error) {
      setLoading(false);
      toast({ title: error?.message || "Failed to save activity", variant: "destructive" });
    }
  };

  const adultPeople = people.filter(p => p.role_type === 'adult');

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label className="text-slate-300">Activity Name *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="e.g., Beach day, Family photos, Hike"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Date *</Label>
          <Select value={formData.date} onValueChange={(value) => setFormData({ ...formData, date: value })}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {tripDays.map(day => (
                <SelectItem key={day.toString()} value={format(day, 'yyyy-MM-dd')}>
                  {format(day, 'EEE, MMM d')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Time</Label>
          <Input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            className="bg-slate-800 border-slate-700 text-slate-100"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Location</Label>
        <Input
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="Where is this happening?"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Organizer</Label>
        <Select 
          value={formData.organizer_id || "none"} 
          onValueChange={(value) => setFormData({ ...formData, organizer_id: value === "none" ? "" : value })}
        >
          <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
            <SelectValue placeholder="Who's organizing?" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="none">No organizer</SelectItem>
            {adultPeople.map(person => (
              <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="Any details or notes..."
          rows={2}
        />
      </div>

      {!activity?.id && (
        <div className="space-y-3 pt-2 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <Label className="text-slate-300">Add Cost</Label>
            </div>
            <Switch checked={hasBudget} onCheckedChange={setHasBudget} />
          </div>

          {hasBudget && (
            <div className="space-y-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={budgetData.cost}
                    onChange={(e) => setBudgetData({ ...budgetData, cost: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-slate-100"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Paid By</Label>
                  <Select value={budgetData.paid_by || "none"} onValueChange={(val) => setBudgetData({ ...budgetData, paid_by: val === "none" ? "" : val })}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                      <SelectValue placeholder="Who's paying?" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="none">Select payer</SelectItem>
                      {people.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Split Among</Label>
                <div className="flex flex-wrap gap-1.5">
                  {people.map(person => (
                    <Badge
                      key={person.id}
                      onClick={() => toggleBudgetSplit(person.id)}
                      className={`cursor-pointer text-xs ${
                        budgetData.split_among_ids.includes(person.id)
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-slate-700 text-slate-500 border-slate-600'
                      }`}
                    >
                      {person.name}
                    </Badge>
                  ))}
                </div>
                {budgetData.split_among_ids.length > 0 && budgetData.cost && (
                  <p className="text-xs text-slate-500 mt-1">
                    ${(parseFloat(budgetData.cost) / budgetData.split_among_ids.length).toFixed(2)} each
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-slate-400">
          Cancel
        </Button>
        <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900" disabled={loading}>
          {loading ? "Saving..." : (activity ? "Update" : "Add Activity")}
        </Button>
      </div>
    </form>
  );
}