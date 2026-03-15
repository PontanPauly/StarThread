import React, { useMemo, useState, useRef, useCallback, useEffect, Suspense, createContext, useContext } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import HouseholdCluster, { HOUSEHOLD_COLORS, StarMapCluster, SystemAura } from './HouseholdCluster';
import RelationshipCluster from './RelationshipCluster';
import { classifyHousehold, computeHouseholdEdges } from '@/lib/starClassification';
import { ChevronRight, ZoomIn, ZoomOut, RotateCcw, Home, Eye, EyeOff, Filter } from 'lucide-react';
import { generateRandomStarProfile, COLOR_PALETTES } from '@/lib/starConfig';
import { StarInstanced } from './Star';

const RELATIONSHIP_FILTER_CATEGORIES = {
  blood: { label: 'Blood', types: ['parent', 'child', 'sibling', 'grandparent', 'grandchild'] },
  marriage: { label: 'Marriage', types: ['spouse', 'partner', 'in_law'] },
  step: { label: 'Step', types: ['step_parent', 'step_child', 'step_sibling'] },
  extended: { label: 'Extended', types: ['aunt_uncle', 'niece_nephew', 'cousin', 'extended', 'uncle', 'aunt'] },
  chosen_family: { label: 'Chosen', types: ['chosen_family'] },
};

function getHouseholdsMatchingFilters(households, people, relationships, householdPositions, filters) {
  const activeRelTypes = filters.relationshipTypes || [];
  const activeGeneration = filters.generation;
  const hasRelFilter = activeRelTypes.length > 0;
  const hasGenFilter = activeGeneration !== null && activeGeneration !== undefined;

  if (!hasRelFilter && !hasGenFilter) return null;

  const allowedTypes = new Set();
  activeRelTypes.forEach(cat => {
    const category = RELATIONSHIP_FILTER_CATEGORIES[cat];
    if (category) category.types.forEach(t => allowedTypes.add(t));
  });

  const matchingHouseholds = new Set();

  if (hasRelFilter) {
    const personToHousehold = new Map();
    people.forEach(p => { if (p.household_id) personToHousehold.set(p.id, p.household_id); });

    relationships.forEach(rel => {
      const type = (rel.relationship_type || '').toLowerCase();
      if (!allowedTypes.has(type)) return;
      const idA = rel.person_id || rel.person1_id;
      const idB = rel.related_person_id || rel.person2_id;
      const hhA = personToHousehold.get(idA);
      const hhB = personToHousehold.get(idB);
      if (hhA) matchingHouseholds.add(hhA);
      if (hhB) matchingHouseholds.add(hhB);
    });
  }

  if (hasGenFilter) {
    const genMatching = new Set();
    households.forEach(h => {
      const pos = householdPositions.get(h.id);
      if (pos && pos.generation === activeGeneration) genMatching.add(h.id);
    });
    if (hasRelFilter) {
      const intersection = new Set();
      genMatching.forEach(id => { if (matchingHouseholds.has(id)) intersection.add(id); });
      return intersection;
    }
    return genMatching;
  }

  return matchingHouseholds;
}

function createRadialGlowTexture(size = 128) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.15, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.15)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.03)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

let _glowTexture = null;
function getGlowTexture() {
  if (!_glowTexture) _glowTexture = createRadialGlowTexture(128);
  return _glowTexture;
}

const TransitionContext = createContext({
  progress: 0,
  isActive: false,
  direction: null,
});

function useTransitionProgress() {
  return useContext(TransitionContext);
}

const QUALITY_TIERS = {
  ultra: {
    tier: 'ultra', starCount: 70000, gasCount: 1200, filamentCount: 300,
    driftCount: 800, bgStarCount: 5000, curveSegments: 20, sphereSegments: 48,
    nebulaOctaves: 4, nebulaFbmCalls: 4, showFilaments: true, showGasCloud: true,
    showDrift: true, showNebula: true, dpr: [1, 2], useGlb: true
  },
  high: {
    tier: 'high', starCount: 55000, gasCount: 800, filamentCount: 200,
    driftCount: 500, bgStarCount: 3500, curveSegments: 16, sphereSegments: 32,
    nebulaOctaves: 3, nebulaFbmCalls: 3, showFilaments: true, showGasCloud: true,
    showDrift: true, showNebula: true, dpr: [1, 1.5], useGlb: true
  },
  medium: {
    tier: 'medium', starCount: 40000, gasCount: 500, filamentCount: 100,
    driftCount: 300, bgStarCount: 2000, curveSegments: 12, sphereSegments: 24,
    nebulaOctaves: 3, nebulaFbmCalls: 3, showFilaments: true, showGasCloud: true,
    showDrift: true, showNebula: true, dpr: 1, useGlb: true
  },
  low: {
    tier: 'low', starCount: 25000, gasCount: 0, filamentCount: 0,
    driftCount: 0, bgStarCount: 1000, curveSegments: 8, sphereSegments: 16,
    nebulaOctaves: 2, nebulaFbmCalls: 2, showFilaments: false, showGasCloud: false,
    showDrift: false, showNebula: true, dpr: 1, useGlb: false
  }
};

function detectQualityTier() {
  if (typeof window === 'undefined') return QUALITY_TIERS.low;
  
  try {
    const saved = localStorage.getItem('starthread_quality_tier');
    if (saved && QUALITY_TIERS[saved]) return QUALITY_TIERS[saved];
  } catch (e) {}

  const cores = navigator.hardwareConcurrency || 4;
  const dpr = window.devicePixelRatio || 1;
  const screenPixels = window.innerWidth * window.innerHeight * dpr;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  let gpuTier = 'unknown';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL).toLowerCase();

        const isIntegrated = renderer.includes('intel') || renderer.includes('mesa') ||
          renderer.includes('llvmpipe') || renderer.includes('swiftshader') ||
          renderer.includes('software');
        const isHighEnd = renderer.includes('rtx') || renderer.includes('rx 7') ||
          renderer.includes('rx 6') || renderer.includes('m1') || renderer.includes('m2') ||
          renderer.includes('m3') || renderer.includes('m4') ||
          (renderer.includes('apple') && !isMobile);
        const isMidRange = renderer.includes('gtx') || renderer.includes('rx 5') ||
          renderer.includes('radeon pro') || renderer.includes('amd');

        if (isHighEnd) gpuTier = 'high';
        else if (isIntegrated) gpuTier = 'low';
        else if (isMidRange) gpuTier = 'mid';
        else gpuTier = 'mid';
      }
      const loseCtx = gl.getExtension('WEBGL_lose_context');
      if (loseCtx) loseCtx.loseContext();
    }
  } catch (e) {}

  let tier;
  if (isMobile) {
    tier = 'low';
  } else if (gpuTier === 'low' || cores <= 2) {
    tier = 'low';
  } else if (gpuTier === 'unknown') {
    tier = cores >= 4 ? 'medium' : 'low';
  } else if (gpuTier === 'high' && cores >= 8 && screenPixels < 5000000) {
    tier = 'ultra';
  } else if ((gpuTier === 'high' || gpuTier === 'mid') && cores >= 6) {
    tier = 'high';
  } else if (cores >= 4) {
    tier = 'medium';
  } else {
    tier = 'low';
  }

  try { localStorage.setItem('starthread_quality_tier', tier); } catch (e) {}
  return QUALITY_TIERS[tier];
}

function useQualityTier() {
  const [qualityTier, setQualityTier] = useState(() => detectQualityTier());
  const fpsBuffer = useRef([]);
  const lastDowngrade = useRef(0);

  const downgrade = useCallback(() => {
    const order = ['ultra', 'high', 'medium', 'low'];
    const idx = order.indexOf(qualityTier.tier);
    if (idx < order.length - 1) {
      const newTier = order[idx + 1];
      try { localStorage.setItem('starthread_quality_tier', newTier); } catch (e) {}
      setQualityTier(QUALITY_TIERS[newTier]);
    }
  }, [qualityTier.tier]);

  const setTier = useCallback((tierName) => {
    if (QUALITY_TIERS[tierName]) {
      try { localStorage.setItem('starthread_quality_tier', tierName); } catch (e) {}
      setQualityTier(QUALITY_TIERS[tierName]);
    }
  }, []);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId;

    const measureFps = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 2000) {
        const fps = (frameCount / (now - lastTime)) * 1000;
        fpsBuffer.current.push(fps);
        if (fpsBuffer.current.length > 3) fpsBuffer.current.shift();

        const avgFps = fpsBuffer.current.reduce((a, b) => a + b, 0) / fpsBuffer.current.length;

        if (avgFps < 24 && fpsBuffer.current.length >= 2 && now - lastDowngrade.current > 10000) {
          lastDowngrade.current = now;
          downgrade();
        }

        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(measureFps);
    };

    animId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(animId);
  }, [downgrade]);

  return useMemo(() => ({ ...qualityTier, setTier }), [qualityTier, setTier]);
}

const NEBULA_COLORS = {
  deepPurple: '#1e1b4b',
  vibrantPurple: '#7c3aed',
  teal: '#0891b2',
  cyan: '#22d3d8',
  blue: '#3b82f6',
  deepBlue: '#1e40af',
  warmOrange: '#f97316',
  warmPink: '#ec4899',
};

const seededRandom = (seed) => {
  let hash = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
};

function generateUniquenessProfile(seed) {
  return {
    wispiness: 1.5 + seededRandom(seed + '-wisp') * 2.0,
    turbulence: 0.5 + seededRandom(seed + '-turb') * 1.0,
    layerCount: Math.floor(3 + seededRandom(seed + '-layers') * 2.99),
    colorShift: seededRandom(seed + '-colorShift'),
    glowIntensity: 0.8 + seededRandom(seed + '-glow') * 0.5,
    rotationSpeed: 0.2 + seededRandom(seed + '-rotSpeed') * 0.6,
  };
}

function useOrganicClusterLayout(households, people, viewMode = 'nebula', relationships = []) {
  return useMemo(() => {
    if (!households || households.length === 0) return new Map();
    
    const householdMemberCounts = new Map();
    const householdMembers = new Map();
    const seenPersonIds = new Set();
    people.forEach(person => {
      if (person.household_id && !seenPersonIds.has(person.id)) {
        seenPersonIds.add(person.id);
        householdMemberCounts.set(
          person.household_id,
          (householdMemberCounts.get(person.household_id) || 0) + 1
        );
        if (!householdMembers.has(person.household_id)) {
          householdMembers.set(person.household_id, []);
        }
        householdMembers.get(person.household_id).push(person);
      }
    });
    
    const personToHousehold = new Map();
    people.forEach(p => {
      if (p.household_id) personToHousehold.set(p.id, p.household_id);
    });
    
    const parentOf = new Map();
    const childOf = new Map();
    relationships.forEach(rel => {
      if (rel.relationship_type !== 'parent') return;
      const parentId = rel.person_id || rel.person1_id;
      const childId = rel.related_person_id || rel.person2_id;
      const parentHH = personToHousehold.get(parentId);
      const childHH = personToHousehold.get(childId);
      if (parentHH && childHH && parentHH !== childHH) {
        if (!parentOf.has(parentHH)) parentOf.set(parentHH, new Set());
        parentOf.get(parentHH).add(childHH);
        if (!childOf.has(childHH)) childOf.set(childHH, new Set());
        childOf.get(childHH).add(parentHH);
      }
    });
    
    const generation = new Map();
    const roots = [];
    households.forEach(h => {
      if (!childOf.has(h.id)) {
        roots.push(h.id);
        generation.set(h.id, 0);
      }
    });
    
    if (roots.length === 0) {
      const hhAges = new Map();
      households.forEach(h => {
        const members = householdMembers.get(h.id) || [];
        const ages = members
          .map(m => m.birth_date ? (new Date().getFullYear() - new Date(m.birth_date).getFullYear()) : 0)
          .filter(a => a > 0);
        const maxAge = ages.length > 0 ? Math.max(...ages) : 30;
        hhAges.set(h.id, maxAge);
      });
      
      const sorted = [...households].sort((a, b) => (hhAges.get(b.id) || 0) - (hhAges.get(a.id) || 0));
      const third = Math.max(1, Math.ceil(sorted.length / 3));
      sorted.forEach((h, i) => {
        if (i < third) {
          generation.set(h.id, 0);
        } else if (i < third * 2) {
          generation.set(h.id, 1);
        } else {
          generation.set(h.id, 2);
        }
      });
    } else {
      const queue = [...roots];
      while (queue.length > 0) {
        const hhId = queue.shift();
        const gen = generation.get(hhId) || 0;
        const children = parentOf.get(hhId);
        if (children) {
          children.forEach(childHH => {
            if (!generation.has(childHH) || generation.get(childHH) < gen + 1) {
              generation.set(childHH, gen + 1);
              queue.push(childHH);
            }
          });
        }
      }
    }
    
    households.forEach(h => {
      if (!generation.has(h.id)) generation.set(h.id, 1);
    });
    
    const genGroups = new Map();
    households.forEach(h => {
      const gen = generation.get(h.id) || 0;
      if (!genGroups.has(gen)) genGroups.set(gen, []);
      genGroups.get(gen).push(h);
    });
    
    const hhCount = households.length;
    const scaleFactor = hhCount <= 5 ? 0.6 : hhCount <= 12 ? 0.8 : hhCount <= 25 ? 1.0 : 0.8 + Math.log2(hhCount / 12) * 0.3;
    const minSeparation = 35.0 * Math.max(0.6, scaleFactor);
    const GOLDEN_ANGLE = 2.399963229728653;
    const BRANCH_DISTANCE = 40 * scaleFactor;
    
    const positions = new Map();
    const placedPositions = [];
    
    const sortedGens = [...genGroups.keys()].sort((a, b) => a - b);
    
    function findParentPositions(hhId) {
      const parents = childOf.get(hhId);
      if (!parents || parents.size === 0) return null;
      const parentPositions = [];
      parents.forEach(pid => {
        const pos = positions.get(pid);
        if (pos) parentPositions.push(pos);
      });
      if (parentPositions.length === 0) return null;
      const avg = { x: 0, y: 0, z: 0 };
      parentPositions.forEach(p => { avg.x += p.x; avg.y += p.y; avg.z += p.z; });
      avg.x /= parentPositions.length;
      avg.y /= parentPositions.length;
      avg.z /= parentPositions.length;
      return avg;
    }
    
    sortedGens.forEach(gen => {
      const group = genGroups.get(gen);
      const n = group.length;
      
      group.forEach((household, idx) => {
        const seed = household.id;
        let x, y, z;
        
        if (gen === 0) {
          const phi = Math.acos(1 - 2 * (idx + 0.5) / Math.max(n, 3));
          const theta = GOLDEN_ANGLE * idx + seededRandom(seed + '-angle') * 0.6;
          const radius = (12 + seededRandom(seed + '-r0') * 14) * scaleFactor;
          x = radius * Math.sin(phi) * Math.cos(theta);
          y = radius * Math.cos(phi);
          z = radius * Math.sin(phi) * Math.sin(theta);
        } else {
          const parentPos = findParentPositions(household.id);
          
          if (parentPos) {
            const dist = Math.sqrt(parentPos.x * parentPos.x + parentPos.y * parentPos.y + parentPos.z * parentPos.z);
            const baseDist = BRANCH_DISTANCE + seededRandom(seed + '-bd') * 10;
            
            const randPhi = Math.acos(1 - 2 * seededRandom(seed + '-phi'));
            const randTheta = seededRandom(seed + '-theta') * Math.PI * 2;
            const offX = Math.sin(randPhi) * Math.cos(randTheta);
            const offY = Math.cos(randPhi);
            const offZ = Math.sin(randPhi) * Math.sin(randTheta);
            
            const radialX = dist > 1 ? parentPos.x / dist : 0;
            const radialY = dist > 1 ? parentPos.y / dist : 0;
            const radialZ = dist > 1 ? parentPos.z / dist : 0;
            
            const outwardBias = 0.4;
            x = parentPos.x + (offX * (1 - outwardBias) + radialX * outwardBias) * baseDist;
            y = parentPos.y + (offY * (1 - outwardBias) + radialY * outwardBias) * baseDist;
            z = parentPos.z + (offZ * (1 - outwardBias) + radialZ * outwardBias) * baseDist;
          } else {
            const phi = Math.acos(1 - 2 * (idx + 0.5) / Math.max(n, 3));
            const theta = GOLDEN_ANGLE * idx + seededRandom(seed + '-angle') * 0.6;
            const shellRadius = (45 + gen * 35 + seededRandom(seed + '-rs') * 18) * scaleFactor;
            x = shellRadius * Math.sin(phi) * Math.cos(theta);
            y = shellRadius * Math.cos(phi);
            z = shellRadius * Math.sin(phi) * Math.sin(theta);
          }
        }
        
        let attempts = 0;
        while (attempts < 60) {
          let tooClose = false;
          for (const placed of placedPositions) {
            const dx = x - placed.x;
            const dy = y - placed.y;
            const dz = z - placed.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < minSeparation) {
              tooClose = true;
              break;
            }
          }
          if (!tooClose) break;
          x += (seededRandom(seed + '-ax-' + attempts) - 0.5) * 40;
          y += (seededRandom(seed + '-ay-' + attempts) - 0.5) * 40;
          z += (seededRandom(seed + '-az-' + attempts) - 0.5) * 40;
          attempts++;
        }
        
        placedPositions.push({ x, y, z });
        
        const uniqueness = generateUniquenessProfile(seed);
        
        positions.set(household.id, {
          x,
          y,
          z,
          memberCount: householdMemberCounts.get(household.id) || 0,
          uniqueness,
          generation: generation.get(household.id) || 0,
        });
      });
    });
    
    const partnerPairs = [];
    relationships.forEach(rel => {
      const type = rel.relationship_type;
      if (type === 'partner' || type === 'spouse') {
        const idA = rel.person_id || rel.person1_id;
        const idB = rel.related_person_id || rel.person2_id;
        const hhA = personToHousehold.get(idA);
        const hhB = personToHousehold.get(idB);
        if (hhA && hhB && hhA !== hhB) {
          const already = partnerPairs.some(p =>
            (p[0] === hhA && p[1] === hhB) || (p[0] === hhB && p[1] === hhA)
          );
          if (!already) partnerPairs.push([hhA, hhB]);
        }
      }
    });

    if (partnerPairs.length > 0) {
      const PARTNER_SEPARATION = minSeparation * 1.1;
      partnerPairs.forEach(([hhA, hhB]) => {
        const posA = positions.get(hhA);
        const posB = positions.get(hhB);
        if (!posA || !posB) return;
        const mx = (posA.x + posB.x) / 2;
        const my = (posA.y + posB.y) / 2;
        const mz = (posA.z + posB.z) / 2;
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dz = posB.z - posA.z;
        let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 0.01) {
          dist = 1;
          posB.x = mx + 1;
        }
        const halfSep = PARTNER_SEPARATION / 2;
        const fdx = posB.x - posA.x;
        const fdy = posB.y - posA.y;
        const fdz = posB.z - posA.z;
        const fdist = Math.sqrt(fdx * fdx + fdy * fdy + fdz * fdz) || 1;
        const nx = fdx / fdist;
        const ny = fdy / fdist;
        const nz = fdz / fdist;
        posA.x = mx - nx * halfSep;
        posA.y = my - ny * halfSep;
        posA.z = mz - nz * halfSep;
        posB.x = mx + nx * halfSep;
        posB.y = my + ny * halfSep;
        posB.z = mz + nz * halfSep;
      });

      const allPos = [...positions.values()];
      for (let iter = 0; iter < 20; iter++) {
        let moved = false;
        for (let i = 0; i < allPos.length; i++) {
          for (let j = i + 1; j < allPos.length; j++) {
            const a = allPos[i];
            const b = allPos[j];
            const isPair = partnerPairs.some(([hhA, hhB]) =>
              (positions.get(hhA) === a && positions.get(hhB) === b) ||
              (positions.get(hhA) === b && positions.get(hhB) === a)
            );
            if (isPair) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dz = b.z - a.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < minSeparation && dist > 0) {
              const push = (minSeparation - dist) / 2 + 0.5;
              const nx = dx / dist;
              const ny = dy / dist;
              const nz = dz / dist;
              a.x -= nx * push;
              a.y -= ny * push;
              a.z -= nz * push;
              b.x += nx * push;
              b.y += ny * push;
              b.z += nz * push;
              moved = true;
            }
          }
        }
        if (!moved) break;
      }
    }
    
    return positions;
  }, [households, people, viewMode, relationships]);
}

function DistributedNebulaClouds({ householdPositions, households, qualityTier }) {
  const isLow = qualityTier.tier === 'low';
  const isUltra = qualityTier.tier === 'ultra';
  const isHigh = qualityTier.tier === 'high';
  const octaves = isUltra ? 4 : (isHigh ? 3 : 2);

  const cloudConfigs = useMemo(() => {
    if (!households || !householdPositions) return [];
    const configs = [];
    const seeded = (seed, i) => {
      const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };

    for (let i = 0; i < households.length; i++) {
      const h = households[i];
      const pos = householdPositions.get(h.id);
      if (!pos || (pos.memberCount || 0) === 0) continue;
      const colorSet = HOUSEHOLD_COLORS[i % HOUSEHOLD_COLORS.length];
      const col = new THREE.Color(colorSet.primary);

      const cloudRadius = 18 + (pos.memberCount || 1) * 2.5;
      configs.push({
        position: [pos.x, pos.y, pos.z],
        color: [col.r, col.g, col.b],
        radius: cloudRadius,
        seed: i * 137.5,
      });

      const numExtra = isUltra ? 3 : (isHigh ? 2 : 1);
      for (let j = 0; j < numExtra; j++) {
        const angle = seeded(i, j * 3) * Math.PI * 2;
        const dist = 20 + seeded(i, j * 3 + 1) * 35;
        const yOff = (seeded(i, j * 3 + 2) - 0.5) * 20;
        configs.push({
          position: [
            pos.x + Math.cos(angle) * dist,
            pos.y + yOff,
            pos.z + Math.sin(angle) * dist,
          ],
          color: [col.r * 0.6, col.g * 0.6, col.b * 0.6],
          radius: 10 + seeded(i, j * 7) * 15,
          seed: i * 137.5 + j * 42.3,
        });
      }
    }

    const maxClouds = isUltra ? 80 : (isHigh ? 50 : 30);
    return configs.slice(0, maxClouds);
  }, [households, householdPositions, isUltra, isHigh]);

  if (isLow || cloudConfigs.length === 0) return null;

  return (
    <group>
      {cloudConfigs.map((config, i) => (
        <VolumetricCloudPocket
          key={i}
          position={config.position}
          color={config.color}
          radius={config.radius}
          seed={config.seed}
          octaves={octaves}
        />
      ))}
    </group>
  );
}

