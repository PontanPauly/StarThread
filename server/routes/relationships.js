import express from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { inferRelationships } from '../relationshipInference.js';
import { rescoreNeighbors } from '../scoringTriggers.js';

const router = express.Router();

const RING_MAP = {
  partner: 1, spouse: 1, parent: 1, child: 1,
  sibling: 2, grandparent: 2, grandchild: 2, half_sibling: 2,
  aunt_uncle: 3, niece_nephew: 3, cousin: 3, in_law: 3,
  step_parent: 2, step_child: 2, step_sibling: 2,
  guardian: 1, ward: 1, godparent: 2, godchild: 2,
  chosen_family: 4, extended: 4
};

function getRing(relType) {
  if (!relType) return 4;
  const lower = relType.toLowerCase();
  if (RING_MAP[lower] !== undefined) return RING_MAP[lower];
  if (lower.startsWith('step_')) return 4;
  return 4;
}

const RECIPROCAL_TYPES = {
  parent: 'child', child: 'parent',
  sibling: 'sibling', partner: 'partner', spouse: 'spouse',
  grandparent: 'grandchild', grandchild: 'grandparent',
  aunt_uncle: 'niece_nephew', niece_nephew: 'aunt_uncle',
  cousin: 'cousin', in_law: 'in_law',
  step_parent: 'step_child', step_child: 'step_parent',
  step_sibling: 'step_sibling', half_sibling: 'half_sibling',
  guardian: 'ward', ward: 'guardian',
  godparent: 'godchild', godchild: 'godparent',
  chosen_family: 'chosen_family', extended: 'extended'
};

const SAFE_PERSON_COLS = 'id, name, nickname, photo_url, birth_date, birth_year, death_date, role_type, is_deceased, is_memorial, memorial_date, star_profile, star_pattern, star_intensity, star_flare_count, privacy_level, about, household_id, user_id, household_status, address, city, state, onboarding_complete, social_links, created_at';

