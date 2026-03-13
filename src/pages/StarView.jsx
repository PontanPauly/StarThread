import React, { useMemo, useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Canvas } from "@react-three/fiber";
import { base44 } from "@/api/base44Client";
import { useMyPerson } from "@/hooks/useMyPerson";
import { useNavigate as useNav2 } from "react-router-dom";
import { ArrowLeft, ChevronRight, Heart, Home, MapPin, ShieldAlert, Sparkles, Users, ZoomIn, ZoomOut, RotateCcw, Shield, Pencil, Globe, Lock, Mail, Info, Eye, MessageSquare, Image, BookOpen, Flame, Calendar, Link2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import PersonForm from "@/components/family/PersonForm";
import { getStarVisuals, DEFAULT_STAR_PROFILE } from "@/lib/starConfig";
import StarComponent from "@/components/constellation/Star";
import OrbitalEngine from "@/components/star-view/OrbitalEngine";
import PlanetDetailPanel from "@/components/star-view/PlanetDetailPanel";
import WebGLErrorBoundary from "@/components/WebGLErrorBoundary";
import {
  MomentPlanet,
  EssencePlanet,
  InterestPlanet,
  FamilyPlanet,
  EventPlanet,
  FeaturedPlanet,
  LoveNotePlanet,
  StoryPlanet,
  TripPlanet,
} from "@/components/star-view/planets";

const PUBLIC_PROFILE_MIN_AGE = 13;

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

function Star3D({ starProfile, personId, isMemorial, glowIntensity = 1, isMobile = false }) {
  const starSize = isMobile ? 150 : 200;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10 }}>
      <div style={{ width: starSize, height: starSize }}>
        <Canvas
          camera={{ position: [0, 0, 4], fov: 50 }}
          gl={{ alpha: true, antialias: true }}
          style={{ background: "transparent" }}
        >
          <Suspense fallback={null}>
            <StarComponent
              starProfile={starProfile || DEFAULT_STAR_PROFILE}
              personId={personId}
              position={[0, 0, 0]}
              isHovered={glowIntensity > 1}
              isFocused={true}
              isMemorial={isMemorial}
              globalOpacity={1}
              globalScale={1.8 * glowIntensity}
              animated={true}
            />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}

function getPersonAge(person) {
  if (!person?.birth_date && !person?.birth_year) return null;
  const birthDate = person.birth_date
    ? new Date(person.birth_date)
    : new Date(person.birth_year, 0, 1);
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

const PARENTAL_FEATURE_OPTIONS = [
  { key: 'messaging', label: 'Messaging', icon: MessageSquare },
  { key: 'trips', label: 'Trips', icon: MapPin },
  { key: 'moments', label: 'Moments', icon: Image },
  { key: 'love_notes', label: 'Love Notes', icon: Heart },
  { key: 'stories', label: 'Stories', icon: BookOpen },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'traditions', label: 'Traditions', icon: Flame },
];