function VolumetricCloudPocket({ position, color, radius, seed, octaves = 3 }) {
  const meshRef = useRef();

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vRayOrigin;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          vRayOrigin = cameraPosition;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float cloudRadius;
        uniform vec3 cloudCenter;
        uniform vec3 cloudColor;
        uniform float seedVal;

        varying vec3 vWorldPos;
        varying vec3 vRayOrigin;

        const int OCTAVES = ${octaves};

        float hash(vec3 p) {
          p = fract(p * vec3(443.897, 441.423, 437.195));
          p += dot(p, p.yxz + 19.19);
          return fract((p.x + p.y) * p.z);
        }

        float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
            f.z);
        }

        float fbm(vec3 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < OCTAVES; i++) {
            v += a * noise(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 rd = normalize(vWorldPos - vRayOrigin);
          vec3 oc = vRayOrigin - cloudCenter;
          float b = dot(oc, rd);
          float c = dot(oc, oc) - cloudRadius * cloudRadius;
          float h = b * b - c;
          if (h < 0.0) discard;
          h = sqrt(h);
          float tNear = max(-b - h, 0.0);
          float tFar = -b + h;
          if (tFar < 0.0) discard;

          const int STEPS = 12;
          float stepSize = (tFar - tNear) / float(STEPS);
          float jitter = hash(vWorldPos + time * 0.1) * stepSize * 0.5;

          vec3 totalColor = vec3(0.0);
          float totalAlpha = 0.0;

          vec3 cosmicBase = vec3(0.08, 0.04, 0.15);

          for (int i = 0; i < STEPS; i++) {
            float t = tNear + stepSize * float(i) + jitter;
            vec3 p = vRayOrigin + rd * t;
            vec3 localP = (p - cloudCenter) / cloudRadius;

            float dist = length(localP);
            float falloff = 1.0 - smoothstep(0.2, 1.0, dist);
            falloff *= falloff;

            float n = fbm(localP * 2.5 + seedVal + time * 0.003);
            float density = n * falloff * 0.5;
            density = max(density - 0.1, 0.0);

            if (density > 0.001) {
              vec3 sampleCol = mix(cosmicBase, cloudColor, 0.3 + n * 0.25);
              sampleCol *= (0.6 + density * 1.5);
              float sa = 1.0 - exp(-density * stepSize * 0.3);
              totalColor += sampleCol * sa * (1.0 - totalAlpha);
              totalAlpha += sa * (1.0 - totalAlpha);
              if (totalAlpha > 0.6) break;
            }
          }

          totalColor = pow(totalColor, vec3(0.85));
          gl_FragColor = vec4(totalColor, totalAlpha * 0.4);
        }
      `,
      uniforms: {
        time: { value: 0 },
        cloudRadius: { value: radius },
        cloudCenter: { value: new THREE.Vector3(...position) },
        cloudColor: { value: new THREE.Vector3(...color) },
        seedVal: { value: seed },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [radius, position, color, seed, octaves]);

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame((state) => {
    material.uniforms.time.value = state.clock.elapsedTime;
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[radius * 1.5, 16, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function NebulaFilaments({ count = 800, qualityTier, universeExtent = 200 }) {
  const pointsRef = useRef();
  
  const particleCount = qualityTier.filamentCount || 150;
  const extScale = Math.max(1, universeExtent / 200);
  
  const { positions, colors, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const siz = new Float32Array(particleCount);
    const pha = new Float32Array(particleCount);
    
    const nebulaColors = [
      new THREE.Color(0x9b5de5),
      new THREE.Color(0x0db5d1),
      new THREE.Color(0x3de8e0),
      new THREE.Color(0xf472b6),
      new THREE.Color(0x2563eb),
      new THREE.Color(0xfbbf24),
      new THREE.Color(0x34d399),
      new THREE.Color(0xf59e0b),
    ];
    
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = (10 + Math.pow(Math.random(), 0.4) * 90) * extScale;
      
      const wispOffset = Math.sin(theta * 3 + phi * 2) * 15;
      const finalR = r + wispOffset;
      
      pos[i * 3] = finalR * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = finalR * Math.sin(phi) * Math.sin(theta) * 0.6;
      pos[i * 3 + 2] = finalR * Math.cos(phi);
      
      const colorIdx = Math.floor(Math.random() * nebulaColors.length);
      const c = nebulaColors[colorIdx];
      const brightness = 0.4 + Math.random() * 0.6;
      col[i * 3] = c.r * brightness;
      col[i * 3 + 1] = c.g * brightness;
      col[i * 3 + 2] = c.b * brightness;
      
      siz[i] = 2 + Math.random() * 5;
      pha[i] = Math.random() * Math.PI * 2;
    }
    
    return { positions: pos, colors: col, sizes: siz, phases: pha };
  }, [particleCount, extScale]);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 particleColor;
        attribute float size;
        attribute float phase;
        uniform float time;
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vColor = particleColor;
          
          float drift = sin(time * 0.15 + phase) * 0.2 + 0.8;
          vAlpha = 0.04 * drift;
          
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (150.0 / -mvPos.z);
          gl_PointSize = clamp(gl_PointSize, 2.0, 40.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha = pow(alpha, 2.5);
          alpha *= vAlpha;
          
          if (alpha < 0.005) discard;
          
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      uniforms: {
        time: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useEffect(() => {
    return () => material.dispose();
  }, [material]);
  
  useFrame((state) => {
    material.uniforms.time.value = state.clock.elapsedTime;
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.00008;
    }
  });
  
  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-particleColor" count={particleCount} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={particleCount} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-phase" count={particleCount} array={phases} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

function TieredNebulaBackdrop({ qualityTier }) {
  return null;
}




function FreeFlightControls({ enabled = true, externalKeysPressed = null, qualityTier, onTouchInteraction }) {
  const { camera, gl } = useThree();
  const internalKeysPressed = useRef({});
  const keysPressed = externalKeysPressed || internalKeysPressed;
  const velocity = useRef(new THREE.Vector3());
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const speedMultiplier = useRef(1.0);
  const isMouseLooking = useRef(false);
  const baseFov = useRef(55);
  const currentFov = useRef(55);
  const cameraSway = useRef({ x: 0, y: 0, phase: 0 });
  const touchState = useRef({ active: false, lastX: 0, lastY: 0, startX: 0, startY: 0, pinchDist: 0, isPinching: false, hasDragged: false });
  const _pinchForward = useMemo(() => new THREE.Vector3(), []);
  const onTouchInteractionRef = useRef(onTouchInteraction);
  onTouchInteractionRef.current = onTouchInteraction;

  const baseSpeed = 140;
  const acceleration = 4.0;
  const damping = 2.5;
  const maxSpeedMult = 5.0;
  const minSpeedMult = 0.2;
  const mouseSensitivity = 0.002;
  const touchSensitivity = 0.004;

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
        keysPressed.current[key] = true;
      }
    };
    const onKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
        keysPressed.current[key] = false;
      }
    };

    const onWheel = (e) => {
      if (!enabled) return;
      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * 0.15;
      speedMultiplier.current = Math.max(minSpeedMult, Math.min(maxSpeedMult, speedMultiplier.current + delta));
    };

    let mouseDownPos = { x: 0, y: 0 };
    let isDragging = false;
    const dragThreshold = 3;

    const onMouseDown = (e) => {
      if (!enabled) return;
      mouseDownPos = { x: e.clientX, y: e.clientY };
      isDragging = false;
      if (e.button === 2) {
        isMouseLooking.current = true;
      }
    };
    const onMouseUp = (e) => {
      isMouseLooking.current = false;
      isDragging = false;
    };
    const onMouseMove = (e) => {
      if (!enabled) return;

      if (e.buttons === 1 && !isDragging) {
        const dx = Math.abs(e.clientX - mouseDownPos.x);
        const dy = Math.abs(e.clientY - mouseDownPos.y);
        if (dx > dragThreshold || dy > dragThreshold) {
          isDragging = true;
          isMouseLooking.current = true;
        }
      }

      if (!isMouseLooking.current) return;
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= e.movementX * mouseSensitivity;
      euler.current.x -= e.movementY * mouseSensitivity;
      euler.current.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, euler.current.x));
      camera.quaternion.setFromEuler(euler.current);
    };
    const onContextMenu = (e) => {
      if (enabled) e.preventDefault();
    };

    const getPinchDistance = (touches) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const touchDragThreshold = 8;

    const onTouchStart = (e) => {
      if (!enabled) return;
      if (onTouchInteractionRef.current) onTouchInteractionRef.current();
      if (e.touches.length === 1) {
        touchState.current.active = true;
        touchState.current.isPinching = false;
        touchState.current.hasDragged = false;
        touchState.current.lastX = e.touches[0].clientX;
        touchState.current.lastY = e.touches[0].clientY;
        touchState.current.startX = e.touches[0].clientX;
        touchState.current.startY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        touchState.current.isPinching = true;
        touchState.current.hasDragged = true;
        touchState.current.active = false;
        touchState.current.pinchDist = getPinchDistance(e.touches);
      }
    };

    const onTouchMove = (e) => {
      if (!enabled) return;
      e.preventDefault();

      if (e.touches.length === 1 && touchState.current.active && !touchState.current.isPinching) {
        const deltaX = e.touches[0].clientX - touchState.current.lastX;
        const deltaY = e.touches[0].clientY - touchState.current.lastY;

        if (!touchState.current.hasDragged) {
          const totalDx = Math.abs(e.touches[0].clientX - touchState.current.startX);
          const totalDy = Math.abs(e.touches[0].clientY - touchState.current.startY);
          if (totalDx > touchDragThreshold || totalDy > touchDragThreshold) {
            touchState.current.hasDragged = true;
          } else {
            return;
          }
        }

        touchState.current.lastX = e.touches[0].clientX;
        touchState.current.lastY = e.touches[0].clientY;

        euler.current.setFromQuaternion(camera.quaternion);
        euler.current.y -= deltaX * touchSensitivity;
        euler.current.x -= deltaY * touchSensitivity;
        euler.current.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, euler.current.x));
        camera.quaternion.setFromEuler(euler.current);
      } else if (e.touches.length === 2 && touchState.current.isPinching) {
        const newDist = getPinchDistance(e.touches);
        const delta = (newDist - touchState.current.pinchDist) * 0.005;
        speedMultiplier.current = Math.max(minSpeedMult, Math.min(maxSpeedMult, speedMultiplier.current + delta));
        touchState.current.pinchDist = newDist;

        _pinchForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
        camera.position.addScaledVector(_pinchForward, delta * 30);
      }
    };

    const onTouchEnd = (e) => {
      if (e.touches.length === 0) {
        touchState.current.active = false;
        touchState.current.isPinching = false;
      } else if (e.touches.length === 1) {
        touchState.current.isPinching = false;
        touchState.current.active = true;
        touchState.current.hasDragged = true;
        touchState.current.lastX = e.touches[0].clientX;
        touchState.current.lastY = e.touches[0].clientY;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const canvas = gl.domElement;
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      camera.fov = baseFov.current;
      camera.updateProjectionMatrix();
      velocity.current.set(0, 0, 0);
    };
  }, [enabled, camera, gl]);

  const _forward = useMemo(() => new THREE.Vector3(), []);
  const _right = useMemo(() => new THREE.Vector3(), []);
  const _up = useMemo(() => new THREE.Vector3(), []);
  const _inputDir = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!enabled) return;
    const dt = Math.min(delta, 0.1);
    const keys = keysPressed.current;
    const hasMovement = keys.w || keys.a || keys.s || keys.d || keys.q || keys.e;

    _forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    _up.set(0, 1, 0);

    _inputDir.set(0, 0, 0);
    if (keys.w) _inputDir.add(_forward);
    if (keys.s) _inputDir.sub(_forward);
    if (keys.d) _inputDir.add(_right);
    if (keys.a) _inputDir.sub(_right);
    if (keys.e) _inputDir.add(_up);
    if (keys.q) _inputDir.sub(_up);

    const moveSpeed = baseSpeed * speedMultiplier.current;

    if (hasMovement && _inputDir.lengthSq() > 0) {
      _inputDir.normalize().multiplyScalar(moveSpeed);
      velocity.current.lerp(_inputDir, 1 - Math.exp(-acceleration * dt));
    } else {
      velocity.current.multiplyScalar(Math.exp(-damping * dt));
      if (velocity.current.lengthSq() < 0.01) velocity.current.set(0, 0, 0);
    }

    camera.position.addScaledVector(velocity.current, dt);

    const speed = velocity.current.length();
    const speedRatio = speed / (baseSpeed * maxSpeedMult);

    const enableSway = qualityTier?.tier !== 'low';
    if (enableSway && speed > 1) {
      cameraSway.current.phase += dt * (1.5 + speedRatio * 2);
      const swayAmount = Math.min(speedRatio * 0.003, 0.002);
      const swayX = Math.sin(cameraSway.current.phase * 1.1) * swayAmount;
      const swayY = Math.cos(cameraSway.current.phase * 0.7) * swayAmount;
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.z = swayX;
      camera.quaternion.setFromEuler(euler.current);
    }

    const targetFov = baseFov.current + speedRatio * 15;
    currentFov.current += (targetFov - currentFov.current) * dt * 3;
    camera.fov = currentFov.current;
    camera.updateProjectionMatrix();
  });

  return null;
}

function NebulaBackground({ qualityTier, universeExtent = 200 }) {
  const meshRef = useRef();
  const { camera } = useThree();
  const octaves = qualityTier?.nebulaOctaves || 3;
  const segments = qualityTier?.sphereSegments || 32;
  
  const gradientMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 camWorldPos;
        varying vec3 vPosition;
        
        const int OCTAVES = ${octaves};
        
        float hash(vec3 p) {
          return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        }
        
        float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          
          float a = hash(i);
          float b = hash(i + vec3(1.0, 0.0, 0.0));
          float c = hash(i + vec3(0.0, 1.0, 0.0));
          float d = hash(i + vec3(1.0, 1.0, 0.0));
          float e = hash(i + vec3(0.0, 0.0, 1.0));
          float f1 = hash(i + vec3(1.0, 0.0, 1.0));
          float g = hash(i + vec3(0.0, 1.0, 1.0));
          float h = hash(i + vec3(1.0, 1.0, 1.0));
          
          return mix(
            mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
            mix(mix(e, f1, f.x), mix(g, h, f.x), f.y),
            f.z
          );
        }
        
        float fbm(vec3 p) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < OCTAVES; i++) {
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }
        
        void main() {
          vec3 dir = normalize(vPosition);
          
          vec3 regionSeed = camWorldPos * 0.003;
          
          float rn1 = fbm(regionSeed * 0.25 + vec3(42.0));
          float rn2 = fbm(regionSeed * 0.15 + vec3(137.0));
          float rn3 = fbm(regionSeed * 0.35 + vec3(256.0));
          
          vec3 warmGold = vec3(1.0, 0.7, 0.1);
          vec3 emeraldGreen = vec3(0.1, 0.9, 0.25);
          vec3 deepPurple = vec3(0.5, 0.1, 0.9);
          vec3 coolBlue = vec3(0.15, 0.4, 1.0);
          vec3 amber = vec3(1.0, 0.55, 0.05);
          vec3 teal = vec3(0.05, 0.85, 0.75);
          
          float r1 = smoothstep(0.25, 0.75, rn1);
          float r2 = smoothstep(0.25, 0.75, rn2);
          float r3 = smoothstep(0.3, 0.7, rn3);
          
          vec3 regionColor = mix(deepPurple, warmGold, r1);
          regionColor = mix(regionColor, emeraldGreen, r2 * 0.6);
          regionColor = mix(regionColor, coolBlue, r3 * 0.4);
          regionColor = mix(regionColor, teal, smoothstep(0.35, 0.65, rn1 * rn2) * 0.3);
          regionColor = mix(regionColor, amber, smoothstep(0.4, 0.65, rn3 * rn1) * 0.2);
          
          vec3 backSeed = regionSeed * 0.08;
          float slowTime = time * 0.00002;
          float bLarge = fbm(dir * 0.3 + backSeed + slowTime);
          float bMed = fbm(dir * 0.7 + backSeed + vec3(50.0) + slowTime * 2.0);
          
          float backShape = bLarge * 0.6 + bMed * 0.4;
          float backClouds = smoothstep(0.3, 0.58, backShape);
          float backBright = smoothstep(0.52, 0.78, backShape);
          
          vec3 foreOffset = camWorldPos * 0.006;
          float fMed = fbm(dir * 1.2 + foreOffset * 0.15 + vec3(200.0) + slowTime * 3.0);
          float fFine = fbm(dir * 2.5 + foreOffset * 0.25 + vec3(300.0) + slowTime * 5.0);
          
          float foreShape = fMed * 0.55 + fFine * 0.45;
          float foreWisps = smoothstep(0.38, 0.62, foreShape);
          float foreBright = smoothstep(0.55, 0.8, foreShape);
          
          float ambient = 0.07 + bLarge * 0.03;
          vec3 baseColor = regionColor * ambient;
          
          baseColor = mix(baseColor, regionColor * 0.18, backClouds);
          baseColor = mix(baseColor, regionColor * 0.40, backBright * 0.65);
          
          baseColor += regionColor * foreWisps * 0.10;
          baseColor += regionColor * foreBright * 0.12;
          
          baseColor = max(baseColor, regionColor * 0.05);
          
          gl_FragColor = vec4(baseColor, 1.0);
        }
      `,
      uniforms: {
        time: { value: 0 },
        camWorldPos: { value: new THREE.Vector3() },
      },
      side: THREE.BackSide,
    });
  }, [octaves]);

  useEffect(() => {
    return () => gradientMaterial.dispose();
  }, [gradientMaterial]);
  
  useFrame((state) => {
    gradientMaterial.uniforms.time.value = state.clock.elapsedTime;
    gradientMaterial.uniforms.camWorldPos.value.copy(camera.position);
    if (meshRef.current) {
      meshRef.current.position.copy(camera.position);
    }
  });
  
  const bgRadius = Math.max(500, universeExtent * 2.5);

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[bgRadius, segments, segments]} />
      <primitive object={gradientMaterial} attach="material" />
    </mesh>
  );
}

