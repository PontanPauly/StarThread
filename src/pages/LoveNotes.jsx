import React, { useState, useEffect } from "react";
import ParentalGate from "@/components/ParentalGate";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMyPerson } from "@/hooks/useMyPerson";
import { format } from "date-fns";
import { 
  Heart, 
  Plus, 
  Send,
  User,
  MapPin,
  Trash2,
  Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function LoveNotes() {
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [myPersonId, setMyPersonId] = useState(null);
  const [noteToDelete, setNoteToDelete] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: loveNotes = [], isLoading } = useQuery({
    queryKey: ['love-notes'],
    queryFn: () => base44.entities.LoveNote.list('-created_date'),
  });

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  const { data: trips = [] } = useQuery({
    queryKey: ['trips'],
    queryFn: () => base44.entities.Trip.list(),
  });

  const { data: myPersonData } = useMyPerson();

  useEffect(() => {
    if (myPersonData) setMyPersonId(myPersonData.id);
  }, [myPersonData]);

  const deleteLoveNote = useMutation({
    mutationFn: (id) => base44.entities.LoveNote.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['love-notes']),
  });

  const getPersonName = (personId) => {
    const person = people.find(p => p.id === personId);
    return person?.name || "Unknown";
  };

  const getPersonPhoto = (personId) => {
    const person = people.find(p => p.id === personId);
    return person?.photo_url;
  };

  const getTripName = (tripId) => {
    const trip = trips.find(t => t.id === tripId);
    return trip?.name || null;
  };

  // Group notes by who they're for (received) and from (sent)
  const receivedNotes = myPersonId ? loveNotes.filter(n => n.to_person_id === myPersonId) : [];
  const sentNotes = myPersonId ? loveNotes.filter(n => n.from_person_id === myPersonId) : [];
  const otherNotes = loveNotes.filter(n => 
    (!myPersonId || (n.to_person_id !== myPersonId && n.from_person_id !== myPersonId))
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (<ParentalGate featureKey="love_notes">
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-400" />
            Love Notes
          </h1>
          <p className="text-slate-500 mt-1">Express gratitude and appreciation</p>
        </div>
        
        <Button 
          onClick={() => setShowNoteForm(true)}
          className="bg-rose-500 hover:bg-rose-600 text-white font-semibold"
        >
          <Send className="w-4 h-4 mr-2" />
          Send a Note
        </Button>
      </div>

      {/* Received Notes */}
      {receivedNotes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
            Notes for You
          </h2>
          <div className="space-y-4">
            <AnimatePresence>
              {receivedNotes.map((note) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="glass-card rounded-2xl p-6 border-l-4 border-rose-500"
                >
                  <p className="text-slate-200 text-lg italic">"{note.content}"</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                        {getPersonPhoto(note.from_person_id) ? (
                          <img src={getPersonPhoto(note.from_person_id)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-slate-400">{getPersonName(note.from_person_id)?.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">From {getPersonName(note.from_person_id)}</p>
                        <p className="text-xs text-slate-600">{format(new Date(note.created_date), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                    {note.trip_id && (
                      <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <MapPin className="w-3 h-3 mr-1" />
                        {getTripName(note.trip_id)}
                      </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Sent Notes */}
      {sentNotes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-slate-400" />
            Notes You've Sent
          </h2>
          <div className="space-y-3">
            {sentNotes.map((note) => (
              <div
                key={note.id}
                className="glass-card rounded-xl p-4 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-slate-300">"{note.content}"</p>
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                      <span>To {getPersonName(note.to_person_id)}</span>
                      <span>•</span>
                      <span>{format(new Date(note.created_date), 'MMM d')}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-slate-200 hover:text-amber-400 hover:bg-amber-500/20"
                      onClick={() => { setEditingNote(note); setShowNoteForm(true); }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-slate-200 hover:text-red-400 hover:bg-red-500/20"
                      onClick={() => setNoteToDelete(note)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All Notes / Other Notes */}
      {otherNotes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-200 mb-4">
            {!myPersonId ? "All Love Notes" : "Family Love Notes"}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {otherNotes.map((note) => (
              <div
                key={note.id}
                className="glass-card rounded-xl p-5"
              >
                <p className="text-slate-300 italic">"{note.content}"</p>
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                  <span>{getPersonName(note.from_person_id)}</span>
                  <Heart className="w-3 h-3 text-rose-400" />
                  <span>{getPersonName(note.to_person_id)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {loveNotes.length === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-10 h-10 text-rose-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-200 mb-2">Spread Some Love</h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Send a note of gratitude or appreciation to a family member. It's a small gesture that means a lot.
          </p>
          <Button 
            onClick={() => setShowNoteForm(true)}
            className="bg-rose-500 hover:bg-rose-600 text-white font-semibold"
          >
            <Send className="w-4 h-4 mr-2" />
            Send First Note
          </Button>
        </div>
      )}

      {/* Note Form Dialog */}
      <Dialog open={showNoteForm} onOpenChange={(open) => { if (!open) { setShowNoteForm(false); setEditingNote(null); } }}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-400" />
              {editingNote ? "Edit Love Note" : "Send a Love Note"}
            </DialogTitle>
          </DialogHeader>
          <LoveNoteForm 
            key={editingNote?.id || 'new'}
            people={people}
            trips={trips}
            myPersonId={myPersonId}
            note={editingNote}
            onSuccess={() => {
              setShowNoteForm(false);
              setEditingNote(null);
              queryClient.invalidateQueries(['love-notes']);
            }}
            onCancel={() => { setShowNoteForm(false); setEditingNote(null); }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Delete Love Note</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete this love note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                deleteLoveNote.mutate(noteToDelete.id);
                setNoteToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </ParentalGate>);
}

function LoveNoteForm({ people, trips, myPersonId, note, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    content: note?.content || "",
    from_person_id: note?.from_person_id || myPersonId || "",
    to_person_id: note?.to_person_id || "",
    trip_id: note?.trip_id || "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (myPersonId && !formData.from_person_id) {
      setFormData(prev => ({ ...prev, from_person_id: myPersonId }));
    }
  }, [myPersonId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSave = {
        ...formData,
        trip_id: formData.trip_id || null,
      };

      if (note?.id) {
        await base44.entities.LoveNote.update(note.id, dataToSave);
      } else {
        await base44.entities.LoveNote.create(dataToSave);
      }
      onSuccess();
    } catch (error) {
      alert(error.message || "Failed to save note");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label className="text-slate-300">Your Message *</Label>
        <Textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="Thank you for... / I appreciate... / I love how you..."
          rows={4}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">From *</Label>
          <Select 
            value={formData.from_person_id} 
            onValueChange={(value) => setFormData({ ...formData, from_person_id: value })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue placeholder="Select yourself" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {people.filter(p => p.role_type === 'adult' || p.role_type === 'teen').map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">To *</Label>
          <Select 
            value={formData.to_person_id} 
            onValueChange={(value) => setFormData({ ...formData, to_person_id: value })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue placeholder="Who is this for?" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {people.filter(p => p.id !== formData.from_person_id).map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Related to a trip? (optional)</Label>
        <Select 
          value={formData.trip_id || "none"} 
          onValueChange={(value) => setFormData({ ...formData, trip_id: value === "none" ? "" : value })}
        >
          <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
            <SelectValue placeholder="Select trip" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="none">No specific trip</SelectItem>
            {trips.map(trip => (
              <SelectItem key={trip.id} value={trip.id}>{trip.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-700">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-slate-200 hover:text-white hover:bg-slate-700">
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="bg-rose-500 hover:bg-rose-600 text-white font-semibold" 
          disabled={loading || !formData.content || !formData.from_person_id || !formData.to_person_id}
        >
          <Send className="w-4 h-4 mr-2" />
          {loading ? "Saving..." : (note ? "Save Changes" : "Send Note")}
        </Button>
      </div>
    </form>
  );
}