router.get('/universe-members', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const personResult = await pool.query(
      `SELECT id FROM people WHERE user_id = $1`, [userId]
    );
    if (personResult.rows.length === 0) {
      return res.json({ people: [], relationships: [] });
    }
    const rootPersonId = personResult.rows[0].id;

    const { rows: hiddenRels } = await pool.query(`
      SELECT relationship_id FROM relationship_visibility
      WHERE user_id = $1 AND is_visible = false
    `, [userId]);
    const hiddenRelIds = new Set(hiddenRels.map(r => r.relationship_id));

    const { rows: allRels } = await pool.query(`
      SELECT r.id, r.person_id, r.related_person_id, r.relationship_type, r.subtype,
             r.status_from_person, r.status_from_related
      FROM relationships r
      WHERE r.status_from_person IN ('confirmed', 'claimed')
        AND r.status_from_related IN ('confirmed', 'claimed')
    `);

    const visibleRels = allRels.filter(r => !hiddenRelIds.has(r.id));

    const adjacency = {};
    for (const rel of visibleRels) {
      if (!adjacency[rel.person_id]) adjacency[rel.person_id] = [];
      if (!adjacency[rel.related_person_id]) adjacency[rel.related_person_id] = [];
      adjacency[rel.person_id].push(rel.related_person_id);
      adjacency[rel.related_person_id].push(rel.person_id);
    }

    const visited = new Set([rootPersonId]);
    let frontier = [rootPersonId];

    while (frontier.length > 0) {
      const nextFrontier = [];
      for (const personId of frontier) {
        const neighbors = adjacency[personId] || [];
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            nextFrontier.push(neighborId);
          }
        }
      }
      frontier = nextFrontier;
    }

    const personIds = Array.from(visited);

    if (personIds.length === 0) {
      return res.json({ people: [], relationships: [] });
    }

    const { rows: people } = await pool.query(`
      SELECT ${SAFE_PERSON_COLS}
      FROM people
      WHERE id = ANY($1::uuid[]) AND merged_into_id IS NULL
    `, [personIds]);

    const filteredPeople = people.map(p => {
      if (p.privacy_level === 'private' && p.user_id !== userId) {
        return { id: p.id, name: p.name, privacy_level: p.privacy_level, household_id: p.household_id, role_type: p.role_type, is_deceased: p.is_deceased, is_memorial: p.is_memorial };
      }
      return p;
    });

    const graphRelationships = visibleRels.filter(r =>
      visited.has(r.person_id) && visited.has(r.related_person_id)
    );

    const householdIds = [...new Set(filteredPeople.map(p => p.household_id).filter(Boolean))];
    let households = [];
    if (householdIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT * FROM households WHERE id = ANY($1::uuid[])`,
        [householdIds]
      );
      households = rows;
    }

    res.json({ people: filteredPeople, relationships: graphRelationships, households });
  } catch (error) {
    console.error('Universe members endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/galaxy/:personId', requireAuth, async (req, res) => {
  try {
    const { personId } = req.params;

    const centerResult = await pool.query(`SELECT ${SAFE_PERSON_COLS} FROM people WHERE id = $1`, [personId]);
    if (centerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }
    const centerPerson = centerResult.rows[0];

    const relResult = await pool.query(`
      SELECT r.*, 
        p.id AS related_id, p.name, p.nickname, p.photo_url, p.birth_date, p.birth_year,
        p.death_date, p.role_type, p.is_deceased, p.is_memorial, p.memorial_date,
        p.star_profile, p.star_pattern, p.star_intensity, p.star_flare_count,
        p.privacy_level, p.about, p.household_id, p.user_id
      FROM relationships r
      JOIN people p ON p.id = CASE WHEN r.person_id = $1 THEN r.related_person_id ELSE r.person_id END
      WHERE (r.person_id = $1 OR r.related_person_id = $1)
        AND (CASE WHEN r.person_id = $1 THEN r.status_from_person ELSE r.status_from_related END) IN ('confirmed', 'claimed')
      ORDER BY CASE WHEN r.person_id = $1 THEN 0 ELSE 1 END
    `, [personId]);

    const hiddenResult = await pool.query(
      'SELECT relationship_id FROM relationship_visibility WHERE user_id = $1 AND is_visible = false',
      [req.session.userId]
    );
    const hiddenRelIds = new Set(hiddenResult.rows.map(r => r.relationship_id));

    const rings = [
      { ring: 1, people: [] },
      { ring: 2, people: [] },
      { ring: 3, people: [] },
      { ring: 4, people: [] }
    ];

    const edges = [];
    const seenPersonIds = new Set();

    for (const row of relResult.rows) {
      if (hiddenRelIds.has(row.id)) continue;
      if (seenPersonIds.has(row.related_id)) continue;
      seenPersonIds.add(row.related_id);

      const isCenterPerson = row.person_id === personId;
      const effectiveType = isCenterPerson
        ? row.relationship_type
        : (RECIPROCAL_TYPES[row.relationship_type] || row.relationship_type);

      const ring = getRing(effectiveType);

      let person;
      if (row.privacy_level === 'private' && row.user_id !== req.session.userId) {
        person = {
          id: row.related_id,
          name: row.name,
          privacy_level: 'private'
        };
      } else {
        person = {
          id: row.related_id,
          name: row.name,
          nickname: row.nickname,
          photo_url: row.photo_url,
          birth_date: row.birth_date,
          birth_year: row.birth_year,
          death_date: row.death_date,
          role_type: row.role_type,
          is_deceased: row.is_deceased,
          is_memorial: row.is_memorial,
          memorial_date: row.memorial_date,
          star_profile: row.star_profile,
          star_pattern: row.star_pattern,
          star_intensity: row.star_intensity,
          star_flare_count: row.star_flare_count,
          privacy_level: row.privacy_level,
          about: row.about,
          household_id: row.household_id,
          user_id: row.user_id
        };
      }

      const confirmationStatus = isCenterPerson
        ? row.status_from_person
        : row.status_from_related;

      const relationship = {
        id: row.id,
        relationship_type: effectiveType,
        subtype: row.subtype,
        status_from_person: isCenterPerson ? row.status_from_person : row.status_from_related,
        status_from_related: isCenterPerson ? row.status_from_related : row.status_from_person
      };

      rings[ring - 1].people.push({ person, relationship });

      edges.push({
        from: personId,
        to: row.related_id,
        relationship_type: effectiveType,
        status: confirmationStatus === 'confirmed' ? 'confirmed' :
                confirmationStatus === 'pending' ? 'pending' : 'claimed'
      });
    }

    res.json({ centerPerson, rings, edges });
  } catch (error) {
    console.error('Galaxy endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/verify/:relationshipId', requireAuth, async (req, res) => {
  try {
    const { relationshipId } = req.params;
    const { action } = req.body;

    if (!['confirm', 'deny'].includes(action)) {
      return res.status(400).json({ error: 'Action must be confirm or deny' });
    }

    const personResult = await pool.query(
      'SELECT id FROM people WHERE user_id = $1',
      [req.session.userId]
    );
    if (personResult.rows.length === 0) {
      return res.status(403).json({ error: 'No person record linked to your account' });
    }
    const myPersonId = personResult.rows[0].id;

    const relResult = await pool.query('SELECT * FROM relationships WHERE id = $1', [relationshipId]);
    if (relResult.rows.length === 0) {
      return res.status(404).json({ error: 'Relationship not found' });
    }
    const rel = relResult.rows[0];

    const isTarget = rel.related_person_id === myPersonId;
    if (!isTarget) {
      return res.status(403).json({ error: 'You can only verify relationships that target you' });
    }

    if (action === 'confirm') {
      await pool.query(
        'UPDATE relationships SET status_from_related = $1 WHERE id = $2',
        ['confirmed', relationshipId]
      );

      const reciprocalType = RECIPROCAL_TYPES[rel.relationship_type] || rel.relationship_type;
      const reciprocal = await pool.query(
        'SELECT id FROM relationships WHERE person_id = $1 AND related_person_id = $2 AND relationship_type = $3',
        [myPersonId, rel.person_id, reciprocalType]
      );

      if (reciprocal.rows.length > 0) {
        await pool.query(
          'UPDATE relationships SET status_from_person = $1, status_from_related = $2 WHERE id = $3',
          ['confirmed', 'confirmed', reciprocal.rows[0].id]
        );
      }
    } else {
      await pool.query(
        'UPDATE relationships SET status_from_related = $1 WHERE id = $2',
        ['denied', relationshipId]
      );

      const reciprocalType = RECIPROCAL_TYPES[rel.relationship_type] || rel.relationship_type;
      const reciprocal = await pool.query(
        'SELECT id FROM relationships WHERE person_id = $1 AND related_person_id = $2 AND relationship_type = $3',
        [myPersonId, rel.person_id, reciprocalType]
      );

      if (reciprocal.rows.length > 0) {
        await pool.query(
          'UPDATE relationships SET status_from_person = $1 WHERE id = $2',
          ['denied', reciprocal.rows[0].id]
        );
      }
    }

    if (action === 'confirm') {
      rescoreNeighbors(rel.person_id).catch(err => console.error('[ScoringTrigger] rescoreNeighbors error:', err.message));
      rescoreNeighbors(rel.related_person_id).catch(err => console.error('[ScoringTrigger] rescoreNeighbors error:', err.message));
    }

    res.json({ message: `Relationship ${action}ed successfully` });
  } catch (error) {
    console.error('Verify relationship error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/pending', requireAuth, async (req, res) => {
  try {
    const personResult = await pool.query(
      'SELECT id FROM people WHERE user_id = $1',
      [req.session.userId]
    );
    if (personResult.rows.length === 0) {
      return res.json([]);
    }
    const myPersonId = personResult.rows[0].id;

    const result = await pool.query(`
      SELECT r.*, p.name AS from_person_name, p.photo_url AS from_person_photo
      FROM relationships r
      JOIN people p ON p.id = r.person_id
      WHERE r.related_person_id = $1
        AND r.status_from_related = 'pending'
    `, [myPersonId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Pending relationships error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/inferred/:personId', requireAuth, async (req, res) => {
  try {
    const { personId } = req.params;
    const userId = req.session.userId;

    const personResult = await pool.query(`SELECT id, user_id FROM people WHERE id = $1 AND merged_into_id IS NULL`, [personId]);
    if (personResult.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const myPersonResult = await pool.query(`SELECT id FROM people WHERE user_id = $1`, [userId]);
    const myPersonId = myPersonResult.rows[0]?.id;
    if (!myPersonId) {
      return res.status(403).json({ error: 'No person profile linked to your account' });
    }

    if (personResult.rows[0].user_id !== userId) {
      const relCheck = await pool.query(
        `SELECT 1 FROM relationships WHERE person_id = $1 AND related_person_id = $2 AND status_from_person IN ('confirmed', 'claimed') LIMIT 1`,
        [myPersonId, personId]
      );
      const adminCheck = await pool.query(`SELECT role FROM users WHERE id = $1`, [userId]);
      if (relCheck.rows.length === 0 && adminCheck.rows[0]?.role !== 'admin') {
        return res.status(403).json({ error: 'You can only view inferred relationships for yourself or people you are connected to' });
      }
    }

    const inferred = await inferRelationships(personId);
    res.json(inferred);
  } catch (error) {
    console.error('Inferred relationships error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
