import React, { useState } from "react";
import ParentalGate from "@/components/ParentalGate";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Star, 
  Plus, 
  Image,
  Video,
  FileText,
  Upload,
  X,
  User,
  MapPin,
  Trash2,
  Pencil
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

export default function Moments() {
  const [showMomentForm, setShowMomentForm] = useState(false);
  const [editingMoment, setEditingMoment] = useState(null);
  const [selectedMoment, setSelectedMoment] = useState(null);
  const [momentToDelete, setMomentToDelete] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: moments = [], isLoading } = useQuery({
    queryKey: ['moments'],
    queryFn: () => base44.entities.Moment.list('-created_date'),
  });

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  const { data: trips = [] } = useQuery({
    queryKey: ['trips'],
    queryFn: () => base44.entities.Trip.list('-start_date'),
  });

  const deleteMoment = useMutation({
    mutationFn: (id) => base44.entities.Moment.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['moments']),
  });

  const getPersonName = (personId) => {
    const person = people.find(p => p.id === personId);
    return person?.name || "Unknown";
  };

  const getTripName = (tripId) => {
    const trip = trips.find(t => t.id === tripId);
    return trip?.name || null;
  };

  const getMediaTypeIcon = (type) => {
    switch(type) {
      case 'photo': return Image;
      case 'video': return Video;
      case 'text': return FileText;
      default: return Star;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (<ParentalGate featureKey="moments">
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-400" />
            Moments
          </h1>
          <p className="text-slate-500 mt-1">Captured memories from your family's journey</p>
        </div>
        
        <Button 
          onClick={() => setShowMomentForm(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Moment
        </Button>
      </div>

      {/* Moments Grid */}
      {moments.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {moments.map((moment) => {
            const MediaIcon = getMediaTypeIcon(moment.media_type);
            const tripName = getTripName(moment.trip_id);
            
            return (
              <div 
                key={moment.id}
                className="group relative aspect-square rounded-xl overflow-hidden bg-slate-800 cursor-pointer"
                onClick={() => setSelectedMoment(moment)}
              >
                {moment.media_urls?.[0] ? (
                  moment.media_type === 'video' ? (
                    <video 
                      src={moment.media_urls[0]} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img 
                      src={moment.media_urls[0]} 
                      alt="" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-800 to-slate-900">
                    <p className="text-slate-400 text-sm text-center line-clamp-6">{moment.content}</p>
                  </div>
                )}
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    {moment.content && (
                      <p className="text-white text-sm line-clamp-2">{moment.content}</p>
                    )}
                    {tripName && (
                      <Badge className="mt-2 bg-amber-500/30 text-amber-300 border-0">
                        <MapPin className="w-3 h-3 mr-1" />
                        {tripName}
                      </Badge>
                    )}
                  </div>
                  {/* Inline edit button — stopPropagation prevents opening the detail view */}
                  <button
                    className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/60 hover:bg-amber-500/80 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingMoment(moment);
                      setShowMomentForm(true);
                    }}
                    title="Edit moment"
                  >
                    <Pencil className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
                
                {/* Type indicator */}
                <div className="absolute top-2 right-2">
                  <div className="p-1.5 rounded-lg bg-black/50">
                    <MediaIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                
                {/* Multiple media indicator */}
                {moment.media_urls?.length > 1 && (
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-black/50 text-white border-0 text-xs">
                      +{moment.media_urls.length - 1}
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Star className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-200 mb-2">Capture Your First Moment</h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Start documenting your family's journey – photos, videos, or just a few words about a special memory.
          </p>
          <Button 
            onClick={() => setShowMomentForm(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add First Moment
          </Button>
        </div>
      )}

      {/* Add/Edit Moment Dialog */}
      <Dialog open={showMomentForm} onOpenChange={(open) => { if (!open) { setShowMomentForm(false); setEditingMoment(null); } }}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-100">{editingMoment ? "Edit Moment" : "Add a Moment"}</DialogTitle>
          </DialogHeader>
          <MomentForm 
            key={editingMoment?.id || 'new'}
            trips={trips}
            people={people}
            moment={editingMoment}
            onSuccess={() => {
              setShowMomentForm(false);
              setEditingMoment(null);
              queryClient.invalidateQueries(['moments']);
            }}
            onCancel={() => { setShowMomentForm(false); setEditingMoment(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* View Moment Dialog */}
      <Dialog open={!!selectedMoment} onOpenChange={(open) => !open && setSelectedMoment(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedMoment && (
            <div>
              {selectedMoment.media_urls?.[0] && (
                <div className="rounded-xl overflow-hidden mb-4">
                  {selectedMoment.media_type === 'video' ? (
                    <video 
                      src={selectedMoment.media_urls[0]} 
                      controls
                      className="w-full max-h-[60vh] object-contain bg-black"
                    />
                  ) : (
                    <img 
                      src={selectedMoment.media_urls[0]} 
                      alt="" 
                      className="w-full max-h-[60vh] object-contain bg-black"
                    />
                  )}
                </div>
              )}
              
              {selectedMoment.content && (
                <p className="text-slate-200 text-lg mb-4">{selectedMoment.content}</p>
              )}
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                {selectedMoment.captured_date && (
                  <span>{format(new Date(selectedMoment.captured_date), 'MMMM d, yyyy')}</span>
                )}
                {selectedMoment.author_person_id && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {getPersonName(selectedMoment.author_person_id)}
                  </span>
                )}
                {selectedMoment.trip_id && (
                  <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <MapPin className="w-3 h-3 mr-1" />
                    {getTripName(selectedMoment.trip_id)}
                  </Badge>
                )}
              </div>
              
              {selectedMoment.tagged_person_ids?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-slate-500 mb-2">Tagged:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedMoment.tagged_person_ids.map(pId => (
                      <Badge key={pId} variant="outline" className="border-slate-700 text-slate-400">
                        {getPersonName(pId)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-6 pt-4 border-t border-slate-700 flex justify-end gap-2">
                <Button 
                  variant="ghost" 
                  className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 font-semibold"
                  onClick={() => {
                    setEditingMoment(selectedMoment);
                    setShowMomentForm(true);
                    setSelectedMoment(null);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="ghost" 
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/20 font-semibold"
                  onClick={() => {
                    setMomentToDelete(selectedMoment);
                    setSelectedMoment(null);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Moment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!momentToDelete} onOpenChange={(open) => !open && setMomentToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Delete Moment</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete this moment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                deleteMoment.mutate(momentToDelete.id);
                setMomentToDelete(null);
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

function MomentForm({ trips, people, moment, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    content: moment?.content || "",
    media_urls: moment?.media_urls || [],
    media_type: moment?.media_type || "text",
    trip_id: moment?.trip_id || "",
    tagged_person_ids: moment?.tagged_person_ids || [],
    captured_date: moment?.captured_date ? moment.captured_date.split('T')[0] : format(new Date(), 'yyyy-MM-dd'),
    author_person_id: moment?.author_person_id || "",
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSave = {
        ...formData,
        trip_id: formData.trip_id || null,
        author_person_id: formData.author_person_id || null,
      };

      if (moment?.id) {
        await base44.entities.Moment.update(moment.id, dataToSave);
      } else {
        await base44.entities.Moment.create(dataToSave);
      }
      onSuccess();
    } catch (error) {
      alert(error.message || "Failed to save moment");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    const urls = [];
    let type = 'photo';

    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
      
      if (file.type.startsWith('video/')) {
        type = 'video';
      }
    }

    setFormData({ 
      ...formData, 
      media_urls: [...formData.media_urls, ...urls],
      media_type: urls.length > 0 ? (formData.content ? 'mixed' : type) : 'text'
    });
    setUploading(false);
  };

  const removeMedia = (index) => {
    const newUrls = formData.media_urls.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      media_urls: newUrls,
      media_type: newUrls.length === 0 ? 'text' : formData.media_type
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Media Upload */}
      <div className="space-y-2">
        <Label className="text-slate-300">Photos / Videos</Label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {formData.media_urls.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-slate-800">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeMedia(i)}
                className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-black/80"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          
          <label className="aspect-square rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-slate-600 transition-colors">
            <input 
              type="file" 
              accept="image/*,video/*" 
              multiple
              onChange={handleFileUpload} 
              className="hidden" 
            />
            {uploading ? (
              <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Upload className="w-6 h-6 text-slate-500 mb-1" />
                <span className="text-xs text-slate-500">Add</span>
              </>
            )}
          </label>
        </div>
      </div>

      {/* Caption */}
      <div className="space-y-2">
        <Label className="text-slate-300">Caption / Notes</Label>
        <Textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="What's the story behind this moment?"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Trip */}
        <div className="space-y-2">
          <Label className="text-slate-300">Trip</Label>
          <Select 
            value={formData.trip_id || "none"} 
            onValueChange={(value) => setFormData({ ...formData, trip_id: value === "none" ? "" : value })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue placeholder="Select trip" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="none">No trip</SelectItem>
              {trips.map(trip => (
                <SelectItem key={trip.id} value={trip.id}>{trip.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Label className="text-slate-300">Date</Label>
          <Input
            type="date"
            value={formData.captured_date}
            onChange={(e) => setFormData({ ...formData, captured_date: e.target.value })}
            className="bg-slate-800 border-slate-700 text-slate-100"
          />
        </div>
      </div>

      {/* Tag People */}
      <div className="space-y-2">
        <Label className="text-slate-300">Tag People</Label>
        <Select 
          value="" 
          onValueChange={(value) => {
            if (!formData.tagged_person_ids.includes(value)) {
              setFormData({ 
                ...formData, 
                tagged_person_ids: [...formData.tagged_person_ids, value] 
              });
            }
          }}
        >
          <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
            <SelectValue placeholder="Tag someone" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            {people.filter(p => !formData.tagged_person_ids.includes(p.id)).map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2">
          {formData.tagged_person_ids.map(pId => {
            const person = people.find(p => p.id === pId);
            return (
              <Badge key={pId} className="bg-slate-700 text-slate-300">
                {person?.name}
                <button 
                  type="button" 
                  onClick={() => setFormData({
                    ...formData,
                    tagged_person_ids: formData.tagged_person_ids.filter(id => id !== pId)
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

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-700">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-slate-200 hover:text-white hover:bg-slate-700">
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold" 
          disabled={loading || (!formData.content && !formData.media_urls.length)}
        >
          {loading ? "Saving..." : (moment ? "Save Changes" : "Add Moment")}
        </Button>
      </div>
    </form>
  );
}