function ParentControls({ person, personId, age, people, households, queryClient, toast }) {
  const navigate = useNav2();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [childEmail, setChildEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const controls = person.parental_controls || {};

  useEffect(() => {
    fetch(`/api/entities/guardian/${personId}/linked-email`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.linked_user_email) setChildEmail(data.linked_user_email); })
      .catch(() => {});
  }, [personId]);

  const handleSaveEmail = async () => {
    setSavingEmail(true);
    try {
      await base44.entities.Person.update(personId, { linked_user_email: childEmail });
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast({ title: 'Email saved' });
    } catch (e) {
      toast({ title: 'Failed to save email', variant: 'destructive' });
    }
    setSavingEmail(false);
  };

  const handleToggleFeature = async (featureKey, enabled) => {
    try {
      const updated = { ...controls, [featureKey]: enabled };
      await base44.entities.Person.update(personId, { parental_controls: updated });
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast({ title: `${featureKey.replace('_', ' ')} ${enabled ? 'enabled' : 'disabled'}` });
    } catch (e) {
      toast({ title: 'Failed to update controls', variant: 'destructive' });
    }
  };

  return (
    <div className="mt-4 w-full max-w-sm space-y-3">
      <div className="glass-card rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
          <Shield className="w-4 h-4" />
          <span>Parent Controls</span>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-400">Privacy Level</p>
          <div className="flex gap-2">
            {[
              { value: 'public', label: 'Public', icon: Globe },
              { value: 'family_only', label: 'Family', icon: Users },
              { value: 'private', label: 'Private', icon: Lock },
            ].map(opt => (
              <Button
                key={opt.value}
                size="sm"
                variant={person.privacy_level === opt.value ? 'default' : 'outline'}
                className={person.privacy_level === opt.value
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 flex-1'
                  : 'border-slate-600 text-slate-400 flex-1'}
                onClick={async () => {
                  try {
                    await base44.entities.Person.update(personId, { privacy_level: opt.value });
                    queryClient.invalidateQueries({ queryKey: ['people'] });
                    toast({ title: `Privacy set to ${opt.label}` });
                  } catch (e) {
                    toast({ title: 'Failed to update privacy', variant: 'destructive' });
                  }
                }}
              >
                <opt.icon className="w-3 h-3 mr-1" />
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-700/50 pt-3">
          <p className="text-xs text-slate-400">Feature Access</p>
          <div className="space-y-2">
            {PARENTAL_FEATURE_OPTIONS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-300">{label}</span>
                </div>
                <Switch
                  checked={controls[key] !== false}
                  onCheckedChange={(checked) => handleToggleFeature(key, checked)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-700/50 pt-3">
          <Button
            size="sm"
            variant="outline"
            className="w-full border-blue-500/30 text-blue-300 hover:bg-blue-500/10"
            onClick={() => navigate(`/guardian-messages/${personId}`)}
          >
            <Eye className="w-3 h-3 mr-2" />
            View Messages
          </Button>
        </div>

        {age !== null && age >= 13 ? (
          <div className="space-y-2 border-t border-slate-700/50 pt-3">
            <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
              <Mail className="w-4 h-4 text-blue-400" />
              <span>Account Ready</span>
            </div>
            <p className="text-xs text-slate-400">
              {person.name} is {age} and can have their own account. Add their email so they can sign up and manage their own profile.
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                value={childEmail}
                onChange={(e) => setChildEmail(e.target.value)}
                placeholder="their@email.com"
                className="bg-slate-800 border-slate-700 text-slate-100 text-sm flex-1"
              />
              <Button
                size="sm"
                onClick={handleSaveEmail}
                disabled={savingEmail || !childEmail}
                className="bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30"
              >
                {savingEmail ? '...' : 'Save'}
              </Button>
            </div>
            {person.user_id && (
              <p className="text-xs text-green-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Account already created
              </p>
            )}
          </div>
        ) : age !== null ? (
          <div className="border-t border-slate-700/50 pt-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Info className="w-3 h-3" />
              <span>Own account available at age 13 (currently {age})</span>
            </div>
          </div>
        ) : null}

        <Button
          size="sm"
          variant="outline"
          className="w-full border-slate-600 text-slate-300"
          onClick={() => setShowEditDialog(true)}
        >
          <Pencil className="w-3 h-3 mr-2" />
          Edit Profile
        </Button>
      </div>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-400" />
              Edit {person.name}
            </DialogTitle>
          </DialogHeader>
          <PersonForm
            person={person}
            households={households}
            people={people}
            onSuccess={() => {
              setShowEditDialog(false);
              queryClient.invalidateQueries({ queryKey: ['people'] });
            }}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RelationshipList({ relationships, people, personId }) {
  if (relationships.length === 0) return null;

  const getRelatedPerson = (rel) => {
    const relatedId =
      rel.person_id === personId ? rel.related_person_id : rel.person_id;
    return people.find((p) => p.id === relatedId);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-amber-400" />
        Family Connections
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {relationships.map((rel) => {
          const related = getRelatedPerson(rel);
          if (!related) return null;
          return (
            <div
              key={rel.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40 hover:border-amber-400/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-slate-600/50 flex-shrink-0">
                {related.photo_url ? (
                  <img
                    src={related.photo_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-400">
                    {related.name?.charAt(0)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {related.name}
                </p>
                <p className="text-xs text-slate-500 capitalize">
                  {(rel._displayType || rel.relationship_type).replace(
                    /_/g,
                    " "
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MomentsGallery({ moments, personId }) {
  const personMoments = moments
    .filter(
      (m) =>
        m.author_person_id === personId ||
        (m.tagged_person_ids && m.tagged_person_ids.includes(personId))
    )
    .slice(0, 6);

  if (personMoments.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-400" />
        Recent Moments
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {personMoments.map((moment) => (
          <div
            key={moment.id}
            className="aspect-square rounded-xl bg-slate-800/60 border border-slate-700/40 overflow-hidden"
          >
            {moment.media_urls && moment.media_urls.length > 0 ? (
              <img
                src={moment.media_urls[0]}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-3">
                <p className="text-xs text-slate-400 text-center line-clamp-4">
                  {moment.content || "Moment"}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildPlanets({
  person,
  personId,
  relationships,
  people,
  moments,
  calendarEvents,
  loveNotes,
  familyStories,
  trips,
  tripParticipants,
}) {
  const planets = [];
  const starProfile = person.star_profile || {};

  const essence = starProfile.essence || person.about;
  planets.push({
    key: "essence",
    type: "essence",
    data: { essence },
    render: (props) => <EssencePlanet data={{ essence }} {...props} />,
  });

  const personMoments = moments.filter(
    (m) =>
      m.author_person_id === personId ||
      (m.tagged_person_ids && m.tagged_person_ids.includes(personId))
  );
  planets.push({
    key: "moments",
    type: "moment",
    data: { moments: personMoments },
    render: (props) => (
      <MomentPlanet data={{ moments: personMoments }} {...props} />
    ),
  });

  const immediateFamily = relationships
    .map((rel) => {
      const relatedId =
        rel.person_id === personId ? rel.related_person_id : rel.person_id;
      const relatedPerson = people.find((p) => p.id === relatedId);
      if (!relatedPerson) return null;
      const type = (rel._displayType || rel.relationship_type || "").toLowerCase();
      if (
        ["parent", "child", "spouse", "partner", "sibling"].includes(type)
      ) {
        return { ...relatedPerson, relType: type };
      }
      return null;
    })
    .filter(Boolean);

  planets.push({
    key: "family",
    type: "family",
    data: { familyMembers: immediateFamily },
    render: (props) => (
      <FamilyPlanet data={{ familyMembers: immediateFamily }} {...props} />
    ),
  });

  const interests = starProfile.interests || starProfile.hobbies || [];
  const allInterests = Array.isArray(interests) ? interests : [interests];
  const interestNames = allInterests.map((i) => (typeof i === "string" ? i : i.name || i));

  if (interestNames.length > 0 && interestNames[0]) {
    planets.push({
      key: "interests",
      type: "interest",
      data: { interests: allInterests },
      render: (props) => (
        <InterestPlanet data={{ interests: interestNames.slice(0, 2) }} index={0} {...props} />
      ),
    });
  }

  const personEvents = calendarEvents.filter(
    (e) => e.person_ids && e.person_ids.includes(personId)
  );
  const now = new Date();
  const nextEvent = personEvents
    .filter((e) => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  let birthday = null;
  if (person.birth_date) {
    const bd = new Date(person.birth_date);
    const thisYearBday = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
    if (thisYearBday < now) {
      thisYearBday.setFullYear(now.getFullYear() + 1);
    }
    const turningAge = thisYearBday.getFullYear() - bd.getFullYear();
    birthday = { title: "Birthday", date: thisYearBday.toISOString(), turningAge };
  }

  const allUpcomingEvents = personEvents
    .filter((e) => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  planets.push({
    key: "events",
    type: "event",
    data: { nextEvent, birthday, allEvents: allUpcomingEvents },
    render: (props) => (
      <EventPlanet data={{ nextEvent, birthday }} {...props} />
    ),
  });

  const receivedNotes = loveNotes.filter((n) => n.to_person_id === personId);
  const sentNotes = loveNotes.filter((n) => n.from_person_id === personId);
  const allPersonNotes = [...receivedNotes, ...sentNotes];
  const receivedWithNames = receivedNotes.map((n) => ({
    ...n,
    from_name: people.find((p) => p.id === n.from_person_id)?.name,
  }));
  const sentWithNames = sentNotes.map((n) => ({
    ...n,
    to_name: people.find((p) => p.id === n.to_person_id)?.name,
  }));
  planets.push({
    key: "lovenotes",
    type: "lovenote",
    data: { loveNotes: allPersonNotes, received: receivedWithNames, sent: sentWithNames },
    render: (props) => (
      <LoveNotePlanet data={{ loveNotes: allPersonNotes }} {...props} />
    ),
  });

  const personStories = familyStories.filter(
    (s) =>
      s.author_person_id === personId ||
      (s.related_person_ids && s.related_person_ids.includes(personId))
  );
  const storiesWithAuthor = personStories.map((s) => ({
    ...s,
    author_name: people.find((p) => p.id === s.author_person_id)?.name,
  }));
  planets.push({
    key: "stories",
    type: "story",
    data: { stories: storiesWithAuthor },
    render: (props) => (
      <StoryPlanet data={{ stories: storiesWithAuthor }} {...props} />
    ),
  });

  const myTripIds = tripParticipants
    .filter((tp) => tp.person_id === personId)
    .map((tp) => tp.trip_id);
  const plannerTrips = trips.filter(
    (t) => t.planner_ids && t.planner_ids.includes(personId)
  );
  const participantTrips = trips.filter((t) => myTripIds.includes(t.id));
  const allPersonTripsMap = new Map();
  [...plannerTrips, ...participantTrips].forEach((t) => allPersonTripsMap.set(t.id, t));
  const allPersonTrips = Array.from(allPersonTripsMap.values());
  const tripsWithParticipants = allPersonTrips.map((t) => {
    const participantIds = tripParticipants
      .filter((tp) => tp.trip_id === t.id)
      .map((tp) => tp.person_id);
    const participants = participantIds
      .map((pid) => people.find((p) => p.id === pid))
      .filter(Boolean)
      .map((p) => ({ name: p.name, id: p.id }));
    return { ...t, participants };
  });
  planets.push({
    key: "trips",
    type: "trip",
    data: { trips: tripsWithParticipants },
    render: (props) => (
      <TripPlanet data={{ trips: tripsWithParticipants }} {...props} />
    ),
  });

  const featuredMoment =
    personMoments.find(
      (m) => m.media_urls && m.media_urls.length > 0
    ) || personMoments[0];
  if (featuredMoment || starProfile.favorites) {
    const featuredData = featuredMoment || {
      content:
        starProfile.favorites?.quote ||
        starProfile.favorites?.place ||
        null,
    };
    planets.push({
      key: "featured",
      type: "featured",
      data: { featured: featuredData },
      render: (props) => (
        <FeaturedPlanet data={{ featured: featuredData }} {...props} />
      ),
    });
  }

  return planets.slice(0, 9);
}

function MatchIndicator({ personId }) {
  const { data: suggestions = [] } = useQuery({
    queryKey: ["identity-suggestions", "all"],
    queryFn: async () => {
      const res = await fetch("/api/identity/suggestions", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const match = suggestions.find(s => s.suggested_person_id === personId);
  if (!match) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mt-2 sm:mt-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-3">
      <Star className="w-4 h-4 text-cyan-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-cyan-300 font-medium">This might be your star</p>
        <p className="text-[10px] text-slate-400">
          {match.confidence === "high" ? "Strong match" : "Possible match"} based on {(match.explanations || []).slice(0, 2).join(", ").toLowerCase()}
        </p>
      </div>
    </div>
  );
}

export default function StarView() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromGalaxy = searchParams.get("from") === "galaxy";
  const fromHouseholdId = searchParams.get("household");

  const handleGoBack = () => {
    if (fromGalaxy) {
      navigate(`/family?galaxy=${fromHouseholdId}`);
    } else {
      navigate('/family');
    }
  };

  const isMobile = useIsMobile();
  const { data: myPerson } = useMyPerson();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [starGlow, setStarGlow] = useState(1);
  const [focusedPlanet, setFocusedPlanet] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const orbitContainerRef = useRef(null);
  const [orbitSize, setOrbitSize] = useState(isMobile ? Math.min(window.innerWidth - 20, window.innerHeight - 180) : 800);

  useEffect(() => {
    const updateSize = () => {
      const sidebarWidth = window.innerWidth >= 1024 ? 256 : 0;
      const availableWidth = window.innerWidth - sidebarWidth;
      const availableHeight = window.innerHeight - 60;
      const baseSize = isMobile
        ? Math.min(availableWidth - 20, window.innerHeight - 180)
        : Math.min(availableWidth, availableHeight);
      setOrbitSize(baseSize);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [isMobile]);

  const { data: galaxyData, isLoading: loadingPeople } = useQuery({
    queryKey: ["galaxy", personId],
    queryFn: async () => {
      const response = await fetch(`/api/relationships/galaxy/${personId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to load galaxy data');
      return response.json();
    },
    enabled: !!personId,
  });

  const { data: households = [] } = useQuery({
    queryKey: ["households"],
    queryFn: () => base44.entities.Household.list(),
  });

  const person = galaxyData?.centerPerson || null;

  const { people, relationships } = useMemo(() => {
    if (!galaxyData) return { people: [], relationships: [] };

    const inverseType = {
      parent: "child",
      child: "parent",
      grandparent: "grandchild",
      grandchild: "grandparent",
      aunt_uncle: "niece_nephew",
      niece_nephew: "aunt_uncle",
      step_parent: "step_child",
      step_child: "step_parent",
    };

    const allPeople = [];
    const allRelationships = [];

    for (const ring of galaxyData.rings) {
      for (const entry of ring.people) {
        allPeople.push(entry.person);
        const type = (entry.relationship.relationship_type || "").toLowerCase();
        allRelationships.push({
          ...entry.relationship,
          person_id: personId,
          related_person_id: entry.person.id,
          _displayType: inverseType[type] || type,
        });
      }
    }

    if (galaxyData.centerPerson) {
      allPeople.push(galaxyData.centerPerson);
    }

    return { people: allPeople, relationships: allRelationships };
  }, [galaxyData, personId]);

  const { data: moments = [] } = useQuery({
    queryKey: ["moments"],
    queryFn: () => base44.entities.Moment.list(),
  });

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: () => base44.entities.CalendarEvent.list(),
  });

  const { data: loveNotes = [], isError: loveNotesError } = useQuery({
    queryKey: ["love-notes", "star-view"],
    queryFn: () => base44.entities.LoveNote.list(),
  });

  const { data: familyStories = [], isError: storiesError } = useQuery({
    queryKey: ["family-stories", "star-view"],
    queryFn: () => base44.entities.FamilyStory.list(),
  });

  const { data: trips = [], isError: tripsError } = useQuery({
    queryKey: ["trips", "star-view"],
    queryFn: () => base44.entities.Trip.list(),
  });

  const { data: tripParticipants = [], isError: participantsError } = useQuery({
    queryKey: ["trip-participants", "star-view"],
    queryFn: () => base44.entities.TripParticipant.list(),
  });

  const planets = useMemo(() => {
    if (!person) return [];
    return buildPlanets({
      person,
      personId,
      relationships,
      people,
      moments,
      calendarEvents,
      loveNotes,
      familyStories,
      trips,
      tripParticipants,
    });
  }, [person, personId, relationships, people, moments, calendarEvents, loveNotes, familyStories, trips, tripParticipants]);

  const handlePlanetHover = useCallback((planet, index) => {
    setStarGlow(index !== null ? 1.08 : 1);
  }, []);

  const handlePlanetFocus = useCallback((planet, index) => {
    setFocusedPlanet(prev => {
      if (prev && planet && prev.key === planet.key) return null;
      return planet || null;
    });
  }, []);


  if (loadingPeople) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl text-slate-400 mb-4">Star not found</p>
          <Link
            to="/family"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  const age = getPersonAge(person);
  const isMinor = age !== null && age < PUBLIC_PROFILE_MIN_AGE;
  const isUnder18 = age !== null && age < 18;
  const isViewerParent =
    isUnder18 &&
    myPerson &&
    relationships.some((rel) => {
      const type = (rel.relationship_type || "").toLowerCase();
      const idA = rel.person_id || rel.person1_id;
      const idB = rel.related_person_id || rel.person2_id;
      return (
        (type === "parent" && idA === myPerson.id && idB === personId) ||
        (type === "child" && idA === personId && idB === myPerson.id)
      );
    });

  if (isMinor) {
    const parentNames = relationships
      .filter((rel) => {
        const type = (rel.relationship_type || "").toLowerCase();
        const idA = rel.person_id || rel.person1_id;
        const idB = rel.related_person_id || rel.person2_id;
        return (
          (type === "parent" && idB === personId) ||
          (type === "child" && idA === personId)
        );
      })
      .map((rel) => {
        const type = (rel.relationship_type || "").toLowerCase();
        const parentId =
          type === "parent"
            ? rel.person_id || rel.person1_id
            : rel.related_person_id || rel.person2_id;
        const parent = people.find((p) => p.id === parentId);
        return parent?.name;
      })
      .filter(Boolean);

    const starProfile = person.star_profile || DEFAULT_STAR_PROFILE;

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, #1e1b4b15 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #0f172a 0%, #000 100%)",
          }}
        />
        <div className="relative z-10 text-center space-y-4 flex flex-col items-center">
          <div className="relative w-[150px] h-[150px]">
            <Canvas
              camera={{ position: [0, 0, 4], fov: 50 }}
              gl={{ alpha: true, antialias: true }}
              style={{ background: "transparent" }}
            >
              <Suspense fallback={null}>
                <StarComponent
                  starProfile={starProfile || DEFAULT_STAR_PROFILE}
                  personId={personId}
                  position={[0, 0, 0]}
                  isHovered={false}
                  isFocused={true}
                  isMemorial={person.is_memorial}
                  globalOpacity={1}
                  globalScale={1.8}
                  animated={true}
                />
              </Suspense>
            </Canvas>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">{person.name}</h1>
          {parentNames.length > 0 && (
            <p className="text-slate-400">
              Child of {parentNames.join(" & ")}
            </p>
          )}
          <div className="flex items-center gap-2 justify-center text-slate-500 text-sm">
            <ShieldAlert className="w-4 h-4" />
            <span>Profile protected</span>
          </div>
          {isViewerParent && (
            <ParentControls
              person={person}
              personId={personId}
              age={age}
              people={people}
              households={households}
              queryClient={queryClient}
              toast={toast}
            />
          )}
          <Link
            to={fromGalaxy ? `/family?galaxy=${fromHouseholdId}` : '/family'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors mt-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  const starProfile = person.star_profile || DEFAULT_STAR_PROFILE;
  const visuals = getStarVisuals(starProfile, personId);
  const primaryColor = visuals.colors.primary || "#FBBF24";

  return (
    <div className="min-h-screen bg-slate-900 relative overflow-x-clip">

      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, ${primaryColor}08 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, #1e1b4b15 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #0f172a 0%, #000 100%)`,
          }}
        />
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: `${((i * 7 + 3) % 3) + 1}px`,
              height: `${((i * 7 + 3) % 3) + 1}px`,
              left: `${((i * 37 + 13) % 100)}%`,
              top: `${((i * 53 + 7) % 100)}%`,
              opacity: ((i * 11 + 5) % 5) * 0.1 + 0.1,
              animation: `twinkle-bg ${3 + ((i * 3) % 4)}s ease-in-out infinite`,
              animationDelay: `${(i * 7) % 5}s`,
            }}
          />
        ))}
        <style>{`
          @keyframes twinkle-bg {
            0%, 100% { opacity: 0.1; }
            50% { opacity: 0.6; }
          }
        `}</style>
      </div>

      <div className="relative z-10">
        <div className="absolute top-0 left-0 right-0 z-50">
          <div className="px-3 sm:px-4 py-2 sm:py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <button
                  onClick={handleGoBack}
                  className="flex items-center gap-1.5 sm:gap-2 group flex-shrink-0"
                >
                  <Home className="w-4 h-4 text-amber-400/70 group-hover:text-amber-300 transition-colors" />
                  <span className="hidden md:inline text-xs uppercase tracking-[0.2em] font-medium text-slate-500 group-hover:text-slate-300 transition-colors">
                    {fromGalaxy ? "Galaxy" : "Back"}
                  </span>
                </button>
                <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                <span className="text-xs uppercase tracking-[0.1em] sm:tracking-[0.2em] font-medium text-amber-400 truncate">
                  {person.name}
                </span>
                {person.nickname && (
                  <span className="hidden md:inline text-[10px] text-amber-300/50 tracking-wider flex-shrink-0">
                    "{person.nickname}"
                  </span>
                )}
              </div>

              <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                {age !== null && (
                  <span className="text-[10px] font-mono tracking-wider text-slate-500">
                    <span className="text-slate-600 mr-1">AGE</span>
                    {age}
                  </span>
                )}
                {person.role_type && (
                  <span className="text-[10px] uppercase tracking-[0.15em] text-amber-400/50 border border-amber-400/20 px-2 py-0.5 rounded">
                    {person.role_type}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setZoomLevel(z => Math.max(0.6, z - 0.15))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-amber-300 hover:border-amber-500/40 transition-colors text-sm font-bold"
                    title="Zoom out"
                  >
                    −
                  </button>
                  <button
                    onClick={() => setZoomLevel(1.0)}
                    className="px-2 h-7 flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700 text-slate-500 hover:text-slate-300 transition-colors text-[10px] font-mono"
                    title="Reset zoom"
                  >
                    {Math.round(zoomLevel * 100)}%
                  </button>
                  <button
                    onClick={() => setZoomLevel(z => Math.min(1.6, z + 0.15))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-amber-300 hover:border-amber-500/40 transition-colors text-sm font-bold"
                    title="Zoom in"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex md:hidden items-center gap-3 mt-1.5 pl-6">
              {age !== null && (
                <span className="text-[10px] font-mono tracking-wider text-slate-500">
                  AGE {age}
                </span>
              )}
              {person.role_type && (
                <span className="text-[10px] uppercase tracking-[0.15em] text-amber-400/50 border border-amber-400/20 px-2 py-0.5 rounded">
                  {person.role_type}
                </span>
              )}
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => setZoomLevel(z => Math.max(0.6, z - 0.15))}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-amber-300 transition-colors text-xs font-bold"
                  title="Zoom out"
                >
                  −
                </button>
                <button
                  onClick={() => setZoomLevel(1.0)}
                  className="px-1.5 h-6 flex items-center justify-center rounded-md bg-slate-800/80 border border-slate-700 text-slate-500 hover:text-slate-300 transition-colors text-[9px] font-mono"
                  title="Reset zoom"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  onClick={() => setZoomLevel(z => Math.min(1.6, z + 0.15))}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-amber-300 transition-colors text-xs font-bold"
                  title="Zoom in"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent" />
        </div>

        {isViewerParent && !isMinor && (
          <div className="absolute top-14 right-4 z-50">
            <ParentControls
              person={person}
              personId={personId}
              age={age}
              people={people}
              households={households}
              queryClient={queryClient}
              toast={toast}
            />
          </div>
        )}

        {/* Orbital view — centered in viewport */}
        <div className={`flex flex-col items-center ${isMobile ? 'justify-start' : 'justify-center'}`} style={{ minHeight: isMobile ? undefined : 'calc(100vh - 60px)', paddingTop: isMobile ? '70px' : '48px', paddingBottom: isMobile ? '16px' : undefined }}>
          <div
            ref={orbitContainerRef}
            className="relative"
            style={{
              width: `${orbitSize}px`,
              height: `${orbitSize}px`,
            }}
          >
            <WebGLErrorBoundary fallbackMessage="3D view couldn't load. You can retry to try again.">
              <Star3D
                starProfile={starProfile}
                personId={personId}
                isMemorial={person.is_memorial}
                glowIntensity={starGlow}
                isMobile={isMobile}
              />

              {!focusedPlanet && (
                <OrbitalEngine
                  planets={planets}
                  onPlanetHover={handlePlanetHover}
                  onPlanetFocus={handlePlanetFocus}
                  isMobile={isMobile}
                  containerSize={orbitSize}
                  personSeed={personId ? parseInt(personId, 10) || 42 : 42}
                  zoom={zoomLevel}
                />
              )}
            </WebGLErrorBoundary>
          </div>

          {focusedPlanet && (
            <PlanetDetailPanel
              planet={focusedPlanet}
              onClose={() => setFocusedPlanet(null)}
              personName={person.name}
            />
          )}

          {starProfile.essence && !focusedPlanet && (
            <p className="text-sm text-slate-400 italic text-center max-w-md mt-2 mb-4">
              "{starProfile.essence}"
            </p>
          )}
        </div>

        {/* Scrollable content below the orbital view */}
        <div className="relative z-10 flex flex-col items-center px-3 sm:px-4 pb-12">
          <MatchIndicator personId={personId} />
          {person.about && (
            <div className="w-full max-w-2xl mx-auto mt-2 sm:mt-6 p-4 sm:p-6 rounded-xl bg-slate-800/60 border border-slate-700/40">
              <h3 className="text-lg font-semibold text-slate-100 mb-3">
                About
              </h3>
              <p className="text-slate-300 leading-relaxed">{person.about}</p>
            </div>
          )}

          {person.social_links && Object.keys(person.social_links).length > 0 && (
            <div className="w-full max-w-2xl mx-auto mt-6 p-4 sm:p-6 rounded-xl bg-slate-800/60 border border-slate-700/40">
              <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <Link2 className="w-5 h-5 text-amber-400" />
                Social Accounts
              </h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(person.social_links).map(([platform, value]) => {
                  const labels = { facebook: 'Facebook', twitter: 'X (Twitter)', instagram: 'Instagram', linkedin: 'LinkedIn', tiktok: 'TikTok', youtube: 'YouTube' };
                  const prefixes = { facebook: 'https://facebook.com/', twitter: 'https://x.com/', instagram: 'https://instagram.com/', linkedin: 'https://linkedin.com/in/', tiktok: 'https://tiktok.com/@', youtube: 'https://youtube.com/@' };
                  const url = value.startsWith('http') ? value : `${prefixes[platform] || ''}${value.replace(/^@/, '')}`;
                  return (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/40 border border-slate-600/30 hover:border-amber-500/40 transition-colors group"
                    >
                      <span className="text-sm font-medium text-slate-300">{labels[platform] || platform}</span>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {person.star_profile &&
            (() => {
              const sp = person.star_profile;
              const interests = sp.interests || sp.hobbies || [];
              const favorites = sp.favorites || {};
              const hasContent =
                interests.length > 0 ||
                Object.keys(favorites).length > 0 ||
                sp.bio;
              if (!hasContent) return null;
              return (
                <div className="w-full max-w-2xl mx-auto mt-6 p-6 rounded-xl bg-slate-800/60 border border-slate-700/40">
                  <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-rose-400" />
                    Profile
                  </h3>
                  {sp.bio && (
                    <p className="text-slate-300 mb-4">{sp.bio}</p>
                  )}
                  {interests.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-slate-500 mb-2">Interests</p>
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(interests)
                          ? interests
                          : [interests]
                        ).map((interest, i) => {
                          const name =
                            typeof interest === "string"
                              ? interest
                              : interest.name || interest;
                          return (
                            <span
                              key={i}
                              className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-sm border border-amber-500/25"
                            >
                              {name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {Object.keys(favorites).length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(favorites).map(([key, value]) => (
                        <div key={key} className="p-3 rounded-lg bg-slate-700/30">
                          <p className="text-xs text-slate-500 capitalize">
                            {key.replace(/_/g, " ")}
                          </p>
                          <p className="text-sm text-slate-200">{value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

          {(person.allergies || person.dietary_preferences) &&
            (() => {
              const allergies = person.allergies
                ? typeof person.allergies === "string"
                  ? person.allergies
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : person.allergies
                : [];
              const dietary = person.dietary_preferences
                ? typeof person.dietary_preferences === "string"
                  ? person.dietary_preferences
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : person.dietary_preferences
                : [];
              if (allergies.length === 0 && dietary.length === 0) return null;
              return (
                <div className="w-full max-w-2xl mx-auto mt-6 p-6 rounded-xl bg-slate-800/60 border border-slate-700/40">
                  <h3 className="text-lg font-semibold text-slate-100 mb-4">
                    Health & Dietary
                  </h3>
                  {allergies.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm text-slate-500 mb-2">Allergies</p>
                      <div className="flex flex-wrap gap-2">
                        {allergies.map((a, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm border border-red-500/30"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {dietary.length > 0 && (
                    <div>
                      <p className="text-sm text-slate-500 mb-2">
                        Dietary Preferences
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {dietary.map((d, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 rounded-full bg-slate-700 text-slate-300 text-sm"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          <RelationshipList
            relationships={relationships}
            people={people}
            personId={personId}
          />
          <MomentsGallery moments={moments} personId={personId} />

          <div className="h-12" />
        </div>
      </div>
    </div>
  );
}
