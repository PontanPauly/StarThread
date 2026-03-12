import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { 
  BedDouble, 
  Plus, 
  Edit,
  Trash2,
  User,
  Users,
  X,
  UserPlus
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
import { cn } from "@/lib/utils";

export default function RoomManager({ tripId, rooms, participants, people }) {
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [assigningRoomId, setAssigningRoomId] = useState(null);
  
  const queryClient = useQueryClient();

  const getPersonById = (personId) => people.find(p => p.id === personId);
  
  const acceptedParticipants = participants.filter(p => p.status === 'accepted');

  const getOccupantsForRoom = (roomId) => {
    return acceptedParticipants
      .filter(p => p.room_id === roomId)
      .map(p => ({ participant: p, person: getPersonById(p.person_id) }))
      .filter(o => o.person);
  };

  const getUnassignedParticipants = () => {
    return acceptedParticipants
      .filter(p => !p.room_id)
      .map(p => ({ participant: p, person: getPersonById(p.person_id) }))
      .filter(o => o.person);
  };

  const assignToRoom = async (participantId, roomId) => {
    await base44.entities.TripParticipant.update(participantId, { room_id: roomId });
    queryClient.invalidateQueries(['trip-participants', tripId]);
  };

  const unassignFromRoom = async (participantId) => {
    await base44.entities.TripParticipant.update(participantId, { room_id: null });
    queryClient.invalidateQueries(['trip-participants', tripId]);
  };

  const deleteRoom = async (roomId) => {
    const roomOccupants = acceptedParticipants.filter(p => p.room_id === roomId);
    for (const p of roomOccupants) {
      await base44.entities.TripParticipant.update(p.id, { room_id: null });
    }
    await base44.entities.Room.delete(roomId);
    queryClient.invalidateQueries(['trip-rooms', tripId]);
    queryClient.invalidateQueries(['trip-participants', tripId]);
  };

  const sortedRooms = [...rooms].sort((a, b) => (a.order || 0) - (b.order || 0));
  const unassigned = getUnassignedParticipants();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <BedDouble className="w-5 h-5 text-amber-400" />
          Rooms
        </h2>
        <Button 
          onClick={() => setShowRoomForm(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Room
        </Button>
      </div>

      {sortedRooms.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedRooms.map((room) => {
            const occupants = getOccupantsForRoom(room.id);
            const isAssigning = assigningRoomId === room.id;
            const isFull = room.capacity && occupants.length >= room.capacity;
            
            return (
              <div 
                key={room.id}
                className="glass-card rounded-xl overflow-hidden"
              >
                <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <BedDouble className="w-4 h-4 text-amber-400" />
                    </div>
                    <h3 className="font-medium text-slate-200">{room.name}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-slate-500 hover:text-slate-300"
                      onClick={() => {
                        setEditingRoom(room);
                        setShowRoomForm(true);
                      }}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-slate-500 hover:text-red-400"
                      onClick={() => deleteRoom(room.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-4">
                  {room.description && (
                    <p className="text-sm text-slate-500 mb-3">{room.description}</p>
                  )}
                  
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className={cn(
                      "border-slate-700",
                      isFull ? "text-amber-400 border-amber-500/30" : "text-slate-400"
                    )}>
                      <Users className="w-3 h-3 mr-1" />
                      {occupants.length}{room.capacity ? `/${room.capacity}` : ''} occupants
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Occupants</p>
                    {occupants.length > 0 ? (
                      <div className="space-y-1.5">
                        {occupants.map(({ participant, person }) => (
                          <div 
                            key={person.id}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-800/50"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                                {person.photo_url ? (
                                  <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xs text-slate-400">{person.name?.charAt(0)}</span>
                                )}
                              </div>
                              <span className="text-sm text-slate-300">{person.name}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-600 hover:text-red-400"
                              onClick={() => unassignFromRoom(participant.id)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">No one assigned yet</p>
                    )}

                    {isAssigning ? (
                      <div className="mt-2 p-2 rounded-lg border border-slate-700 bg-slate-800/50 space-y-1">
                        <p className="text-xs text-slate-400 mb-1">Select a person to assign:</p>
                        {unassigned.length > 0 ? (
                          unassigned.map(({ participant, person }) => (
                            <button
                              key={person.id}
                              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-left"
                              onClick={() => {
                                assignToRoom(participant.id, room.id);
                                setAssigningRoomId(null);
                              }}
                            >
                              <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                                {person.photo_url ? (
                                  <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xs text-slate-400">{person.name?.charAt(0)}</span>
                                )}
                              </div>
                              <span className="text-sm text-slate-300">{person.name}</span>
                            </button>
                          ))
                        ) : (
                          <p className="text-xs text-slate-500 py-1">Everyone is already assigned to a room</p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-slate-500 hover:text-slate-300 mt-1"
                          onClick={() => setAssigningRoomId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-slate-500 hover:text-amber-400 border border-dashed border-slate-700 hover:border-amber-500/50 mt-1"
                        onClick={() => setAssigningRoomId(room.id)}
                        disabled={isFull}
                      >
                        <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                        {isFull ? 'Room Full' : 'Assign Person'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card rounded-xl p-12 text-center">
          <BedDouble className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 mb-2">No rooms defined yet</p>
          <p className="text-sm text-slate-600 mb-4">Add rooms to organize sleeping arrangements</p>
          <Button 
            onClick={() => setShowRoomForm(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add First Room
          </Button>
        </div>
      )}

      {unassigned.length > 0 && sortedRooms.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
            Unassigned ({unassigned.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(({ person }) => (
              <Badge key={person.id} variant="outline" className="border-slate-700 text-slate-400 py-1.5">
                <User className="w-3 h-3 mr-1" />
                {person.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Dialog open={showRoomForm} onOpenChange={(open) => {
        setShowRoomForm(open);
        if (!open) setEditingRoom(null);
      }}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {editingRoom ? 'Edit Room' : 'Add Room'}
            </DialogTitle>
          </DialogHeader>
          <RoomForm 
            room={editingRoom}
            tripId={tripId}
            onSuccess={() => {
              setShowRoomForm(false);
              setEditingRoom(null);
              queryClient.invalidateQueries(['trip-rooms', tripId]);
            }}
            onCancel={() => {
              setShowRoomForm(false);
              setEditingRoom(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoomForm({ room, tripId, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    trip_id: tripId,
    name: room?.name || "",
    description: room?.description || "",
    capacity: room?.capacity || "",
    order: room?.order || 0,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dataToSave = {
      ...formData,
      capacity: formData.capacity ? Number(formData.capacity) : null,
      order: Number(formData.order) || 0,
    };

    if (room?.id) {
      await base44.entities.Room.update(room.id, dataToSave);
    } else {
      await base44.entities.Room.create(dataToSave);
    }

    setLoading(false);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label className="text-slate-300">Room Name *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="e.g., Room 1, Master Suite, Bunk Room"
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="e.g., Queen bed, en-suite bathroom"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Capacity</Label>
          <Input
            type="number"
            value={formData.capacity}
            onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
            className="bg-slate-800 border-slate-700 text-slate-100"
            placeholder="e.g., 2"
            min="1"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Display Order</Label>
          <Input
            type="number"
            value={formData.order}
            onChange={(e) => setFormData({ ...formData, order: e.target.value })}
            className="bg-slate-800 border-slate-700 text-slate-100"
            min="0"
          />
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-slate-400">
          Cancel
        </Button>
        <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900" disabled={loading}>
          {loading ? "Saving..." : (room ? "Update" : "Add Room")}
        </Button>
      </div>
    </form>
  );
}
