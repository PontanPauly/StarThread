import { pool } from './db/index.js';
import { computeMatchScore, findCandidates } from './identityScoring.js';

const MIN_SCORE_THRESHOLD = 20;

async function upsertSuggestion(userId, suggestedPersonId, score, confidence, explanations, breakdown) {
  if (score < MIN_SCORE_THRESHOLD || confidence === 'none') return;

  const explanationsArray = Array.isArray(explanations) ? explanations : [];
  await pool.query(`
    INSERT INTO person_match_suggestions (user_id, suggested_person_id, score, confidence, explanations, breakdown)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (user_id, suggested_person_id)
    DO UPDATE SET score = EXCLUDED.score, confidence = EXCLUDED.confidence,
                  explanations = EXCLUDED.explanations, breakdown = EXCLUDED.breakdown,
                  updated_at = NOW()
    WHERE person_match_suggestions.status = 'pending'
  `, [userId, suggestedPersonId, score, confidence, explanationsArray, JSON.stringify(breakdown)]);
}

async function getConfirmedContextPersonIds(personId) {
  const { rows } = await pool.query(`
    SELECT CASE WHEN person_id = $1 THEN related_person_id ELSE person_id END AS related_id
    FROM relationships
    WHERE (person_id = $1 OR related_person_id = $1)
      AND status_from_person IN ('confirmed', 'claimed')
      AND status_from_related IN ('confirmed', 'claimed')
    LIMIT 50
  `, [personId]);
  return rows.map(r => r.related_id);
}

export async function scoreNewPerson(personId) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM people WHERE id = $1 AND merged_into_id IS NULL`, [personId]
    );
    if (rows.length === 0) return;
    const person = rows[0];

    if (person.user_id) {
      rescoreForUser(person.user_id).catch(err =>
        console.error('[ScoringTrigger] scoreNewPerson->rescoreForUser error:', err.message)
      );
      return;
    }

    const personSignals = {
      name: person.name,
      first_name: person.first_name,
      last_name: person.last_name,
    };

    const candidates = await findCandidates(personSignals, {
      excludeIds: [personId],
      limit: 50,
      unclaimedOnly: false,
    });

    const claimedCandidates = candidates.filter(c => c.user_id);

    const seenUserIds = new Set();

    for (const candidate of claimedCandidates) {
      if (seenUserIds.has(candidate.user_id)) continue;
      seenUserIds.add(candidate.user_id);

      const { rows: userRows } = await pool.query(
        `SELECT id, email, full_name FROM users WHERE id = $1`, [candidate.user_id]
      );
      if (userRows.length === 0) continue;
      const user = userRows[0];

      const userContextIds = await getConfirmedContextPersonIds(candidate.id);
      const userSignals = {
        name: user.full_name,
        email: user.email,
        context_person_ids: userContextIds,
      };

      const result = await computeMatchScore(person, userSignals);
      if (result.score >= MIN_SCORE_THRESHOLD) {
        await upsertSuggestion(candidate.user_id, personId, result.score, result.confidence, result.explanations, result.breakdown);
      }
    }

    const seenUserIdsArr = Array.from(seenUserIds);
    const { rows: allUsers } = seenUserIdsArr.length > 0
      ? await pool.query(`
        SELECT u.id AS user_id, u.email, u.full_name, p.id AS person_id
        FROM users u
        LEFT JOIN people p ON p.user_id = u.id
        WHERE u.id != ALL($1::uuid[])
      `, [seenUserIdsArr])
      : await pool.query(`
        SELECT u.id AS user_id, u.email, u.full_name, p.id AS person_id
        FROM users u
        LEFT JOIN people p ON p.user_id = u.id
      `);

    for (const user of allUsers) {
      const userContextIds = user.person_id ? await getConfirmedContextPersonIds(user.person_id) : [];
      const userSignals = {
        name: user.full_name,
        email: user.email,
        context_person_ids: userContextIds,
      };

      const result = await computeMatchScore(person, userSignals);
      if (result.score >= MIN_SCORE_THRESHOLD) {
        await upsertSuggestion(user.user_id, personId, result.score, result.confidence, result.explanations, result.breakdown);
      }
    }
  } catch (err) {
    console.error('[ScoringTrigger] scoreNewPerson error:', err.message);
  }
}

export async function rescorePerson(personId) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM people WHERE id = $1 AND merged_into_id IS NULL`, [personId]
    );
    if (rows.length === 0) return;
    const person = rows[0];

    if (person.user_id) return;

    const { rows: allUsers } = await pool.query(`
      SELECT u.id AS user_id, u.email, u.full_name, p.id AS person_id
      FROM users u
      LEFT JOIN people p ON p.user_id = u.id
    `);

    for (const user of allUsers) {
      const userContextIds = user.person_id ? await getConfirmedContextPersonIds(user.person_id) : [];
      const signals = {
        name: user.full_name,
        email: user.email,
        context_person_ids: userContextIds,
      };

      const result = await computeMatchScore(person, signals);
      if (result.score >= MIN_SCORE_THRESHOLD) {
        await upsertSuggestion(user.user_id, personId, result.score, result.confidence, result.explanations, result.breakdown);
      }
    }
  } catch (err) {
    console.error('[ScoringTrigger] rescorePerson error:', err.message);
  }
}

