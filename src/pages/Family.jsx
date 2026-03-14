import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMyPerson } from "@/hooks/useMyPerson";
import { 
  Users, 
  Plus, 
  Search,
  Home as HomeIcon,
  User,
  Baby,
  UserCheck,
  Star,
  MoreHorizontal,
  Edit,
  Trash2,
  ChevronRight,
  Network,
  AlertCircle
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import PersonForm from "@/components/family/PersonForm";
import AddPersonDialog from "@/components/family/AddPersonDialog";
import HouseholdForm from "@/components/family/HouseholdForm";
import LineageView from "@/components/family/LineageView";
import GalaxyView from "@/components/constellation/GalaxyView";
import WebGLErrorBoundary from "@/components/WebGLErrorBoundary";
import FamilySuggestions from "@/components/identity/FamilySuggestions";

export default function Family() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [ageFilter, setAgeFilter] = useState("all");
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [showHouseholdForm, setShowHouseholdForm] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialGalaxyId = searchParams.get('galaxy');
  const [editingPerson, setEditingPerson] = useState(null);
  const [editingHousehold, setEditingHousehold] = useState(null);
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [viewMode, setViewMode] = useState('galaxy');
  const [galaxyCenterId, setGalaxyCenterId] = useState(null);
  const [navigateToPersonId, setNavigateToPersonId] = useState(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const { data: myPerson } = useMyPerson();

  useEffect(() => {
    if (myPerson && !galaxyCenterId) {
      setGalaxyCenterId(myPerson.id);
    }
  }, [myPerson, galaxyCenterId]);

  const { data: universeData, isLoading: loadingUniverse } = useQuery({
    queryKey: ['universe-members'],
    queryFn: async () => {
      const response = await fetch('/api/family/universe-members', { credentials: 'include' });
      if (!response.ok) return { people: [], relationships: [], households: [] };
      return response.json();
    },
    staleTime: 30000,
  });

  const rawPeople = universeData?.people || [];
  const rawHouseholds = universeData?.households || [];
  const relationships = universeData?.relationships || [];
  const loadingPeople = loadingUniverse;
  const loadingHouseholds = loadingUniverse;

  const { people, households } = useMemo(() => {
    const householdless = rawPeople.filter(p => !p.household_id);
    if (householdless.length === 0) return { people: rawPeople, households: rawHouseholds };

    const personHouseholdMap = {};
    for (const p of rawPeople) {
      if (p.household_id) personHouseholdMap[p.id] = p.household_id;
    }

    const assignments = {};
    for (const person of householdless) {
      let bestHouseholdId = null;
      for (const rel of relationships) {
        const otherId = rel.person_id === person.id ? rel.related_person_id : 
                        rel.related_person_id === person.id ? rel.person_id : null;
        if (otherId && personHouseholdMap[otherId]) {
          bestHouseholdId = personHouseholdMap[otherId];
          break;
        }
      }

      if (bestHouseholdId) {
        assignments[person.id] = bestHouseholdId;
      } else {
        assignments[person.id] = '__connected_family__';
      }
    }

    const needsVirtualHousehold = Object.values(assignments).some(v => v === '__connected_family__');
    const virtualHouseholds = [];
    if (needsVirtualHousehold) {
      virtualHouseholds.push({ id: '__connected_family__', name: 'Connected Family' });
    }

    const augmentedPeople = rawPeople.map(p => {
      if (!p.household_id && assignments[p.id]) {
        return { ...p, household_id: assignments[p.id] };
      }
      return p;
    });

    return {
      people: augmentedPeople,
      households: [...rawHouseholds, ...virtualHouseholds],
    };
  }, [rawPeople, rawHouseholds, relationships]);

  const { data: galaxyData } = useQuery({
    queryKey: ['galaxy', galaxyCenterId],
    queryFn: async () => {
      const response = await fetch(`/api/relationships/galaxy/${galaxyCenterId}`, { credentials: 'include' });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!galaxyCenterId,
    staleTime: 30000,
  });

  const deletePerson = useMutation({
    mutationFn: (id) => base44.entities.Person.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['universe-members']),
  });

  const deleteHousehold = useMutation({
    mutationFn: (id) => base44.entities.Household.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['universe-members']),
  });



  const filteredPeople = people.filter(person => {
    const matchesSearch = person.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      person.nickname?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || person.role_type === roleFilter;
    
    let matchesAge = true;
    if (ageFilter === "children") {
      matchesAge = person.role_type === "child";
    } else if (ageFilter === "teens") {
      matchesAge = person.role_type === "teen";
    } else if (ageFilter === "adults") {
      matchesAge = person.role_type === "adult" || person.role_type === "ancestor";
    }
    
    return matchesSearch && matchesRole && matchesAge;
  });

  const getPeopleInHousehold = (householdId) => {
    return filteredPeople.filter(p => p.household_id === householdId);
  };

  const getPeopleWithoutHousehold = () => {
    return filteredPeople.filter(p => !p.household_id);
  };

  const getRoleIcon = (roleType) => {
    switch(roleType) {
      case 'adult': return User;
      case 'teen': return UserCheck;
      case 'child': return Baby;
      case 'ancestor': return Star;
      default: return User;
    }
  };

  const getRoleBadgeColor = (roleType) => {
    switch(roleType) {
      case 'adult': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'teen': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'child': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'ancestor': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const householdColors = [
    'from-blue-500 to-cyan-500',
    'from-purple-500 to-pink-500',
    'from-amber-500 to-orange-500',
    'from-green-500 to-emerald-500',
    'from-rose-500 to-red-500',
    'from-indigo-500 to-violet-500',
  ];

  const getHouseholdColor = (index) => {
    return householdColors[index % householdColors.length];
  };

  const handlePersonClick = useCallback((person) => navigate(`/star/${person.id}`), [navigate]);
  const handleRecenterGalaxy = useCallback((personId) => setGalaxyCenterId(personId), []);
  const handleNavigateToStar = useCallback((person, householdId) => navigate(`/star/${person.id}${householdId ? `?from=galaxy&household=${householdId}` : ''}`), [navigate]);
  const handleNavigateToGalaxy = useCallback((person) => setGalaxyCenterId(person.id), []);

  if (loadingPeople || loadingHouseholds) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Galaxy View - 3D WebGL Universe */}
      {viewMode === 'galaxy' ? (
        <div className="fixed top-16 lg:top-0 left-0 right-0 bottom-0 lg:left-64 z-0">
          <WebGLErrorBoundary onSwitchView={() => setViewMode('list')}>
            <GalaxyView 
              people={people}
              households={households}
              relationships={relationships}
              galaxyData={galaxyData}
              onPersonClick={handlePersonClick}
              onRecenterGalaxy={handleRecenterGalaxy}
              onNavigateToStar={handleNavigateToStar}
              onNavigateToGalaxy={handleNavigateToGalaxy}
              myPerson={myPerson}
              initialGalaxyId={initialGalaxyId}
              navigateToPersonId={navigateToPersonId}
            />
          </WebGLErrorBoundary>
          {/* Floating Controls */}
          <div className="fixed top-[4.5rem] lg:top-4 left-3 sm:left-4 lg:left-68 right-3 sm:right-4 z-50 pointer-events-none">
            <div className="flex items-center justify-end gap-2">
              <div className="glass-card rounded-xl px-3 py-1.5 border border-slate-700/50 pointer-events-auto flex-shrink-0 lg:hidden mr-auto">
                <h1 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  Universe
                </h1>
                <p className="text-[10px] text-slate-500 mt-0.5">{people.length} stars · {relationships.length} connections</p>
              </div>

              <div className="flex gap-1 pointer-events-auto items-center flex-shrink min-w-0">
                <Button
                  onClick={() => setMobileSearchOpen(true)}
                  className="lg:hidden bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-600 backdrop-blur-md h-8 w-8 p-0"
                  size="icon"
                >
                  <Search className="w-3.5 h-3.5" />
                </Button>
                <div className="relative hidden lg:block">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Find a star..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-32 xl:w-44 bg-slate-800/90 border-slate-600 text-slate-200 placeholder:text-slate-500 backdrop-blur-md h-8"
                  />
                  {searchQuery && (
                    <div className="absolute top-full right-0 mt-2 w-72 glass-card rounded-xl border border-slate-700/50 pointer-events-auto max-h-64 overflow-y-auto z-[60]">
                      {people
                        .filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                        .slice(0, 10)
                        .map(person => (
                          <button
                            key={person.id}
                            onClick={() => {
                              setNavigateToPersonId(person.id + ':' + Date.now());
                              setGalaxyCenterId(person.id);
                              setSearchQuery('');
                            }}
                            className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-700/50 transition-colors text-left border-b border-slate-800 last:border-0"
                          >
                            {person.photo_url ? (
                              <img src={person.photo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-amber-500/30" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-amber-500/30">
                                <User className="w-4 h-4 text-amber-400" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-slate-200">{person.name}</p>
                              {person.role_type && (
                                <p className="text-xs text-slate-500 capitalize">{person.role_type}</p>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-500 ml-auto" />
                          </button>
                        ))
                      }
                      {people.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                        <p className="px-4 py-3 text-sm text-slate-500">No stars found matching "{searchQuery}"</p>
                      )}
                    </div>
                  )}
                </div>
                <Button 
                  onClick={() => setViewMode('list')}
                  className="bg-slate-700/90 hover:bg-slate-600 text-white border border-slate-500 backdrop-blur-md h-8 w-8 lg:w-auto lg:px-3 p-0"
                  size="sm"
                >
                  <Users className="w-3.5 h-3.5 lg:mr-1.5" />
                  <span className="hidden lg:inline text-xs">List</span>
                </Button>
                <Button 
                  onClick={() => setViewMode('connections')}
                  className="bg-slate-700/90 hover:bg-slate-600 text-white border border-slate-500 backdrop-blur-md h-8 w-8 lg:w-auto lg:px-3 p-0"
                  size="sm"
                >
                  <Network className="w-3.5 h-3.5 lg:mr-1.5" />
                  <span className="hidden lg:inline text-xs">Lineage</span>
                </Button>
                <Button 
                  onClick={() => { setAddingChild(true); setShowPersonForm(true); }}
                  className="hidden xl:flex bg-indigo-500/90 hover:bg-indigo-600 text-white font-semibold backdrop-blur-md h-8 px-3"
                  size="sm"
                >
                  <Baby className="w-3.5 h-3.5 mr-1.5" />
                  <span className="text-xs">Add Child</span>
                </Button>
                <Button 
                  onClick={() => setShowPersonForm(true)}
                  className="bg-amber-500/90 hover:bg-amber-600 text-slate-900 font-semibold backdrop-blur-md h-8 w-8 lg:w-auto lg:px-3 p-0"
                  size="sm"
                >
                  <Plus className="w-3.5 h-3.5 lg:mr-1.5" />
                  <span className="hidden lg:inline text-xs">Add Star</span>
                </Button>
              </div>
            </div>
          </div>

          {mobileSearchOpen && (
            <div className="fixed inset-0 z-[70] bg-slate-950/95 backdrop-blur-md sm:hidden flex flex-col">
              <div className="flex items-center gap-2 p-3 border-b border-slate-700/50">
                <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <Input
                  autoFocus
                  placeholder="Find a star..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none text-slate-200 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <button
                  onClick={() => { setMobileSearchOpen(false); setSearchQuery(''); }}
                  className="p-2 text-slate-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {searchQuery && people
                  .filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .slice(0, 20)
                  .map(person => (
                    <button
                      key={person.id}
                      onClick={() => {
                        setNavigateToPersonId(person.id + ':' + Date.now());
                        setGalaxyCenterId(person.id);
                        setSearchQuery('');
                        setMobileSearchOpen(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-800/50 active:bg-slate-700/50 transition-colors text-left border-b border-slate-800/50"
                    >
                      {person.photo_url ? (
                        <img src={person.photo_url} alt="" className="w-10 h-10 rounded-full object-cover border border-amber-500/30" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border border-amber-500/30">
                          <User className="w-5 h-5 text-amber-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-200 truncate">{person.name}</p>
                        {person.role_type && (
                          <p className="text-xs text-slate-500 capitalize">{person.role_type}</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    </button>
                  ))
                }
                {searchQuery && people.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                  <p className="px-4 py-6 text-sm text-slate-500 text-center">No stars found matching "{searchQuery}"</p>
                )}
                {!searchQuery && (
                  <p className="px-4 py-6 text-sm text-slate-500 text-center">Type to search for a star...</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : viewMode === 'connections' ? (
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
                <Network className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                Family Connections
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Lineage and relationships across generations</p>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => setViewMode('galaxy')}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
                size="sm"
              >
                <Star className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Universe</span>
              </Button>
              <Button 
                onClick={() => setViewMode('list')}
                className="bg-slate-700 hover:bg-slate-600 text-white border border-slate-500"
                size="sm"
              >
                <Users className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">List View</span>
              </Button>
            </div>
          </div>

          {/* Lineage Tree */}
          <LineageView 
            people={people}
            relationships={relationships}
            onPersonClick={(person) => navigate(`/star/${person.id}`)}
          />
        </div>
      ) : (
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                  Family
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">{people.length} members · {households.length} households</p>
              </div>
              <Button 
                onClick={() => setShowPersonForm(true)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold sm:hidden"
                size="icon"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              <Button 
                onClick={() => setViewMode('galaxy')}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold flex-shrink-0"
                size="sm"
              >
                <Star className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Universe</span>
              </Button>
              <Button 
                onClick={() => setViewMode('connections')}
                className="bg-slate-700 hover:bg-slate-600 text-white border border-slate-500 flex-shrink-0"
                size="sm"
              >
                <Network className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Connections</span>
              </Button>
              <Button 
                onClick={() => setShowHouseholdForm(true)}
                className="bg-slate-700 hover:bg-slate-600 text-white border border-slate-500 flex-shrink-0"
                size="sm"
              >
                <HomeIcon className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Galaxy</span>
              </Button>
              <Button 
                onClick={() => { setAddingChild(true); setShowPersonForm(true); }}
                className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold flex-shrink-0"
                size="sm"
              >
                <Baby className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Child</span>
              </Button>
              <Button 
                onClick={() => setShowPersonForm(true)}
                className="hidden sm:flex bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold flex-shrink-0"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Person
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <Input
                placeholder="Search family members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-500 text-white placeholder:text-slate-300 focus:border-amber-400"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg bg-slate-800 border border-slate-500 text-sm text-white focus:border-amber-400"
              >
                <option value="all">All Roles</option>
                <option value="adult">Adults</option>
                <option value="teen">Teens</option>
                <option value="child">Children</option>
                <option value="ancestor">Ancestors</option>
              </select>
              <select
                value={ageFilter}
                onChange={(e) => setAgeFilter(e.target.value)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg bg-slate-800 border border-slate-500 text-sm text-white focus:border-amber-400"
              >
                <option value="all">All Ages</option>
                <option value="children">Children</option>
                <option value="teens">Teens</option>
                <option value="adults">Adults</option>
              </select>
            </div>
          </div>

          <FamilySuggestions />

          {/* Households */}
          <div className="space-y-6">
            {households.map((household, index) => {
          const householdPeople = getPeopleInHousehold(household.id);
          
          return (
            <div key={household.id} className="glass-card rounded-2xl overflow-hidden">
              {/* Household Header */}
              <div className={cn(
                "p-4 bg-gradient-to-r",
                getHouseholdColor(index)
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <HomeIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">{household.name}</h2>
                      <p className="text-sm text-white/70">{householdPeople.length} members</p>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/30">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                      <DropdownMenuItem 
                        onClick={() => {
                          setEditingHousehold(household);
                          setShowHouseholdForm(true);
                        }}
                        className="text-slate-200 focus:bg-slate-700"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => deleteHousehold.mutate(household.id)}
                        className="text-red-400 focus:bg-slate-700 focus:text-red-400"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              {/* Members */}
              <div className="p-4">
                {householdPeople.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {householdPeople.map((person) => {
                      const RoleIcon = getRoleIcon(person.role_type);

                      // Get relationship summary
                      const personParents = relationships.filter(r => 
                        r.relationship_type === 'parent' && r.related_person_id === person.id
                      ).map(r => people.find(p => p.id === r.person_id)?.name).filter(Boolean);

                      const personPartner = relationships.find(r => 
                        r.relationship_type === 'partner' && 
                        (r.person_id === person.id || r.related_person_id === person.id)
                      );
                      const partnerName = personPartner ? 
                        people.find(p => p.id === (personPartner.person_id === person.id ? personPartner.related_person_id : personPartner.person_id))?.name 
                        : null;

                      return (
                        <div 
                          key={person.id}
                          className="p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors border border-slate-700/50 cursor-pointer group"
                          onClick={() => navigate(`/star/${person.id}`)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                              {person.photo_url ? (
                                <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-lg font-medium text-slate-400">
                                  {person.name?.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-slate-100 truncate">{person.name}</h3>
                                {person.is_deceased && (
                                  <Star className="w-3 h-3 text-amber-400" />
                                )}
                              </div>
                              {person.nickname && (
                                <p className="text-sm text-amber-400">"{person.nickname}"</p>
                              )}
                              <Badge className={cn("mt-2 border", getRoleBadgeColor(person.role_type))}>
                                <RoleIcon className="w-3 h-3 mr-1" />
                                {person.role_type}
                              </Badge>

                              {/* Relationship summary */}
                              {(personParents.length > 0 || partnerName) && (
                                <div className="mt-2 text-xs text-slate-400 space-y-0.5">
                                  {personParents.length > 0 && (
                                    <div>Parents: {personParents.join(", ")}</div>
                                  )}
                                  {partnerName && (
                                    <div>Partner: {partnerName}</div>
                                  )}
                                </div>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                          </div>
                          
                          {(person.allergies?.length > 0 || person.dietary_preferences?.length > 0) && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {person.allergies?.map((allergy, i) => (
                                <Badge key={i} variant="outline" className="text-xs border-red-500/30 text-red-400">
                                  <AlertCircle className="w-2.5 h-2.5 mr-1" />
                                  {allergy}
                                </Badge>
                              ))}
                              {person.dietary_preferences?.map((pref, i) => (
                                <Badge key={i} variant="outline" className="text-xs border-slate-600 text-slate-400">
                                  {pref}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No members in this household yet</p>
                  </div>
                )}
              </div>
              </div>
            );
          })}

          {/* People without household */}
          {getPeopleWithoutHousehold().length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-700/50">
                <h2 className="text-lg font-semibold text-slate-100">Unassigned Members</h2>
                <p className="text-sm text-slate-500">Not yet assigned to a galaxy</p>
              </div>
              <div className="p-4">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {getPeopleWithoutHousehold().map((person) => {
                    const RoleIcon = getRoleIcon(person.role_type);
                    return (
                      <div 
                        key={person.id}
                        className="p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors border border-slate-700/50 cursor-pointer"
                        onClick={() => navigate(`/star/${person.id}`)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
                            <span className="text-lg font-medium text-slate-400">
                              {person.name?.charAt(0)}
                            </span>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-slate-100">{person.name}</h3>
                            <Badge className={cn("mt-1 border", getRoleBadgeColor(person.role_type))}>
                              <RoleIcon className="w-3 h-3 mr-1" />
                              {person.role_type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {people.length === 0 && households.length === 0 && (
            <div className="glass-card rounded-2xl p-6 sm:p-12 text-center">
              <Users className="w-12 h-12 sm:w-16 sm:h-16 text-slate-700 mx-auto mb-4" />
              <h2 className="text-lg sm:text-xl font-semibold text-slate-200 mb-2">Start Building Your Family</h2>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                Add galaxies and family members to begin creating your family universe.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button 
                  onClick={() => setShowHouseholdForm(true)}
                  className="bg-slate-700 hover:bg-slate-600 text-white border-2 border-slate-500"
                >
                  <HomeIcon className="w-4 h-4 mr-2" />
                  Create Galaxy
                </Button>
                <Button 
                  onClick={() => { setAddingChild(true); setShowPersonForm(true); }}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold"
                >
                  <Baby className="w-4 h-4 mr-2" />
                  Add Child
                </Button>
                <Button 
                  onClick={() => setShowPersonForm(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Person
                </Button>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Person Form Dialog - Only admins can edit */}
      <AddPersonDialog
        open={showPersonForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowPersonForm(false);
            setAddingChild(false);
          }
        }}
        households={households}
        defaultRelType={addingChild ? "child" : null}
        onSuccess={() => {
          queryClient.invalidateQueries(['universe-members']);
          queryClient.invalidateQueries(['galaxy']);
        }}
      />

      {editingPerson && (
        <Dialog open={!!editingPerson} onOpenChange={(open) => {
          if (!open) setEditingPerson(null);
        }}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-slate-100">View Person</DialogTitle>
            </DialogHeader>
            <PersonForm
              person={editingPerson}
              households={households}
              people={people}
              onSuccess={() => {
                setEditingPerson(null);
                queryClient.invalidateQueries(['universe-members']);
              }}
              onCancel={() => setEditingPerson(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Household Form Dialog */}
      <Dialog open={showHouseholdForm || !!editingHousehold} onOpenChange={(open) => {
        if (!open) {
          setShowHouseholdForm(false);
          setEditingHousehold(null);
        }
      }}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {editingHousehold ? 'Edit Household' : 'Add New Household'}
            </DialogTitle>
          </DialogHeader>
          <HouseholdForm 
            household={editingHousehold}
            onSuccess={() => {
              setShowHouseholdForm(false);
              setEditingHousehold(null);
              queryClient.invalidateQueries(['universe-members']);
            }}
            onCancel={() => {
              setShowHouseholdForm(false);
              setEditingHousehold(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}