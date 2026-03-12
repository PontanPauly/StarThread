import React, { useMemo, useState, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Seeded random for consistent positioning
const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Position couples close together and their children branching from them
const positionFamily = (people, relationships, generations) => {
  const positions = new Map();
  const processed = new Set();
  
  // Find all couples (spouse relationships)
  const couples = new Map(); // person_id -> spouse_id
  relationships.forEach(rel => {
    if (rel.relationship_type === 'spouse') {
      couples.set(rel.person_id, rel.related_person_id);
    }
  });
  
  // Group by generation
  const byGeneration = new Map();
  people.forEach(p => {
    const gen = generations.get(p.id) || 0;
    if (!byGeneration.has(gen)) byGeneration.set(gen, []);
    byGeneration.get(gen).push(p);
  });
  
  const maxGen = Math.max(...Array.from(byGeneration.keys()));
  
  // Process generation by generation, starting from oldest (generation 0)
  byGeneration.forEach((members, gen) => {
    const radius = gen === 0 ? 5 : 15 + (gen * 20); // Gen 0 in center
    const goldenAngle = 137.5;
    
    // Group into family units (couples + singles)
    const familyUnits = [];
    const usedIds = new Set();
    
    members.forEach(person => {
      if (usedIds.has(person.id)) return;
      
      const spouseId = couples.get(person.id);
      const spouse = spouseId ? people.find(p => p.id === spouseId) : null;
      
      if (spouse && members.includes(spouse)) {
        familyUnits.push([person, spouse]);
        usedIds.add(person.id);
        usedIds.add(spouse.id);
      } else if (!usedIds.has(person.id)) {
        familyUnits.push([person]);
        usedIds.add(person.id);
      }
    });
    
    // Position each family unit
    familyUnits.forEach((unit, unitIndex) => {
      const angle = (unitIndex * goldenAngle + gen * 30) * (Math.PI / 180);
      const centerX = 50 + radius * Math.cos(angle);
      const centerY = 50 + radius * Math.sin(angle);
      
      if (unit.length === 2) {
        // Couple - position close together
        const offset = 2;
        positions.set(unit[0].id, {
          x: Math.max(5, Math.min(95, centerX - offset)),
          y: Math.max(5, Math.min(95, centerY))
        });
        positions.set(unit[1].id, {
          x: Math.max(5, Math.min(95, centerX + offset)),
          y: Math.max(5, Math.min(95, centerY))
        });
      } else {
        // Single person
        positions.set(unit[0].id, {
          x: Math.max(5, Math.min(95, centerX)),
          y: Math.max(5, Math.min(95, centerY))
        });
      }
    });
  });
  
  return positions;
};

export default function FamilyConstellation({ people, households, relationships }) {
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [hoveredPersonId, setHoveredPersonId] = useState(null);
  const [filterMode, setFilterMode] = useState('all');
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Calculate generations for positioning
  const generations = useMemo(() => {
    if (!people || !relationships) return new Map();
    
    const genMap = new Map();
    const hasParent = new Set();
    
    // Find who has parents
    relationships.forEach(rel => {
      if (rel.relationship_type === 'parent') {
        hasParent.add(rel.related_person_id);
      }
    });
    
    // Ancestors and adults without parents = generation 0
    const roots = people.filter(p => 
      !hasParent.has(p.id) && (p.role_type === 'adult' || p.role_type === 'ancestor' || p.is_deceased)
    );
    roots.forEach(p => genMap.set(p.id, 0));
    
    // BFS to assign generations
    let currentGen = roots;
    let genLevel = 0;
    const visited = new Set(roots.map(p => p.id));
    
    while (currentGen.length > 0) {
      const nextGen = [];
      currentGen.forEach(parent => {
        const children = relationships
          .filter(r => r.relationship_type === 'parent' && r.person_id === parent.id)
          .map(r => people.find(p => p.id === r.related_person_id))
          .filter(p => p && !visited.has(p.id));
        
        children.forEach(child => {
          genMap.set(child.id, genLevel + 1);
          visited.add(child.id);
          nextGen.push(child);
        });
      });
      
      currentGen = nextGen;
      genLevel++;
    }
    
    // Remaining people (no connections) go to outer ring
    people.forEach(p => {
      if (!genMap.has(p.id)) {
        genMap.set(p.id, genLevel);
      }
    });
    
    return genMap;
  }, [people, relationships]);

  // Generate positions with couples clustered together
  const positions = useMemo(() => {
    if (!people || !relationships) return new Map();
    
    if (filterMode === 'household' && selectedHouseholdId) {
      const household = people.filter(p => p.household_id === selectedHouseholdId);
      return positionFamily(household, relationships, generations);
    }
    
    return positionFamily(people, relationships, generations);
  }, [people, relationships, generations, filterMode, selectedHouseholdId]);

  // Visible people
  const visiblePeople = useMemo(() => {
    if (!people) return [];
    if (filterMode === 'ancestors') return people.filter(p => p.is_deceased || p.role_type === 'ancestor');
    if (filterMode === 'living') return people.filter(p => !p.is_deceased && p.role_type !== 'ancestor');
    if (filterMode === 'household' && selectedHouseholdId) return people.filter(p => p.household_id === selectedHouseholdId);
    return people;
  }, [people, filterMode, selectedHouseholdId]);

  // Connection lines
  const connections = useMemo(() => {
    if (!relationships || !visiblePeople) return [];
    
    return relationships
      .filter(r => {
        const hasSource = visiblePeople.find(p => p.id === r.person_id);
        const hasTarget = visiblePeople.find(p => p.id === r.related_person_id);
        return hasSource && hasTarget && positions.get(r.person_id) && positions.get(r.related_person_id);
      })
      .map(r => {
        const source = positions.get(r.person_id);
        const target = positions.get(r.related_person_id);
        const isHighlighted = selectedPersonId === r.person_id || selectedPersonId === r.related_person_id;
        
        return { ...r, source, target, isHighlighted };
      });
  }, [relationships, visiblePeople, positions, selectedPersonId]);

  // Star visuals with variation
  const getStarVisuals = (person) => {
    const seed = person.id.charCodeAt(0) + person.id.charCodeAt(person.id.length - 1);
    const isAncestor = person.is_deceased || person.role_type === 'ancestor';
    
    let baseSize = 12;
    if (person.role_type === 'child') baseSize = 10;
    else if (person.role_type === 'teen') baseSize = 11;
    else if (isAncestor) baseSize = 14;
    
    // Add subtle size variation for organic feel
    const sizeVariation = seededRandom(seed) * 3;
    const size = baseSize + sizeVariation;
    
    // Color variation
    const baseColor = isAncestor ? '#FBBF77' : '#60A5FA';
    const glowColor = isAncestor ? '#FDBA74' : '#93C5FD';
    
    // Brightness variation
    const brightness = 0.8 + seededRandom(seed * 2) * 0.4;
    
    // Twinkle delay
    const twinkleDelay = seededRandom(seed * 3) * 8;
    
    return { size, baseColor, glowColor, brightness, twinkleDelay };
  };

  const selectedPerson = people?.find(p => p.id === selectedPersonId);

  if (!people || people.length === 0) {
    return (
      <div className="relative w-full h-[600px] rounded-2xl bg-gradient-to-b from-[#050716] to-[#03040d] flex items-center justify-center">
        <p className="text-slate-500">No family members yet</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Deep space background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#000000] via-[#020206] to-[#030308]" />
        
        {/* Distant stars - multiple layers for depth */}
        <div className="absolute inset-0 opacity-50">
          {[...Array(100)].map((_, i) => {
            const x = seededRandom(i * 7) * 100;
            const y = seededRandom(i * 11) * 100;
            const size = seededRandom(i * 13) < 0.7 ? 1 : 1.5;
            const opacity = 0.3 + seededRandom(i * 17) * 0.5;
            const delay = seededRandom(i * 19) * 5;
            
            return (
              <div
                key={i}
                className="absolute rounded-full bg-white"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: size,
                  height: size,
                  opacity,
                  animation: `twinkle ${3 + seededRandom(i * 23) * 4}s ease-in-out infinite`,
                  animationDelay: `${delay}s`,
                }}
              />
            );
          })}
        </div>

        {/* Nebula clouds */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute w-[600px] h-[600px] rounded-full top-[20%] left-[15%]"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.5) 0%, transparent 60%)',
              filter: 'blur(100px)',
            }}
          />
          <div className="absolute w-[500px] h-[500px] rounded-full bottom-[25%] right-[20%]"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.4) 0%, transparent 60%)',
              filter: 'blur(90px)',
            }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-20 right-4 z-50 glass-card rounded-xl px-4 py-3 border border-slate-700/50 space-y-2">
        <Select value={filterMode} onValueChange={setFilterMode}>
          <SelectTrigger className="h-8 text-xs bg-slate-800/90 border-slate-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all">Whole Universe</SelectItem>
            <SelectItem value="living">Living</SelectItem>
            <SelectItem value="ancestors">Ancestors</SelectItem>
            <SelectItem value="household">Household</SelectItem>
          </SelectContent>
        </Select>

        {filterMode === 'household' && (
          <Select value={selectedHouseholdId} onValueChange={setSelectedHouseholdId}>
            <SelectTrigger className="h-8 text-xs bg-slate-800/90 border-slate-700">
              <SelectValue placeholder="Select household" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {households.map(h => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex gap-1 pt-2 border-t border-slate-700/50">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400" onClick={() => setZoom(z => Math.min(z + 0.2, 3))}>
            <span className="text-xs">+</span>
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400" onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))}>
            <span className="text-xs">−</span>
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
            <span className="text-xs">⊙</span>
          </Button>
        </div>
        <div className="pt-2 border-t border-slate-700/50 text-xs text-slate-500">
          <p>{visiblePeople.length} stars</p>
        </div>
      </div>

      {/* Constellation */}
      <div 
        className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => {
          setIsDragging(true);
          setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }}
        onMouseMove={(e) => {
          if (isDragging) {
            setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
          }
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onWheel={(e) => {
          e.preventDefault();
          const delta = e.deltaY * -0.001;
          setZoom(z => Math.min(Math.max(0.5, z + delta), 3));
        }}
      >
        {/* Connection lines */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none" 
          viewBox="0 0 100 100" 
          preserveAspectRatio="none"
          style={{ 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center'
          }}
        >
          {connections.map((conn, i) => {
            let opacity = 0.15;
            let width = 0.15;
            let color = '#FBBF24';
            
            if (conn.relationship_type === 'spouse' || conn.relationship_type === 'partner') {
              color = '#EC4899';
              opacity = 0.25;
              width = 0.2;
            }
            
            if (conn.isHighlighted) {
              opacity = 0.6;
              width *= 2;
            }

            return (
              <line
                key={i}
                x1={conn.source.x}
                y1={conn.source.y}
                x2={conn.target.x}
                y2={conn.target.y}
                stroke={color}
                strokeOpacity={opacity}
                strokeWidth={width}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {/* Stars */}
        <div 
          className="absolute inset-0"
          style={{ 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center'
          }}
        >
          {visiblePeople.map(person => {
            const pos = positions.get(person.id);
            if (!pos) return null;

            const { size, baseColor, glowColor, brightness, twinkleDelay } = getStarVisuals(person);
            const isSelected = selectedPersonId === person.id;
            const isHovered = hoveredPersonId === person.id;
            const finalSize = isSelected ? size * 1.5 : isHovered ? size * 1.25 : size;

            return (
              <div
                key={person.id}
                className="absolute cursor-pointer transition-all duration-500 ease-out hover:z-20"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              onMouseEnter={() => setHoveredPersonId(person.id)}
              onMouseLeave={() => setHoveredPersonId(null)}
              onClick={() => setSelectedPersonId(person.id)}
            >
              <div style={{ width: finalSize, height: finalSize }} className="relative">
                {/* Core star */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle at 40% 35%, ${baseColor}, transparent 65%)`,
                    filter: 'blur(0.4px)',
                    opacity: brightness,
                    animation: isSelected ? 'none' : `twinkle ${4 + twinkleDelay}s ease-in-out infinite`,
                    animationDelay: `${twinkleDelay}s`,
                  }}
                />

                {/* Glow */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    width: finalSize * 2.5,
                    height: finalSize * 2.5,
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: `radial-gradient(circle, ${glowColor}40 0%, transparent 60%)`,
                    opacity: isSelected || isHovered ? 1 : 0.4,
                    transition: 'opacity 0.3s',
                  }}
                />

                {/* Bright center point */}
                <div
                  className="absolute rounded-full bg-white"
                  style={{
                    width: finalSize * 0.3,
                    height: finalSize * 0.3,
                    left: '40%',
                    top: '35%',
                    transform: 'translate(-50%, -50%)',
                    opacity: 0.9,
                  }}
                />
              </div>

              {/* Label */}
              {(isHovered || isSelected) && (
                <div className="absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap z-50 animate-in fade-in duration-200">
                  <div className="rounded-lg border border-amber-500/30 bg-slate-900/95 px-3 py-1.5 text-xs backdrop-blur-md shadow-xl">
                    <div className="font-medium text-white">{person.name}</div>
                    {person.nickname && <div className="text-[10px] text-amber-400">"{person.nickname}"</div>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>

      {/* Info panel */}
      {selectedPerson && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[480px] max-w-[calc(100vw-2rem)] glass-card rounded-2xl p-6 border border-amber-500/30 z-50 animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-amber-500/30">
                {selectedPerson.photo_url ? (
                  <img src={selectedPerson.photo_url} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl text-slate-400">{selectedPerson.name?.charAt(0)}</span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{selectedPerson.name}</h3>
                {selectedPerson.nickname && <p className="text-sm text-amber-400 mt-0.5">"{selectedPerson.nickname}"</p>}
                <Badge className="mt-2 bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                  {selectedPerson.role_type}
                </Badge>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedPersonId(null)} className="text-slate-400">
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {selectedPerson.about && (
            <p className="text-sm text-slate-400 mt-4 leading-relaxed">{selectedPerson.about}</p>
          )}

          {selectedPerson.household_id && (
            <p className="text-xs text-slate-500 mt-3">
              {households.find(h => h.id === selectedPerson.household_id)?.name}
            </p>
          )}
        </div>
      )}

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}