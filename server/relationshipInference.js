import { pool } from './db/index.js';

const RECIPROCAL_MAP = {
  parent: 'child',
  child: 'parent',
  grandparent: 'grandchild',
  grandchild: 'grandparent',
  aunt_uncle: 'niece_nephew',
  niece_nephew: 'aunt_uncle',
  sibling: 'sibling',
  spouse: 'spouse',
  partner: 'partner',
  cousin: 'cousin',
  in_law: 'in_law',
};

async function getDirectRelationships(personId) {
  const { rows } = await pool.query(`
    SELECT r.related_person_id AS target_id, r.relationship_type, r.status_from_person, r.status_from_related,
           p.name AS target_name
    FROM relationships r
    JOIN people p ON p.id = r.related_person_id
    WHERE r.person_id = $1
      AND r.status_from_person IN ('confirmed', 'claimed')
      AND p.merged_into_id IS NULL
  `, [personId]);
  return rows;
}

function edgeConfidence(status_from_person, status_from_related) {
  if (status_from_person === 'confirmed' && status_from_related === 'confirmed') return 1;
  if (status_from_person === 'confirmed' || status_from_related === 'confirmed') return 0.8;
  return 0.6;
}

export async function inferRelationships(personId) {
  const directRels = await getDirectRelationships(personId);
  const directTargetIds = new Set(directRels.map(r => r.target_id));
  directTargetIds.add(personId);

  const inferred = [];
  const seen = new Set();

  for (const rel of directRels) {
    const hop1Confidence = edgeConfidence(rel.status_from_person, rel.status_from_related);
    const hop2Rels = await getDirectRelationships(rel.target_id);

    for (const rel2 of hop2Rels) {
      if (directTargetIds.has(rel2.target_id) || rel2.target_id === personId) continue;
      const hop2Confidence = edgeConfidence(rel2.status_from_person, rel2.status_from_related);

      const inferredType = inferType2Hop(rel.relationship_type, rel2.relationship_type);
      if (!inferredType) continue;

      const key = `${rel2.target_id}:${inferredType}`;
      if (seen.has(key)) continue;
      seen.add(key);

      inferred.push({
        personId: rel2.target_id,
        personName: rel2.target_name,
        inferredType,
        source: 'inferred',
        path: [rel.target_id],
        pathNames: [rel.target_name],
        confidence: hop1Confidence * hop2Confidence >= 0.8 ? 'high' : hop1Confidence * hop2Confidence >= 0.5 ? 'medium' : 'low',
      });

      const hop3Rels = await getDirectRelationships(rel2.target_id);
      for (const rel3 of hop3Rels) {
        if (directTargetIds.has(rel3.target_id) || rel3.target_id === personId || seen.has(`${rel3.target_id}:cousin`)) continue;
        const hop3Confidence = edgeConfidence(rel3.status_from_person, rel3.status_from_related);

        const inferredType3 = inferType3Hop(rel.relationship_type, rel2.relationship_type, rel3.relationship_type);
        if (!inferredType3) continue;

        const key3 = `${rel3.target_id}:${inferredType3}`;
        if (seen.has(key3)) continue;
        seen.add(key3);

        const combinedConf = hop1Confidence * hop2Confidence * hop3Confidence;

        inferred.push({
          personId: rel3.target_id,
          personName: rel3.target_name,
          inferredType: inferredType3,
          source: 'inferred',
          path: [rel.target_id, rel2.target_id],
          pathNames: [rel.target_name, rel2.target_name],
          confidence: combinedConf >= 0.6 ? 'high' : combinedConf >= 0.3 ? 'medium' : 'low',
        });
      }
    }
  }

  return inferred;
}

function inferType2Hop(type1, type2) {
  if (type1 === 'child' && type2 === 'child') return 'grandparent';
  if (type1 === 'parent' && type2 === 'parent') return 'grandchild';
  if (type1 === 'child' && type2 === 'sibling') return 'aunt_uncle';
  if (type1 === 'child' && type2 === 'parent') return 'sibling';
  if (type1 === 'parent' && type2 === 'child') return 'niece_nephew';
  if (type1 === 'sibling' && type2 === 'child') return 'niece_nephew';
  if (type1 === 'spouse' && type2 === 'child') return 'in_law';
  if (type1 === 'spouse' && type2 === 'sibling') return 'in_law';
  if (type1 === 'sibling' && type2 === 'spouse') return 'in_law';
  return null;
}

function inferType3Hop(type1, type2, type3) {
  if (type1 === 'child' && type2 === 'sibling' && type3 === 'parent') return 'cousin';
  if (type1 === 'child' && type2 === 'parent' && type3 === 'parent') return 'cousin';
  return null;
}
