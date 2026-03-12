import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Plus, 
  Check, 
  X, 
  HelpCircle,
  MoreHorizontal,
  Trash2,
  BedDouble
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

export default function ParticipantManager({ tripId, participants, people, rooms }) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const queryClient = useQueryClient();

  const togglePerson = (personId) => {
    if (selectedPersonIds.includes(personId)) {
      setSelectedPersonIds(selectedPersonIds.filter(id => id !== personId));
    } else {
      setSelectedPersonIds([...selectedPersonIds, personId]);
    }
  };

  const addParticipants = async () => {
    if (selectedPersonIds.length === 0) return;
    setLoading(true);
    
    await Promise.all(
      selectedPersonIds.map(personId =>
        base44.entities.TripParticipant.create({
          trip_id: tripId,
          person_id: personId,
          status: 'invited'
        })
      )
    );
    
    setLoading(false);
    setShowAddDialog(false);
    setSelectedPersonIds([]);
    queryClient.invalidateQueries(['trip-participants', tripId]);
  };

  const updateStatus = async (participantId, newStatus) => {
    await base44.entities.TripParticipant.update(participantId, { status: newStatus });
    queryClient.invalidateQueries(['trip-participants', tripId]);
  };

  const updateRoom = async (participantId, roomId) => {
    await base44.entities.TripParticipant.update(participantId, { room_id: roomId || null });
    queryClient.invalidateQueries(['trip-participants', tripId]);
  };

  const deleteParticipant = async (participantId) => {
    await base44.entities.TripParticipant.delete(participantId);
    queryClient.invalidateQueries(['trip-participants', tripId]);
  };

  const getPersonById = (personId) => people.find(p => p.id === personId);
  const getRoomById = (roomId) => rooms.find(r => r.id === roomId);

  const participantPersonIds = participants.map(p => p.person_id);
  const availablePeople = people.filter(p => !participantPersonIds.includes(p.id));

  const statusConfig = {
    invited: { label: 'Invited', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: null },
    accepted: { label: 'Attending', className: 'bg-green-500/20 text-green-400 border-green-500/30', icon: Check },
    declined: { label: 'Declined', className: 'bg-red-500/20 text-red-400 border-red-500/30', icon: X },
    maybe: { label: 'Maybe', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: HelpCircle },
  };

  const groupedParticipants = {
    accepted: participants.filter(p => p.status === 'accepted'),
    maybe: participants.filter(p => p.status === 'maybe'),
    invited: participants.filter(p => p.status === 'invited'),
    declined: participants.filter(p => p.status === 'declined'),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-400" />
          Trip Participants
        </h2>
        <Button 
          onClick={() => setShowAddDialog(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Invite
        </Button>
      </div>

      {/* Participant Lists */}
      {Object.entries(groupedParticipants).map(([status, group]) => {
        if (group.length === 0) return null;
        const config = statusConfig[status];
        
        return (
          <div key={status} className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Badge className={cn("border", config.className)}>
                {config.label} ({group.length})
              </Badge>
            </div>
            
            <div className="space-y-2">
              {group.map((participant) => {
                const person = getPersonById(participant.person_id);
                const room = getRoomById(participant.room_id);
                
                if (!person) return null;
                
                return (
                  <div 
                    key={participant.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                        {person.photo_url ? (
                          <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-medium text-slate-400">
                            {person.name?.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-200">{person.name}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="capitalize">{person.role_type}</span>
                          {room && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <BedDouble className="w-3 h-3" />
                                {room.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Status Selector */}
                      <Select 
                        value={participant.status} 
                        onValueChange={(value) => updateStatus(participant.id, value)}
                      >
                        <SelectTrigger className="w-28 h-8 bg-slate-700 border-slate-600 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="invited">Invited</SelectItem>
                          <SelectItem value="accepted">Attending</SelectItem>
                          <SelectItem value="maybe">Maybe</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* Room Selector */}
                      {status === 'accepted' && rooms.length > 0 && (
                        <Select 
                          value={participant.room_id || "none"} 
                          onValueChange={(value) => updateRoom(participant.id, value === "none" ? null : value)}
                        >
                          <SelectTrigger className="w-28 h-8 bg-slate-700 border-slate-600 text-xs">
                            <BedDouble className="w-3 h-3 mr-1" />
                            <SelectValue placeholder="Room" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="none">No room</SelectItem>
                            {rooms.map(room => (
                              <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      {/* Delete */}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-red-400"
                        onClick={() => deleteParticipant(participant.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {participants.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No participants yet</p>
          <Button 
            onClick={() => setShowAddDialog(true)}
            variant="link"
            className="text-amber-400 mt-2"
          >
            Invite family members
          </Button>
        </div>
      )}

      {/* Add Participant Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Invite to Trip</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300 text-sm mb-2 block">
                Select People ({selectedPersonIds.length} selected)
              </Label>
              <div className="max-h-64 overflow-y-auto space-y-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700">
                {availablePeople.map(person => (
                  <div
                    key={person.id}
                    onClick={() => togglePerson(person.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                      selectedPersonIds.includes(person.id)
                        ? "bg-amber-500/20 border-2 border-amber-500/50"
                        : "bg-slate-700/50 border-2 border-transparent hover:border-slate-600"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                      selectedPersonIds.includes(person.id)
                        ? "bg-amber-500 border-amber-500"
                        : "border-slate-600"
                    )}>
                      {selectedPersonIds.includes(person.id) && <Check className="w-3 h-3 text-slate-900" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-200 font-medium">{person.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{person.role_type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <Button variant="ghost" onClick={() => {
                setShowAddDialog(false);
                setSelectedPersonIds([]);
              }} className="text-slate-400">
                Cancel
              </Button>
              <Button 
                onClick={addParticipants}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900"
                disabled={selectedPersonIds.length === 0 || loading}
              >
                {loading ? "Adding..." : `Invite ${selectedPersonIds.length || ''} ${selectedPersonIds.length === 1 ? 'Person' : 'People'}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}