function DenseStarField({ count = 70000, universeExtent = 200 }) {
  const { positions, colors, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    
    const starColors = [
      [1.0, 1.0, 1.0],
      [0.9, 0.95, 1.0],
      [1.0, 0.95, 0.9],
      [0.85, 0.9, 1.0],
      [1.0, 0.9, 0.85],
      [0.95, 0.98, 1.0],
    ];
    
    const farCount = Math.floor(count * 0.75);
    const midCount = Math.floor(count * 0.2);
    const scale = Math.max(1, universeExtent / 200);
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      let radius;
      if (i < farCount) {
        radius = (160 + Math.random() * 140) * scale;
      } else if (i < farCount + midCount) {
        radius = (90 + Math.random() * 70) * scale;
      } else {
        radius = (45 + Math.random() * 45) * scale;
      }
      
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
      
      const colorIndex = Math.floor(Math.random() * starColors.length);
      const dimFactor = Math.pow(Math.random(), 2.5);
      const brightness = 0.08 + dimFactor * 0.25;
      col[i * 3] = starColors[colorIndex][0] * brightness;
      col[i * 3 + 1] = starColors[colorIndex][1] * brightness;
      col[i * 3 + 2] = starColors[colorIndex][2] * brightness;
      
      const sizeFactor = Math.pow(Math.random(), 4.0);
      if (i < farCount) {
        siz[i] = 0.04 + sizeFactor * 0.08;
      } else if (i < farCount + midCount) {
        siz[i] = 0.06 + sizeFactor * 0.12;
      } else {
        siz[i] = 0.08 + sizeFactor * 0.18;
      }
    }
    
    return { positions: pos, colors: col, sizes: siz };
  }, [count, universeExtent]);
  
  const starMaterial = useMemo(() => {
    const dpr = window.devicePixelRatio || 1;
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 starColor;
        attribute float size;
        uniform float pixelRatio;
        varying vec3 vColor;
        
        void main() {
          vColor = starColor;
          float dpiScale = 1.0 / max(pixelRatio, 1.0);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * dpiScale * (150.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 0.3, 2.5);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        
        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha *= alpha;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      uniforms: {
        pixelRatio: { value: dpr },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useEffect(() => {
    return () => starMaterial.dispose();
  }, [starMaterial]);
  
  return (
    <points material={starMaterial} frustumCulled={true}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-starColor" count={count} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={sizes} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

function NebulaGasCloud({ count = 8000, universeExtent = 200 }) {
  const pointsRef = useRef(null);
  const extScale = Math.max(1, universeExtent / 200);
  
  const { positions, colors, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const pha = new Float32Array(count);
    
    const nebulaColors = [
      new THREE.Color('#1a2840'),
      new THREE.Color('#2a1545'),
      new THREE.Color('#0d2535'),
      new THREE.Color('#302818'),
      new THREE.Color('#152a20'),
      new THREE.Color('#251535'),
      new THREE.Color('#0d2030'),
    ];
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const radius = Math.pow(Math.random(), 0.5) * 50 * extScale;
      const height = (Math.random() - 0.5) * 25 * extScale;
      
      pos[i * 3] = Math.cos(theta) * radius + (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = height + (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = Math.sin(theta) * radius + (Math.random() - 0.5) * 10;
      
      const colorIndex = Math.floor(Math.random() * nebulaColors.length);
      const c = nebulaColors[colorIndex];
      const brightness = 0.6 + Math.random() * 0.4;
      col[i * 3] = c.r * brightness;
      col[i * 3 + 1] = c.g * brightness;
      col[i * 3 + 2] = c.b * brightness;
      
      siz[i] = 1.0 + Math.random() * 2.5;
      pha[i] = Math.random() * Math.PI * 2;
    }
    
    return { positions: pos, colors: col, sizes: siz, phases: pha };
  }, [count, extScale]);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 gasColor;
        attribute float size;
        attribute float phase;
        uniform float time;
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vColor = gasColor;
          
          float drift = sin(time * 0.08 + phase) * 0.3;
          vAlpha = 0.03 + drift * 0.01;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 30.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha = pow(alpha, 3.0);
          alpha *= vAlpha;
          
          if (alpha < 0.005) discard;
          
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      uniforms: {
        time: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useEffect(() => {
    return () => material.dispose();
  }, [material]);
  
  useFrame((state) => {
    material.uniforms.time.value = state.clock.elapsedTime;
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.00015;
    }
  });
  
  return (
    <points ref={pointsRef} material={material} frustumCulled={true}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-gasColor" count={count} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-phase" count={count} array={phases} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

function VignetteOverlay() {
  return (
    <div 
      className="absolute inset-0 pointer-events-none z-10"
      style={{
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
      }}
    />
  );
}

function WarpOverlay({ active, direction }) {
  const [phase, setPhase] = useState('idle');
  const timerRef = useRef(null);

  useEffect(() => {
    if (active && direction === 'zoom-in') {
      setPhase('warping');
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setPhase('flash'), 1100);
    } else if (!active && phase !== 'idle') {
      setPhase('fading');
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setPhase('idle'), 600);
    }
    return () => clearTimeout(timerRef.current);
  }, [active, direction]);

  if (phase === 'idle') return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[45]">
      {phase === 'warping' && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 5%, transparent 20%, rgba(140,180,255,0.06) 35%, rgba(80,140,255,0.12) 55%, rgba(40,80,200,0.18) 75%, rgba(10,20,60,0.5) 100%)',
            animation: 'warpStreaks 1.2s ease-in forwards',
          }}
        />
      )}
      {phase === 'warping' && (
        <div
          className="absolute inset-0"
          style={{
            background: `
              repeating-conic-gradient(
                from 0deg at 50% 50%,
                transparent 0deg,
                rgba(180,220,255,0.04) 1.5deg,
                transparent 3deg,
                transparent 7deg,
                rgba(120,180,255,0.03) 8.5deg,
                transparent 10deg
              )
            `,
            animation: 'warpRotate 1.2s linear forwards',
            filter: 'blur(1px)',
          }}
        />
      )}
      {phase === 'warping' && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, transparent 60%, rgba(0,0,0,0.6) 100%)',
            animation: 'warpTunnel 1.2s ease-in forwards',
          }}
        />
      )}
      {(phase === 'flash' || phase === 'fading') && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(200,230,255,0.9) 0%, rgba(100,160,255,0.4) 30%, transparent 70%)',
            animation: 'warpFlash 0.5s ease-out forwards',
          }}
        />
      )}
      <style>{`
        @keyframes warpStreaks {
          0% { opacity: 0; transform: scale(1); filter: blur(0px); }
          30% { opacity: 1; transform: scale(1.02); filter: blur(0px); }
          70% { opacity: 1; transform: scale(1.05); filter: blur(2px); }
          100% { opacity: 1; transform: scale(1.15); filter: blur(6px); }
        }
        @keyframes warpRotate {
          0% { opacity: 0; transform: rotate(0deg) scale(1); }
          20% { opacity: 0.6; }
          60% { opacity: 1; transform: rotate(15deg) scale(1.3); }
          100% { opacity: 0.8; transform: rotate(40deg) scale(2); }
        }
        @keyframes warpTunnel {
          0% { opacity: 0; }
          40% { opacity: 0.3; }
          100% { opacity: 1; }
        }
        @keyframes warpFlash {
          0% { opacity: 1; }
          30% { opacity: 0.6; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function CameraController({ 
  level, 
  targetPosition, 
  controlsRef,
  onTransitionComplete,
  setAutoRotateEnabled,
  onProgressUpdate,
  initialHomePosition,
  targetMemberCount = 0,
}) {
  const { camera, gl } = useThree();
  const startCamPos = useRef(new THREE.Vector3());
  const startQuat = useRef(new THREE.Quaternion());
  const startLookAt = useRef(new THREE.Vector3());
  const targetCamPos = useRef(new THREE.Vector3(25, 20, 50));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const targetQuat = useRef(new THREE.Quaternion());
  const isAnimating = useRef(false);
  const animationPhase = useRef('idle');
  const elapsedTime = useRef(0);
  const arcOffset = useRef(new THREE.Vector3());
  const originalDpr = useRef(1);
  const lastReportedProgress = useRef(-1);
  const hasInitialized = useRef(false);
  const isFirstMount = useRef(true);
  const savedUniversePos = useRef(null);
  const savedUniverseQuat = useRef(null);
  
  const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  useEffect(() => {
    if (hasInitialized.current) return;
    if (!initialHomePosition) return;
    if (level !== 'galaxy') {
      hasInitialized.current = true;
      return;
    }
    const hx = initialHomePosition.x || 0;
    const hy = initialHomePosition.y || 0;
    const hz = initialHomePosition.z || 0;
    camera.position.set(hx + 15, hy + 10, hz + 30);
    camera.lookAt(hx, hy, hz);
    hasInitialized.current = true;
    isFirstMount.current = false;
    animationPhase.current = 'idle';
    isAnimating.current = false;
    onProgressUpdate?.(1, 'idle');
  }, [initialHomePosition, level]);
  
  useEffect(() => {
    if (isFirstMount.current && level === 'galaxy') {
      isFirstMount.current = false;
      return;
    }
    if (!hasInitialized.current && level === 'galaxy') {
      return;
    }
    isFirstMount.current = false;

    startCamPos.current.copy(camera.position);
    startQuat.current.copy(camera.quaternion);

    const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    startLookAt.current.copy(camera.position).add(lookDir);
    
    if (level === 'galaxy') {
      if (savedUniversePos.current && savedUniverseQuat.current) {
        targetCamPos.current.copy(savedUniversePos.current);
        targetQuat.current.copy(savedUniverseQuat.current);
        const savedLook = new THREE.Vector3(0, 0, -1).applyQuaternion(savedUniverseQuat.current);
        targetLookAt.current.copy(savedUniversePos.current).add(savedLook);
      } else {
        targetCamPos.current.set(
          startCamPos.current.x * 3 + 20,
          startCamPos.current.y + 40,
          startCamPos.current.z * 3 + 30
        );
        targetLookAt.current.set(startCamPos.current.x * 0.5, 0, startCamPos.current.z * 0.5);
        const tempCam = camera.clone();
        tempCam.position.copy(targetCamPos.current);
        tempCam.lookAt(targetLookAt.current);
        targetQuat.current.copy(tempCam.quaternion);
      }
      animationPhase.current = 'zoom-out';
    } else if (level === 'system') {
      savedUniversePos.current = startCamPos.current.clone();
      savedUniverseQuat.current = startQuat.current.clone();
      
      const hx = targetPosition?.x || 0;
      const hy = targetPosition?.y || 0;
      const hz = targetPosition?.z || 0;
      
      const zoomScale = targetMemberCount <= 1 ? 0.4 : targetMemberCount <= 3 ? 0.7 : 1;
      targetLookAt.current.set(hx, hy, hz);
      targetCamPos.current.set(hx + 5 * zoomScale, hy + 25 * zoomScale, hz + 12 * zoomScale);

      const tempCam = camera.clone();
      tempCam.position.copy(targetCamPos.current);
      tempCam.lookAt(targetLookAt.current);
      targetQuat.current.copy(tempCam.quaternion);

      animationPhase.current = 'zoom-in';
    }
    
    const direction = new THREE.Vector3().subVectors(targetCamPos.current, startCamPos.current).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    arcOffset.current.crossVectors(direction, worldUp).normalize().multiplyScalar(3);
    
    isAnimating.current = true;
    elapsedTime.current = 0;
    
    originalDpr.current = gl.getPixelRatio();
    gl.setPixelRatio(Math.min(originalDpr.current, 1));

    if (controlsRef.current) {
      controlsRef.current.enabled = false;
      controlsRef.current.autoRotate = false;
    }
  }, [level, targetPosition, targetMemberCount]);
  
  useFrame((state, delta) => {
    if (isAnimating.current) {
      elapsedTime.current += delta;
      
      const duration = 1.6;
      const progress = Math.min(elapsedTime.current / duration, 1);
      
      const eased = easeInOutCubic(progress);
      
      if (Math.abs(eased - lastReportedProgress.current) > 0.03) {
        lastReportedProgress.current = eased;
        onProgressUpdate?.(eased, animationPhase.current);
      }
      
      const arcStrength = 4 * eased * (1 - eased);
      
      const interpolatedPos = new THREE.Vector3().lerpVectors(startCamPos.current, targetCamPos.current, eased);
      interpolatedPos.add(arcOffset.current.clone().multiplyScalar(arcStrength));
      
      camera.position.copy(interpolatedPos);
      camera.quaternion.slerpQuaternions(startQuat.current, targetQuat.current, eased);
      
      if (progress >= 1) {
        isAnimating.current = false;
        gl.setPixelRatio(originalDpr.current);
        
        lastReportedProgress.current = -1;
        onProgressUpdate?.(1, 'idle');
        animationPhase.current = 'idle';
        
        camera.position.copy(targetCamPos.current);
        camera.quaternion.copy(targetQuat.current);
        
        requestAnimationFrame(() => {
          if (controlsRef.current && level === 'system') {
            controlsRef.current.target.copy(targetLookAt.current);
            controlsRef.current.enabled = true;
            controlsRef.current.update();
          }
        });
        
        onTransitionComplete?.();
      }
    } else if (level === 'system' && controlsRef.current) {
      controlsRef.current.update();
    }
  });
  
  return null;
}

function arrangeStarsInCluster(people, centerX = 0, centerY = 0, centerZ = 0, relationships = []) {
  const count = people.length;
  if (count === 0) return [];
  if (count === 1) {
    return [{
      ...people[0],
      position: [centerX, centerY, centerZ],
      isParent: true,
    }];
  }
  
  const personIds = new Set(people.map(p => p.id));
  const householdRelationships = relationships.filter(r => {
    const idA = r.person_id || r.person1_id;
    const idB = r.related_person_id || r.person2_id;
    return personIds.has(idA) && personIds.has(idB);
  });
  
  const partners = new Set();
  const parents = new Set();
  const childrenIds = new Set();
  
  householdRelationships.forEach(rel => {
    const type = (rel.relationship_type || '').toLowerCase();
    const idA = rel.person_id || rel.person1_id;
    const idB = rel.related_person_id || rel.person2_id;
    if (type === 'partner' || type === 'spouse' || type === 'married') {
      partners.add(idA);
      partners.add(idB);
    }
    if (type === 'parent') {
      parents.add(idA);
      childrenIds.add(idB);
    }
    if (type === 'child') {
      parents.add(idB);
      childrenIds.add(idA);
    }
  });
  
  let parentPair = [];
  let childrenList = [];
  
  if (partners.size >= 2) {
    parentPair = people.filter(p => partners.has(p.id)).slice(0, 2);
    childrenList = people.filter(p => !parentPair.includes(p));
  } else if (parents.size > 0) {
    parentPair = people.filter(p => parents.has(p.id)).slice(0, 2);
    childrenList = people.filter(p => !parentPair.includes(p));
  } else {
    const adults = people.filter(p => {
      const roleType = (p.role_type || '').toLowerCase();
      return roleType.includes('parent') || roleType.includes('adult') || 
             roleType.includes('head') || roleType.includes('grandparent');
    });
    
    if (adults.length >= 2) {
      parentPair = adults.slice(0, 2);
      childrenList = people.filter(p => !parentPair.includes(p));
    } else if (adults.length === 1) {
      parentPair = adults;
      childrenList = people.filter(p => !parentPair.includes(p));
    } else {
      parentPair = people.slice(0, Math.min(2, count));
      childrenList = people.slice(parentPair.length);
    }
  }
  
  const positioned = [];
  
  const parentOrbitRadius = 1.8;
  const parentOrbitAngle = Math.PI / 6;
  
  if (parentPair.length >= 2) {
    positioned.push({
      ...parentPair[0],
      position: [
        centerX + Math.cos(parentOrbitAngle) * parentOrbitRadius,
        centerY,
        centerZ + Math.sin(parentOrbitAngle) * parentOrbitRadius
      ],
      isParent: true,
    });
    positioned.push({
      ...parentPair[1],
      position: [
        centerX + Math.cos(parentOrbitAngle + Math.PI) * parentOrbitRadius,
        centerY,
        centerZ + Math.sin(parentOrbitAngle + Math.PI) * parentOrbitRadius
      ],
      isParent: true,
    });
  } else if (parentPair.length === 1) {
    positioned.push({
      ...parentPair[0],
      position: [centerX, centerY, centerZ],
      isParent: true,
    });
  }
  
  const childOrbitRadius = 9.0;
  const childCount = childrenList.length;
  
  childrenList.forEach((child, index) => {
    const seed = child.id || index;
    const angleJitter = (seededRandom(seed + '-aj') - 0.5) * 0.6;
    const baseAngle = (index / Math.max(1, childCount)) * Math.PI * 2;
    const angle = baseAngle + angleJitter;
    
    const radiusVariation = seededRandom(seed + '-rad') * 5.0 - 2.0;
    const yVariation = (seededRandom(seed + '-y') - 0.5) * 6.0;
    const zJitter = (seededRandom(seed + '-zj') - 0.5) * 3.0;
    
    const finalRadius = childOrbitRadius + radiusVariation;
    
    positioned.push({
      ...child,
      position: [
        centerX + Math.cos(angle) * finalRadius,
        centerY + yVariation,
        centerZ + Math.sin(angle) * finalRadius + zJitter
      ],
      isParent: false,
    });
  });
  
  return positioned;
}

function arrangeStarsByRings(galaxyData, centerX = 0, centerY = 0, centerZ = 0) {
  if (!galaxyData || !Array.isArray(galaxyData.rings)) return [];
  const positioned = [];
  const RING_RADII = { 1: 4, 2: 10, 3: 16, 4: 24 };

  if (galaxyData.centerPerson) {
    positioned.push({
      ...galaxyData.centerPerson,
      position: [centerX, centerY, centerZ],
      isParent: true,
      ring: 0,
    });
  }

  galaxyData.rings.forEach(ringData => {
    const ringNum = ringData.ring;
    const radius = RING_RADII[ringNum] || (ringNum * 8);
    const ringPeople = ringData.people || [];
    const count = ringPeople.length;

    ringPeople.forEach((entry, index) => {
      const person = entry.person || entry;
      const angle = (index / Math.max(1, count)) * Math.PI * 2;
      const seed = person.id || index;
      const radVar = seededRandom(seed + '-rr') * 2 - 1;
      const yVar = seededRandom(seed + '-ry') * 3 - 1.5;
      const finalRadius = radius + radVar;

      positioned.push({
        ...person,
        position: [
          centerX + Math.cos(angle) * finalRadius,
          centerY + yVar,
          centerZ + Math.sin(angle) * finalRadius,
        ],
        isParent: ringNum === 1 && (entry.relationship?.relationship_type === 'partner' || entry.relationship?.relationship_type === 'spouse'),
        ring: ringNum,
        relationshipType: entry.relationship?.relationship_type,
        relationshipStatus: entry.relationship?.status_from_person,
      });
    });
  });

  return positioned;
}

function RelationshipLines({ stars, galaxyData, centerX = 0, centerY = 0, centerZ = 0 }) {
  const lines = useMemo(() => {
    if (!galaxyData?.edges || !stars.length) return [];
    const posMap = new Map();
    stars.forEach(s => posMap.set(s.id, s.position));

    return galaxyData.edges.map((edge, i) => {
      const fromPos = posMap.get(edge.from);
      const toPos = posMap.get(edge.to);
      if (!fromPos || !toPos) return null;

      const status = edge.status || 'confirmed';
      let color = '#FFD700';
      let opacity = 0.25;
      if (status === 'pending') { color = '#22D3EE'; opacity = 0.15; }
      else if (status === 'claimed') { color = '#94A3B8'; opacity = 0.12; }
      else if (status === 'denied') return null;

      const points = [
        new THREE.Vector3(...fromPos),
        new THREE.Vector3(...toPos),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);

      return { geometry, color, opacity, key: `edge-${i}` };
    }).filter(Boolean);
  }, [stars, galaxyData]);

  useEffect(() => {
    return () => {
      lines.forEach(line => line.geometry.dispose());
    };
  }, [lines]);

  return (
    <group>
      {lines.map(line => (
        <line key={line.key} geometry={line.geometry}>
          <lineBasicMaterial
            color={line.color}
            transparent
            opacity={line.opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </line>
      ))}
    </group>
  );
}

function RelationshipSystemView({
  galaxyData,
  centerPosition,
  onStarClick,
  onStarHover,
  hoveredStarIdRef,
  focusedStarId,
  fadeOpacity = 1,
  bloomScale = 1,
}) {
  const centerX = centerPosition?.x || 0;
  const centerY = centerPosition?.y || 0;
  const centerZ = centerPosition?.z || 0;

  const positionedPeople = useMemo(() => {
    return arrangeStarsByRings(galaxyData, centerX, centerY, centerZ);
  }, [galaxyData, centerX, centerY, centerZ]);

  const starsWithProfiles = useMemo(() => {
    return positionedPeople.map(person => ({
      id: person.id,
      position: person.position,
      starProfile: person.star_profile || generateRandomStarProfile(person.id),
      person,
      ring: person.ring,
      isParent: person.isParent,
    }));
  }, [positionedPeople]);

  const systemGroupRef = useRef();
  useFrame((state) => {
    if (!systemGroupRef.current) return;
    const t = state.clock.elapsedTime;
    systemGroupRef.current.rotation.y = t * 0.003;
    systemGroupRef.current.position.y = Math.sin(t * 0.1) * 0.03;
  });

  if (!galaxyData || starsWithProfiles.length === 0) return null;

  return (
    <group ref={systemGroupRef}>
      {(() => {
        const centerStar = starsWithProfiles.find(s => s.ring === 0);
        const partnerStars = starsWithProfiles.filter(s => s.isParent && s.ring !== 0);
        if (centerStar && partnerStars.length > 0) {
          return partnerStars.map((partner, i) => (
            <UnionLightBridge
              key={`union-bridge-${i}`}
              starA={centerStar.position}
              starB={partner.position}
              colorA={getStarPrimaryColor(centerStar.starProfile)}
              colorB={getStarPrimaryColor(partner.starProfile)}
              intensity={1.0 * fadeOpacity}
            />
          ));
        }
        return null;
      })()}
      <SystemDustCloud
        center={[centerX, centerY, centerZ]}
        color="#FFD700"
        count={100}
        radius={12}
        opacity={0.2 * fadeOpacity}
      />
      <sprite position={[centerX, centerY, centerZ]} scale={[10, 10, 1]}>
        <spriteMaterial
          map={getGlowTexture()}
          color="#FFD700"
          transparent
          opacity={0.05 * fadeOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <RelationshipLines
        stars={starsWithProfiles}
        galaxyData={galaxyData}
        centerX={centerX}
        centerY={centerY}
        centerZ={centerZ}
      />
      <StarInstanced
        stars={starsWithProfiles}
        onStarClick={onStarClick}
        onStarHover={onStarHover}
        hoveredIdRef={hoveredStarIdRef}
        focusedId={focusedStarId}
        globalOpacity={fadeOpacity}
        globalScale={bloomScale}
      />
    </group>
  );
}

function TransitioningNebula({ household, householdPositions, households, opacity = 1, onFadeComplete }) {
  const groupRef = useRef();
  const lastOpacity = useRef(opacity);
  
  const pos = householdPositions.get(household.id);
  const colorIndex = households.findIndex(h => h.id === household.id);
  
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.traverse((child) => {
        if (child.material) {
          child.material.opacity = opacity;
          child.material.transparent = true;
        }
      });
    }
    
    if (lastOpacity.current > 0.01 && opacity <= 0.01) {
      onFadeComplete?.();
    }
    lastOpacity.current = opacity;
  });
  
  if (!pos) return null;
  
  return (
    <group ref={groupRef}>
      <HouseholdCluster
        position={[pos.x, pos.y, pos.z]}
        household={household}
        memberCount={pos.memberCount}
        colorIndex={colorIndex}
        isHovered={false}
        onClick={() => {}}
        onPointerOver={() => {}}
        onPointerOut={() => {}}
      />
    </group>
  );
}

function getStarPrimaryColor(starProfile) {
  if (!starProfile) return '#ffffff';
  const palette = COLOR_PALETTES[starProfile.colorPalette];
  if (palette) return palette.primary;
  if (starProfile.customColor) return starProfile.customColor;
  return '#ffffff';
}

function UnionLightBridge({ starA, starB, colorA = '#ffffff', colorB = '#ffffff', intensity: intensityProp = 1.0, intensityRef }) {
  const streamAtoB = useRef();
  const streamBtoA = useRef();

  const colA = useMemo(() => new THREE.Color(colorA), [colorA]);
  const colB = useMemo(() => new THREE.Color(colorB), [colorB]);

  const posA = useMemo(() => new THREE.Vector3(...(starA || [0, 0, 0])), [starA]);
  const posB = useMemo(() => new THREE.Vector3(...(starB || [0, 0, 0])), [starB]);
  const bridgeLength = useMemo(() => posA.distanceTo(posB), [posA, posB]);

  const particlesPerStream = 18;
  const streamData = useMemo(() => {
    const makeStream = (seedBase) => {
      const particles = [];
      for (let i = 0; i < particlesPerStream; i++) {
        const hash = Math.sin((seedBase + i) * 127.1 + 311.7) * 43758.5453;
        const r = hash - Math.floor(hash);
        const hash2 = Math.sin((seedBase + i) * 269.5 + 183.3) * 31415.9265;
        const r2 = hash2 - Math.floor(hash2);
        const hash3 = Math.sin((seedBase + i) * 419.2 + 571.1) * 27182.8182;
        const r3 = hash3 - Math.floor(hash3);
        const hash4 = Math.sin((seedBase + i) * 631.7 + 113.9) * 14142.1356;
        const r4 = hash4 - Math.floor(hash4);
        particles.push({
          speed: 0.05 + r * 0.08,
          offset: i / particlesPerStream + r2 * 0.05,
          driftA: (r3 - 0.5) * 0.4,
          driftB: (r4 - 0.5) * 0.4,
          size: 0.15 + r * 0.2,
          brightness: 0.8 + r2 * 0.4,
          wobbleFreq: 1.5 + r3 * 2.0,
          wobbleFreq2: 1.0 + r4 * 1.5,
          glowPhase: r3 * Math.PI * 2,
          glowSpeed: 0.8 + r4 * 1.2,
        });
      }
      return particles;
    };
    return {
      aToB: makeStream(0),
      bToA: makeStream(100),
    };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const intensity = intensityRef ? intensityRef.current : intensityProp;

    if (streamAtoB.current) {
      const children = streamAtoB.current.children;
      const data = streamData.aToB;
      for (let i = 0; i < children.length && i < data.length; i++) {
        const p = data[i];
        const progress = (p.offset + t * p.speed) % 1.0;
        const px = posA.x + (posB.x - posA.x) * progress;
        const py = posA.y + (posB.y - posA.y) * progress + Math.sin(t * p.wobbleFreq + i * 5.0) * p.driftA;
        const pz = posA.z + (posB.z - posA.z) * progress + Math.cos(t * p.wobbleFreq2 + i * 3.7) * p.driftB;
        children[i].position.set(px, py, pz);
        const fade = Math.sin(progress * Math.PI);
        const glowPulse = 0.75 + 0.25 * Math.sin(t * p.glowSpeed + p.glowPhase);
        children[i].material.opacity = Math.min(p.brightness * fade * glowPulse * intensity, 1.0);
        const sizeGlow = 1.0 + 0.4 * Math.sin(t * p.glowSpeed * 0.7 + p.glowPhase + 1.0);
        const s = p.size * (0.8 + fade * 0.6) * sizeGlow;
        children[i].scale.set(s, s, 1);
      }
    }

    if (streamBtoA.current) {
      const children = streamBtoA.current.children;
      const data = streamData.bToA;
      for (let i = 0; i < children.length && i < data.length; i++) {
        const p = data[i];
        const progress = (p.offset + t * p.speed) % 1.0;
        const px = posB.x + (posA.x - posB.x) * progress;
        const py = posB.y + (posA.y - posB.y) * progress + Math.sin(t * p.wobbleFreq + i * 4.3) * p.driftA;
        const pz = posB.z + (posA.z - posB.z) * progress + Math.cos(t * p.wobbleFreq2 + i * 6.1) * p.driftB;
        children[i].position.set(px, py, pz);
        const fade = Math.sin(progress * Math.PI);
        const glowPulse = 0.75 + 0.25 * Math.sin(t * p.glowSpeed + p.glowPhase);
        children[i].material.opacity = Math.min(p.brightness * fade * glowPulse * intensity, 1.0);
        const sizeGlow = 1.0 + 0.4 * Math.sin(t * p.glowSpeed * 0.7 + p.glowPhase + 1.0);
        const s = p.size * (0.8 + fade * 0.6) * sizeGlow;
        children[i].scale.set(s, s, 1);
      }
    }
  });

  if (!starA || !starB || bridgeLength < 0.01) return null;

  return (
    <group>
      <group ref={streamAtoB}>
        {streamData.aToB.map((_, i) => (
          <sprite key={`stream-a-${i}`}>
            <spriteMaterial
              map={getGlowTexture()}
              color={colA}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </sprite>
        ))}
      </group>
      <group ref={streamBtoA}>
        {streamData.bToA.map((_, i) => (
          <sprite key={`stream-b-${i}`}>
            <spriteMaterial
              map={getGlowTexture()}
              color={colB}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </sprite>
        ))}
      </group>
    </group>
  );
}

function SystemDustCloud({ center, color, count = 120, radius = 8, opacity = 0.3 }) {
  const pointsRef = useRef();
  const { positions, phases } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.random() * radius;
      pos[i * 3] = center[0] + r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = center[1] + (Math.random() - 0.5) * radius * 0.4;
      pos[i * 3 + 2] = center[2] + r * Math.sin(phi) * Math.sin(theta);
      ph[i] = Math.random() * Math.PI * 2;
    }
    return { positions: pos, phases: ph };
  }, [count, radius, center]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.elapsedTime;
    const posArr = pointsRef.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const phase = phases[i];
      posArr[i * 3] += Math.sin(t * 0.15 + phase) * 0.002;
      posArr[i * 3 + 1] += Math.cos(t * 0.1 + phase * 1.3) * 0.001;
      posArr[i * 3 + 2] += Math.cos(t * 0.12 + phase * 0.7) * 0.002;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.08}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function SystemLevelScene({
  household,
  people,
  relationships,
  hoveredStarIdRef,
  focusedStarId,
  onStarClick,
  onStarHover,
  colorIndex = 0,
  householdPosition,
  fadeOpacity = 1,
  bloomScale = 1,
}) {
  const householdPeople = useMemo(() => {
    const householdMembers = people.filter(p => p.household_id === household.id);
    if (householdMembers.length === 0) return [];

    const coupleTypes = ['partner', 'spouse'];
    const parentTypes = ['parent'];

    const coupleIds = new Set();
    householdMembers.forEach(member => {
      relationships.forEach(rel => {
        const idA = rel.person_id || rel.person1_id;
        const idB = rel.related_person_id || rel.person2_id;
        const type = (rel.relationship_type || '').toLowerCase();
        if (coupleTypes.includes(type)) {
          if (idA === member.id) { coupleIds.add(member.id); coupleIds.add(idB); }
          if (idB === member.id) { coupleIds.add(member.id); coupleIds.add(idA); }
        }
      });
    });

    const coreParentIds = coupleIds.size > 0 ? coupleIds : new Set(householdMembers.map(m => m.id));

    const childIds = new Set();
    relationships.forEach(rel => {
      const idA = rel.person_id || rel.person1_id;
      const idB = rel.related_person_id || rel.person2_id;
      const type = (rel.relationship_type || '').toLowerCase();
      if (parentTypes.includes(type) && coreParentIds.has(idA)) childIds.add(idB);
      if (type === 'child' && coreParentIds.has(idB)) childIds.add(idA);
    });

    coreParentIds.forEach(id => childIds.delete(id));

    const familyIds = new Set([...coreParentIds, ...childIds]);
    const seen = new Set();
    const coreParents = people.filter(p => coreParentIds.has(p.id) && !seen.has(p.id) && seen.add(p.id));
    const children = people.filter(p => childIds.has(p.id) && !seen.has(p.id) && seen.add(p.id));
    return [...coreParents, ...children];
  }, [people, household.id, relationships]);
  
  const centerX = householdPosition?.x || 0;
  const centerY = householdPosition?.y || 0;
  const centerZ = householdPosition?.z || 0;
  
  const positionedPeople = useMemo(() => {
    return arrangeStarsInCluster(householdPeople, centerX, centerY, centerZ, relationships);
  }, [householdPeople, centerX, centerY, centerZ, relationships]);
  
  const starsWithProfiles = useMemo(() => {
    return positionedPeople.map(person => ({
      id: person.id,
      position: person.position,
      starProfile: person.star_profile || generateRandomStarProfile(person.id),
      person,
      isParent: person.isParent,
    }));
  }, [positionedPeople]);
  
  const colors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  
  const mc = householdPeople.length;
  const sc = classifyHousehold(mc);

  return (
    <group>
      <group position={[centerX, centerY, centerZ]}>
      </group>
      {(() => {
        const parentStars = starsWithProfiles.filter(s => s.isParent);
        if (parentStars.length >= 2) {
          return (
            <UnionLightBridge
              starA={parentStars[0].position}
              starB={parentStars[1].position}
              colorA={getStarPrimaryColor(parentStars[0].starProfile)}
              colorB={getStarPrimaryColor(parentStars[1].starProfile)}
              intensity={1.0 * fadeOpacity}
            />
          );
        }
        return null;
      })()}
      <ConstellationLines
        stars={starsWithProfiles}
        relationships={relationships}
        colorIndex={colorIndex}
        opacity={0.5 * fadeOpacity}
      />
      <StarInstanced
        stars={starsWithProfiles}
        onStarClick={onStarClick}
        onStarHover={onStarHover}
        hoveredIdRef={hoveredStarIdRef}
        focusedId={focusedStarId}
        globalOpacity={fadeOpacity}
        globalScale={bloomScale}
      />
    </group>
  );
}

function AnimatedHouseholdGroup({ 
  household, 
  basePosition, 
  colorIndex, 
  hoveredHouseholdIdRef,
  connectedToHoveredRef,
  isFocused,
  transitionProgressRef,
  transitionDirectionRef,
  level,
  focusedHouseholdId,
  householdPositions,
  stars,
  relationships = [],
  onStarClick,
  onStarHover,
  hoveredStarIdRef,
  focusedStarId,
  onClick, 
  onPointerOver, 
  onPointerOut,
  viewMode = 'nebula',
  memberCount = 0,
  starClass,
  showLabels = true,
  householdGroupRefs,
  isTransitioning = false,
  hasMinorChildren = false,
}) {
  const groupRef = useRef();
  const { camera } = useThree();
  const breathPhase = useMemo(() => (parseInt(household?.id, 10) || 0) * 1.7, [household?.id]);
  const currentState = useRef({
    offsetX: 0, offsetY: 0, offsetZ: 0,
    scale: 1, opacity: 1.0, starOpacity: 1
  });
  const renderOpacityRef = useRef(1.0);
  const starRenderOpacityRef = useRef(1);
  const constellationHighlightRef = useRef(0.05);
  const [isHoveredSelf, setIsHoveredSelf] = useState(false);
  const prevIsHoveredSelf = useRef(false);
  
  const localStars = useMemo(() => {
    return stars.map(star => ({
      ...star,
      position: [
        star.position[0] - basePosition.x,
        star.position[1] - basePosition.y,
        star.position[2] - basePosition.z
      ]
    }));
  }, [stars, basePosition]);
  
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    const dir = transitionDirectionRef ? transitionDirectionRef.current : null;
    const tp = transitionProgressRef ? transitionProgressRef.current : 0;
    let focusProgress;
    if (dir === 'zoom-in') {
      focusProgress = tp;
    } else if (dir === 'zoom-out') {
      focusProgress = 1 - tp;
    } else if (dir === 'idle' || dir === null) {
      focusProgress = level === 'system' ? 1 : 0;
    } else {
      focusProgress = 0;
    }
    
    const cameraForward = new THREE.Vector3();
    camera.getWorldDirection(cameraForward);
    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(camera.up, cameraForward).normalize();
    const cameraUp = new THREE.Vector3();
    cameraUp.crossVectors(cameraForward, cameraRight).normalize();
    
    let targetOffsetX = 0, targetOffsetY = 0, targetOffsetZ = 0;
    let targetScale = 1;
    let targetOpacity = 1.0;
    let targetStarOpacity = 1;
    
    if (isFocused) {
      targetScale = 1 + focusProgress * 0.5;
      targetOpacity = Math.max(0.05, 1 - focusProgress * 1.2);
      targetStarOpacity = 1;
    } else if (focusedHouseholdId) {
      const fadeAmount = Math.min(1, focusProgress * 2);
      targetOpacity = 0.8 - fadeAmount * 0.7;
      targetStarOpacity = 1 - fadeAmount * 0.85;
      targetScale = 1 - fadeAmount * 0.15;
    } else if (hoveredHouseholdIdRef.current != null && String(hoveredHouseholdIdRef.current) === String(household.id)) {
      const towardCamera = cameraForward.clone().multiplyScalar(-6);
      targetOffsetX = towardCamera.x;
      targetOffsetY = towardCamera.y;
      targetOffsetZ = towardCamera.z;
      targetScale = 1.5;
      targetOpacity = 1;
      targetStarOpacity = 1;
    } else if (hoveredHouseholdIdRef.current) {
      const connected = connectedToHoveredRef.current;
      if (connected && connected.has(String(household.id))) {
        targetOpacity = 0.9;
        targetStarOpacity = 1;
        targetScale = 1.05;
      } else {
        targetOpacity = 0.25;
        targetStarOpacity = 0.35;
        targetScale = 0.92;
      }
    } else {
      const breathe = Math.sin(state.clock.elapsedTime * 0.8 + breathPhase) * 0.03;
      targetScale = 1.0 + breathe;
    }

    if (isNaN(targetScale)) targetScale = 1;
    if (isNaN(targetOpacity)) targetOpacity = 1;
    if (isNaN(targetStarOpacity)) targetStarOpacity = 1;
    
    const lerpSpeed = 4.5 * delta;
    const curr = currentState.current;
    curr.offsetX += (targetOffsetX - curr.offsetX) * lerpSpeed;
    curr.offsetY += (targetOffsetY - curr.offsetY) * lerpSpeed;
    curr.offsetZ += (targetOffsetZ - curr.offsetZ) * lerpSpeed;
    curr.scale += (targetScale - curr.scale) * lerpSpeed;
    curr.opacity += (targetOpacity - curr.opacity) * lerpSpeed;
    curr.starOpacity += (targetStarOpacity - curr.starOpacity) * lerpSpeed;
    
    groupRef.current.position.set(
      basePosition.x + curr.offsetX,
      basePosition.y + curr.offsetY,
      basePosition.z + curr.offsetZ
    );
    groupRef.current.scale.setScalar(curr.scale);
    
    if (householdGroupRefs) {
      householdGroupRefs.current.set(household.id, groupRef.current);
    }
    
    renderOpacityRef.current = curr.opacity;
    starRenderOpacityRef.current = curr.starOpacity;
    
    const nowHovered = hoveredHouseholdIdRef.current != null && String(hoveredHouseholdIdRef.current) === String(household.id);
    const targetHighlight = nowHovered ? 1.0 : 0.05;
    constellationHighlightRef.current += (targetHighlight - constellationHighlightRef.current) * lerpSpeed;
    if (nowHovered !== prevIsHoveredSelf.current) {
      prevIsHoveredSelf.current = nowHovered;
      setIsHoveredSelf(nowHovered);
    }
  });
  
  const isOtherFocused = focusedHouseholdId && !isFocused;

  const galaxyCoupleRing = useMemo(() => {
    if (!localStars || localStars.length < 2) return null;
    const parentStars = localStars.filter(s => s.isParent);
    if (parentStars.length < 2) return null;
    return { center: [0, 0, 0], radius: GALAXY_RING_RADIUS };
  }, [localStars]);

  const coupleStarPair = useMemo(() => {
    if (!localStars || localStars.length < 2) return null;
    const parentStars = localStars.filter(s => s.isParent);
    if (parentStars.length < 2) return null;
    return [parentStars[0], parentStars[1]];
  }, [localStars]);

  const householdColor = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];

  return (
    <group ref={groupRef}>
      <StarMapCluster
        position={[0, 0, 0]}
        household={household}
        memberCount={memberCount}
        starClass={starClass}
        isHovered={isHoveredSelf && !focusedHouseholdId}
        isSystemView={!!focusedHouseholdId}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        showLabels={showLabels}
        householdColor={householdColor}
      />
      {showLabels && !focusedHouseholdId && !isHoveredSelf && (
        <GalaxyLabel household={household} householdColor={householdColor} opacityRef={renderOpacityRef} />
      
      )}
      {!focusedHouseholdId && galaxyCoupleRing && (
        <CoupleRing
          center={galaxyCoupleRing.center}
          radius={GALAXY_RING_RADIUS}
          colorIndex={colorIndex}
          opacityRef={renderOpacityRef}
          opacityScale={0.5}
        />
      )}
      {!focusedHouseholdId && coupleStarPair && (
        <UnionLightBridge
          starA={coupleStarPair[0].position}
          starB={coupleStarPair[1].position}
          colorA={getStarPrimaryColor(coupleStarPair[0].starProfile)}
          colorB={getStarPrimaryColor(coupleStarPair[1].starProfile)}
          intensityRef={renderOpacityRef}
        />
      )}
      {!focusedHouseholdId && isHoveredSelf && galaxyCoupleRing && (
        <HoverSphere
          colorIndex={colorIndex}
          radius={GALAXY_RING_RADIUS}
        />
      )}
      {isFocused && !isTransitioning && (
        <ConstellationLines
          stars={localStars}
          relationships={relationships}
          colorIndex={colorIndex}
          opacityRef={starRenderOpacityRef}
          opacityScale={0.8}
        />
      )}
      {!focusedHouseholdId && hasMinorChildren && (
        <ConstellationLines
          stars={localStars}
          relationships={relationships}
          colorIndex={colorIndex}
          opacityRef={renderOpacityRef}
          opacityScale={isHoveredSelf ? 0.7 : 0.25}
          highlightRef={constellationHighlightRef}
        />
      )}
      {!isOtherFocused && (
        <StarInstanced
          stars={localStars}
          onStarClick={focusedHouseholdId ? onStarClick : (star) => onClick()}
          onStarHover={focusedHouseholdId ? onStarHover : () => {}}
          hoveredIdRef={focusedHouseholdId ? hoveredStarIdRef : null}
          focusedId={focusedHouseholdId ? focusedStarId : null}
          globalOpacityRef={starRenderOpacityRef}
          globalScale={1}
          animated={isFocused}
        />
      )}
    </group>
  );
}

const GALAXY_RING_RADIUS = 3.5;

function GalaxyLabel({ household, householdColor, opacityRef }) {
  const divRef = useRef();
  const groupRef = useRef();
  const { camera, size } = useThree();
  const isMobile = size.width < 768;

  useFrame(() => {
    if (!divRef.current || !groupRef.current) return;
    const worldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPos);
    const dist = camera.position.distanceTo(worldPos);

    const cullDist = isMobile ? 300 : 400;
    if (dist > cullDist) {
      divRef.current.style.display = 'none';
      return;
    }
    divRef.current.style.display = '';

    const externalOpacity = opacityRef ? opacityRef.current : 1;
    const minFont = isMobile ? 11 : 12;
    const maxFont = isMobile ? 18 : 22;
    const fontSize = Math.max(minFont, Math.min(maxFont, 500 / dist));
    const baseOpacity = Math.max(0.4, Math.min(0.95, 25 / dist));
    divRef.current.style.fontSize = fontSize + 'px';
    divRef.current.style.opacity = baseOpacity * externalOpacity;
  });

  const displayName = household?.name || '';

  return (
    <group ref={groupRef} position={[0, -3.5, 0]}>
      <Html center style={{ pointerEvents: 'none' }}>
        <div ref={divRef} style={{
          color: householdColor.primary,
          fontSize: '12px',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: isMobile ? '120px' : '240px',
          opacity: 0.85,
          textShadow: `0 0 8px ${householdColor.primary}88, 0 0 16px ${householdColor.primary}44`,
          transition: 'font-size 0.1s ease',
        }}>
          {displayName}
        </div>
      </Html>
    </group>
  );
}

function GalaxyOutlineRing({ colorIndex, radius = GALAXY_RING_RADIUS, opacity: externalOpacity = 1 }) {
  const ringGroupRef = useRef();
  const matRef = useRef();
  const baseColors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  const ringColor = useMemo(() => new THREE.Color(baseColors.primary), [baseColors]);
  const { camera } = useThree();

  const _worldPos = useMemo(() => new THREE.Vector3(), []);
  const _dir = useMemo(() => new THREE.Vector3(), []);
  const _right = useMemo(() => new THREE.Vector3(), []);
  const _up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const _corrUp = useMemo(() => new THREE.Vector3(), []);
  const _mat = useMemo(() => new THREE.Matrix4(), []);

  const ringPoints = useMemo(() => {
    const segments = 64;
    const pts = new Float32Array((segments + 1) * 3);
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts[i * 3] = Math.cos(angle) * radius;
      pts[i * 3 + 1] = Math.sin(angle) * radius;
      pts[i * 3 + 2] = 0;
    }
    return pts;
  }, [radius]);

  useFrame((state) => {
    if (ringGroupRef.current) {
      ringGroupRef.current.getWorldPosition(_worldPos);
      _dir.copy(camera.position).sub(_worldPos).normalize();
      const upVec = Math.abs(_dir.y) > 0.95 ? _up.set(1, 0, 0) : _up.set(0, 1, 0);
      _right.crossVectors(upVec, _dir).normalize();
      _corrUp.crossVectors(_dir, _right).normalize();
      _mat.makeBasis(_right, _corrUp, _dir);
      ringGroupRef.current.quaternion.setFromRotationMatrix(_mat);
    }
    if (matRef.current) {
      const t = state.clock.elapsedTime;
      matRef.current.opacity = (0.45 + Math.sin(t * 1.2) * 0.1) * externalOpacity;
    }
  });

  return (
    <group ref={ringGroupRef}>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={ringPoints.length / 3}
            array={ringPoints}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          ref={matRef}
          color={ringColor}
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>
    </group>
  );
}

function UniverseCoupleLink({ starA, starB, colorIndex, opacity = 1 }) {
  const lineRef = useRef();
  const particlesRef = useRef();
  const baseColors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  const lineColor = useMemo(() => new THREE.Color(baseColors.primary), [baseColors]);
  const glowColor = useMemo(() => new THREE.Color(baseColors.glow), [baseColors]);

  const PARTICLE_COUNT = 6;

  const particleData = useMemo(() => {
    const data = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      data.push({
        speed: 0.25 + Math.random() * 0.3,
        offset: Math.random(),
        size: 0.12 + Math.random() * 0.08,
      });
    }
    return data;
  }, []);

  const lineGeo = useMemo(() => {
    const posA = starA.position;
    const posB = starB.position;
    const pts = new Float32Array([
      posA[0], posA[1], posA[2],
      posB[0], posB[1], posB[2],
    ]);
    return pts;
  }, [starA, starB]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (lineRef.current) {
      lineRef.current.material.opacity = opacity * (0.35 + Math.sin(t * 1.5) * 0.15);
    }
    if (particlesRef.current) {
      const posA = starA.position;
      const posB = starB.position;
      const children = particlesRef.current.children;
      for (let i = 0; i < children.length && i < particleData.length; i++) {
        const p = particleData[i];
        const progress = ((p.offset + t * p.speed) % 1);
        const x = posA[0] + (posB[0] - posA[0]) * progress;
        const y = posA[1] + (posB[1] - posA[1]) * progress;
        const z = posA[2] + (posB[2] - posA[2]) * progress;
        children[i].position.set(x, y, z);
        const pulse = 0.5 + Math.sin(t * 3 + p.offset * Math.PI * 2) * 0.3;
        children[i].material.opacity = opacity * pulse * 0.7;
        const s = p.size * (0.8 + pulse * 0.4);
        children[i].scale.set(s, s, 1);
      }
    }
  });

  return (
    <group>
      <line ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={lineGeo}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={lineColor}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>
      <group ref={particlesRef}>
        {particleData.map((p, i) => (
          <sprite key={`couple-particle-${i}`} scale={[p.size, p.size, 1]}>
            <spriteMaterial
              map={getGlowTexture()}
              color={glowColor}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </sprite>
        ))}
      </group>
    </group>
  );
}

function HoverSphere({ colorIndex, radius = 3.0 }) {
  const meshRef = useRef();
  const baseColors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  const sphereColor = useMemo(() => new THREE.Color(baseColors.primary), [baseColors]);

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime;
      const pulse = 1.0 + Math.sin(t * 1.5) * 0.08;
      meshRef.current.scale.setScalar(pulse);
      meshRef.current.material.opacity = 0.12 + Math.sin(t * 2.0) * 0.04;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshBasicMaterial
        color={sphereColor}
        transparent
        opacity={0.12}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function CoupleRing({ center, radius, colorIndex, opacity: opacityProp = 0.6, opacityRef, opacityScale = 1 }) {
  const mainMatRef = useRef();
  const outerGlowMatRef = useRef();
  const innerFillMatRef = useRef();
  const pulseRingRef = useRef();
  const pulseMatRef = useRef();
  const sparkleRef = useRef();

  const baseColors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  const ringColor = useMemo(() => new THREE.Color(baseColors.primary), [baseColors.primary]);
  const glowColor = useMemo(() => new THREE.Color(baseColors.glow), [baseColors.glow]);

  const ringLines = useMemo(() => {
    const segments = 96;
    const layers = [
      { r: radius * 0.97, opacity: 0.15 },
      { r: radius, opacity: 0.7 },
      { r: radius * 1.03, opacity: 0.25 },
      { r: radius * 1.07, opacity: 0.08 },
    ];
    return layers.map(layer => {
      const arr = new Float32Array((segments + 1) * 3);
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        arr[i * 3] = Math.cos(angle) * layer.r;
        arr[i * 3 + 1] = Math.sin(angle) * layer.r;
        arr[i * 3 + 2] = 0;
      }
      return { positionArray: arr, count: segments + 1, opacity: layer.opacity };
    });
  }, [radius]);

  const sparkleCount = 8;
  const sparkleData = useMemo(() => {
    const data = [];
    for (let i = 0; i < sparkleCount; i++) {
      data.push({
        phase: (i / sparkleCount) * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.2,
        size: 0.06 + Math.random() * 0.04,
        brightness: 0.5 + Math.random() * 0.5,
      });
    }
    return data;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const opacity = opacityRef ? opacityRef.current * opacityScale : opacityProp;
    const breathe = 0.65 + Math.sin(t * 0.9) * 0.2 + Math.sin(t * 1.7) * 0.1;
    const pulseWave = Math.max(0, Math.sin(t * 0.6));
    const pulseScale = 1.05 + pulseWave * 0.12;

    if (mainMatRef.current) {
      mainMatRef.current.opacity = opacity * breathe;
    }
    if (outerGlowMatRef.current) {
      outerGlowMatRef.current.opacity = opacity * 0.08 * breathe;
    }
    if (innerFillMatRef.current) {
      innerFillMatRef.current.opacity = opacity * 0.04 * breathe;
    }
    if (pulseRingRef.current) {
      pulseRingRef.current.scale.set(pulseScale, pulseScale, pulseScale);
    }
    if (pulseMatRef.current) {
      pulseMatRef.current.opacity = opacity * 0.1 * pulseWave;
    }

    if (sparkleRef.current) {
      const children = sparkleRef.current.children;
      for (let i = 0; i < children.length && i < sparkleData.length; i++) {
        const s = sparkleData[i];
        const angle = s.phase + t * s.speed;
        children[i].position.set(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          0
        );
        const flicker = 0.3 + Math.sin(t * 3 + s.phase) * 0.4 + Math.sin(t * 7.3 + s.phase * 2) * 0.3;
        children[i].material.opacity = opacity * s.brightness * Math.max(0, flicker);
      }
    }
  });

  const { camera } = useThree();
  const ringGroupRef = useRef();
  const _worldPos = useMemo(() => new THREE.Vector3(), []);
  const _dir = useMemo(() => new THREE.Vector3(), []);
  const _right = useMemo(() => new THREE.Vector3(), []);
  const _up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const _corrUp = useMemo(() => new THREE.Vector3(), []);
  const _mat = useMemo(() => new THREE.Matrix4(), []);

  useFrame(() => {
    if (ringGroupRef.current) {
      ringGroupRef.current.getWorldPosition(_worldPos);
      _dir.copy(camera.position).sub(_worldPos).normalize();
      const upVec = Math.abs(_dir.y) > 0.95 ? _up.set(1, 0, 0) : _up.set(0, 1, 0);
      _right.crossVectors(upVec, _dir).normalize();
      _corrUp.crossVectors(_dir, _right).normalize();
      _mat.makeBasis(_right, _corrUp, _dir);
      ringGroupRef.current.quaternion.setFromRotationMatrix(_mat);
    }
  });

  return (
    <group position={[center[0], center[1], center[2]]}>
      <group ref={ringGroupRef}>
        {ringLines.map((layer, li) => (
          <line key={`ring-layer-${li}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={layer.count}
                array={layer.positionArray}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial
              ref={li === 1 ? mainMatRef : (li === 3 ? outerGlowMatRef : undefined)}
              color={li === 0 ? glowColor : ringColor}
              transparent
              opacity={opacityProp * layer.opacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </line>
        ))}

        <mesh>
          <circleGeometry args={[radius * 0.95, 64]} />
          <meshBasicMaterial
            ref={innerFillMatRef}
            color={ringColor}
            transparent
            opacity={opacityProp * 0.02}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        <group ref={pulseRingRef}>
          <mesh>
            <ringGeometry args={[radius * 1.01, radius * 1.06, 64]} />
            <meshBasicMaterial
              ref={pulseMatRef}
              color={glowColor}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>

        <group ref={sparkleRef}>
          {sparkleData.map((s, i) => (
            <sprite key={`sparkle-${i}`} scale={[s.size, s.size, 1]}>
              <spriteMaterial
                map={getGlowTexture()}
                color={glowColor}
                transparent
                opacity={0}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </sprite>
          ))}
        </group>
      </group>
    </group>
  );
}

