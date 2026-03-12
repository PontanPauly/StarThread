import React, { useState } from "react";
import ParentalGate from "@/components/ParentalGate";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isAfter, isBefore, isToday } from "date-fns";
import { 
  MapPin, 
  Plus, 
  Calendar,
  Users,
  ChevronRight,
  Clock,
  CheckCircle2,
  Search,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import TripForm from "@/components/trips/TripForm";

export default function Trips() {
  const [showTripForm, setShowTripForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const queryClient = useQueryClient();

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['trips'],
    queryFn: () => base44.entities.Trip.list('-start_date'),
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['all-participants'],
    queryFn: () => base44.entities.TripParticipant.list(),
  });

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  const today = new Date();

  const getTripStatus = (trip) => {
    const start = new Date(trip.start_date);
    const end = new Date(trip.end_date);
    
    if (isBefore(end, today)) return 'completed';
    if (isBefore(start, today) && isAfter(end, today)) return 'ongoing';
    return 'upcoming';
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'completed':
        return { label: 'Completed', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
      case 'ongoing':
        return { label: 'Happening Now', className: 'bg-green-500/20 text-green-400 border-green-500/30' };
      case 'upcoming':
        return { label: 'Upcoming', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
      default:
        return { label: 'Planning', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
    }
  };

  const getParticipantCount = (tripId) => {
    return participants.filter(p => p.trip_id === tripId && p.status === 'accepted').length;
  };

  const filteredTrips = trips.filter(trip => {
    const matchesSearch = trip.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         trip.location?.toLowerCase().includes(searchQuery.toLowerCase());
    const tripStatus = getTripStatus(trip);
    const matchesStatus = statusFilter === 'all' || tripStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const upcomingTrips = filteredTrips.filter(t => getTripStatus(t) === 'upcoming' || getTripStatus(t) === 'ongoing');
  const pastTrips = filteredTrips.filter(t => getTripStatus(t) === 'completed');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (<ParentalGate featureKey="trips">
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-amber-400" />
            Trips
          </h1>
          <p className="text-slate-500 mt-1">{trips.length} total trips</p>
        </div>
        
        <Button 
          onClick={() => setShowTripForm(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900"
        >
          <Plus className="w-4 h-4 mr-2" />
          Plan New Trip
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search trips..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800/50 border-slate-600 text-slate-100 placeholder:text-slate-400"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-slate-800/50 border-slate-600 text-slate-100">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all">All Trips</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="ongoing">Ongoing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Upcoming & Ongoing Trips */}
      {upcomingTrips.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Upcoming & Ongoing
          </h2>
          <div className="grid gap-4">
            {upcomingTrips.map((trip) => {
              const status = getTripStatus(trip);
              const statusBadge = getStatusBadge(status);
              const participantCount = getParticipantCount(trip.id);
              
              return (
                <Link 
                  key={trip.id}
                  to={createPageUrl(`TripDetail?id=${trip.id}`)}
                  className="block glass-card rounded-2xl overflow-hidden hover:bg-slate-800/40 transition-colors group"
                >
                  <div className="flex flex-col md:flex-row">
                    {/* Image */}
                    <div className="md:w-64 h-48 md:h-auto bg-gradient-to-br from-slate-700 to-slate-800 relative overflow-hidden">
                      {trip.cover_image_url ? (
                        <img 
                          src={trip.cover_image_url} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <MapPin className="w-12 h-12 text-slate-600" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <Badge className={cn("border", statusBadge.className)}>
                          {statusBadge.label}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-100 group-hover:text-amber-400 transition-colors">
                            {trip.name}
                          </h3>
                          <p className="text-slate-400 mt-1 flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {trip.location}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-amber-400 transition-colors" />
                      </div>
                      
                      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(trip.start_date), "MMM d")} - {format(new Date(trip.end_date), "MMM d, yyyy")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {participantCount} attending
                        </span>
                      </div>
                      
                      {trip.description && (
                        <p className="mt-3 text-slate-500 line-clamp-2">{trip.description}</p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Past Trips */}
      {pastTrips.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-slate-500" />
            Past Trips
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastTrips.map((trip) => {
              const participantCount = getParticipantCount(trip.id);
              
              return (
                <Link 
                  key={trip.id}
                  to={createPageUrl(`TripDetail?id=${trip.id}`)}
                  className="block glass-card rounded-xl overflow-hidden hover:bg-slate-800/40 transition-colors group"
                >
                  <div className="h-32 bg-gradient-to-br from-slate-700 to-slate-800 relative">
                    {trip.cover_image_url ? (
                      <img 
                        src={trip.cover_image_url} 
                        alt="" 
                        className="w-full h-full object-cover opacity-80"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <MapPin className="w-8 h-8 text-slate-600" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-slate-200 group-hover:text-amber-400 transition-colors">
                      {trip.name}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">{trip.location}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      <span>{format(new Date(trip.start_date), "MMM yyyy")}</span>
                      <span>•</span>
                      <span>{participantCount} attended</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty State */}
      {trips.length === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <MapPin className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-200 mb-2">Plan Your First Trip</h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Create a family trip to bring everyone together. Manage meals, rooms, and activities all in one place.
          </p>
          <Button 
            onClick={() => setShowTripForm(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Plan New Trip
          </Button>
        </div>
      )}

      {/* Trip Form Dialog */}
      <Dialog open={showTripForm} onOpenChange={setShowTripForm}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Plan New Trip</DialogTitle>
          </DialogHeader>
          <TripForm 
            people={people}
            onSuccess={() => {
              setShowTripForm(false);
              queryClient.invalidateQueries(['trips']);
            }}
            onCancel={() => setShowTripForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  </ParentalGate>);
}