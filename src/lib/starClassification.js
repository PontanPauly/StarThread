export const STAR_CLASSES = {
  F: {
    id: 'F',
    label: 'Class F',
    description: 'Yellow Star',
    minMembers: 1,
    maxMembers: 2,
    colors: {
      core: '#FFF8E7',
      inner: '#FFD700',
      outer: '#FFB347',
      glow: '#FFA500'
    },
    brightness: 1.0
  },
  K: {
    id: 'K',
    label: 'Class K',
    description: 'Red Giant',
    minMembers: 3,
    maxMembers: 4,
    colors: {
      core: '#FFE4E1',
      inner: '#FF6B4A',
      outer: '#FF4500',
      glow: '#CC3700'
    },
    brightness: 0.9
  },
  E: {
    id: 'E',
    label: 'Class E',
    description: 'Emerald Star',
    minMembers: 5,
    maxMembers: 7,
    colors: {
      core: '#E0FFE0',
      inner: '#50C878',
      outer: '#2E8B57',
      glow: '#228B22'
    },
    brightness: 1.1
  },
  O: {
    id: 'O',
    label: 'Class O',
    description: 'Blue Supergiant',
    minMembers: 8,
    maxMembers: Infinity,
    colors: {
      core: '#E8F4FD',
      inner: '#4DA6FF',
      outer: '#1E90FF',
      glow: '#0066CC'
    },
    brightness: 1.3
  }
};

export function classifyHousehold(memberCount) {
  if (memberCount <= 2) return STAR_CLASSES.F;
  if (memberCount <= 4) return STAR_CLASSES.K;
  if (memberCount <= 7) return STAR_CLASSES.E;
  return STAR_CLASSES.O;
}

export function getClassificationSummary(households, people) {
  const memberCounts = {};
  for (const person of people) {
    if (person.household_id) {
      memberCounts[person.household_id] = (memberCounts[person.household_id] || 0) + 1;
    }
  }

  return households.map(h => ({
    ...h,
    memberCount: memberCounts[h.id] || 0,
    starClass: classifyHousehold(memberCounts[h.id] || 0)
  }));
}

export function computeHouseholdEdges(relationships, people) {
  const personToHousehold = {};
  for (const person of people) {
    if (person.household_id) {
      personToHousehold[person.id] = person.household_id;
    }
  }

  const partnerSets = {};
  const bioParentsOf = {};

  for (const rel of relationships) {
    const idA = rel.person_id || rel.person1_id;
    const idB = rel.related_person_id || rel.person2_id;
    const type = (rel.relationship_type || '').toLowerCase();
    const subtype = (rel.subtype || 'biological').toLowerCase();

    if (type === 'partner' || type === 'spouse' || type === 'married') {
      const hhA = personToHousehold[idA];
      const hhB = personToHousehold[idB];
      if (hhA && hhA === hhB) {
        if (!partnerSets[hhA]) partnerSets[hhA] = new Set();
        partnerSets[hhA].add(idA);
        partnerSets[hhA].add(idB);
      }
    }

    if (type === 'parent' && subtype === 'biological') {
      if (!bioParentsOf[idB]) bioParentsOf[idB] = [];
      bioParentsOf[idB].push(idA);
    }
  }

  const edgeSet = new Set();
  const edges = [];

  for (const rel of relationships) {
    if (rel.relationship_type !== 'parent') continue;
    const parentId = rel.person_id || rel.person1_id;
    const childId = rel.related_person_id || rel.person2_id;
    const subtype = (rel.subtype || 'biological').toLowerCase();
    const parentHH = personToHousehold[parentId];
    const childHH = personToHousehold[childId];

    if (subtype === 'step') continue;

    if (parentHH && childHH && parentHH !== childHH) {
      const key = parentHH + '|' + childHH + '|' + childId;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);

        const partners = partnerSets[parentHH];
        const childBioParents = bioParentsOf[childId] || [];
        const bothBioOnRing = partners && childBioParents.length >= 2 &&
          childBioParents.every(bp => partners.has(bp));

        edges.push({
          from: parentHH,
          to: childHH,
          childPersonId: childId,
          fromPersonId: parentId,
          fromRing: bothBioOnRing,
          type: rel.relationship_type
        });
      }
    }
    if (parentHH && childHH && parentHH === childHH) {
      const key = parentHH + '|' + parentHH + '|' + childId;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);

        const partners = partnerSets[parentHH];
        const childBioParents = bioParentsOf[childId] || [];
        const bothBioOnRing = partners && childBioParents.length >= 2 &&
          childBioParents.every(bp => partners.has(bp));

        edges.push({
          from: parentHH,
          to: parentHH,
          childPersonId: childId,
          fromPersonId: parentId,
          fromRing: bothBioOnRing,
          type: 'intra',
          isIntraHousehold: true
        });
      }
    }
  }

  const nonParentTypes = new Set(['sibling', 'grandparent', 'grandchild', 'aunt_uncle', 'niece_nephew', 'cousin', 'in_law', 'chosen_family', 'extended', 'guardian', 'godparent', 'half_sibling']);
  for (const rel of relationships) {
    const type = (rel.relationship_type || '').toLowerCase();
    if (!nonParentTypes.has(type)) continue;

    const idA = rel.person_id || rel.person1_id;
    const idB = rel.related_person_id || rel.person2_id;
    const hhA = personToHousehold[idA];
    const hhB = personToHousehold[idB];

    if (hhA && hhB && hhA !== hhB) {
      const key = [hhA, hhB].sort().join('|') + '|' + type;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({
          from: hhA,
          to: hhB,
          fromPersonId: idA,
          childPersonId: idB,
          fromRing: false,
          type
        });
      }
    }
  }

  return edges;
}