export async function rescoreNeighbors(personId) {
  try {
    const neighborIds = await getConfirmedContextPersonIds(personId);

    if (neighborIds.length === 0) return;

    const { rows: unclaimed } = await pool.query(
      `SELECT id FROM people WHERE id = ANY($1::uuid[]) AND user_id IS NULL AND merged_into_id IS NULL`,
      [neighborIds]
    );

    for (const row of unclaimed) {
      await rescorePerson(row.id);
    }
  } catch (err) {
    console.error('[ScoringTrigger] rescoreNeighbors error:', err.message);
  }
}

export async function rescoreForUser(userId) {
  try {
    const { rows: userRows } = await pool.query(
      `SELECT id, email, full_name FROM users WHERE id = $1`, [userId]
    );
    if (userRows.length === 0) return;
    const user = userRows[0];

    const { rows: existingPerson } = await pool.query(
      `SELECT id FROM people WHERE user_id = $1`, [userId]
    );

    const userContextIds = existingPerson.length > 0
      ? await getConfirmedContextPersonIds(existingPerson[0].id)
      : [];

    const signals = {
      name: user.full_name,
      first_name: user.full_name?.split(' ')[0],
      last_name: user.full_name?.split(' ').slice(1).join(' '),
      email: user.email,
      context_person_ids: userContextIds,
    };

    const candidates = await findCandidates(signals, { unclaimedOnly: true, limit: 25 });

    for (const candidate of candidates) {
      const result = await computeMatchScore(candidate, signals);
      await upsertSuggestion(userId, candidate.id, result.score, result.confidence, result.explanations, result.breakdown);
    }
  } catch (err) {
    console.error('[ScoringTrigger] rescoreForUser error:', err.message);
  }
}

export async function periodicRescore() {
  try {
    console.log('[ScoringTrigger] Starting periodic re-score...');

    const { rows: pendingSuggestions } = await pool.query(`
      SELECT DISTINCT ON (s.user_id, s.suggested_person_id) s.user_id, s.suggested_person_id
      FROM person_match_suggestions s
      JOIN people p ON p.id = s.suggested_person_id
      WHERE s.status = 'pending'
        AND p.user_id IS NULL
        AND p.merged_into_id IS NULL
        AND s.score < 75
    `);

    let updated = 0;
    for (const suggestion of pendingSuggestions) {
      const { rows: personRows } = await pool.query(
        `SELECT * FROM people WHERE id = $1`, [suggestion.suggested_person_id]
      );
      if (personRows.length === 0) continue;

      const { rows: userRows } = await pool.query(
        `SELECT u.id, u.email, u.full_name, p.id AS person_id
         FROM users u LEFT JOIN people p ON p.user_id = u.id
         WHERE u.id = $1`, [suggestion.user_id]
      );
      if (userRows.length === 0) continue;

      const user = userRows[0];
      const contextIds = user.person_id ? await getConfirmedContextPersonIds(user.person_id) : [];
      const signals = {
        name: user.full_name,
        email: user.email,
        context_person_ids: contextIds,
      };

      const result = await computeMatchScore(personRows[0], signals);
      await upsertSuggestion(suggestion.user_id, suggestion.suggested_person_id, result.score, result.confidence, result.explanations, result.breakdown);
      updated++;
    }

    console.log(`[ScoringTrigger] Periodic re-score complete. Updated ${updated} suggestions.`);
  } catch (err) {
    console.error('[ScoringTrigger] periodicRescore error:', err.message);
  }
}

export async function scoreFamilySuggestions(userId) {
  try {
    const { rows: personRows } = await pool.query(
      `SELECT id FROM people WHERE user_id = $1`, [userId]
    );
    if (personRows.length === 0) return [];

    const myPersonId = personRows[0].id;

    const familyIds = await getConfirmedContextPersonIds(myPersonId);
    if (familyIds.length === 0) return [];

    const { rows: suggestions } = await pool.query(`
      SELECT s.*, p.name, p.first_name, p.last_name, p.photo_url, p.role_type,
             p.birth_year, p.city, p.state,
             fp.name AS for_family_member_name, fp.id AS for_family_member_id
      FROM person_match_suggestions s
      JOIN people p ON p.id = s.suggested_person_id
      JOIN people fp ON fp.user_id = s.user_id
      WHERE s.user_id IN (
        SELECT user_id FROM people WHERE id = ANY($1::uuid[]) AND user_id IS NOT NULL
      )
        AND s.status = 'pending'
        AND p.user_id IS NULL
        AND p.merged_into_id IS NULL
        AND s.user_id != $2
      ORDER BY s.score DESC
      LIMIT 10
    `, [familyIds, userId]);

    return suggestions;
  } catch (err) {
    console.error('[ScoringTrigger] scoreFamilySuggestions error:', err.message);
    return [];
  }
}
