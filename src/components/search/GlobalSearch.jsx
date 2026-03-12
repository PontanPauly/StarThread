import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useMyPerson } from "@/hooks/useMyPerson";
import { Search, X, User, MapPin, Heart, Image, Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Badge } from "@/components/ui/badge";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

export default function GlobalSearch({ open, onClose }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { data: myPerson } = useMyPerson();

  const { data: people = [], isLoading: loadingPeople } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  const { data: trips = [], isLoading: loadingTrips } = useQuery({
    queryKey: ['trips'],
    queryFn: () => base44.entities.Trip.list(),
  });

  const { data: moments = [] } = useQuery({
    queryKey: ['moments'],
    queryFn: () => base44.entities.Moment.list(),
  });

  const { data: rituals = [] } = useQuery({
    queryKey: ['rituals'],
    queryFn: () => base44.entities.Ritual.list(),
  });

  const { data: allRelationships = [] } = useQuery({
    queryKey: ['relationships'],
    queryFn: () => base44.entities.Relationship.list(),
  });

  const isLoading = loadingPeople || loadingTrips;

  const familyPersonIds = React.useMemo(() => {
    const ids = new Set();
    if (myPerson?.id) ids.add(myPerson.id);
    allRelationships.forEach(r => {
      if (r.person_id === myPerson?.id) ids.add(r.related_person_id);
      if (r.related_person_id === myPerson?.id) ids.add(r.person_id);
    });
    return ids;
  }, [myPerson, allRelationships]);

  const filteredResults = React.useMemo(() => {
    if (!query.trim()) return { people: [], trips: [], moments: [], rituals: [] };

    const q = query.toLowerCase();
    return {
      // Only show private people if they're in the current user's family graph
      people: people.filter(p => {
        if (p.privacy_level === 'private' && !familyPersonIds.has(p.id)) return false;
        return p.name?.toLowerCase().includes(q) || p.nickname?.toLowerCase().includes(q);
      }).slice(0, 5),
      trips: trips.filter(t =>
        t.name?.toLowerCase().includes(q) ||
        t.location?.toLowerCase().includes(q)
      ).slice(0, 5),
      moments: moments.filter(m =>
        m.content?.toLowerCase().includes(q)
      ).slice(0, 5),
      rituals: rituals.filter(r =>
        r.name?.toLowerCase().includes(q)
      ).slice(0, 5),
    };
  }, [query, people, trips, moments, rituals, familyPersonIds]);

  const handleSelect = (type, id) => {
    if (type === 'person') navigate(createPageUrl('Family'));
    else if (type === 'trip') navigate(createPageUrl(`TripDetail?id=${id}`));
    else if (type === 'moment') navigate(createPageUrl('Moments'));
    else if (type === 'ritual') navigate(createPageUrl('Rituals'));
    onClose();
  };

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const hasResults = filteredResults.people.length > 0 || 
                     filteredResults.trips.length > 0 || 
                     filteredResults.moments.length > 0 || 
                     filteredResults.rituals.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
        <VisuallyHidden><DialogTitle>Search</DialogTitle></VisuallyHidden>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search family, trips, moments..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-10 bg-slate-800 border-slate-700 text-white h-12 text-lg"
            autoFocus
          />
          {query && (
            <button 
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto space-y-4 mt-4">
          {!query && (
            <p className="text-center text-slate-500 py-8">Start typing to search...</p>
          )}

          {query && isLoading && (
            <div className="flex items-center justify-center py-8 gap-2">
              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500">Searching...</p>
            </div>
          )}

          {query && !isLoading && !hasResults && (
            <p className="text-center text-slate-500 py-8">No results found</p>
          )}

          {/* People */}
          {filteredResults.people.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 px-2">People</h3>
              {filteredResults.people.map(person => (
                <button
                  key={person.id}
                  onClick={() => handleSelect('person', person.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-left"
                >
                  <User className="w-5 h-5 text-blue-400" />
                  <div className="flex-1">
                    <p className="text-slate-200">{person.name}</p>
                    {person.nickname && (
                      <p className="text-sm text-slate-500">"{person.nickname}"</p>
                    )}
                  </div>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    {person.role_type}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {/* Trips */}
          {filteredResults.trips.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 px-2">Trips</h3>
              {filteredResults.trips.map(trip => (
                <button
                  key={trip.id}
                  onClick={() => handleSelect('trip', trip.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-left"
                >
                  <MapPin className="w-5 h-5 text-amber-400" />
                  <div className="flex-1">
                    <p className="text-slate-200">{trip.name}</p>
                    <p className="text-sm text-slate-500">{trip.location}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Moments */}
          {filteredResults.moments.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 px-2">Moments</h3>
              {filteredResults.moments.map(moment => (
                <button
                  key={moment.id}
                  onClick={() => handleSelect('moment', moment.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-left"
                >
                  <Image className="w-5 h-5 text-purple-400" />
                  <div className="flex-1">
                    <p className="text-slate-200 line-clamp-2">{moment.content}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Rituals */}
          {filteredResults.rituals.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 px-2">Traditions</h3>
              {filteredResults.rituals.map(ritual => (
                <button
                  key={ritual.id}
                  onClick={() => handleSelect('ritual', ritual.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-left"
                >
                  <Flame className="w-5 h-5 text-orange-400" />
                  <div className="flex-1">
                    <p className="text-slate-200">{ritual.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}