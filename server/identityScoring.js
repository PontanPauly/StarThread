import { pool } from './db/index.js';

function levenshteinDistance(a, b) {
  if (!a || !b) return a?.length || b?.length || 0;
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = a[i - 1] === b[j - 1]
        ? matrix[i - 1][j - 1]
        : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
    }
  }
  return matrix[a.length][b.length];
}

function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 0;
  const dist = levenshteinDistance(la, lb);
  return Math.max(0, 1 - dist / maxLen);
}

function scoreNameMatch(candidate, signals) {
  const scores = [];

  if (signals.first_name && candidate.first_name) {
    scores.push(nameSimilarity(signals.first_name, candidate.first_name) * 1.2);
  }
  if (signals.last_name && candidate.last_name) {
    scores.push(nameSimilarity(signals.last_name, candidate.last_name) * 1.2);
  }
  if (signals.name && candidate.name) {
    scores.push(nameSimilarity(signals.name, candidate.name));
  }
  if (signals.first_name && candidate.nickname) {
    scores.push(nameSimilarity(signals.first_name, candidate.nickname) * 0.8);
  }
  if (signals.name && candidate.nickname) {
    scores.push(nameSimilarity(signals.name, candidate.nickname) * 0.7);
  }

  if (scores.length === 0) return 0;
  return Math.min(1, Math.max(...scores));
}

function scoreEmailMatch(candidate, signals) {
  if (!signals.email || !candidate.linked_user_email) return 0;
  if (signals.email.toLowerCase() === candidate.linked_user_email.toLowerCase()) return 1;
  const signalDomain = signals.email.split('@')[1];
  const candDomain = candidate.linked_user_email.split('@')[1];
  if (signalDomain && candDomain && signalDomain === candDomain) return 0.2;
  return 0;
}

function scoreBirthYear(candidate, signals) {
  const sigYear = signals.birth_year || signals.birthYear;
  if (!sigYear) return 0;
  const candYear = candidate.birth_year || (candidate.birth_date ? new Date(candidate.birth_date).getFullYear() : null);
  if (!candYear) return 0;
  const diff = Math.abs(sigYear - candYear);
  if (diff === 0) return 1;
  if (diff === 1) return 0.8;
  if (diff === 2) return 0.5;
  return 0;
}

function scoreLocation(candidate, signals) {
  if (!signals.city && !signals.state) return 0;
  const candCity = (candidate.city || '').toLowerCase().trim();
  const candState = (candidate.state || '').toLowerCase().trim();
  const sigCity = (signals.city || '').toLowerCase().trim();
  const sigState = (signals.state || '').toLowerCase().trim();

  if (sigCity && candCity && sigCity === candCity && sigState && candState && sigState === candState) return 1;
  if (sigState && candState && sigState === candState) return 0.5;
  if (sigCity && candCity && sigCity === candCity) return 0.7;
  return 0;
}

async function scoreFamilyCluster(candidate, signals) {
  if (!signals.context_person_ids || signals.context_person_ids.length === 0) return { score: 0, connectedNames: [] };

  const { rows } = await pool.query(`
    SELECT DISTINCT p.name
    FROM relationships r
    JOIN people p ON p.id = r.person_id OR p.id = r.related_person_id
    WHERE (r.person_id = $1 OR r.related_person_id = $1)
      AND (r.person_id = ANY($2::uuid[]) OR r.related_person_id = ANY($2::uuid[]))
      AND r.status_from_person IN ('confirmed', 'claimed')
  `, [candidate.id, signals.context_person_ids]);

  if (rows.length === 0) {
    if (signals.context_person_ids.length > 0 && candidate.household_id) {
      const hhCheck = await pool.query(
        `SELECT 1 FROM people WHERE id = ANY($1::uuid[]) AND household_id = $2 LIMIT 1`,
        [signals.context_person_ids, candidate.household_id]
      );
      if (hhCheck.rows.length > 0) return { score: 0.3, connectedNames: [] };
    }
    return { score: 0, connectedNames: [] };
  }

  const connectedNames = rows.map(r => r.name);
  return { score: Math.min(1, rows.length * 0.5), connectedNames };
}

async function scoreParentSpouseOverlap(candidate, signals) {
  if (!signals.context_person_ids || signals.context_person_ids.length === 0) return 0;

  const { rows } = await pool.query(`
    SELECT 1 FROM relationships
    WHERE (person_id = $1 OR related_person_id = $1)
      AND (person_id = ANY($2::uuid[]) OR related_person_id = ANY($2::uuid[]))
      AND relationship_type IN ('parent', 'child', 'spouse', 'partner')
      AND status_from_person IN ('confirmed', 'claimed')
    LIMIT 1
  `, [candidate.id, signals.context_person_ids]);

  return rows.length > 0 ? 1 : 0;
}

const WEIGHTS = {
  name: 35,
  email: 25,
  birthYear: 15,
  location: 10,
  familyCluster: 10,
  relationships: 5,
};