const _sysRingDir = new THREE.Vector3();
const _sysRingUp = new THREE.Vector3();
const _sysRingRight = new THREE.Vector3();
const _sysRingCorrUp = new THREE.Vector3();
const _sysWorldCenter = new THREE.Vector3();

function SystemMeshLines({ lines, colorIndex, opacity = 0.6, coupleCenter, coupleRadius, highlightRef }) {
  const meshRef = useRef();
  const startAttrRef = useRef();
  const timeUniform = useRef({ value: 0 });
  const resolutionUniform = useRef({ value: new THREE.Vector2(1920, 1080) });
  const lineWidthUniform = useRef({ value: 4.0 });

  const lineCount = lines.length;
  const totalVerts = lineCount * 4;
  const totalIndices = lineCount * 6;

  const { startPos, endPos, sides, tValues, colorValues, highlightValues, indices, dummyPositions } = useMemo(() => {
    const sp = new Float32Array(totalVerts * 3);
    const ep = new Float32Array(totalVerts * 3);
    const sd = new Float32Array(totalVerts);
    const t = new Float32Array(totalVerts);
    const col = new Float32Array(totalVerts * 3);
    const hl = new Float32Array(totalVerts);
    const dp = new Float32Array(totalVerts * 3);
    const idx = new Uint32Array(totalIndices);

    const baseColors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
    const lineColor = new THREE.Color(baseColors.glow);

    for (let e = 0; e < lineCount; e++) {
      const base = e * 4;
      sd[base] = -1; t[base] = 0;
      sd[base + 1] = 1; t[base + 1] = 0;
      sd[base + 2] = -1; t[base + 2] = 1;
      sd[base + 3] = 1; t[base + 3] = 1;

      const idxOff = e * 6;
      idx[idxOff] = base;
      idx[idxOff + 1] = base + 1;
      idx[idxOff + 2] = base + 2;
      idx[idxOff + 3] = base + 1;
      idx[idxOff + 4] = base + 3;
      idx[idxOff + 5] = base + 2;

      const line = lines[e];
      for (let v = 0; v < 4; v++) {
        const vi = (base + v) * 3;
        sp[vi] = line.from[0]; sp[vi + 1] = line.from[1]; sp[vi + 2] = line.from[2];
        ep[vi] = line.to[0]; ep[vi + 1] = line.to[1]; ep[vi + 2] = line.to[2];
        col[vi] = lineColor.r; col[vi + 1] = lineColor.g; col[vi + 2] = lineColor.b;
        hl[base + v] = 1.0;
      }
    }

    return { startPos: sp, endPos: ep, sides: sd, tValues: t, colorValues: col, highlightValues: hl, indices: idx, dummyPositions: dp };
  }, [lines, colorIndex, lineCount, totalVerts, totalIndices]);

  useFrame((state) => {
    timeUniform.current.value = state.clock.elapsedTime;
    const size = state.gl.getSize(new THREE.Vector2());
    resolutionUniform.current.value.set(size.x, size.y);

    if (coupleCenter && coupleRadius > 0 && startAttrRef.current && meshRef.current && lineCount > 0) {
      const spAttr = startAttrRef.current;
      const cx = coupleCenter[0], cy = coupleCenter[1], cz = coupleCenter[2];

      _sysWorldCenter.copy(state.camera.position);
      meshRef.current.worldToLocal(_sysWorldCenter);

      _sysRingDir.set(
        _sysWorldCenter.x - cx,
        _sysWorldCenter.y - cy,
        _sysWorldCenter.z - cz
      ).normalize();
      const upY = Math.abs(_sysRingDir.y) > 0.95 ? 1 : 0;
      _sysRingUp.set(upY, 1 - upY, 0);
      _sysRingRight.crossVectors(_sysRingUp, _sysRingDir).normalize();
      _sysRingCorrUp.crossVectors(_sysRingDir, _sysRingRight).normalize();

      for (let e = 0; e < lineCount; e++) {
        const line = lines[e];
        const toX = line.to[0], toY = line.to[1], toZ = line.to[2];

        const dx = toX - cx;
        const dy = toY - cy;
        const dz = toZ - cz;
        const projR = dx * _sysRingRight.x + dy * _sysRingRight.y + dz * _sysRingRight.z;
        const projU = dx * _sysRingCorrUp.x + dy * _sysRingCorrUp.y + dz * _sysRingCorrUp.z;
        const projLen = Math.sqrt(projR * projR + projU * projU);

        let fromX = cx, fromY = cy, fromZ = cz;
        if (projLen > 0.001) {
          const nR = projR / projLen;
          const nU = projU / projLen;
          fromX += (_sysRingRight.x * nR + _sysRingCorrUp.x * nU) * coupleRadius;
          fromY += (_sysRingRight.y * nR + _sysRingCorrUp.y * nU) * coupleRadius;
          fromZ += (_sysRingRight.z * nR + _sysRingCorrUp.z * nU) * coupleRadius;
        }

        const base = e * 4;
        for (let v = 0; v < 4; v++) {
          const vi = (base + v) * 3;
          spAttr.array[vi] = fromX;
          spAttr.array[vi + 1] = fromY;
          spAttr.array[vi + 2] = fromZ;
        }
      }
      spAttr.needsUpdate = true;
    }

    if (highlightRef && meshRef.current && lineCount > 0) {
      const hlAttr = meshRef.current.geometry.getAttribute('aHighlight');
      if (hlAttr) {
        const hlVal = highlightRef.current;
        for (let i = 0; i < lineCount * 4; i++) {
          hlAttr.array[i] = hlVal;
        }
        hlAttr.needsUpdate = true;
      }
    }
  });

  if (totalVerts === 0) return null;

  return (
    <mesh ref={meshRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={totalVerts} array={dummyPositions} itemSize={3} />
        <bufferAttribute ref={startAttrRef} attach="attributes-aStart" count={totalVerts} array={startPos} itemSize={3} />
        <bufferAttribute attach="attributes-aEnd" count={totalVerts} array={endPos} itemSize={3} />
        <bufferAttribute attach="attributes-aSide" count={totalVerts} array={sides} itemSize={1} />
        <bufferAttribute attach="attributes-aT" count={totalVerts} array={tValues} itemSize={1} />
        <bufferAttribute attach="attributes-aColor" count={totalVerts} array={colorValues} itemSize={3} />
        <bufferAttribute attach="attributes-aHighlight" count={totalVerts} array={highlightValues} itemSize={1} />
        <bufferAttribute attach="index" count={indices.length} array={indices} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={connectionLineShader.vertexShader}
        fragmentShader={connectionLineShader.fragmentShader}
        uniforms={{
          uTime: timeUniform.current,
          uResolution: resolutionUniform.current,
          uLineWidth: lineWidthUniform.current,
        }}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ConstellationLines({ stars, relationships, colorIndex, opacity: opacityProp = 0.6, opacityRef, opacityScale = 1, highlightRef }) {
  const { lines_data, coupleCenter, coupleRadius, hasCouple } = useMemo(() => {
    if (!stars || stars.length < 2) {
      return { lines_data: [], coupleCenter: [0,0,0], coupleRadius: 0, hasCouple: false };
    }

    const parentStars = stars.filter(s => s.isParent);
    const childStars = stars.filter(s => !s.isParent);

    let centerX = 0, centerY = 0, centerZ = 0;
    if (parentStars.length > 0) {
      centerX = parentStars.reduce((sum, s) => sum + s.position[0], 0) / parentStars.length;
      centerY = parentStars.reduce((sum, s) => sum + s.position[1], 0) / parentStars.length;
      centerZ = parentStars.reduce((sum, s) => sum + s.position[2], 0) / parentStars.length;
    }

    const ringRadius = 2.8;
    const parentStarIds = new Set(parentStars.map(s => s.id));

    const bioParentsOf = {};
    if (relationships) {
      for (const rel of relationships) {
        const type = (rel.relationship_type || '').toLowerCase();
        const subtype = (rel.subtype || 'biological').toLowerCase();
        if (type === 'parent' && subtype === 'biological') {
          const parentId = rel.person_id || rel.person1_id;
          const childId = rel.related_person_id || rel.person2_id;
          if (!bioParentsOf[childId]) bioParentsOf[childId] = [];
          bioParentsOf[childId].push(parentId);
        }
      }
    }

    const lines = [];

    if (childStars.length > 0 && parentStars.length > 0) {
      childStars.forEach(child => {
        const childBioParents = bioParentsOf[child.id] || [];

        if (parentStars.length >= 2) {
          const dx = child.position[0] - centerX;
          const dy = child.position[1] - centerY;
          const dz = child.position[2] - centerZ;
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (len > 0.001) {
            const nx = dx / len, ny = dy / len, nz = dz / len;
            lines.push({
              from: [centerX + nx * ringRadius, centerY + ny * ringRadius, centerZ + nz * ringRadius],
              to: child.position,
            });
          } else {
            lines.push({ from: [centerX, centerY, centerZ], to: child.position });
          }
        } else {
          const bioParentStar = parentStars.find(s => childBioParents.includes(s.id));
          const fromPos = bioParentStar ? bioParentStar.position : parentStars[0].position;
          lines.push({ from: fromPos, to: child.position });
        }
      });
    }

    return {
      lines_data: lines,
      coupleCenter: [centerX, centerY, centerZ],
      coupleRadius: ringRadius,
      hasCouple: parentStars.length >= 2,
    };
  }, [stars, relationships, colorIndex]);

  if (lines_data.length === 0 && !hasCouple) return null;

  return (
    <group>
      {hasCouple && (
        <CoupleRing
          center={coupleCenter}
          radius={coupleRadius}
          colorIndex={colorIndex}
          opacityRef={opacityRef}
          opacityScale={opacityScale * 0.85}
          opacity={opacityProp * 0.85}
        />
      )}
      {lines_data.length > 0 && (
        <SystemMeshLines
          lines={lines_data}
          colorIndex={colorIndex}
          opacity={opacityProp}
          coupleCenter={hasCouple ? coupleCenter : null}
          coupleRadius={hasCouple ? coupleRadius : 0}
          highlightRef={highlightRef}
        />
      )}
    </group>
  );
}

const connectionLineShader = {
  vertexShader: `
    attribute vec3 aStart;
    attribute vec3 aEnd;
    attribute float aSide;
    attribute float aT;
    attribute vec3 aColor;
    attribute float aHighlight;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uLineWidth;
    varying float vT;
    varying vec3 vColor;
    varying float vHighlight;
    varying float vSide;
    void main() {
      vec4 clipStart = projectionMatrix * modelViewMatrix * vec4(aStart, 1.0);
      vec4 clipEnd = projectionMatrix * modelViewMatrix * vec4(aEnd, 1.0);
      vec2 ndcStart = clipStart.xy / clipStart.w;
      vec2 ndcEnd = clipEnd.xy / clipEnd.w;
      vec2 screenStart = (ndcStart * 0.5 + 0.5) * uResolution;
      vec2 screenEnd = (ndcEnd * 0.5 + 0.5) * uResolution;
      vec2 dir = screenEnd - screenStart;
      float len = length(dir);
      vec2 perp = len > 0.001 ? vec2(-dir.y, dir.x) / len : vec2(0.0, 1.0);
      float pulse = fract(uTime * 0.3 - aT);
      float pulseShape = smoothstep(0.0, 0.14, pulse) * (1.0 - smoothstep(0.14, 0.28, pulse));
      float bulgeFactor = 1.0 + pulseShape * 0.5 * aHighlight;
      vec2 screenOffset = perp * aSide * uLineWidth * 0.5 * bulgeFactor;
      vec2 ndcOffset = screenOffset / uResolution * 2.0;
      vec4 clipPos = mix(clipStart, clipEnd, aT);
      clipPos.xy += ndcOffset * clipPos.w;
      gl_Position = clipPos;
      vT = aT;
      vColor = aColor;
      vHighlight = aHighlight;
      vSide = aSide;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying float vT;
    varying vec3 vColor;
    varying float vHighlight;
    varying float vSide;
    void main() {
      float edge = abs(vSide);
      float edgeFalloff = 1.0 - smoothstep(0.3, 1.0, edge);
      float coreBright = 1.0 - smoothstep(0.0, 0.6, edge);
      float pulse = fract(uTime * 0.3 - vT);
      float pulseGlow = smoothstep(0.0, 0.14, pulse) * (1.0 - smoothstep(0.14, 0.28, pulse));
      float baseBrightness = mix(0.18, 0.28, vHighlight);
      float brightness = baseBrightness;
      brightness *= (0.6 + coreBright * 0.4);
      float alpha = mix(0.25, 0.7, vHighlight) * edgeFalloff;
      alpha += pulseGlow * 0.35 * vHighlight;
      alpha = clamp(alpha, 0.0, 1.0);
      if (alpha < 0.01) discard;
      vec3 col = vColor * brightness;
      col += vColor * coreBright * 0.12;
      vec3 pulseCol = mix(vColor * 1.5, vec3(1.0), 0.5) * pulseGlow * 1.8;
      col += pulseCol * vHighlight;
      gl_FragColor = vec4(col, alpha);
    }
  `
};

const _lineColor = new THREE.Color();

const _LINE_VERSION = 8;
const _ringDir = new THREE.Vector3();
const _ringRight = new THREE.Vector3();
const _ringUp = new THREE.Vector3();
const _ringCorrUp = new THREE.Vector3();
const _ringTarget = new THREE.Vector3();
const _ringFrom = new THREE.Vector3();

function HouseholdConnectionLines({ edges, householdPositions, hoveredHouseholdIdRef, starsByHousehold, householdGroupRefs, coupleHouseholds }) {
  const meshRef = useRef();
  const timeUniform = useRef({ value: 0 });
  const resolutionUniform = useRef({ value: new THREE.Vector2(1920, 1080) });
  const lineWidthUniform = useRef({ value: 4.0 });

  const { edgeData, hoverMask } = useMemo(() => {
    if (!edges || edges.length === 0) {
      return { edgeData: [], hoverMask: [] };
    }

    const mask = [];
    const data = [];

    const findStarLocalPos = (hhId, personId, basePos) => {
      if (!starsByHousehold || !personId) return null;
      const stars = starsByHousehold.get(hhId) || starsByHousehold.get(String(hhId)) || starsByHousehold.get(Number(hhId));
      if (!stars) return null;
      const star = stars.find(s => String(s.id) === String(personId));
      if (!star || !star.position) return null;
      return {
        x: star.position[0] - basePos.x,
        y: star.position[1] - basePos.y,
        z: star.position[2] - basePos.z,
      };
    };

    edges.forEach((edge, i) => {
      if (edge.isIntraHousehold || String(edge.from) === String(edge.to)) return;

      const edgeFrom = edge.from;
      const edgeTo = edge.to;
      const fromPos = householdPositions.get(edgeFrom) || householdPositions.get(String(edgeFrom)) || householdPositions.get(Number(edgeFrom));
      const toPos = householdPositions.get(edgeTo) || householdPositions.get(String(edgeTo)) || householdPositions.get(Number(edgeTo));
      if (!fromPos || !toPos) {
        mask.push({ from: null, to: null });
        data.push(null);
        return;
      }

      let fromColorIndex = 0;
      if (starsByHousehold) {
        const fromStars = starsByHousehold.get(edgeFrom) || starsByHousehold.get(String(edgeFrom)) || starsByHousehold.get(Number(edgeFrom));
        if (fromStars && fromStars.length > 0) {
          fromColorIndex = fromStars[0].householdIndex || 0;
        }
      }

      const childStarLocal = findStarLocalPos(edgeTo, edge.childPersonId, toPos);

      data.push({
        fromHouseholdId: edge.from,
        toHouseholdId: edge.to,
        fromBase: { x: fromPos.x, y: fromPos.y, z: fromPos.z },
        toBase: { x: toPos.x, y: toPos.y, z: toPos.z },
        fromColorIndex,
        isIntraHousehold: edge.isIntraHousehold || false,
        fromRing: edge.fromRing || false,
        childStarLocal,
      });

      mask.push({ from: edge.from, to: edge.to });
    });

    return { edgeData: data, hoverMask: mask };
  }, [edges, householdPositions, starsByHousehold]);

  const validEdgeCount = useMemo(() => edgeData.filter(e => e !== null).length, [edgeData]);
  const totalVerts = validEdgeCount * 4;
  const totalIndices = validEdgeCount * 6;

  const { startPos, endPos, sides, tValues, colorValues, highlightValues, indices, dummyPositions } = useMemo(() => {
    const sp = new Float32Array(totalVerts * 3);
    const ep = new Float32Array(totalVerts * 3);
    const sd = new Float32Array(totalVerts);
    const t = new Float32Array(totalVerts);
    const col = new Float32Array(totalVerts * 3);
    const hl = new Float32Array(totalVerts);
    hl.fill(0.10);
    const dp = new Float32Array(totalVerts * 3);
    const idx = new Uint32Array(totalIndices);

    let vertOffset = 0;
    for (let e = 0; e < validEdgeCount; e++) {
      sd[vertOffset] = -1; t[vertOffset] = 0;
      sd[vertOffset + 1] = 1; t[vertOffset + 1] = 0;
      sd[vertOffset + 2] = -1; t[vertOffset + 2] = 1;
      sd[vertOffset + 3] = 1; t[vertOffset + 3] = 1;

      const idxOffset = e * 6;
      idx[idxOffset] = vertOffset;
      idx[idxOffset + 1] = vertOffset + 1;
      idx[idxOffset + 2] = vertOffset + 2;
      idx[idxOffset + 3] = vertOffset + 1;
      idx[idxOffset + 4] = vertOffset + 3;
      idx[idxOffset + 5] = vertOffset + 2;

      vertOffset += 4;
    }

    return { startPos: sp, endPos: ep, sides: sd, tValues: t, colorValues: col, highlightValues: hl, indices: idx, dummyPositions: dp };
  }, [totalVerts, totalIndices, validEdgeCount]);

  const nodeGlowCount = validEdgeCount * 2;
  const nodeGlowRef = useRef();

  const { nodePositions, nodeColors, nodeAlphas } = useMemo(() => {
    const np = new Float32Array(nodeGlowCount * 3);
    const nc = new Float32Array(nodeGlowCount * 3);
    const na = new Float32Array(nodeGlowCount);
    na.fill(0.2);
    return { nodePositions: np, nodeColors: nc, nodeAlphas: na };
  }, [nodeGlowCount]);

  const nodeGlowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 nodeColor;
        attribute float nodeAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = nodeColor;
          vAlpha = nodeAlpha;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 8.0 * (150.0 / -mvPos.z);
          gl_PointSize = clamp(gl_PointSize, 2.0, 16.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float alpha = 1.0 - smoothstep(0.0, 0.5, d);
          alpha = pow(alpha, 2.0) * vAlpha;
          if (alpha < 0.005) discard;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useEffect(() => {
    return () => nodeGlowMaterial.dispose();
  }, [nodeGlowMaterial]);

  useFrame((state) => {
    if (!meshRef.current || !meshRef.current.geometry) return;
    timeUniform.current.value = state.clock.elapsedTime;

    const renderer = state.gl;
    const size = renderer.getSize(new THREE.Vector2());
    resolutionUniform.current.value.set(size.x, size.y);

    const spAttr = meshRef.current.geometry.getAttribute('aStart');
    const epAttr = meshRef.current.geometry.getAttribute('aEnd');
    const hlAttr = meshRef.current.geometry.getAttribute('aHighlight');
    const colAttr = meshRef.current.geometry.getAttribute('aColor');
    if (!spAttr || !epAttr) return;

    const groupRefs = householdGroupRefs?.current;
    let edgeIdx = 0;

    for (let i = 0; i < edgeData.length; i++) {
      const edge = edgeData[i];
      if (!edge) continue;

      let fromX = edge.fromBase.x, fromY = edge.fromBase.y, fromZ = edge.fromBase.z;
      let toX = edge.toBase.x, toY = edge.toBase.y, toZ = edge.toBase.z;

      if (groupRefs) {
        const fhId = edge.fromHouseholdId;
        const fromGroup = groupRefs.get(fhId) ?? groupRefs.get(String(fhId)) ?? groupRefs.get(Number(fhId));
        if (fromGroup) {
          fromX = fromGroup.position.x;
          fromY = fromGroup.position.y;
          fromZ = fromGroup.position.z;
        }

        const thId = edge.toHouseholdId;
        const toGroup = groupRefs.get(thId) ?? groupRefs.get(String(thId)) ?? groupRefs.get(Number(thId));
        if (toGroup) {
          toX = toGroup.position.x;
          toY = toGroup.position.y;
          toZ = toGroup.position.z;
        }
      }

      let fromScale = 1.0, toScale = 1.0;
      if (groupRefs) {
        const fGroup = groupRefs.get(edge.fromHouseholdId) ?? groupRefs.get(String(edge.fromHouseholdId)) ?? groupRefs.get(Number(edge.fromHouseholdId));
        if (fGroup) fromScale = fGroup.scale.x;
        const tGroup = groupRefs.get(edge.toHouseholdId) ?? groupRefs.get(String(edge.toHouseholdId)) ?? groupRefs.get(Number(edge.toHouseholdId));
        if (tGroup) toScale = tGroup.scale.x;
      }

      if (edge.childStarLocal) {
        toX = toX + edge.childStarLocal.x * toScale;
        toY = toY + edge.childStarLocal.y * toScale;
        toZ = toZ + edge.childStarLocal.z * toScale;
      }

      const fromR = GALAXY_RING_RADIUS * fromScale;
      _ringFrom.set(fromX, fromY, fromZ);
      _ringTarget.set(toX, toY, toZ);
      _ringDir.copy(state.camera.position).sub(_ringFrom).normalize();
      const upY = Math.abs(_ringDir.y) > 0.95 ? 1 : 0;
      _ringUp.set(upY, 1 - upY, 0);
      _ringRight.crossVectors(_ringUp, _ringDir).normalize();
      _ringCorrUp.crossVectors(_ringDir, _ringRight).normalize();
      const localX = _ringTarget.x - fromX;
      const localY = _ringTarget.y - fromY;
      const localZ = _ringTarget.z - fromZ;
      const projR = localX * _ringRight.x + localY * _ringRight.y + localZ * _ringRight.z;
      const projU = localX * _ringCorrUp.x + localY * _ringCorrUp.y + localZ * _ringCorrUp.z;
      const projLen = Math.sqrt(projR * projR + projU * projU);
      if (projLen > 0.001) {
        const nR = projR / projLen;
        const nU = projU / projLen;
        fromX += (_ringRight.x * nR + _ringCorrUp.x * nU) * fromR;
        fromY += (_ringRight.y * nR + _ringCorrUp.y * nU) * fromR;
        fromZ += (_ringRight.z * nR + _ringCorrUp.z * nU) * fromR;
      }

      const hhi = hoveredHouseholdIdRef.current;
      const isHighlighted = hhi && (String(hoverMask[i]?.from) === String(hhi) || String(hoverMask[i]?.to) === String(hhi));
      const hlVal = isHighlighted ? 1.0 : 0.05;

      const edgeColors = HOUSEHOLD_COLORS[edge.fromColorIndex % HOUSEHOLD_COLORS.length];
      _lineColor.set(edgeColors.glow);

      const base = edgeIdx * 4;
      for (let v = 0; v < 4; v++) {
        const vi = (base + v) * 3;
        spAttr.array[vi] = fromX;
        spAttr.array[vi + 1] = fromY;
        spAttr.array[vi + 2] = fromZ;
        epAttr.array[vi] = toX;
        epAttr.array[vi + 1] = toY;
        epAttr.array[vi + 2] = toZ;
        if (colAttr) {
          colAttr.array[vi] = _lineColor.r;
          colAttr.array[vi + 1] = _lineColor.g;
          colAttr.array[vi + 2] = _lineColor.b;
        }
        if (hlAttr) hlAttr.array[base + v] = hlVal;
      }

      edgeIdx++;
    }

    spAttr.needsUpdate = true;
    epAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;
    if (hlAttr) hlAttr.needsUpdate = true;

    if (nodeGlowRef.current && nodeGlowRef.current.geometry) {
      const ngPosAttr = nodeGlowRef.current.geometry.getAttribute('position');
      const ngColAttr = nodeGlowRef.current.geometry.getAttribute('nodeColor');
      const ngAlphaAttr = nodeGlowRef.current.geometry.getAttribute('nodeAlpha');
      if (ngPosAttr && ngColAttr && ngAlphaAttr) {
        let nodeIdx = 0;
        let validIdx = 0;
        for (let i = 0; i < edgeData.length; i++) {
          const edge = edgeData[i];
          if (!edge) continue;
          if (nodeIdx + 1 < nodeGlowCount) {
            const base = validIdx * 4;
            const svi = base * 3;
            const evi = (base + 2) * 3;
            ngPosAttr.array[nodeIdx * 3] = spAttr.array[svi];
            ngPosAttr.array[nodeIdx * 3 + 1] = spAttr.array[svi + 1];
            ngPosAttr.array[nodeIdx * 3 + 2] = spAttr.array[svi + 2];
            ngPosAttr.array[(nodeIdx + 1) * 3] = epAttr.array[evi];
            ngPosAttr.array[(nodeIdx + 1) * 3 + 1] = epAttr.array[evi + 1];
            ngPosAttr.array[(nodeIdx + 1) * 3 + 2] = epAttr.array[evi + 2];
            if (colAttr) {
              for (let ci = 0; ci < 3; ci++) {
                ngColAttr.array[nodeIdx * 3 + ci] = colAttr.array[svi + ci];
                ngColAttr.array[(nodeIdx + 1) * 3 + ci] = colAttr.array[svi + ci];
              }
            }
            const hhi2 = hoveredHouseholdIdRef.current;
            const isHl = hhi2 && (String(hoverMask[i]?.from) === String(hhi2) || String(hoverMask[i]?.to) === String(hhi2));
            const alpha = isHl ? 0.6 : 0.2;
            ngAlphaAttr.array[nodeIdx] = alpha;
            ngAlphaAttr.array[nodeIdx + 1] = alpha;
            nodeIdx += 2;
          }
          validIdx++;
        }
        ngPosAttr.needsUpdate = true;
        ngColAttr.needsUpdate = true;
        ngAlphaAttr.needsUpdate = true;
      }
    }
  });

  if (totalVerts === 0) return null;

  return (
    <group>
      <mesh ref={meshRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={totalVerts} array={dummyPositions} itemSize={3} />
          <bufferAttribute attach="attributes-aStart" count={totalVerts} array={startPos} itemSize={3} />
          <bufferAttribute attach="attributes-aEnd" count={totalVerts} array={endPos} itemSize={3} />
          <bufferAttribute attach="attributes-aSide" count={totalVerts} array={sides} itemSize={1} />
          <bufferAttribute attach="attributes-aT" count={totalVerts} array={tValues} itemSize={1} />
          <bufferAttribute attach="attributes-aColor" count={totalVerts} array={colorValues} itemSize={3} />
          <bufferAttribute attach="attributes-aHighlight" count={totalVerts} array={highlightValues} itemSize={1} />
          <bufferAttribute attach="index" count={indices.length} array={indices} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={connectionLineShader.vertexShader}
          fragmentShader={connectionLineShader.fragmentShader}
          uniforms={{
            uTime: timeUniform.current,
            uResolution: resolutionUniform.current,
            uLineWidth: lineWidthUniform.current,
          }}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {nodeGlowCount > 0 && (
        <points ref={nodeGlowRef} frustumCulled={false} material={nodeGlowMaterial}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={nodeGlowCount} array={nodePositions} itemSize={3} />
            <bufferAttribute attach="attributes-nodeColor" count={nodeGlowCount} array={nodeColors} itemSize={3} />
            <bufferAttribute attach="attributes-nodeAlpha" count={nodeGlowCount} array={nodeAlphas} itemSize={1} />
          </bufferGeometry>
        </points>
      )}
    </group>
  );
}

function AmbientDrift({ qualityTier }) {
  const pointsRef = useRef();

  const particleCount = qualityTier.driftCount || 300;

  const { positions, velocities, colors, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const vel = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const siz = new Float32Array(particleCount);
    const pha = new Float32Array(particleCount);

    const driftColors = [
      new THREE.Color(0xffd700),
      new THREE.Color(0xffb347),
      new THREE.Color(0xffe8cc),
      new THREE.Color(0xc8a8ff),
    ];

    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 200;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 200;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 200;

      vel[i * 3] = (Math.random() - 0.5) * 0.3;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;

      const c = driftColors[Math.floor(Math.random() * driftColors.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;

      siz[i] = 2 + Math.random() * 2;
      pha[i] = Math.random() * Math.PI * 2;
    }

    return { positions: pos, velocities: vel, colors: col, sizes: siz, phases: pha };
  }, [particleCount]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 particleColor;
        attribute float size;
        attribute float phase;
        uniform float time;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = particleColor;
          float flicker = sin(time * 0.4 + phase) * 0.5 + 0.5;
          vAlpha = mix(0.05, 0.15, flicker);

          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (120.0 / -mvPos.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 6.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha = pow(alpha, 2.0);
          alpha *= vAlpha;
          if (alpha < 0.003) discard;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      uniforms: {
        time: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame((state, delta) => {
    material.uniforms.time.value = state.clock.elapsedTime;
    if (pointsRef.current) {
      const posAttr = pointsRef.current.geometry.attributes.position;
      const arr = posAttr.array;
      const t = state.clock.elapsedTime;
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const turbX = Math.sin(t * 0.1 + phases[i]) * 0.02;
        const turbY = Math.cos(t * 0.08 + phases[i] * 1.3) * 0.02;
        const turbZ = Math.sin(t * 0.12 + phases[i] * 0.7) * 0.02;
        arr[i3] += (velocities[i3] + turbX) * delta;
        arr[i3 + 1] += (velocities[i3 + 1] + turbY) * delta;
        arr[i3 + 2] += (velocities[i3 + 2] + turbZ) * delta;

        for (let axis = 0; axis < 3; axis++) {
          if (arr[i3 + axis] > 100) arr[i3 + axis] = -100;
          if (arr[i3 + axis] < -100) arr[i3 + axis] = 100;
        }
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-particleColor" count={particleCount} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={particleCount} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-phase" count={particleCount} array={phases} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

function UnifiedGalaxyScene({
  households,
  householdPositions,
  people,
  relationships = [],
  focusedHouseholdId,
  hoveredHouseholdIdRef,
  hoveredStarIdRef,
  focusedStarId,
  onHouseholdClick,
  onHouseholdHover,
  onStarClick,
  onStarHover,
  transitionProgressRef,
  transitionDirectionRef,
  level,
  viewMode = 'nebula',
  filters = {},
  isTransitioning = false,
}) {
  const householdGroupRefs = useRef(new Map());

  const matchingHouseholdIds = useMemo(() => {
    return getHouseholdsMatchingFilters(households, people, relationships, householdPositions, filters);
  }, [households, people, relationships, householdPositions, filters]);

  const starsByHousehold = useMemo(() => {
    const coupleTypes = ['partner', 'spouse'];
    const map = new Map();
    households.forEach((household, householdIndex) => {
      const pos = householdPositions.get(household.id);
      if (!pos) return;
      
      const householdMembers = people.filter(p => p.household_id === household.id);
      
      const memberIdSet = new Set(householdMembers.map(m => m.id));
      const coupleIds = new Set();
      householdMembers.forEach(member => {
        relationships.forEach(rel => {
          const idA = rel.person_id || rel.person1_id;
          const idB = rel.related_person_id || rel.person2_id;
          const type = (rel.relationship_type || '').toLowerCase();
          if (coupleTypes.includes(type)) {
            if (idA === member.id && memberIdSet.has(idB)) { coupleIds.add(member.id); coupleIds.add(idB); }
            if (idB === member.id && memberIdSet.has(idA)) { coupleIds.add(member.id); coupleIds.add(idA); }
          }
        });
      });

      const coreParentIds = coupleIds.size > 0 ? coupleIds : new Set(householdMembers.map(m => m.id));

      const dependentChildIds = new Set();
      relationships.forEach(rel => {
        const idA = rel.person_id || rel.person1_id;
        const idB = rel.related_person_id || rel.person2_id;
        const type = (rel.relationship_type || '').toLowerCase();
        let childId = null;
        if (type === 'parent' && coreParentIds.has(idA)) childId = idB;
        if (type === 'child' && coreParentIds.has(idB)) childId = idA;
        if (childId && !coreParentIds.has(childId)) {
          const child = people.find(p => p.id === childId);
          if (child) {
            const isDependent = (child.role_type || '').toLowerCase() === 'child' ||
              child.household_id === household.id;
            if (isDependent) dependentChildIds.add(childId);
          }
        }
      });

      const visibleIds = new Set([...coreParentIds, ...dependentChildIds]);
      const visiblePeople = people.filter(p => visibleIds.has(p.id));
      const positionedPeople = arrangeStarsInCluster(visiblePeople, pos.x, pos.y, pos.z, relationships);
      
      const stars = positionedPeople.map(person => ({
        id: person.id,
        householdId: household.id,
        household,
        householdIndex,
        position: person.position,
        isParent: person.isParent,
        starProfile: person.star_profile || generateRandomStarProfile(person.id),
        person,
      }));
      
      map.set(household.id, stars);
    });
    return map;
  }, [households, householdPositions, people, relationships]);
  
  const nonEmptyHouseholdIds = useMemo(() => {
    const ids = new Set();
    households.forEach(h => {
      const pos = householdPositions.get(h.id);
      if (pos && (pos.memberCount || 0) > 0) ids.add(h.id);
    });
    return ids;
  }, [households, householdPositions]);

  const householdEdges = useMemo(() => {
    return computeHouseholdEdges(relationships, people).filter(
      e => nonEmptyHouseholdIds.has(e.from) && nonEmptyHouseholdIds.has(e.to)
    );
  }, [relationships, people, nonEmptyHouseholdIds]);

  const coupleHouseholds = useMemo(() => {
    const set = new Set();
    starsByHousehold.forEach((stars, hhId) => {
      const parentStars = stars.filter(s => s.isParent);
      if (parentStars.length >= 2) set.add(hhId);
    });
    return set;
  }, [starsByHousehold]);

  const householdsWithMinors = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const set = new Set();
    for (const p of people) {
      if (!p.household_id) continue;
      let age = null;
      if (p.birth_date) {
        const bd = new Date(p.birth_date);
        age = currentYear - bd.getFullYear() - (now < new Date(currentYear, bd.getMonth(), bd.getDate()) ? 1 : 0);
      } else if (p.birth_year) {
        age = currentYear - p.birth_year;
      }
      if (age !== null && age < 18) {
        set.add(p.household_id);
      } else if (age === null && (p.role_type || '').toLowerCase() === 'child') {
        set.add(p.household_id);
      }
    }
    return set;
  }, [people]);

  const connectedToHoveredRef = useRef(null);
  const prevHoveredIdRef = useRef(null);
  const prevEdgesRef = useRef(null);
  
  useFrame(() => {
    const hid = hoveredHouseholdIdRef.current;
    const edgesChanged = householdEdges !== prevEdgesRef.current;
    if (hid !== prevHoveredIdRef.current || edgesChanged) {
      prevHoveredIdRef.current = hid;
      prevEdgesRef.current = householdEdges;
      if (!hid || !householdEdges) {
        connectedToHoveredRef.current = null;
      } else {
        const connected = new Set();
        connected.add(String(hid));
        householdEdges.forEach(edge => {
          if (String(edge.from) === String(hid)) connected.add(String(edge.to));
          if (String(edge.to) === String(hid)) connected.add(String(edge.from));
        });
        connectedToHoveredRef.current = connected;
      }
    }
  });
  
  return (
    <group>
      {!focusedHouseholdId && filters.showLines !== false && (
        <HouseholdConnectionLines
          edges={matchingHouseholdIds ? householdEdges.filter(e => matchingHouseholdIds.has(e.from) && matchingHouseholdIds.has(e.to)) : householdEdges}
          householdPositions={householdPositions}
          hoveredHouseholdIdRef={hoveredHouseholdIdRef}
          starsByHousehold={starsByHousehold}
          householdGroupRefs={householdGroupRefs}
          coupleHouseholds={coupleHouseholds}
        />
      )}
      {households.map((household, index) => {
        const pos = householdPositions.get(household.id);
        if (!pos) return null;
        
        const isFocused = household.id === focusedHouseholdId;
        const householdStars = starsByHousehold.get(household.id) || [];
        
        const mc = pos.memberCount || 0;
        const sc = classifyHousehold(mc);

        if (matchingHouseholdIds !== null && !matchingHouseholdIds.has(household.id)) return null;
        if (mc === 0) return null;

        return (
          <AnimatedHouseholdGroup
            key={`household-${household.id}`}
            household={household}
            basePosition={pos}
            colorIndex={index}
            hoveredHouseholdIdRef={hoveredHouseholdIdRef}
            connectedToHoveredRef={connectedToHoveredRef}
            isFocused={isFocused}
            transitionProgressRef={transitionProgressRef}
            transitionDirectionRef={transitionDirectionRef}
            level={level}
            focusedHouseholdId={focusedHouseholdId}
            householdPositions={householdPositions}
            stars={householdStars}
            relationships={relationships}
            onStarClick={onStarClick}
            onStarHover={onStarHover}
            hoveredStarIdRef={hoveredStarIdRef}
            focusedStarId={focusedStarId}
            onClick={() => !focusedHouseholdId && onHouseholdClick(household)}
            onPointerOver={() => !focusedHouseholdId && onHouseholdHover(household.id)}
            onPointerOut={() => onHouseholdHover(null)}
            viewMode={viewMode}
            memberCount={mc}
            starClass={sc}
            showLabels={filters.showLabels !== false}
            householdGroupRefs={householdGroupRefs}
            isTransitioning={isTransitioning}
            hasMinorChildren={householdsWithMinors.has(household.id)}
          />
        );
      })}
    </group>
  );
}

const createNebulaTexture = (colorHex, seed = 0, style = 'cloud') => {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const center = size / 2;
  
  const color = new THREE.Color(colorHex);
  const r = Math.floor(color.r * 255);
  const g = Math.floor(color.g * 255);
  const b = Math.floor(color.b * 255);
  
  const hash = (n) => {
    let x = Math.sin(n + seed) * 43758.5453;
    return x - Math.floor(x);
  };
  
  const noise2d = (px, py) => {
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    const fx = px - ix;
    const fy = py - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix + iy * 57);
    const b = hash(ix + 1 + iy * 57);
    const c = hash(ix + (iy + 1) * 57);
    const d = hash(ix + 1 + (iy + 1) * 57);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  
  const fbm = (px, py, octaves) => {
    let val = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
      val += noise2d(px * freq, py * freq) * amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return val;
  };
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      const nx = x / size * 4 + seed * 0.1;
      const ny = y / size * 4 + seed * 0.13;
      
      let density;
      if (style === 'wispy') {
        const warp = fbm(nx * 0.5, ny * 0.5, 3) * 2;
        const filament = fbm(nx + warp, ny + warp, 4);
        const ridged = 1 - Math.abs(filament * 2 - 1);
        density = ridged * ridged;
      } else if (style === 'core') {
        const core = fbm(nx * 1.5, ny * 1.5, 5);
        const bright = Math.pow(core, 0.7);
        density = bright * (1 - dist * 0.8);
      } else {
        const cloud = fbm(nx, ny, 4);
        const detail = fbm(nx * 2, ny * 2, 3) * 0.3;
        density = cloud + detail;
      }
      
      const edgeNoise = fbm(angle * 3 + seed, dist * 2, 3) * 0.25;
      const irregularEdge = 0.85 + edgeNoise;
      const falloff = Math.max(0, 1 - Math.pow(dist / irregularEdge, 2.5));
      
      const alpha = Math.pow(density * falloff, 1.2) * 0.9;
      
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.floor(Math.min(1, Math.max(0, alpha)) * 255);
    }
  }
  
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
};

function HouseholdLabel({ name, isVisible, color }) {
  if (!isVisible || !name) return null;
  
  return (
    <Html
      center
      position={[0, 0, 0]}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div style={{
        background: `linear-gradient(135deg, ${color}22 0%, ${color}44 100%)`,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${color}66`,
        borderRadius: '12px',
        padding: '8px 16px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '500',
        letterSpacing: '0.5px',
        textShadow: `0 0 10px ${color}, 0 0 20px ${color}88`,
        boxShadow: `0 0 20px ${color}33, 0 4px 12px rgba(0,0,0,0.3)`,
        whiteSpace: 'nowrap',
        animation: 'fadeIn 0.2s ease-out',
      }}>
        {name}
      </div>
    </Html>
  );
}

function HouseholdAtmosphere({ position, colorIndex, opacity, scale = 1, isHovered = false, householdName = '', onClick, onPointerOver, onPointerOut, isFocusedView = false }) {
  const colors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  
  const textures = useMemo(() => ({
    core: createNebulaTexture(colors.primary, colorIndex * 7, 'core'),
    cloud: createNebulaTexture(colors.secondary, colorIndex * 11 + 3, 'cloud'),
    wispy: createNebulaTexture(colors.glow, colorIndex * 13 + 7, 'wispy'),
    outer: createNebulaTexture(colors.primary, colorIndex * 17 + 11, 'cloud'),
  }), [colors, colorIndex]);
  
  const stretch1 = 1.3 + (colorIndex % 3) * 0.2;
  const stretch2 = 0.8 + (colorIndex % 4) * 0.15;
  const baseRotation = (colorIndex * 0.7) % (Math.PI * 2);
  
  const hitboxRadius = scale * 5;
  
  return (
    <group position={position}>
      <HouseholdLabel name={householdName} isVisible={isHovered} color={colors.primary} />
      
      {/* 3D sphere hitbox for better raycasting from any angle */}
      <mesh
        visible={false}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
          onPointerOver?.(e);
        }}
        onPointerOut={(e) => {
          document.body.style.cursor = 'default';
          onPointerOut?.(e);
        }}
      >
        <sphereGeometry args={[hitboxRadius, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      
      <sprite 
        scale={[scale * 6 * stretch1, scale * 5, 1]}
        rotation={[0, 0, baseRotation]}
      >
        <spriteMaterial
          map={textures.core}
          transparent
          opacity={opacity * 0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <sprite 
        scale={[scale * 9 * stretch2, scale * 7, 1]} 
        rotation={[0, 0, baseRotation + 0.5]}
      >
        <spriteMaterial
          map={textures.cloud}
          transparent
          opacity={opacity * 0.38}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <sprite 
        scale={[scale * 11, scale * 8 * stretch1, 1]} 
        rotation={[0, 0, baseRotation - 0.4]}
      >
        <spriteMaterial
          map={textures.wispy}
          transparent
          opacity={opacity * 0.25}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <sprite 
        scale={[scale * 14 * stretch2, scale * 12, 1]} 
        rotation={[0, 0, baseRotation + 0.8]}
      >
        <spriteMaterial
          map={textures.outer}
          transparent
          opacity={opacity * 0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <pointLight 
        color={colors.primary} 
        intensity={opacity * (isHovered ? 0.3 : 0.18)} 
        distance={isHovered ? 12 : 9}
        decay={2}
      />
    </group>
  );
}

function MotionTrailEffect() {
  const { camera } = useThree();
  const prevPos = useRef(new THREE.Vector3());
  const trailRef = useRef();
  const velocitySmooth = useRef(0);
  
  const trailMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float intensity;
        uniform vec3 trailColor;
        varying vec2 vUv;
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float glow = exp(-dist * 4.0) * intensity * 0.5;
          if (glow < 0.005) discard;
          gl_FragColor = vec4(trailColor * glow, glow * 0.25);
        }
      `,
      uniforms: {
        intensity: { value: 0 },
        trailColor: { value: new THREE.Color(0.3, 0.5, 0.8) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, []);

  useEffect(() => {
    return () => trailMaterial.dispose();
  }, [trailMaterial]);
  
  useFrame(() => {
    const dx = camera.position.x - prevPos.current.x;
    const dy = camera.position.y - prevPos.current.y;
    const dz = camera.position.z - prevPos.current.z;
    const velocity = Math.sqrt(dx * dx + dy * dy + dz * dz);
    prevPos.current.copy(camera.position);
    
    const target = Math.min(velocity * 0.8, 0.25);
    velocitySmooth.current += (target - velocitySmooth.current) * 0.05;
    
    if (velocitySmooth.current < 0.005) {
      velocitySmooth.current = 0;
    }
    
    trailMaterial.uniforms.intensity.value = velocitySmooth.current;
    
    if (trailRef.current) {
      const show = velocitySmooth.current > 0.02 && velocity > 0.05;
      trailRef.current.visible = show;
      if (show) {
        const dirLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dirLen > 0.001) {
          trailRef.current.position.copy(camera.position);
          trailRef.current.lookAt(
            camera.position.x + (dx / dirLen) * 10,
            camera.position.y + (dy / dirLen) * 10,
            camera.position.z + (dz / dirLen) * 10
          );
        }
      }
    }
  });
  
  return (
    <mesh ref={trailRef} visible={false} raycast={() => null}>
      <planeGeometry args={[400, 400]} />
      <primitive object={trailMaterial} attach="material" />
    </mesh>
  );
}

function FogController({ qualityTier }) {
  const { scene } = useThree();
  const isLow = qualityTier?.tier === 'low';

  useEffect(() => {
    const fogColor = new THREE.Color('#120828');
    scene.fog = new THREE.FogExp2(fogColor, isLow ? 0.001 : 0.0003);
    return () => {
      scene.fog = null;
    };
  }, [scene, isLow]);

  return null;
}

function SpeedDust({ qualityTier }) {
  const { camera } = useThree();
  const pointsRef = useRef();
  const prevCamPos = useRef(new THREE.Vector3());
  const velocitySmooth = useRef(0);

  const particleCount = qualityTier?.tier === 'ultra' ? 500 : (qualityTier?.tier === 'high' ? 300 : 150);

  const { positions, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const siz = new Float32Array(particleCount);
    const pha = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
      siz[i] = 0.5 + Math.random() * 1.5;
      pha[i] = Math.random() * Math.PI * 2;
    }
    return { positions: pos, sizes: siz, phases: pha };
  }, [particleCount]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute float size;
        attribute float phase;
        uniform float time;
        uniform float speed;
        varying float vAlpha;

        void main() {
          float flicker = sin(time * 0.3 + phase) * 0.15 + 0.85;
          vAlpha = speed * flicker * 0.6;

          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          float stretch = 1.0 + speed * 2.0;
          gl_PointSize = size * stretch * (80.0 / -mvPos.z);
          gl_PointSize = clamp(gl_PointSize, 0.5, 4.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = 1.0 - smoothstep(0.0, 0.5, d);
          a *= vAlpha;
          if (a < 0.005) discard;
          gl_FragColor = vec4(0.7, 0.8, 1.0, a);
        }
      `,
      uniforms: {
        time: { value: 0 },
        speed: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame((state, delta) => {
    const dx = camera.position.x - prevCamPos.current.x;
    const dy = camera.position.y - prevCamPos.current.y;
    const dz = camera.position.z - prevCamPos.current.z;
    const vel = Math.sqrt(dx * dx + dy * dy + dz * dz) / Math.max(delta, 0.001);
    prevCamPos.current.copy(camera.position);

    const targetSpeed = Math.min(vel / 400, 1.0);
    velocitySmooth.current += (targetSpeed - velocitySmooth.current) * 0.1;

    material.uniforms.time.value = state.clock.elapsedTime;
    material.uniforms.speed.value = velocitySmooth.current;

    if (pointsRef.current) {
      pointsRef.current.position.copy(camera.position);
      const posAttr = pointsRef.current.geometry.attributes.position;
      const arr = posAttr.array;
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        arr[i3] += (Math.random() - 0.5) * 0.1;
        arr[i3 + 1] += (Math.random() - 0.5) * 0.1;
        arr[i3 + 2] += (Math.random() - 0.5) * 0.1;
        for (let ax = 0; ax < 3; ax++) {
          if (arr[i3 + ax] > 30) arr[i3 + ax] = -30;
          if (arr[i3 + ax] < -30) arr[i3 + ax] = 30;
        }
      }
      posAttr.needsUpdate = true;
    }
  });

  if (qualityTier?.tier === 'low') return null;

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={particleCount} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-phase" count={particleCount} array={phases} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

function ParallaxNebulaWisps({ qualityTier, universeExtent = 200 }) {
  const { camera } = useThree();
  const layerRefs = useRef([]);

  const layers = useMemo(() => {
    const isUltra = qualityTier?.tier === 'ultra';
    const isHigh = qualityTier?.tier === 'high';
    const layerCount = isUltra ? 3 : (isHigh ? 2 : 1);
    const result = [];
    const scale = Math.max(1, universeExtent / 200);

    const wispColors = [
      [0.15, 0.08, 0.25],
      [0.08, 0.12, 0.22],
      [0.12, 0.06, 0.18],
    ];

    for (let l = 0; l < layerCount; l++) {
      const count = isUltra ? 40 : (isHigh ? 25 : 15);
      const depth = (l + 1) * 80 * scale;
      const parallaxFactor = 0.3 + l * 0.25;
      const pos = new Float32Array(count * 3);
      const siz = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = depth * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = depth * Math.sin(phi) * Math.sin(theta) * 0.5;
        pos[i * 3 + 2] = depth * Math.cos(phi);
        siz[i] = 8 + Math.random() * 15;
      }

      result.push({ positions: pos, sizes: siz, count, parallaxFactor, color: wispColors[l % wispColors.length], depth });
    }
    return result;
  }, [qualityTier, universeExtent]);

  const materials = useMemo(() => {
    return layers.map((layer) => {
      return new THREE.ShaderMaterial({
        vertexShader: `
          attribute float size;
          uniform float time;
          varying float vAlpha;
          void main() {
            float flicker = sin(time * 0.15 + position.x * 0.1) * 0.2 + 0.8;
            vAlpha = 0.06 * flicker;
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (200.0 / -mvPos.z);
            gl_PointSize = clamp(gl_PointSize, 2.0, 40.0);
            gl_Position = projectionMatrix * mvPos;
          }
        `,
        fragmentShader: `
          uniform vec3 wispColor;
          varying float vAlpha;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c);
            float a = 1.0 - smoothstep(0.0, 0.5, d);
            a = pow(a, 2.5) * vAlpha;
            if (a < 0.003) discard;
            gl_FragColor = vec4(wispColor, a);
          }
        `,
        uniforms: {
          time: { value: 0 },
          wispColor: { value: new THREE.Vector3(...layer.color) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    });
  }, [layers]);

  useEffect(() => {
    return () => materials.forEach(m => m.dispose());
  }, [materials]);

  useFrame((state) => {
    materials.forEach(m => {
      m.uniforms.time.value = state.clock.elapsedTime;
    });
    layerRefs.current.forEach((ref, i) => {
      if (ref && layers[i]) {
        const pf = layers[i].parallaxFactor;
        ref.position.set(
          camera.position.x * pf,
          camera.position.y * pf * 0.5,
          camera.position.z * pf
        );
      }
    });
  });

  if (qualityTier?.tier === 'low') return null;

  return (
    <group>
      {layers.map((layer, i) => (
        <points key={i} ref={el => layerRefs.current[i] = el} material={materials[i]}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={layer.count} array={layer.positions} itemSize={3} />
            <bufferAttribute attach="attributes-size" count={layer.count} array={layer.sizes} itemSize={1} />
          </bufferGeometry>
        </points>
      ))}
    </group>
  );
}

function BackgroundStarField({ qualityTier, universeExtent = 200 }) {
  const pointsRef = useRef();
  const { camera } = useThree();

  const starCount = qualityTier.bgStarCount || 2000;
  const extScale = Math.max(1, universeExtent / 200);

  const { positions, phases, brightnesses } = useMemo(() => {
    const pos = new Float32Array(starCount * 3);
    const pha = new Float32Array(starCount);
    const bri = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = (200 + Math.random() * 300) * extScale;

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      pha[i] = Math.random() * Math.PI * 2;
      bri[i] = 0.3 + Math.random() * 0.7;
    }

    return { positions: pos, phases: pha, brightnesses: bri };
  }, [starCount, extScale]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute float phase;
        attribute float brightness;
        uniform float time;
        varying float vAlpha;

        void main() {
          float twinkle = sin(time * (0.15 + brightness * 0.35) + phase) * 0.5 + 0.5;
          float twinkle2 = sin(time * (0.06 + brightness * 0.12) + phase * 2.3) * 0.5 + 0.5;
          twinkle = mix(twinkle, twinkle2, 0.3);
          twinkle = twinkle * 0.4 + 0.6;
          vAlpha = brightness * twinkle * 0.7;

          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (1.0 + brightness) * (200.0 / -mvPos.z);
          gl_PointSize = clamp(gl_PointSize, 0.5, 2.5);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying float vAlpha;

        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          if (dist > 0.5) discard;

          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          vec3 coolStar = vec3(0.75, 0.82, 1.0);
          vec3 warmStar = vec3(1.0, 0.92, 0.8);
          vec3 color = mix(coolStar, warmStar, vAlpha * 0.6);
          gl_FragColor = vec4(color, alpha * vAlpha);
        }
      `,
      uniforms: {
        time: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame((state) => {
    material.uniforms.time.value = state.clock.elapsedTime;
    if (pointsRef.current) {
      pointsRef.current.position.copy(camera.position);
      pointsRef.current.rotation.y += 0.00003;
      pointsRef.current.rotation.x += 0.00001;
    }
  });

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={starCount} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-phase" count={starCount} array={phases} itemSize={1} />
        <bufferAttribute attach="attributes-brightness" count={starCount} array={brightnesses} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

function PolarStabilizer() {
  return null;
}

const NebulaScene = React.memo(function NebulaScene({
  level,
  households,
  people,
  relationships,
  selectedHousehold,
  householdPositions,
  hoveredHouseholdIdRef,
  hoveredStarIdRef,
  focusedStarId,
  onHouseholdClick,
  onHouseholdHover,
  onStarClick,
  onStarHover,
  onBackgroundClick,
  controlsRef,
  autoRotateEnabled,
  setAutoRotateEnabled,
  qualityTier,
  isTransitioning,
  transitioningHousehold,
  onTransitionComplete,
  viewMode = 'nebula',
  filters = {},
  galaxyData = null,
  onRecenterGalaxy,
  initialHomePosition = null,
  wasdKeysPressed = null,
  onTouchInteraction = null,
}) {
  const transitionProgressRef = useRef(0);
  const [transitionDirection, setTransitionDirection] = useState(null);
  const transitionDirectionRef = useRef(null);
  
  const handleProgressUpdate = useCallback((progress, direction) => {
    transitionProgressRef.current = progress;
    if (direction !== transitionDirectionRef.current) {
      transitionDirectionRef.current = direction;
      setTransitionDirection(direction);
    }
  }, []);
  
  const selectedHouseholdPosition = useMemo(() => {
    if (!selectedHousehold) return null;
    return householdPositions.get(selectedHousehold.id);
  }, [selectedHousehold, householdPositions]);
  
  const transitioningHouseholdPosition = useMemo(() => {
    if (!transitioningHousehold) return null;
    return householdPositions.get(transitioningHousehold.id);
  }, [transitioningHousehold, householdPositions]);
  
  const cameraTargetPosition = transitioningHouseholdPosition || selectedHouseholdPosition;
  const cameraTargetMemberCount = cameraTargetPosition?.memberCount || 0;
  
  const selectedColorIndex = useMemo(() => {
    if (!selectedHousehold) return 0;
    return households.findIndex(h => h.id === selectedHousehold.id);
  }, [selectedHousehold, households]);
  
  const effectiveFocusedId = useMemo(() => {
    if (transitionDirection === 'zoom-out') {
      return transitioningHousehold?.id;
    } else if (transitionDirection === 'idle' || transitionDirection === null) {
      return selectedHousehold?.id || null;
    }
    return selectedHousehold?.id || transitioningHousehold?.id;
  }, [selectedHousehold, transitioningHousehold, transitionDirection]);

  const universeExtent = useMemo(() => {
    if (!householdPositions || householdPositions.size === 0) return 200;
    let maxDist = 0;
    householdPositions.forEach(p => {
      const d = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      if (d > maxDist) maxDist = d;
    });
    return Math.max(200, maxDist + 80);
  }, [householdPositions]);
  
  return (
    <>
      <CameraController
        level={isTransitioning ? 'system' : level}
        targetPosition={cameraTargetPosition}
        targetMemberCount={cameraTargetMemberCount}
        controlsRef={controlsRef}
        onTransitionComplete={onTransitionComplete}
        setAutoRotateEnabled={setAutoRotateEnabled}
        onProgressUpdate={handleProgressUpdate}
        initialHomePosition={initialHomePosition}
      />
      
      <ambientLight intensity={0.1} />
      <pointLight position={[40, 30, 40]} intensity={0.2} color="#ffffff" />
      <pointLight position={[-30, -10, -30]} intensity={0.15} color={NEBULA_COLORS.vibrantPurple} />
      
      <FogController qualityTier={qualityTier} />
      
      {level === 'galaxy' && !isTransitioning && transitionDirection !== 'zoom-in' && transitionDirection !== 'zoom-out' && (
        <FreeFlightControls
          enabled={true}
          externalKeysPressed={wasdKeysPressed}
          qualityTier={qualityTier}
          onTouchInteraction={onTouchInteraction}
        />
      )}
      
      <pointLight position={[0, 50, 0]} intensity={0.1} color={NEBULA_COLORS.cyan} />
      <pointLight position={[20, -20, 30]} intensity={0.08} color={NEBULA_COLORS.warmPink} />
      
      {qualityTier.showNebula !== false && <NebulaBackground qualityTier={qualityTier} universeExtent={universeExtent} />}
      
      <BackgroundStarField qualityTier={qualityTier} universeExtent={universeExtent} />
      
      {level !== 'system' && <SpeedDust qualityTier={qualityTier} />}
      
      {(level !== 'system' || isTransitioning) && (
        <UnifiedGalaxyScene
          households={households}
          householdPositions={householdPositions}
          people={people}
          relationships={relationships}
          focusedHouseholdId={effectiveFocusedId}
          hoveredHouseholdIdRef={hoveredHouseholdIdRef}
          hoveredStarIdRef={hoveredStarIdRef}
          focusedStarId={focusedStarId}
          onHouseholdClick={onHouseholdClick}
          onHouseholdHover={onHouseholdHover}
          onStarClick={onStarClick}
          onStarHover={onStarHover}
          transitionProgressRef={transitionProgressRef}
          transitionDirectionRef={transitionDirectionRef}
          level={level}
          viewMode={viewMode}
          filters={filters}
          isTransitioning={isTransitioning}
        />
      )}
      
      {level === 'system' && selectedHousehold && !isTransitioning && (
        <SystemLevelScene
          household={selectedHousehold}
          people={people}
          relationships={relationships}
          hoveredStarIdRef={hoveredStarIdRef}
          focusedStarId={focusedStarId}
          onStarClick={onStarClick}
          onStarHover={onStarHover}
          colorIndex={households.findIndex(h => h.id === selectedHousehold.id)}
          householdPosition={selectedHouseholdPosition || { x: 0, y: 0, z: 0 }}
          fadeOpacity={1}
          bloomScale={1}
        />
      )}
      
      <mesh visible={false} onClick={onBackgroundClick}>
        <sphereGeometry args={[Math.max(500, universeExtent * 2.5), 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>
      
      {level === 'system' && !isTransitioning && (
        <OrbitControls
          ref={(node) => {
            controlsRef.current = node;
            if (node && cameraTargetPosition) {
              node.target.set(cameraTargetPosition.x || 0, cameraTargetPosition.y || 0, cameraTargetPosition.z || 0);
              node.update();
            }
          }}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          enableDamping={true}
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={200}
          autoRotate={false}
          autoRotateSpeed={0.08}
          rotateSpeed={0.4}
          zoomSpeed={0.6}
          panSpeed={0.4}
          minPolarAngle={Math.PI * 0.02}
          maxPolarAngle={Math.PI * 0.98}
        />
      )}
      <PolarStabilizer controlsRef={controlsRef} active={false} />
    </>
  );
});

function CameraTracker({ onCameraUpdate }) {
  const { camera } = useThree();
  
  useFrame(() => {
    onCameraUpdate?.({
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    });
  });
  
  return null;
}

function CornerBrackets({ children, className = '' }) {
  return (
    <div className={`relative rounded border border-slate-700/40 ${className}`}>
      {children}
    </div>
  );
}

const HoverTooltip = React.forwardRef(function HoverTooltip({ household, memberCount, starClass, mousePosRef, generation = 0, members = [], colorIndex = 0, hasChildren = false, hasParents = false }, ref) {
  if (!household) return null;

  const initialPos = mousePosRef?.current;

  const householdColor = HOUSEHOLD_COLORS[Math.abs(colorIndex) % HOUSEHOLD_COLORS.length];
  const accentColor = householdColor?.primary || '#8B5CF6';

  const memberNames = members.slice(0, 6).map(m => {
    const firstName = (m.name || '').split(' ')[0];
    return firstName;
  });
  const extraCount = members.length - 6;

  return (
    <div
      ref={ref}
      className="fixed z-[60] pointer-events-none"
      style={{ left: initialPos ? initialPos.x + 20 : -9999, top: initialPos ? initialPos.y - 8 : -9999 }}
    >
      <div
        className="rounded-xl min-w-[190px] overflow-hidden"
        style={{
          background: 'rgba(6, 4, 16, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: `0 0 30px ${accentColor}18, 0 0 60px ${accentColor}08, 0 8px 32px rgba(0,0,0,0.6)`,
          border: `1px solid ${accentColor}22`,
        }}
      >
        <div
          className="h-[2px]"
          style={{
            background: `linear-gradient(to right, transparent, ${accentColor}66, ${accentColor}aa, ${accentColor}66, transparent)`,
          }}
        />
        <div className="px-3.5 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 0 6px ${accentColor}aa, 0 0 12px ${accentColor}44`,
              }}
            />
            <span className="text-[13px] font-semibold text-slate-50 tracking-wide">{household.name}</span>
          </div>

          <div className="text-[10px] text-slate-500 mb-2.5">{members.length} {members.length === 1 ? 'member' : 'members'}</div>

          <div
            className="h-px mb-2.5"
            style={{
              background: `linear-gradient(to right, ${accentColor}20, ${accentColor}08)`,
            }}
          />

          {memberNames.length > 0 && (
            <div className="space-y-0.5">
              {memberNames.map((name, i) => (
                <span key={i} className="block text-[11px] text-slate-300/80 font-light">{name}</span>
              ))}
              {extraCount > 0 && (
                <span className="text-xs text-slate-500">+{extraCount} more</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

function SystemInfoPanel({ household, memberCount, starClass, people, onClose }) {
  if (!household) return null;

  const members = people.filter(p => p.household_id === household.id)
    .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);

  return (
    <div className="absolute bottom-3 left-3 right-3 z-50 lg:bottom-6 lg:left-6 lg:right-auto lg:w-[320px]">
      <CornerBrackets className="bg-slate-950/90 backdrop-blur-xl p-2.5 lg:p-4">
        <div className="flex justify-between items-center lg:items-start mb-1.5 lg:mb-3">
          <div className="min-w-0 flex-1">
            <div className="text-[9px] uppercase tracking-[0.15em] lg:tracking-[0.2em] text-amber-400/60">Galaxy Overview</div>
            <h3 className="text-sm lg:text-lg font-bold text-slate-100 tracking-wide truncate">{household.name}</h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <span className="lg:hidden text-[10px] font-mono text-slate-400">{memberCount} members</span>
            <button
              onClick={onClose}
              className="p-1 text-slate-500 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent mb-3" />
          <div className="bg-slate-800/40 rounded px-2 py-1.5 mb-3">
            <div className="text-[9px] uppercase tracking-widest text-slate-500">Members</div>
            <div className="text-sm font-medium text-slate-200 mt-0.5">{memberCount}</div>
          </div>
        </div>

        {members.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 lg:flex-col lg:space-y-1 lg:gap-0 max-h-[60px] lg:max-h-[120px] overflow-y-auto">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-1 lg:gap-2 text-[10px] lg:text-xs text-slate-400">
                <span className="w-1 h-1 rounded-full bg-amber-400/50 flex-shrink-0" />
                <span className="text-slate-300 whitespace-nowrap">{m.name}</span>
                {m.role_type && <span className="hidden lg:inline text-slate-600">· {m.role_type}</span>}
              </div>
            ))}
          </div>
        )}
      </CornerBrackets>
    </div>
  );
}

function TopBar({ level, selectedHousehold, cameraPosRef, onBackToGalaxy, starCount = 0, connectionCount = 0, showFilter = false, filters, onToggleFilter, qualityTier, onSetQuality }) {
  const coordRef = useRef(null);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [showRelFilters, setShowRelFilters] = useState(false);
  const activeRelCount = (filters?.relationshipTypes || []).length;

  useEffect(() => {
    const interval = setInterval(() => {
      if (coordRef.current && cameraPosRef.current) {
        const p = cameraPosRef.current;
        coordRef.current.textContent = `${p.x.toFixed(1)} · ${p.y.toFixed(1)} · ${p.z.toFixed(1)}`;
      }
    }, 200);
    return () => clearInterval(interval);
  }, [cameraPosRef]);

  return (
    <div className="absolute top-2 lg:top-3 left-3 lg:left-4 z-40 pointer-events-none">
      <div className="pointer-events-auto glass-card rounded-xl px-2.5 lg:px-3 py-1 lg:py-1.5 border border-slate-700/50">
        <div className="flex items-center gap-1.5 lg:gap-2 min-w-0">
          <button
            onClick={onBackToGalaxy}
            className="flex items-center gap-1 lg:gap-1.5 group flex-shrink-0 min-h-[40px] lg:min-h-0 px-1 lg:px-0"
          >
            <Home className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-amber-400/70 group-hover:text-amber-300 transition-colors" />
            <span
              className={`text-xs lg:text-sm font-bold transition-colors ${
                level === 'galaxy' ? 'text-slate-100' : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              Universe
            </span>
          </button>
          {level === 'system' && selectedHousehold && (
            <>
              <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
              <span className="text-xs lg:text-sm font-bold text-slate-100 truncate max-w-[140px] lg:max-w-[200px]">
                {selectedHousehold.name}
              </span>
            </>
          )}
          {showFilter && (
            <button
              onClick={() => setFilterExpanded(prev => !prev)}
              className={`lg:hidden ml-auto flex items-center gap-1 px-1.5 py-1 rounded transition-colors ${
                filterExpanded ? 'text-amber-400' : 'text-slate-500'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <ChevronRight className={`w-3 h-3 transition-transform ${filterExpanded ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>
        <div className="lg:hidden flex items-center gap-1 mt-0.5 px-1">
          {starCount > 0 && (
            <span className="text-[10px] text-slate-500">
              {starCount} {starCount === 1 ? 'star' : 'stars'}
              {connectionCount > 0 && ` · ${connectionCount} connections`}
            </span>
          )}
        </div>
        <div className="hidden lg:flex items-center gap-3 mt-0.5">
          {level === 'galaxy' && starCount > 0 && (
            <span className="text-[10px] text-slate-500">
              {starCount} {starCount === 1 ? 'star' : 'stars'}
            </span>
          )}
          <span ref={coordRef} className="text-[10px] font-mono text-slate-600">
            0.0 · 0.0 · 0.0
          </span>
        </div>
      </div>
      {showFilter && filterExpanded && (
        <div className="lg:hidden pointer-events-auto mt-1.5 glass-card rounded-xl border border-slate-700/50 p-2.5 space-y-2 min-w-[160px]">
          <div className="space-y-1">
            <button
              onClick={() => onToggleFilter('showLines')}
              className={`flex items-center gap-2 text-xs uppercase tracking-wider px-2 py-2 min-h-[36px] w-full rounded transition-colors ${
                filters?.showLines ? 'text-amber-400' : 'text-slate-600'
              }`}
            >
              {filters?.showLines ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              Lines
            </button>
            <button
              onClick={() => onToggleFilter('showLabels')}
              className={`flex items-center gap-2 text-xs uppercase tracking-wider px-2 py-2 min-h-[36px] w-full rounded transition-colors ${
                filters?.showLabels ? 'text-amber-400' : 'text-slate-600'
              }`}
            >
              {filters?.showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              Labels
            </button>
          </div>
          <div className="h-px bg-slate-700/50" />
          <div>
            <button
              onClick={() => setShowRelFilters(prev => !prev)}
              className={`flex items-center gap-2 px-2 py-2 min-h-[36px] text-xs uppercase tracking-wider w-full rounded transition-colors ${
                activeRelCount > 0 ? 'text-amber-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Filter className="w-4 h-4" />
              Relationships
              {activeRelCount > 0 && (
                <span className="ml-auto text-[9px] bg-amber-400/20 text-amber-400 px-1.5 rounded">{activeRelCount}</span>
              )}
            </button>
            {showRelFilters && (
              <div className="mt-1 space-y-0.5 pl-1">
                {Object.entries(RELATIONSHIP_FILTER_CATEGORIES).map(([key, cat]) => {
                  const isActive = (filters?.relationshipTypes || []).includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => onToggleFilter('relationshipType', key)}
                      className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1.5 min-h-[32px] w-full rounded transition-colors ${
                        isActive ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-amber-400' : 'bg-slate-600'}`} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {onSetQuality && (
            <>
              <div className="h-px bg-slate-700/50" />
              <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 px-1">Quality</div>
              <div className="flex gap-1">
                {['low', 'medium', 'high', 'ultra'].map(t => (
                  <button
                    key={t}
                    onClick={() => onSetQuality(t)}
                    className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider transition-all ${
                      qualityTier?.tier === t
                        ? 'text-amber-400 border border-amber-400/40 bg-amber-400/10'
                        : 'text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    {t[0].toUpperCase()}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FilterToggles({
  filters,
  onToggleFilter,
  qualityTier,
  onSetQuality,
  starCount = 0,
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRelFilters, setShowRelFilters] = useState(false);
  const activeRelCount = (filters.relationshipTypes || []).length;

  return (
    <div className="absolute top-[4.5rem] left-3 lg:left-4 z-40 hidden lg:block">
      <div>
        <CornerBrackets className="bg-slate-950/80 backdrop-blur-md p-2.5 space-y-2.5">
          <button
            onClick={() => setExpanded(prev => !prev)}
            className="flex items-center justify-between w-full"
          >
            <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 px-1">Filters</div>
            <ChevronRight className={`w-3 h-3 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>

          {expanded && (
            <>
              <div className="space-y-1">
                <button
                  onClick={() => onToggleFilter('showLines')}
                  className={`flex items-center gap-2 text-[10px] uppercase tracking-wider px-1 py-0.5 w-full rounded transition-colors ${
                    filters.showLines ? 'text-amber-400' : 'text-slate-600'
                  }`}
                >
                  {filters.showLines ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  Lines
                </button>
                <button
                  onClick={() => onToggleFilter('showLabels')}
                  className={`flex items-center gap-2 text-[10px] uppercase tracking-wider px-1 py-0.5 w-full rounded transition-colors ${
                    filters.showLabels ? 'text-amber-400' : 'text-slate-600'
                  }`}
                >
                  {filters.showLabels ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  Labels
                </button>
              </div>

              <div className="h-px bg-slate-700/50" />

              <div>
                <button
                  onClick={() => setShowRelFilters(prev => !prev)}
                  className={`flex items-center gap-2 px-1 py-0.5 text-[10px] uppercase tracking-wider w-full rounded transition-colors ${
                    activeRelCount > 0 ? 'text-amber-400' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  Relationships
                  {activeRelCount > 0 && (
                    <span className="ml-auto text-[8px] bg-amber-400/20 text-amber-400 px-1 rounded">{activeRelCount}</span>
                  )}
                </button>
                {showRelFilters && (
                  <div className="mt-1 space-y-0.5 pl-1">
                    {Object.entries(RELATIONSHIP_FILTER_CATEGORIES).map(([key, cat]) => {
                      const isActive = (filters.relationshipTypes || []).includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => onToggleFilter('relationshipType', key)}
                          className={`flex items-center gap-1.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 w-full rounded transition-colors ${
                            isActive ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-amber-400' : 'bg-slate-600'}`} />
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {onSetQuality && (
                <>
                  <div className="h-px bg-slate-700/50" />
                  <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 px-1">Quality</div>
                  <div className="flex gap-1">
                    {['low', 'medium', 'high', 'ultra'].map(t => (
                      <button
                        key={t}
                        onClick={() => onSetQuality(t)}
                        className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider transition-all ${
                          qualityTier?.tier === t
                            ? 'text-amber-400 border border-amber-400/40 bg-amber-400/10'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                      >
                        {t[0].toUpperCase()}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </CornerBrackets>
      </div>
    </div>
  );
}

function ZoomControls({ onZoomIn, onZoomOut, onResetView }) {
  return (
    <div className="absolute right-3 sm:right-6 z-[60] flex flex-col gap-1 sm:gap-1.5 bottom-[5.5rem] lg:bottom-24" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <button
        onClick={onZoomIn}
        className="p-2 bg-slate-950/80 border border-amber-500/20 text-slate-400 hover:text-amber-300 hover:border-amber-500/40 active:bg-amber-500/20 transition-colors rounded"
        title="Zoom In"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
      <button
        onClick={onZoomOut}
        className="p-2 bg-slate-950/80 border border-amber-500/20 text-slate-400 hover:text-amber-300 hover:border-amber-500/40 active:bg-amber-500/20 transition-colors rounded"
        title="Zoom Out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>
      <button
        onClick={onResetView}
        className="p-2 bg-slate-950/80 border border-amber-500/20 text-slate-400 hover:text-amber-300 hover:border-amber-500/40 active:bg-amber-500/20 transition-colors rounded"
        title="Reset View"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
  );
}

function TouchGestureHint({ visible, onDismiss }) {
  const [show, setShow] = useState(visible);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      setFading(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible && show) {
      setFading(true);
      const timer = setTimeout(() => setShow(false), 600);
      return () => clearTimeout(timer);
    }
  }, [visible, show]);

  if (!show) return null;

  return (
    <div
      className="absolute inset-0 z-[55] flex items-center justify-center pointer-events-none"
      style={{
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
      }}
    >
      <div
        className="pointer-events-auto px-6 py-4 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-amber-500/20 text-center max-w-[280px]"
        onClick={onDismiss}
      >
        <div className="flex justify-center gap-6 mb-3">
          <div className="flex flex-col items-center gap-1">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="10" stroke="#FBBF24" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5"/>
              <circle cx="16" cy="16" r="3" fill="#FBBF24" opacity="0.8"/>
              <path d="M16 6V10M16 22V26M6 16H10M22 16H26" stroke="#FBBF24" strokeWidth="1" opacity="0.4"/>
            </svg>
            <span className="text-xs text-amber-300/70">Drag</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="12" cy="16" r="3" fill="#FBBF24" opacity="0.8"/>
              <circle cx="20" cy="16" r="3" fill="#FBBF24" opacity="0.8"/>
              <path d="M8 16H4M24 16H28" stroke="#FBBF24" strokeWidth="1.5" opacity="0.5" strokeLinecap="round"/>
            </svg>
            <span className="text-xs text-amber-300/70">Pinch</span>
          </div>
        </div>
        <p className="text-sm text-slate-300">Drag to explore, pinch to zoom</p>
        <p className="text-xs text-slate-500 mt-1.5">Tap to dismiss</p>
      </div>
    </div>
  );
}

function PersonDetailPanel({ person, household, onClose }) {
  if (!person) return null;
  
  return (
    <div className="absolute bottom-4 sm:bottom-6 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[480px] sm:max-w-[calc(100vw-2rem)] glass-card rounded-2xl p-4 sm:p-6 border border-amber-500/20 z-50 animate-in slide-in-from-bottom duration-300 bg-slate-900/95 backdrop-blur-xl" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 16px, 16px)' }}>
      <div className="flex justify-between items-start">
        <div className="flex gap-2.5 sm:gap-3 min-w-0">
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-amber-500/20 flex-shrink-0">
            {person.photo_url ? (
              <img src={person.photo_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <span className="text-lg sm:text-xl text-slate-400">{person.name?.charAt(0)}</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-slate-100 truncate">{person.name}</h3>
            {person.nickname && (
              <p className="text-sm text-amber-400 mt-0.5 truncate">"{person.nickname}"</p>
            )}
            <span className="inline-block mt-1.5 sm:mt-2 px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
              {person.role_type}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 sm:p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 active:bg-slate-700/70 transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {person.about && (
        <p className="text-sm text-slate-400 mt-3 sm:mt-4 leading-relaxed line-clamp-3 sm:line-clamp-none">{person.about}</p>
      )}
      
      {household && (
        <p className="text-xs text-slate-500 mt-2 sm:mt-3">{household.name}</p>
      )}
    </div>
  );
}

function personHasOwnGalaxy(personId, relationships) {
  return relationships.some(rel => {
    const type = (rel.relationship_type || '').toLowerCase();
    const idA = rel.person_id || rel.person1_id;
    const idB = rel.related_person_id || rel.person2_id;
    if (type === 'partner' || type === 'spouse' || type === 'married') {
      return idA === personId || idB === personId;
    }
    if (type === 'parent' && idA === personId) return true;
    if (type === 'child' && idB === personId) return true;
    return false;
  });
}

const GalaxyView = React.memo(function GalaxyView({ people = [], relationships = [], households = [], galaxyData = null, onPersonClick, onRecenterGalaxy, onNavigateToStar, onNavigateToGalaxy, myPerson = null, initialGalaxyId = null, navigateToPersonId = null }) {
  const [level, setLevel] = useState('galaxy');
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [hoveredHouseholdId, _setHoveredHouseholdId] = useState(null);
  const [hoveredStarId, _setHoveredStarId] = useState(null);
  const [focusedStarId, setFocusedStarId] = useState(null);
  const hoveredHouseholdIdRef = useRef(null);
  const hoveredStarIdRef = useRef(null);
  const setHoveredHouseholdId = useCallback((id) => {
    hoveredHouseholdIdRef.current = id;
    _setHoveredHouseholdId(id);
  }, []);
  const setHoveredStarId = useCallback((id) => {
    hoveredStarIdRef.current = id;
    _setHoveredStarId(id);
  }, []);
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [transitioningHousehold, setTransitioningHousehold] = useState(null);
  const transitioningHouseholdRef = useRef(null);
  useEffect(() => {
    transitioningHouseholdRef.current = transitioningHousehold;
  }, [transitioningHousehold]);
  const [warpDirection, setWarpDirection] = useState(null);
  const [viewMode, setViewMode] = useState('nebula');
  const mousePosRef = useRef(null);
  const tooltipRef = useRef(null);
  const [filters, setFilters] = useState({
    showLines: true,
    showLabels: true,
    relationshipTypes: [],
    generation: null,
  });
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const normalizeDpr = useCallback((dpr) => {
    if (Array.isArray(dpr)) {
      const deviceDpr = window.devicePixelRatio || 1;
      return Math.min(dpr[1], Math.max(dpr[0], deviceDpr));
    }
    return dpr;
  }, []);
  const cameraRef = useRef(null);
  const cameraPosRef = useRef(null);
  const wasdKeysPressed = useRef({ w: false, a: false, s: false, d: false });
  const [showGestureHint, setShowGestureHint] = useState(() => {
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (!isTouchDevice) return false;
    try { return !localStorage.getItem('starthread_gesture_hint_seen'); } catch (e) { return true; }
  });
  const showGestureHintRef = useRef(showGestureHint);
  useEffect(() => {
    showGestureHintRef.current = showGestureHint;
  }, [showGestureHint]);

  const handleTouchInteraction = useCallback(() => {
    if (showGestureHintRef.current) {
      setShowGestureHint(false);
      try { localStorage.setItem('starthread_gesture_hint_seen', '1'); } catch (e) {}
    }
  }, []);

  const dismissGestureHint = useCallback(() => {
    setShowGestureHint(false);
    try { localStorage.setItem('starthread_gesture_hint_seen', '1'); } catch (e) {}
  }, []);

  const qualityTier = useQualityTier();
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setPixelRatio(normalizeDpr(qualityTier.dpr));
    }
  }, [qualityTier.dpr, normalizeDpr]);

  const canvasCamera = useMemo(() => ({ position: [50, 35, 70], fov: 55 }), []);
  const canvasGl = useMemo(() => ({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: false,
    preserveDrawingBuffer: false,
  }), []);
  const canvasStyle = useMemo(() => ({ background: '#060410' }), []);

  const rawHouseholdPositions = useOrganicClusterLayout(households, people, viewMode, relationships);

  const householdPositions = useMemo(() => {
    if (rawHouseholdPositions.size <= 1) return rawHouseholdPositions;
    const MIN_DIST = 50;
    const entries = [];
    rawHouseholdPositions.forEach((pos, id) => {
      entries.push({ id, x: pos.x, y: pos.y, z: pos.z, data: pos });
    });
    for (let iter = 0; iter < 12; iter++) {
      let moved = false;
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const a = entries[i], b = entries[j];
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < MIN_DIST && dist > 0.001) {
            const overlap = (MIN_DIST - dist) * 0.55;
            const nx = dx / dist, ny = dy / dist, nz = dz / dist;
            a.x -= nx * overlap; a.y -= ny * overlap; a.z -= nz * overlap;
            b.x += nx * overlap; b.y += ny * overlap; b.z += nz * overlap;
            moved = true;
          } else if (dist <= 0.001) {
            const angle = (i * 2.399 + j * 1.7);
            a.x -= Math.cos(angle) * MIN_DIST * 0.5;
            a.z -= Math.sin(angle) * MIN_DIST * 0.5;
            b.x += Math.cos(angle) * MIN_DIST * 0.5;
            b.z += Math.sin(angle) * MIN_DIST * 0.5;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    const result = new Map();
    entries.forEach(e => {
      result.set(e.id, { ...e.data, x: e.x, y: e.y, z: e.z });
    });
    return result;
  }, [rawHouseholdPositions]);

  const myHomePosition = useMemo(() => {
    if (!myPerson || !myPerson.household_id || householdPositions.size === 0) return null;
    return householdPositions.get(myPerson.household_id) || null;
  }, [myPerson, householdPositions]);

  const initialCameraPos = useMemo(() => {
    if (!myHomePosition) return [75, 140, 105];
    const hx = myHomePosition.x || 0;
    const hy = myHomePosition.y || 0;
    const hz = myHomePosition.z || 0;
    return [hx + 15, hy + 10, hz + 30];
  }, [myHomePosition]);

  const initialGalaxyHandled = useRef(false);
  useEffect(() => {
    let timer;
    if (initialGalaxyId && !initialGalaxyHandled.current && households.length > 0) {
      const targetHousehold = households.find(h => h.id === initialGalaxyId);
      if (targetHousehold) {
        initialGalaxyHandled.current = true;
        timer = setTimeout(() => {
          setTransitioningHousehold(targetHousehold);
          setIsTransitioning(true);
          setTransitionProgress(0);
          setAutoRotateEnabled(false);
          setWarpDirection('zoom-in');
        }, 500);
      }
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [initialGalaxyId, households]);

  const lastNavigatedPersonId = useRef(null);
  const navigateFocusTimer = useRef(null);
  useEffect(() => {
    if (navigateToPersonId && navigateToPersonId !== lastNavigatedPersonId.current && people.length > 0 && households.length > 0) {
      lastNavigatedPersonId.current = navigateToPersonId;
      if (navigateFocusTimer.current) clearTimeout(navigateFocusTimer.current);
      const personId = navigateToPersonId.includes(':') ? navigateToPersonId.split(':')[0] : navigateToPersonId;
      const person = people.find(p => p.id === personId);
      if (person && person.household_id) {
        const targetHousehold = households.find(h => h.id === person.household_id);
        if (targetHousehold) {
          if (selectedHousehold?.id === targetHousehold.id) {
            setFocusedStarId(person.id);
          } else {
            setTransitioningHousehold(targetHousehold);
            setIsTransitioning(true);
            setTransitionProgress(0);
            setAutoRotateEnabled(false);
            setWarpDirection('zoom-in');
            navigateFocusTimer.current = setTimeout(() => {
              setFocusedStarId(person.id);
            }, 2000);
          }
        }
      }
    }
    return () => { if (navigateFocusTimer.current) clearTimeout(navigateFocusTimer.current); };
  }, [navigateToPersonId, people, households]);

  const handleCameraUpdate = useCallback((pos) => {
    cameraPosRef.current = pos;
  }, []);


  const handleToggleFilter = useCallback((type, value) => {
    if (type === 'relationshipType') {
      setHoveredHouseholdId(null);
      setFilters(prev => {
        const current = prev.relationshipTypes || [];
        const next = current.includes(value)
          ? current.filter(t => t !== value)
          : [...current, value];
        return { ...prev, relationshipTypes: next };
      });
    } else if (type === 'generation') {
      setHoveredHouseholdId(null);
      setFilters(prev => ({
        ...prev,
        generation: prev.generation === value ? null : value,
      }));
    } else {
      setFilters(prev => ({ ...prev, [type]: !prev[type] }));
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    if (tooltipRef.current) {
      tooltipRef.current.style.left = (e.clientX + 20) + 'px';
      tooltipRef.current.style.top = (e.clientY - 8) + 'px';
    }
  }, []);

  const hoveredHousehold = useMemo(() => {
    if (!hoveredHouseholdId) return null;
    return households.find(h => h.id === hoveredHouseholdId);
  }, [hoveredHouseholdId, households]);

  const hoveredHouseholdInfo = useMemo(() => {
    if (!hoveredHouseholdId) return null;
    const pos = householdPositions.get(hoveredHouseholdId);
    const mc = pos?.memberCount || 0;
    const gen = pos?.generation ?? 0;
    const members = people.filter(p => p.household_id === hoveredHouseholdId)
      .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
    const colorIndex = households.findIndex(h => h.id === hoveredHouseholdId);
    const memberIds = new Set(members.map(m => m.id));
    const hasChildren = relationships.some(r =>
      r.relationship_type === 'parent' && memberIds.has(r.person_id) && !memberIds.has(r.related_person_id)
    );
    const hasParents = relationships.some(r =>
      r.relationship_type === 'parent' && memberIds.has(r.related_person_id) && !memberIds.has(r.person_id)
    );
    return { memberCount: mc, starClass: classifyHousehold(mc), generation: gen, members, colorIndex, hasChildren, hasParents };
  }, [hoveredHouseholdId, householdPositions, people, households, relationships]);

  const selectedHouseholdInfo = useMemo(() => {
    if (!selectedHousehold) return null;
    const pos = householdPositions.get(selectedHousehold.id);
    const mc = pos?.memberCount || 0;
    return { memberCount: mc, starClass: classifyHousehold(mc) };
  }, [selectedHousehold, householdPositions]);

  const cameraInitializedRef = useRef(false);
  const handleCanvasCreated = useCallback(({ gl, camera }) => {
    rendererRef.current = gl;
    cameraRef.current = camera;
    gl.setPixelRatio(normalizeDpr(qualityTier.dpr));
    if (myHomePosition && !cameraInitializedRef.current) {
      const hx = myHomePosition.x || 0;
      const hy = myHomePosition.y || 0;
      const hz = myHomePosition.z || 0;
      camera.position.set(hx + 15, hy + 10, hz + 30);
      camera.lookAt(hx, hy, hz);
      cameraInitializedRef.current = true;
    }
    const canvas = gl.domElement;
    
    let loseContextExt = null;
    try {
      const ctx = gl.getContext();
      loseContextExt = ctx?.getExtension?.('WEBGL_lose_context');
    } catch (e) {}
    
    let restoreTimeout = null;
    
    const handleContextLost = (event) => {
      event.preventDefault();
      setContextLost(true);
      console.warn('WebGL context lost. Attempting recovery...');
      
      if (loseContextExt) {
        restoreTimeout = setTimeout(() => {
          try {
            loseContextExt.restoreContext();
          } catch (e) {
            console.warn('Could not restore WebGL context:', e);
          }
        }, 1500);
      }
    };
    
    const handleContextRestored = () => {
      setContextLost(false);
      if (restoreTimeout) clearTimeout(restoreTimeout);
      console.log('WebGL context restored.');
    };
    
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
    
    return () => {
      if (restoreTimeout) clearTimeout(restoreTimeout);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, []);
  
  const isTouchDevice = useRef('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const handleHouseholdClick = useCallback((household) => {
    if (isTouchDevice.current && hoveredHouseholdIdRef.current !== household.id) {
      setHoveredHouseholdId(household.id);
      return;
    }
    setTransitioningHousehold(household);
    setIsTransitioning(true);
    setTransitionProgress(0);
    setFocusedStarId(null);
    setAutoRotateEnabled(false);
    setWarpDirection('zoom-in');
  }, [setHoveredHouseholdId]);
  
  const handleBackToGalaxy = useCallback(() => {
    setIsTransitioning(true);
    setTransitionProgress(0);
    setLevel('galaxy');
    setFocusedStarId(null);
    setHoveredStarId(null);
    setWarpDirection('zoom-out');
    setTimeout(() => {
      setSelectedHousehold(null);
      setTransitioningHousehold(null);
      setIsTransitioning(false);
      setWarpDirection(null);
    }, 1800);
  }, []);
  
  const handleTransitionComplete = useCallback(() => {
    setIsTransitioning(false);
    setWarpDirection(null);
    if (transitioningHouseholdRef.current) {
      setSelectedHousehold(transitioningHouseholdRef.current);
      setLevel('system');
    }
    setTransitioningHousehold(null);
  }, []);
  
  const handleStarClick = useCallback((star) => {
    const person = star.person;
    if (level === 'system') {
      const hasOwnGalaxy = person.household_id
        && person.household_id !== selectedHousehold?.id
        && personHasOwnGalaxy(person.id, relationships);
      if (hasOwnGalaxy) {
        const targetHousehold = households.find(h => h.id === person.household_id);
        if (targetHousehold) {
          handleHouseholdClick(targetHousehold);
          return;
        }
      }
      onNavigateToStar?.(person, selectedHousehold?.id);
    } else {
      setFocusedStarId(star.id);
    }
  }, [onNavigateToStar, level, selectedHousehold, relationships, households, handleHouseholdClick]);
  
  const handleBackgroundClick = useCallback(() => {
    setFocusedStarId(null);
    if (isTouchDevice.current) {
      setHoveredHouseholdId(null);
    }
  }, [setHoveredHouseholdId]);
  
  const handleZoomIn = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    if (level === 'system' && controlsRef.current) {
      const direction = new THREE.Vector3();
      cam.getWorldDirection(direction);
      cam.position.addScaledVector(direction, 8);
      controlsRef.current.target.copy(cam.position).addScaledVector(direction, 1);
      controlsRef.current.update();
    } else {
      const direction = new THREE.Vector3();
      cam.getWorldDirection(direction);
      cam.position.addScaledVector(direction, 8);
    }
  }, [level]);
  
  const handleZoomOut = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    if (level === 'system' && controlsRef.current) {
      const direction = new THREE.Vector3();
      cam.getWorldDirection(direction);
      cam.position.addScaledVector(direction, -8);
      controlsRef.current.target.copy(cam.position).addScaledVector(direction, 1);
      controlsRef.current.update();
    } else {
      const direction = new THREE.Vector3();
      cam.getWorldDirection(direction);
      cam.position.addScaledVector(direction, -8);
    }
  }, [level]);
  
  const handleResetView = useCallback(() => {
    if (level === 'system') {
      handleBackToGalaxy();
    } else {
      const cam = cameraRef.current;
      if (cam) {
        cam.position.set(50, 35, 70);
        cam.lookAt(0, 0, 0);
      }
    }
  }, [level, handleBackToGalaxy]);
  
  const focusedPerson = useMemo(() => {
    if (!focusedStarId) return null;
    return people.find(p => p.id === focusedStarId) || null;
  }, [focusedStarId, people]);
  
  if (!people || people.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#050510] via-[#0d0820] to-[#080510]">
        <p className="text-slate-500">No family members yet</p>
      </div>
    );
  }
  
  if (!households || households.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#050510] via-[#0d0820] to-[#080510]">
        <p className="text-slate-500">No family connections yet. Add family members to see the universe.</p>
      </div>
    );
  }
  
  return (
    <div className="absolute inset-0" onMouseMove={handleMouseMove}>
      <div
        className="absolute inset-0 pointer-events-none z-[2]"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(10,4,18,0.3) 60%, rgba(6,2,12,0.6) 100%)',
        }}
      />
      {contextLost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/90">
          <div className="text-center">
            <p className="text-white text-lg mb-2">Recovering graphics...</p>
            <p className="text-slate-400 text-sm">Please wait a moment</p>
          </div>
        </div>
      )}
      <Canvas
        camera={canvasCamera}
        gl={canvasGl}
        style={canvasStyle}
        onCreated={handleCanvasCreated}
        frameloop="always"
      >
        <CameraTracker onCameraUpdate={handleCameraUpdate} />
        <NebulaScene
          level={level}
          households={households}
          people={people}
          relationships={relationships}
          selectedHousehold={selectedHousehold}
          householdPositions={householdPositions}
          hoveredHouseholdIdRef={hoveredHouseholdIdRef}
          hoveredStarIdRef={hoveredStarIdRef}
          focusedStarId={focusedStarId}
          onHouseholdClick={handleHouseholdClick}
          onHouseholdHover={setHoveredHouseholdId}
          onStarClick={handleStarClick}
          onStarHover={setHoveredStarId}
          onBackgroundClick={handleBackgroundClick}
          controlsRef={controlsRef}
          autoRotateEnabled={autoRotateEnabled}
          setAutoRotateEnabled={setAutoRotateEnabled}
          qualityTier={qualityTier}
          isTransitioning={isTransitioning}
          transitioningHousehold={transitioningHousehold}
          onTransitionComplete={handleTransitionComplete}
          viewMode={viewMode}
          filters={filters}
          galaxyData={galaxyData}
          onRecenterGalaxy={onRecenterGalaxy}
          initialHomePosition={myHomePosition}
          wasdKeysPressed={wasdKeysPressed}
          onTouchInteraction={handleTouchInteraction}
        />
      </Canvas>
      
      <VignetteOverlay />
      <WarpOverlay active={isTransitioning} direction={warpDirection} />

      <TopBar
        level={level}
        selectedHousehold={selectedHousehold}
        cameraPosRef={cameraPosRef}
        onBackToGalaxy={handleBackToGalaxy}
        starCount={people.length}
        connectionCount={relationships.length}
        showFilter={level === 'galaxy'}
        filters={filters}
        onToggleFilter={handleToggleFilter}
        qualityTier={qualityTier}
        onSetQuality={qualityTier.setTier}
      />

      {level === 'galaxy' && (
        <FilterToggles
          filters={filters}
          onToggleFilter={handleToggleFilter}
          qualityTier={qualityTier}
          onSetQuality={qualityTier.setTier}
        />
      )}

      <ZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
      />

      {level === 'galaxy' && !isTransitioning && (
        <TouchGestureHint visible={showGestureHint} onDismiss={dismissGestureHint} />
      )}

      {level === 'galaxy' && hoveredHousehold && hoveredHouseholdInfo && (
        <HoverTooltip
          ref={tooltipRef}
          household={hoveredHousehold}
          memberCount={hoveredHouseholdInfo.memberCount}
          starClass={hoveredHouseholdInfo.starClass}
          mousePosRef={mousePosRef}
          generation={hoveredHouseholdInfo.generation}
          members={hoveredHouseholdInfo.members}
          colorIndex={hoveredHouseholdInfo.colorIndex}
          hasChildren={hoveredHouseholdInfo.hasChildren}
          hasParents={hoveredHouseholdInfo.hasParents}
        />
      )}

      {level === 'system' && selectedHousehold && selectedHouseholdInfo && (
        <SystemInfoPanel
          household={selectedHousehold}
          memberCount={selectedHouseholdInfo.memberCount}
          starClass={selectedHouseholdInfo.starClass}
          people={people}
          onClose={handleBackToGalaxy}
        />
      )}
      
      
    </div>
  );
});

export default GalaxyView;
