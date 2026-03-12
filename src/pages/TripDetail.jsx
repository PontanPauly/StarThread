import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMyPerson } from "@/hooks/useMyPerson";
import { format, differenceInDays } from "date-fns";
import { 
  MapPin, 
  Calendar,
  Users,
  ChevronLeft,
  Edit,
  UtensilsCrossed,
  BedDouble,
  CalendarDays,
  Heart,
  Star,
  Plus,
  Check,
  X,
  HelpCircle,
  AlertCircle,
  MoreHorizontal,
  DollarSign,
  Package,
  MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import TripForm from "@/components/trips/TripForm.jsx";
import ParticipantManager from "@/components/trips/ParticipantManager.jsx";
import MealManager from "@/components/trips/MealManager.jsx";
import RoomManager from "@/components/trips/RoomManager.jsx";
import ActivityManager from "@/components/trips/ActivityManager.jsx";
import BudgetManager from "@/components/trips/BudgetManager.jsx";
import SharedItemsManager from "@/components/trips/SharedItemsManager.jsx";
import MyPackingList from "@/components/trips/MyPackingList.jsx";
import TripComments from "@/components/trips/TripComments.jsx";

export default function TripDetail() {
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get('id');
  
  const [showEditForm, setShowEditForm] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  
  const queryClient = useQueryClient();

  const { data: trip, isLoading: loadingTrip } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => base44.entities.Trip.filter({ id: tripId }),
    select: (data) => data[0],
    enabled: !!tripId,
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['trip-participants', tripId],
    queryFn: () => base44.entities.TripParticipant.filter({ trip_id: tripId }),
    enabled: !!tripId,
  });

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  const { data: meals = [] } = useQuery({
    queryKey: ['trip-meals', tripId],
    queryFn: () => base44.entities.Meal.filter({ trip_id: tripId }),
    enabled: !!tripId,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['trip-rooms', tripId],
    queryFn: () => base44.entities.Room.filter({ trip_id: tripId }),
    enabled: !!tripId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['trip-activities', tripId],
    queryFn: () => base44.entities.Activity.filter({ trip_id: tripId }),
    enabled: !!tripId,
  });

  const { data: myPerson } = useMyPerson();

  if (loadingTrip || !trip) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tripDays = differenceInDays(new Date(trip.end_date), new Date(trip.start_date)) + 1;
  const acceptedCount = participants.filter(p => p.status === 'accepted').length;
  const maybeCount = participants.filter(p => p.status === 'maybe').length;
  const declinedCount = participants.filter(p => p.status === 'declined').length;

  const getPersonName = (personId) => {
    const person = people.find(p => p.id === personId);
    return person?.name || "Unknown";
  };

  const getAttendingPeople = () => {
    const acceptedParticipantIds = participants
      .filter(p => p.status === 'accepted')
      .map(p => p.person_id);
    return people.filter(p => acceptedParticipantIds.includes(p.id));
  };

  const myParticipation = participants.find(p => p.person_id === myPerson?.id);
  const isAttending = myParticipation?.status === 'accepted';

  const getAllergiesForAttendees = () => {
    const attendees = getAttendingPeople();
    const allergies = [];
    attendees.forEach(person => {
      if (person.allergies?.length) {
        person.allergies.forEach(allergy => {
          allergies.push({ person: person.name, allergy });
        });
      }
      if (person.dietary_preferences?.length) {
        person.dietary_preferences.forEach(pref => {
          allergies.push({ person: person.name, allergy: pref, isDiet: true });
        });
      }
    });
    return allergies;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back Navigation */}
      <Link to={createPageUrl("Trips")} className="inline-flex items-center text-slate-400 hover:text-slate-200 transition-colors">
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Trips
      </Link>

      {/* Hero Section */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="relative h-48 sm:h-64 md:h-80 bg-gradient-to-br from-slate-700 to-slate-800">
          {trip.cover_image_url ? (
            <img 
              src={trip.cover_image_url} 
              alt="" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <MapPin className="w-20 h-20 text-slate-600" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent" />
          
          {/* Edit Button */}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowEditForm(true)}
            className="absolute top-4 right-4 bg-black/30 text-white hover:bg-black/50"
          >
            <Edit className="w-4 h-4" />
          </Button>
          
          {/* Trip Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">{trip.name}</h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm sm:text-base text-slate-300">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {trip.location}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {format(new Date(trip.start_date), "MMM d")} - {format(new Date(trip.end_date), "MMM d, yyyy")}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {acceptedCount} attending
              </span>
            </div>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="p-4 sm:p-6 border-t border-slate-700/50 grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-100">{tripDays}</p>
            <p className="text-xs text-slate-500">Days</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">{acceptedCount}</p>
            <p className="text-xs text-slate-500">Attending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-400">{maybeCount}</p>
            <p className="text-xs text-slate-500">Maybe</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-100">{meals.length}</p>
            <p className="text-xs text-slate-500">Meals</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-100">{activities.length}</p>
            <p className="text-xs text-slate-500">Activities</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-800/50 border border-slate-700 p-1 overflow-x-auto scrollbar-hide flex w-full justify-start">
          <TabsTrigger value="overview" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 flex-shrink-0">
            Overview
          </TabsTrigger>
          <TabsTrigger value="people" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 flex-shrink-0">
            <Users className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">People</span>
          </TabsTrigger>
          <TabsTrigger value="meals" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 flex-shrink-0">
            <UtensilsCrossed className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Meals</span>
          </TabsTrigger>
          <TabsTrigger value="rooms" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 flex-shrink-0">
            <BedDouble className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Rooms</span>
          </TabsTrigger>
          <TabsTrigger value="activities" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 flex-shrink-0">
            <CalendarDays className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Activities</span>
          </TabsTrigger>
          <TabsTrigger value="budget" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 flex-shrink-0">
            <DollarSign className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Budget</span>
          </TabsTrigger>
          <TabsTrigger value="shared" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 flex-shrink-0">
            <Package className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Shared</span>
          </TabsTrigger>
          <TabsTrigger value="comments" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 flex-shrink-0">
            <MessageCircle className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Comments</span>
          </TabsTrigger>
          {isAttending && (
            <TabsTrigger value="packing" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 flex-shrink-0">
              <Package className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Packing</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {trip.description && (
            <div className="glass-card rounded-xl p-6">
              <h3 className="font-medium text-slate-200 mb-2">About this trip</h3>
              <p className="text-slate-400">{trip.description}</p>
            </div>
          )}
          
          {/* Planners */}
          {trip.planner_ids?.length > 0 && (
            <div className="glass-card rounded-xl p-6">
              <h3 className="font-medium text-slate-200 mb-3">Trip Planners</h3>
              <div className="flex flex-wrap gap-2">
                {trip.planner_ids.map(id => (
                  <Badge key={id} className="bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {getPersonName(id)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Dietary Alerts */}
          {getAllergiesForAttendees().length > 0 && (
            <div className="glass-card rounded-xl p-6 border-l-4 border-red-500">
              <h3 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                Dietary Considerations
              </h3>
              <div className="space-y-2">
                {getAllergiesForAttendees().map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-slate-300">{item.person}:</span>
                    <Badge 
                      className={cn(
                        "border",
                        item.isDiet 
                          ? "bg-slate-700 text-slate-300 border-slate-600" 
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                      )}
                    >
                      {item.allergy}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* People Tab */}
        <TabsContent value="people">
          <ParticipantManager 
            tripId={tripId}
            participants={participants}
            people={people}
            rooms={rooms}
          />
        </TabsContent>

        {/* Meals Tab */}
        <TabsContent value="meals">
          <MealManager 
            tripId={tripId}
            trip={trip}
            meals={meals}
            people={people}
            participants={participants}
          />
        </TabsContent>

        {/* Rooms Tab */}
        <TabsContent value="rooms">
          <RoomManager 
            tripId={tripId}
            rooms={rooms}
            participants={participants}
            people={people}
          />
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities">
          <ActivityManager 
            tripId={tripId}
            trip={trip}
            activities={activities}
            people={people}
          />
        </TabsContent>

        {/* Budget Tab */}
        <TabsContent value="budget">
          <BudgetManager 
            tripId={tripId}
            people={getAttendingPeople()}
          />
        </TabsContent>

        {/* Shared Items Tab */}
         <TabsContent value="shared">
           <SharedItemsManager 
             tripId={tripId}
             people={getAttendingPeople()}
           />
         </TabsContent>

         {/* Comments Tab */}
         <TabsContent value="comments">
           <TripComments 
             tripId={tripId}
             currentUser={user}
             people={people}
           />
         </TabsContent>

         {/* My Packing Tab */}
         {isAttending && (
           <TabsContent value="packing">
             <MyPackingList 
               tripId={tripId}
               myPerson={myPerson}
               allPeople={people}
             />
           </TabsContent>
         )}
      </Tabs>

      {/* Edit Trip Dialog */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Edit Trip</DialogTitle>
          </DialogHeader>
          <TripForm 
            trip={trip}
            people={people}
            onSuccess={() => {
              setShowEditForm(false);
              queryClient.invalidateQueries(['trip', tripId]);
            }}
            onCancel={() => setShowEditForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}