export async function computeMatchScore(candidate, signals) {
  const nameScore = scoreNameMatch(candidate, signals);
  const emailScore = scoreEmailMatch(candidate, signals);
  const birthYearScore = scoreBirthYear(candidate, signals);
  const locationScore = scoreLocation(candidate, signals);
  const clusterResult = await scoreFamilyCluster(candidate, signals);
  const relScore = await scoreParentSpouseOverlap(candidate, signals);

  const breakdown = {
    name: Math.round(nameScore * 100),
    email: Math.round(emailScore * 100),
    birthYear: Math.round(birthYearScore * 100),
    location: Math.round(locationScore * 100),
    familyCluster: Math.round(clusterResult.score * 100),
    relationships: Math.round(relScore * 100),
  };

  let totalScore = (
    nameScore * WEIGHTS.name +
    emailScore * WEIGHTS.email +
    birthYearScore * WEIGHTS.birthYear +
    locationScore * WEIGHTS.location +
    clusterResult.score * WEIGHTS.familyCluster +
    relScore * WEIGHTS.relationships
  );

  if (emailScore === 1) {
    totalScore = Math.max(totalScore, 95);
  }

  totalScore = Math.round(Math.min(100, totalScore));

  const explanations = [];
  if (nameScore >= 0.9) {
    explanations.push('Same full name');
  } else if (nameScore >= 0.6) {
    explanations.push('Similar name');
  }
  if (emailScore === 1) {
    explanations.push('Invited by email');
  }
  if (birthYearScore === 1) {
    explanations.push('Same birth year');
  } else if (birthYearScore > 0) {
    explanations.push('Similar birth year');
  }
  if (locationScore >= 0.7) {
    explanations.push(`Same city`);
  } else if (locationScore >= 0.5) {
    explanations.push('Same state');
  }
  if (clusterResult.connectedNames.length > 0) {
    const names = clusterResult.connectedNames.slice(0, 3).join(' and ');
    explanations.push(`Connected to ${names}`);
  }
  if (relScore > 0) {
    explanations.push('Shares a close family connection');
  }

  let confidence;
  if (totalScore >= 75) confidence = 'high';
  else if (totalScore >= 45) confidence = 'medium';
  else if (totalScore >= 20) confidence = 'low';
  else confidence = 'none';

  return { score: totalScore, breakdown, confidence, explanations };
}

export async function findCandidates(signals, options = {}) {
  const { excludeIds = [], limit = 25, unclaimedOnly = false } = options;

  let query;
  const params = [];
  let paramIdx = 1;

  const searchName = signals.name || [signals.first_name, signals.last_name].filter(Boolean).join(' ');

  if (searchName && searchName.length >= 2) {
    const likeTerm = `%${searchName}%`;
    query = `
      SELECT id, name, first_name, last_name, nickname, role_type, photo_url,
             birth_date, birth_year, city, state, household_id, user_id, linked_user_email,
             is_deceased, is_memorial, merged_into_id
      FROM people
      WHERE merged_into_id IS NULL
        AND (
          LOWER(name) LIKE LOWER($${paramIdx})
          OR LOWER(first_name) LIKE LOWER($${paramIdx})
          OR LOWER(last_name) LIKE LOWER($${paramIdx})
          OR LOWER(nickname) LIKE LOWER($${paramIdx})
          OR similarity(name, $${paramIdx + 1}) > 0.2
        )
    `;
    params.push(likeTerm, searchName);
    paramIdx += 2;
  } else {
    return [];
  }

  if (excludeIds.length > 0) {
    query += ` AND id != ALL($${paramIdx}::uuid[])`;
    params.push(excludeIds);
    paramIdx++;
  }

  if (unclaimedOnly) {
    query += ` AND user_id IS NULL AND is_deceased = false`;
  }

  query += ` ORDER BY similarity(name, $2) DESC LIMIT $${paramIdx}`;
  params.push(limit);

  try {
    const { rows } = await pool.query(query, params);
    return rows;
  } catch (err) {
    if (err.message && err.message.includes('similarity')) {
      const fallbackParams = [`%${nameQuery}%`];
      let fbParamIdx = 2;
      let excludeClause = '';
      if (excludeIds.length > 0) {
        excludeClause = `AND id != ALL($${fbParamIdx}::uuid[])`;
        fallbackParams.push(excludeIds);
        fbParamIdx++;
      }
      const fallbackQuery = `
        SELECT id, name, first_name, last_name, nickname, role_type, photo_url,
               birth_date, birth_year, city, state, household_id, user_id, linked_user_email,
               is_deceased, is_memorial, merged_into_id
        FROM people
        WHERE merged_into_id IS NULL
          AND (
            LOWER(name) LIKE LOWER($1)
            OR LOWER(first_name) LIKE LOWER($1)
            OR LOWER(last_name) LIKE LOWER($1)
            OR LOWER(nickname) LIKE LOWER($1)
          )
          ${excludeClause}
          ${unclaimedOnly ? 'AND user_id IS NULL AND is_deceased = false' : ''}
        ORDER BY name ASC
        LIMIT ${limit}
      `;
      const { rows } = await pool.query(fallbackQuery, fallbackParams);
      return rows;
    }
    throw err;
  }
}
