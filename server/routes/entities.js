import express from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { sendAccountReadyEmail } from '../email.js';
import { scoreNewPerson, rescorePerson, rescoreForUser, rescoreNeighbors } from '../scoringTriggers.js';

const router = express.Router();

function formatProperName(name) {
  if (!name || typeof name !== 'string') return name;
  return name.trim().split(/\s+/).map(word => {
    if (/^[A-Z][a-z]+[A-Z]/.test(word)) return word;
    if (word.includes('-')) {
      return word.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('-');
    }
    if (word.includes("'") || word.includes("\u2019")) {
      return word.split(/('+|\u2019+)/).map(part => {
        if (part === "'" || part === "\u2019" || !part) return part;
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }).join('');
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

const entityLimiter = rateLimit({
  windowMs: 60000,
  max: 100,
  validate: { xForwardedForHeader: false }
});

router.use(entityLimiter);

const SYSTEM_ADMIN_ONLY = ['family_settings'];

function computeAgeFromDate(dateStr) {
  const bd = new Date(dateStr + 'T00:00:00');
  if (isNaN(bd.getTime())) return null;
  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let age = todayLocal.getFullYear() - bd.getFullYear();
  const monthDiff = todayLocal.getMonth() - bd.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && todayLocal.getDate() < bd.getDate())) age--;
  return age;
}

function roleFromAge(age) {
  if (age === null) return null;
  if (age >= 18) return 'adult';
  if (age >= 13) return 'teen';
  return 'child';
}

function syncRoleFromBirthDate(data, existingRoleType) {
  if (!data.birth_date) return;
  const effectiveRole = existingRoleType || data.role_type;
  if (effectiveRole === 'ancestor') return;
  const age = computeAgeFromDate(data.birth_date);
  const role = roleFromAge(age);
  if (role) data.role_type = role;
}

async function autoCreateGalaxyIfNeeded(person) {
  if (person.role_type !== 'adult') return person;
  if (person.is_deceased || person.is_memorial) return person;

  let needsOwnGalaxy = !person.household_id;

  if (!needsOwnGalaxy && person.household_id) {
    const { rows: parentRels } = await pool.query(
      `SELECT 1 FROM relationships
       WHERE relationship_type = 'child' AND person_id = $1
         AND related_person_id IN (SELECT id FROM people WHERE household_id = $2 AND id != $1)
       LIMIT 1`,
      [person.id, person.household_id]
    );
    if (parentRels.length > 0) {
      needsOwnGalaxy = true;
    }
  }

  if (!needsOwnGalaxy) return person;

  try {
    const householdName = `${person.name} Galaxy`;
    const { rows: newH } = await pool.query(
      `INSERT INTO households (name) VALUES ($1) RETURNING id`,
      [householdName]
    );
    if (newH.length > 0) {
      await pool.query(
        `UPDATE people SET household_id = $1 WHERE id = $2`,
        [newH[0].id, person.id]
      );
      person.household_id = newH[0].id;
      console.log(`Auto-created galaxy "${householdName}" for ${person.name}`);
    }
  } catch (err) {
    console.error('Auto-galaxy creation failed:', err.message);
  }
  return person;
}

// ---------------------------------------------------------------------------
// Row-Level Security helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the current session user's person_id.
 * Returns null if the user has no linked person record.
 */
async function getMyPersonId(userId) {
  const { rows } = await pool.query('SELECT id FROM people WHERE user_id = $1 LIMIT 1', [userId]);
  return rows.length > 0 ? rows[0].id : null;
}

/**
 * Returns a { whereClause, params, paramOffset } object that should be
 * AND-appended to any query on the given table, or null if no extra
 * scoping is needed for that table.
 *
 * paramOffset is the index of the NEXT $N placeholder to use (1-based).
 */
async function buildRlsClause(table, userId, existingParamCount = 0) {
  const myPersonId = await getMyPersonId(userId);
  if (!myPersonId) return null;

  const offset = existingParamCount;

  switch (table) {
    case 'messages': {
      // Only messages belonging to conversations the user is a participant in
      return {
        whereClause: `conversation_id IN (
          SELECT id FROM conversations WHERE participant_ids @> ARRAY[$${offset + 1}::uuid]
        )`,
        params: [myPersonId],
      };
    }
    case 'love_notes': {
      return {
        whereClause: `(from_person_id = $${offset + 1} OR to_person_id = $${offset + 2})`,
        params: [myPersonId, myPersonId],
      };
    }
    case 'conversations': {
      return {
        whereClause: `participant_ids @> ARRAY[$${offset + 1}::uuid]`,
        params: [myPersonId],
      };
    }
    case 'packing_items': {
      return {
        whereClause: `(person_id = $${offset + 1} OR trip_id IN (
          SELECT trip_id FROM trip_participants WHERE person_id = $${offset + 2}
        ))`,
        params: [myPersonId, myPersonId],
      };
    }
    case 'shared_trip_items': {
      return {
        whereClause: `trip_id IN (
          SELECT trip_id FROM trip_participants WHERE person_id = $${offset + 1}
        )`,
        params: [myPersonId],
      };
    }
    case 'invite_links': {
      return {
        whereClause: `created_by_person_id = $${offset + 1}`,
        params: [myPersonId],
      };
    }
    case 'people': {
      return {
        whereClause: `(
          user_id = $${offset + 1}
          OR id = $${offset + 2}
          OR id IN (
            SELECT related_person_id FROM relationships
            WHERE person_id = $${offset + 3}
              AND status_from_person IN ('confirmed', 'claimed')
            UNION
            SELECT person_id FROM relationships
            WHERE related_person_id = $${offset + 4}
              AND status_from_person IN ('confirmed', 'claimed')
          )
          OR privacy_level = 'public'
        )`,
        params: [userId, myPersonId, myPersonId, myPersonId],
      };
    }
    default:
      return null;
  }
}

async function verifyWriteOwnership(table, recordId, userId, updates = null) {
  const myPersonId = await getMyPersonId(userId);
  if (!myPersonId && table !== 'people') return false;

  switch (table) {
    case 'messages': {
      const { rows } = await pool.query(
        `SELECT id FROM messages WHERE id = $1 AND conversation_id IN (
          SELECT id FROM conversations WHERE participant_ids @> ARRAY[$2::uuid]
        )`, [recordId, myPersonId]
      );
      return rows.length > 0;
    }
    case 'love_notes': {
      const { rows } = await pool.query(
        'SELECT id FROM love_notes WHERE id = $1 AND from_person_id = $2',
        [recordId, myPersonId]
      );
      return rows.length > 0;
    }
    case 'conversations': {
      const { rows } = await pool.query(
        'SELECT id FROM conversations WHERE id = $1 AND participant_ids @> ARRAY[$2::uuid]',
        [recordId, myPersonId]
      );
      return rows.length > 0;
    }
    case 'packing_items': {
      const { rows } = await pool.query(
        `SELECT id FROM packing_items WHERE id = $1 AND (person_id = $2 OR trip_id IN (
          SELECT trip_id FROM trip_participants WHERE person_id = $3
        ))`, [recordId, myPersonId, myPersonId]
      );
      return rows.length > 0;
    }
    case 'shared_trip_items': {
      const { rows } = await pool.query(
        `SELECT id FROM shared_trip_items WHERE id = $1 AND trip_id IN (
          SELECT trip_id FROM trip_participants WHERE person_id = $2
        )`, [recordId, myPersonId]
      );
      return rows.length > 0;
    }
    case 'trips': {
      const { rows } = await pool.query(
        `SELECT id FROM trips WHERE id = $1 AND $2 = ANY(planner_ids)`,
        [recordId, myPersonId]
      );
      return rows.length > 0;
    }
    case 'trip_participants': {
      const { rows } = await pool.query(
        `SELECT tp.id FROM trip_participants tp
         JOIN trips t ON t.id = tp.trip_id
         WHERE tp.id = $1 AND $2 = ANY(t.planner_ids)`,
        [recordId, myPersonId]
      );
      return rows.length > 0;
    }
    case 'meals':
    case 'rooms':
    case 'activities':
    case 'expenses': {
      const { rows } = await pool.query(
        `SELECT id FROM ${table} WHERE id = $1 AND trip_id IN (
          SELECT id FROM trips WHERE $2 = ANY(planner_ids)
        )`, [recordId, myPersonId]
      );
      return rows.length > 0;
    }
    case 'moments': {
      const { rows } = await pool.query(
        `SELECT id FROM moments WHERE id = $1 AND author_person_id = $2`,
        [recordId, myPersonId]
      );
      return rows.length > 0;
    }
    case 'family_stories': {
      const { rows } = await pool.query(
        `SELECT id FROM family_stories WHERE id = $1 AND (author_person_id = $2 OR $2 = ANY(related_person_ids))`,
        [recordId, myPersonId]
      );
      return rows.length > 0;
    }
    case 'rituals': {
      const { rows } = await pool.query(
        `SELECT id FROM rituals WHERE id = $1 AND $2 = ANY(assigned_person_ids)`,
        [recordId, myPersonId]
      );
      return rows.length > 0;
    }
    case 'trusted_contacts': {
      const { rows } = await pool.query(
        `SELECT id FROM trusted_contacts WHERE id = $1 AND person_id = $2`,
        [recordId, myPersonId]
      );
      return rows.length > 0;
    }
    case 'relationship_visibility': {
      const { rows } = await pool.query(
        `SELECT rv.id FROM relationship_visibility rv
         JOIN relationships r ON r.id = rv.relationship_id
         WHERE rv.id = $1 AND (r.person_id = $2 OR r.related_person_id = $2)`,
        [recordId, myPersonId]
      );
      return rows.length > 0;
    }
    case 'invite_links': {
      const { rows } = await pool.query(
        `SELECT id FROM invite_links WHERE id = $1 AND created_by_person_id = $2`,
        [recordId, myPersonId]
      );
      return rows.length > 0;
    }
    case 'relationships': {
      const { rows } = await pool.query(
        `SELECT id FROM relationships WHERE id = $1 AND (person_id = $2 OR related_person_id = $2)`,
        [recordId, myPersonId]
      );
      return rows.length > 0;
    }
    case 'people': {
      const { rows: userRows } = await pool.query(
        `SELECT id FROM people WHERE id = $1 AND user_id = $2`,
        [recordId, userId]
      );
      if (userRows.length > 0) return true;
      if (!myPersonId && updates && String(updates.user_id) === String(userId)) {
        const { rows: unlinkedRows } = await pool.query(
          `SELECT id FROM people WHERE id = $1 AND user_id IS NULL`,
          [recordId]
        );
        if (unlinkedRows.length > 0) return true;
      }
      const { rows: guardianRows } = await pool.query(
        `SELECT id FROM people WHERE id = $1 AND $2 = ANY(guardian_ids)`,
        [recordId, myPersonId]
      );
      if (guardianRows.length > 0) return true;
      const { rows: creatorRows } = await pool.query(
        `SELECT id FROM people WHERE id = $1 AND (is_deceased = true OR is_memorial = true) AND created_by_user_id = $2`,
        [recordId, userId]
      );
      return creatorRows.length > 0;
    }
    case 'households': {
      const { rows } = await pool.query(
        `SELECT id FROM people WHERE household_id = $1 AND id = $2`,
        [recordId, myPersonId]
      );
      return rows.length > 0;
    }
    default:
      return true;
  }
}

const RLS_WRITE_TABLES = [
  'messages', 'love_notes', 'conversations', 'packing_items', 'shared_trip_items',
  'trips', 'trip_participants', 'meals', 'rooms', 'activities', 'expenses',
  'moments', 'family_stories', 'rituals', 'trusted_contacts',
  'relationship_visibility', 'invite_links', 'people', 'households', 'relationships'
];

async function isSystemAdmin(userId) {
  const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
  return rows.length > 0 && rows[0].role === 'admin';
}

const SOCIAL_PLATFORMS = ['facebook', 'twitter', 'instagram', 'linkedin', 'tiktok', 'youtube'];
const SOCIAL_URL_PATTERNS = {
  facebook: /^https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9._-]+\/?$/,
  twitter: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/?$/,
  instagram: /^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._]+\/?$/,
  linkedin: /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[a-zA-Z0-9._-]+\/?$/,
  tiktok: /^https?:\/\/(www\.)?tiktok\.com\/@[a-zA-Z0-9._-]+\/?$/,
  youtube: /^https?:\/\/(www\.)?(youtube\.com\/(c\/|channel\/|@)?[a-zA-Z0-9._-]+|youtu\.be\/[a-zA-Z0-9._-]+)\/?$/,
};
const SOCIAL_HANDLE_PATTERNS = {
  facebook: /^[a-zA-Z0-9._-]+$/,
  twitter: /^@?[a-zA-Z0-9_]{1,15}$/,
  instagram: /^@?[a-zA-Z0-9._]{1,30}$/,
  linkedin: /^[a-zA-Z0-9._-]+$/,
  tiktok: /^@?[a-zA-Z0-9._-]+$/,
  youtube: /^@?[a-zA-Z0-9._-]+$/,
};

function validateSocialLinks(socialLinks) {
  if (typeof socialLinks !== 'object' || socialLinks === null || Array.isArray(socialLinks)) {
    return 'social_links must be an object';
  }
  for (const [platform, value] of Object.entries(socialLinks)) {
    if (!SOCIAL_PLATFORMS.includes(platform)) {
      return `Unsupported social platform: ${platform}`;
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      return `Invalid value for ${platform}`;
    }
    const trimmed = value.trim();
    const urlPattern = SOCIAL_URL_PATTERNS[platform];
    const handlePattern = SOCIAL_HANDLE_PATTERNS[platform];
    if (!urlPattern.test(trimmed) && !handlePattern.test(trimmed)) {
      return `Invalid ${platform} handle or URL`;
    }
  }
  return null;
}

const entityConfig = {
  Person: {
    table: 'people',
    columns: ['id', 'name', 'first_name', 'middle_name', 'last_name', 'nickname', 'photo_url', 'birth_date', 'birth_year', 'death_date', 'role_type', 'household_id', 'household_status', 'allergies', 'dietary_preferences', 'is_deceased', 'about', 'star_profile', 'guardian_ids', 'star_pattern', 'star_intensity', 'star_flare_count', 'user_id', 'address', 'city', 'state', 'is_memorial', 'memorial_date', 'privacy_level', 'parental_controls', 'onboarding_complete', 'created_by_user_id', 'social_links', 'created_at']
  },
  Trip: {
    table: 'trips',
    columns: ['id', 'name', 'location', 'description', 'start_date', 'end_date', 'cover_image_url', 'planner_ids', 'visibility', 'status', 'created_at']
  },
  Household: {
    table: 'households',
    columns: ['id', 'name', 'description', 'created_at']
  },
  Relationship: {
    table: 'relationships',
    columns: ['id', 'person_id', 'related_person_id', 'relationship_type', 'subtype', 'status_from_person', 'status_from_related', 'created_at']
  },
  TripParticipant: {
    table: 'trip_participants',
    columns: ['id', 'trip_id', 'person_id', 'status', 'room_id']
  },
  Meal: {
    table: 'meals',
    columns: ['id', 'trip_id', 'date', 'meal_type', 'title', 'description', 'chef_ids', 'location', 'notes']
  },
  Room: {
    table: 'rooms',
    columns: ['id', 'trip_id', 'name', 'capacity', 'notes', 'assigned_person_ids']
  },
  Activity: {
    table: 'activities',
    columns: ['id', 'trip_id', 'name', 'date', 'time', 'location', 'description', 'organizer_ids']
  },
  Expense: {
    table: 'expenses',
    columns: ['id', 'trip_id', 'description', 'amount', 'paid_by_person_id', 'category', 'date', 'split_among_ids', 'activity_id']
  },
  PackingItem: {
    table: 'packing_items',
    columns: ['id', 'trip_id', 'person_id', 'item', 'category', 'is_packed']
  },
  SharedTripItem: {
    table: 'shared_trip_items',
    columns: ['id', 'trip_id', 'item', 'assigned_to_person_id', 'is_confirmed']
  },
  Moment: {
    table: 'moments',
    columns: ['id', 'content', 'media_urls', 'media_type', 'trip_id', 'tagged_person_ids', 'captured_date', 'author_person_id', 'created_date']
  },
  LoveNote: {
    table: 'love_notes',
    columns: ['id', 'content', 'from_person_id', 'to_person_id', 'trip_id', 'created_date']
  },
  FamilyStory: {
    table: 'family_stories',
    columns: ['id', 'title', 'content', 'author_person_id', 'related_person_ids', 'era', 'created_date']
  },
  FamilySettings: {
    table: 'family_settings',
    columns: ['id', 'family_name', 'invite_code', 'timezone', 'tagline', 'admin_emails', 'planner_emails', 'created_at']
  },
  FamilySetting: {
    table: 'family_settings',
    columns: ['id', 'family_name', 'invite_code', 'timezone', 'tagline', 'admin_emails', 'planner_emails', 'created_at']
  },
  JoinRequest: {
    table: 'join_requests',
    columns: ['id', 'email', 'message', 'status', 'reviewed_by_email', 'reviewed_at', 'created_at']
  },
  Ritual: {
    table: 'rituals',
    columns: ['id', 'name', 'description', 'frequency', 'assigned_person_ids', 'household_id', 'next_occurrence', 'category', 'typical_month', 'host_rotation', 'current_host_index', 'custom_frequency', 'cover_image_url', 'typical_participant_household_ids', 'created_at']
  },
  Conversation: {
    table: 'conversations',
    columns: ['id', 'participant_ids', 'type', 'name', 'created_date']
  },
  Message: {
    table: 'messages',
    columns: ['id', 'conversation_id', 'from_person_id', 'content', 'media_url', 'is_read', 'created_date']
  },
  TrustedContact: {
    table: 'trusted_contacts',
    columns: ['id', 'person_id', 'trusted_person_id', 'created_at']
  },
  RelationshipVisibility: {
    table: 'relationship_visibility',
    columns: ['id', 'user_id', 'relationship_id', 'is_visible']
  },
  InviteLink: {
    table: 'invite_links',
    columns: ['id', 'code', 'created_by_person_id', 'relationship_type', 'for_person_id', 'created_at', 'expires_at', 'used_by_user_id', 'used_at']
  }
};

const lowercaseMap = {};
for (const [key, config] of Object.entries(entityConfig)) {
  lowercaseMap[key] = config;
  lowercaseMap[config.table] = config;
}

function getConfig(entityType) {
  return lowercaseMap[entityType] || null;
}

function isValidColumn(col) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col);
}

const WRITE_ONLY_COLUMNS = {
  people: ['linked_user_email'],
};

function sanitizeResponse(row, tableName) {
  const writeOnly = WRITE_ONLY_COLUMNS[tableName];
  if (!writeOnly || !row) return row;
  const sanitized = { ...row };
  for (const col of writeOnly) {
    delete sanitized[col];
  }
  return sanitized;
}

const TYPED_COLUMNS = {
  uuid: ['household_id', 'user_id', 'person_id', 'related_person_id', 'trip_id', 'room_id', 'activity_id', 'paid_by_person_id', 'assigned_to_person_id', 'from_person_id', 'to_person_id', 'conversation_id', 'author_person_id', 'confirmed_by_person_id', 'created_by_person_id', 'created_by_user_id', 'used_by_user_id', 'relationship_id', 'trusted_person_id', 'family_plan_id', 'owner_user_id'],
  date: ['birth_date', 'death_date', 'memorial_date', 'start_date', 'end_date', 'date', 'captured_date', 'created_date', 'next_occurrence', 'reviewed_at'],
  integer: ['birth_year', 'star_intensity', 'star_flare_count', 'capacity', 'current_host_index', 'max_seats'],
  boolean: ['is_deceased', 'is_memorial', 'onboarding_complete', 'is_packed', 'is_confirmed', 'is_visible', 'is_read'],
  numeric: ['amount'],
};

function sanitizeTypedValues(data) {
  for (const [key, value] of Object.entries(data)) {
    if (value === '') {
      if (TYPED_COLUMNS.uuid.includes(key) || TYPED_COLUMNS.date.includes(key) || TYPED_COLUMNS.integer.includes(key) || TYPED_COLUMNS.boolean.includes(key) || TYPED_COLUMNS.numeric.includes(key)) {
        data[key] = null;
      }
    }
  }
  return data;
}

function filterColumns(data, allowedColumns, tableName) {
  const writeOnly = WRITE_ONLY_COLUMNS[tableName] || [];
  const filtered = {};
  for (const [key, value] of Object.entries(data)) {
    if ((allowedColumns.includes(key) || writeOnly.includes(key)) && key !== 'id') {
      filtered[key] = value;
    }
  }
  return sanitizeTypedValues(filtered);
}

// ---------------------------------------------------------------------------
// Guardian message view - read-only access to ward's conversations & messages
// ---------------------------------------------------------------------------

async function verifyGuardianOf(guardianPersonId, wardPersonId) {
  const { rows } = await pool.query(
    `SELECT id, role_type FROM people WHERE id = $1 AND $2 = ANY(guardian_ids) AND role_type IN ('teen', 'child')`,
    [wardPersonId, guardianPersonId]
  );
  return rows.length > 0;
}

router.get('/guardian/:wardPersonId/conversations', requireAuth, async (req, res) => {
  try {
    const myPersonId = await getMyPersonId(req.session.userId);
    if (!myPersonId) return res.status(403).json({ error: 'No linked person' });

    const isGuardian = await verifyGuardianOf(myPersonId, req.params.wardPersonId);
    if (!isGuardian) return res.status(403).json({ error: 'Not a guardian of this person' });

    const { rows } = await pool.query(
      `SELECT id, participant_ids, type, name, created_date
       FROM conversations WHERE participant_ids @> ARRAY[$1::uuid]
       ORDER BY created_date DESC`,
      [req.params.wardPersonId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Guardian conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/guardian/:wardPersonId/messages', requireAuth, async (req, res) => {
  try {
    const myPersonId = await getMyPersonId(req.session.userId);
    if (!myPersonId) return res.status(403).json({ error: 'No linked person' });

    const isGuardian = await verifyGuardianOf(myPersonId, req.params.wardPersonId);
    if (!isGuardian) return res.status(403).json({ error: 'Not a guardian of this person' });

    const conversationId = req.query.conversation_id;
    if (!conversationId) return res.status(400).json({ error: 'conversation_id required' });

    const convCheck = await pool.query(
      `SELECT id FROM conversations WHERE id = $1 AND participant_ids @> ARRAY[$2::uuid]`,
      [conversationId, req.params.wardPersonId]
    );
    if (convCheck.rows.length === 0) return res.status(403).json({ error: 'Ward is not in this conversation' });

    const { rows } = await pool.query(
      `SELECT id, conversation_id, from_person_id, content, media_url, is_read, created_date
       FROM messages WHERE conversation_id = $1
       ORDER BY created_date ASC`,
      [conversationId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Guardian messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/guardian/:wardPersonId/linked-email', requireAuth, async (req, res) => {
  try {
    const myPersonId = await getMyPersonId(req.session.userId);
    if (!myPersonId) return res.status(403).json({ error: 'No linked person' });

    const isGuardian = await verifyGuardianOf(myPersonId, req.params.wardPersonId);
    if (!isGuardian) return res.status(403).json({ error: 'Not a guardian of this person' });

    const { rows } = await pool.query(
      `SELECT linked_user_email FROM people WHERE id = $1`,
      [req.params.wardPersonId]
    );
    res.json({ linked_user_email: rows[0]?.linked_user_email || null });
  } catch (error) {
    console.error('Guardian linked-email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// Parental controls feature gating helper
// ---------------------------------------------------------------------------

const FEATURE_TABLE_MAP = {
  messages: 'messaging',
  conversations: 'messaging',
  love_notes: 'love_notes',
  moments: 'moments',
  family_stories: 'stories',
  rituals: 'traditions',
  trips: 'trips',
};

async function checkParentalControlsForCreate(table, userId) {
  const featureKey = FEATURE_TABLE_MAP[table];
  if (!featureKey) return null;

  const myPersonId = await getMyPersonId(userId);
  if (!myPersonId) return null;

  const { rows } = await pool.query(
    `SELECT role_type, parental_controls FROM people WHERE id = $1`,
    [myPersonId]
  );
  if (rows.length === 0) return null;
  const person = rows[0];
  if (person.role_type !== 'teen' && person.role_type !== 'child') return null;

  const controls = person.parental_controls;
  if (!controls) return null;

  if (controls[featureKey] === false) {
    return `This feature is managed by your parent`;
  }
  return null;
}

router.get('/:type', requireAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const config = getConfig(type);
    if (!config) {
      return res.status(403).json({ error: `Entity type '${type}' is not allowed` });
    }

    const rls = await buildRlsClause(config.table, req.session.userId, 0);
    const selectCols = config.columns.join(', ');
    let query = `SELECT ${selectCols} FROM ${config.table}`;
    const params = rls ? [...rls.params] : [];

    if (rls) {
      query += ` WHERE ${rls.whereClause}`;
    }

    if (req.query.sort) {
      const sortFields = req.query.sort.split(',').map(field => {
        const desc = field.startsWith('-');
        const col = desc ? field.substring(1) : field;
        if (!isValidColumn(col) || !config.columns.includes(col)) return null;
        return `${col} ${desc ? 'DESC' : 'ASC'}`;
      }).filter(Boolean);
      if (sortFields.length > 0) {
        query += ` ORDER BY ${sortFields.join(', ')}`;
      }
    }

    if (req.query.limit) {
      params.push(parseInt(req.query.limit, 10));
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows.map(r => sanitizeResponse(r, config.table)));
  } catch (error) {
    console.error('List entities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/Person/search', requireAuth, async (req, res) => {
  try {
    const { q, birth_year, city, state, email, context_person_ids } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ matches: [] });
    }

    const { findCandidates, computeMatchScore } = await import('../identityScoring.js');

    const signals = {
      name: q.trim(),
      first_name: q.trim().split(/\s+/)[0],
      last_name: q.trim().split(/\s+/).length > 1 ? q.trim().split(/\s+/).slice(-1)[0] : null,
      birth_year: birth_year ? parseInt(birth_year) : null,
      city: city || null,
      state: state || null,
      email: email || null,
      context_person_ids: context_person_ids ? context_person_ids.split(',').filter(Boolean) : [],
    };

    const candidates = await findCandidates(signals, { excludeIds: [], limit: 25 });

    const { nameSimilarity } = await import('../identityScoring.js');

    const scored = [];
    for (const candidate of candidates) {
      const result = await computeMatchScore(candidate, signals);
      if (signals.first_name && signals.first_name.length >= 2) {
        const candidateFirst = candidate.first_name || (candidate.name ? candidate.name.split(' ')[0] : '');
        const firstSim = nameSimilarity(signals.first_name, candidateFirst);
        const nickSim = candidate.nickname ? nameSimilarity(signals.first_name, candidate.nickname) : 0;
        const bestFirstSim = Math.max(firstSim, nickSim);
        if (bestFirstSim < 0.5 && result.score < 75) continue;
        if (bestFirstSim >= 0.7 && result.score >= 30) { /* allow strong first-name matches at lower threshold */ }
        else if (result.score < 45) continue;
      } else {
        if (result.score < 45) continue;
      }

      scored.push({
        id: candidate.id,
        name: candidate.name,
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        role_type: candidate.role_type,
        photo_url: candidate.photo_url,
        birth_year: candidate.birth_year,
        city: candidate.city,
        state: candidate.state,
        score: result.score,
        confidence: result.confidence,
        breakdown: result.breakdown,
        explanations: result.explanations,
      });
    }

    scored.sort((a, b) => b.score - a.score);

    res.json({ matches: scored.slice(0, 10) });
  } catch (err) {
    console.error('Person search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/:type/filter', requireAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const config = getConfig(type);
    if (!config) {
      return res.status(403).json({ error: `Entity type '${type}' is not allowed` });
    }

    const filters = { ...req.query };
    delete filters.sort;
    delete filters.limit;

    const conditions = [];
    const params = [];

    // Apply caller-supplied filters first
    Object.entries(filters).forEach(([key, value]) => {
      if (isValidColumn(key) && config.columns.includes(key)) {
        params.push(value);
        conditions.push(`${key} = $${params.length}`);
      }
    });

    // Append RLS clause on top of any caller filters
    const rls = await buildRlsClause(config.table, req.session.userId, params.length);
    if (rls) {
      conditions.push(rls.whereClause);
      params.push(...rls.params);
    }

    const selectCols = config.columns.join(', ');
    let query = `SELECT ${selectCols} FROM ${config.table}`;
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (req.query.sort) {
      const sortFields = req.query.sort.split(',').map(field => {
        const desc = field.startsWith('-');
        const col = desc ? field.substring(1) : field;
        if (!isValidColumn(col) || !config.columns.includes(col)) return null;
        return `${col} ${desc ? 'DESC' : 'ASC'}`;
      }).filter(Boolean);
      if (sortFields.length > 0) {
        query += ` ORDER BY ${sortFields.join(', ')}`;
      }
    }

    if (req.query.limit) {
      params.push(parseInt(req.query.limit, 10));
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows.map(r => sanitizeResponse(r, config.table)));
  } catch (error) {
    console.error('Filter entities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:type', requireAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const config = getConfig(type);
    if (!config) {
      return res.status(403).json({ error: `Entity type '${type}' is not allowed` });
    }

    if (SYSTEM_ADMIN_ONLY.includes(config.table)) {
      const admin = await isSystemAdmin(req.session.userId);
      if (!admin) {
        return res.status(403).json({ error: 'Admin privileges required' });
      }
    }

    const parentalBlock = await checkParentalControlsForCreate(config.table, req.session.userId);
    if (parentalBlock) {
      return res.status(403).json({ error: parentalBlock });
    }

    if (config.table === 'people') {
      const hasName = req.body.name;
      const hasNameParts = req.body.first_name;
      if (!hasName && !hasNameParts) {
        return res.status(400).json({ error: 'Missing required fields: name or first_name' });
      }
    }

    const requiredFields = {
      trips: ['name', 'start_date', 'end_date'],
      love_notes: ['content', 'from_person_id', 'to_person_id']
    };

    if (requiredFields[config.table]) {
      const missing = requiredFields[config.table].filter(f => !req.body[f]);
      if (missing.length > 0) {
        return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
      }
    }

    const myPersonId = await getMyPersonId(req.session.userId);

    if (config.table === 'messages') {
      if (!req.body.content && !req.body.media_url) {
        return res.status(400).json({ error: 'Message must have content or an image' });
      }
      if (req.body.from_person_id && req.body.from_person_id !== myPersonId) {
        return res.status(403).json({ error: 'Cannot send messages as another person' });
      }
      req.body.from_person_id = myPersonId;

      if (req.body.conversation_id) {
        const convResult = await pool.query(
          'SELECT participant_ids FROM conversations WHERE id = $1',
          [req.body.conversation_id]
        );
        if (convResult.rows.length === 0) {
          return res.status(404).json({ error: 'Conversation not found' });
        }
        const participantIds = convResult.rows[0].participant_ids || [];
        if (!participantIds.includes(myPersonId)) {
          return res.status(403).json({ error: 'You are not a participant in this conversation' });
        }
        const recipientIds = participantIds.filter(id => id !== myPersonId);
        if (recipientIds.length > 0) {
          const deceasedCheck = await pool.query(
            'SELECT id FROM people WHERE id = ANY($1::uuid[]) AND (is_deceased = true OR is_memorial = true)',
            [recipientIds]
          );
          if (deceasedCheck.rows.length > 0) {
            return res.status(403).json({ error: 'Cannot send messages to a memorialized account' });
          }
        }
      }
    }

    if (config.table === 'love_notes') {
      if (req.body.from_person_id && req.body.from_person_id !== myPersonId) {
        return res.status(403).json({ error: 'Cannot send love notes as another person' });
      }
      req.body.from_person_id = myPersonId;

      if (req.body.to_person_id) {
        const deceasedCheck = await pool.query(
          'SELECT id FROM people WHERE id = $1 AND (is_deceased = true OR is_memorial = true)',
          [req.body.to_person_id]
        );
        if (deceasedCheck.rows.length > 0) {
          return res.status(403).json({ error: 'Cannot send a love note to a memorialized account' });
        }
      }
    }

    if (myPersonId) {
      const ownerFieldMap = {
        moments: 'author_person_id',
        family_stories: 'author_person_id',
        trusted_contacts: 'person_id',
        invite_links: 'created_by_person_id',
      };
      const ownerField = ownerFieldMap[config.table];
      if (ownerField) {
        if (req.body[ownerField] && req.body[ownerField] !== myPersonId) {
          return res.status(403).json({ error: 'Cannot create records on behalf of another person' });
        }
        req.body[ownerField] = myPersonId;
      }

      if (config.table === 'trips') {
        req.body.planner_ids = req.body.planner_ids || [myPersonId];
        if (!req.body.planner_ids.includes(myPersonId)) {
          req.body.planner_ids.push(myPersonId);
        }
      }

      if (config.table === 'rituals' && req.body.assigned_person_ids) {
        if (!req.body.assigned_person_ids.includes(myPersonId)) {
          req.body.assigned_person_ids.push(myPersonId);
        }
      }
    }

    const data = filterColumns(req.body, config.columns, config.table);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid columns provided' });
    }

    if (data.first_name) data.first_name = formatProperName(data.first_name);
    if (data.middle_name) data.middle_name = formatProperName(data.middle_name);
    if (data.last_name) data.last_name = formatProperName(data.last_name);
    if (config.table === 'people' && (data.first_name || data.last_name)) {
      data.name = [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(' ');
    }
    if (data.name && !data.first_name && !data.last_name) data.name = formatProperName(data.name);
    if (data.nickname) data.nickname = formatProperName(data.nickname);

    if (config.table === 'people') {
      syncRoleFromBirthDate(data, null);
      data.created_by_user_id = req.session.userId;
      if ('social_links' in data) {
        if (data.social_links === null || data.social_links === undefined) {
          data.social_links = {};
        }
        const validationError = validateSocialLinks(data.social_links);
        if (validationError) return res.status(400).json({ error: validationError });
      }
    }

    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    let query;
    if (config.table === 'relationships') {
      query = `INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (person_id, related_person_id, relationship_type) DO UPDATE SET status_from_person = COALESCE(EXCLUDED.status_from_person, relationships.status_from_person), status_from_related = COALESCE(EXCLUDED.status_from_related, relationships.status_from_related) RETURNING *`;
    } else {
      query = `INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    }
    const result = await pool.query(query, values);

    let created = result.rows[0];

    if (config.table === 'people') {
      created = await autoCreateGalaxyIfNeeded(created);
      if (!created.user_id) {
        scoreNewPerson(created.id).catch(err => console.error('[ScoringTrigger] async scoreNewPerson error:', err.message));
      }

      if (data.linked_user_email && created.linked_user_email) {
        try {
          const parentPersonRow = await pool.query(
            `SELECT name FROM people WHERE user_id = $1`, [req.session.userId]
          );
          const parentName = parentPersonRow.rows[0]?.name || 'Your family';
          const childName = created.name || 'there';

          const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
          const host = req.get('host');
          const baseUrl = `${protocol}://${host}`;
          const registerUrl = `${baseUrl}/?register=true&email=${encodeURIComponent(created.linked_user_email)}`;

          sendAccountReadyEmail(created.linked_user_email, childName, parentName, registerUrl)
            .then(sent => {
              if (sent) console.log(`[EMAIL] Account ready email sent to ${created.linked_user_email}`);
            })
            .catch(err => console.error('[EMAIL] Failed to send account ready email:', err));
        } catch (emailErr) {
          console.error('[EMAIL] Error preparing account ready email:', emailErr);
        }
      }
    }

    if (config.table === 'messages' && created.conversation_id) {
      try {
        const convResult = await pool.query(
          'SELECT participant_ids FROM conversations WHERE id = $1',
          [created.conversation_id]
        );
        if (convResult.rows.length > 0) {
          const broadcast = req.app.get('broadcastToConversation');
          if (broadcast) {
            broadcast(convResult.rows[0].participant_ids, 'new_message', created);
          }
        }
      } catch (wsErr) {
        console.error('WebSocket broadcast error (non-fatal):', wsErr.message);
      }
    }

    if (config.table === 'conversations') {
      try {
        const broadcast = req.app.get('broadcastToConversation');
        if (broadcast && created.participant_ids) {
          broadcast(created.participant_ids, 'new_conversation', created);
        }
      } catch (wsErr) {
        console.error('WebSocket broadcast error (non-fatal):', wsErr.message);
      }
    }

    res.status(201).json(sanitizeResponse(created, config.table));
  } catch (error) {
    if (error.code === '22P02' || error.code === '22007' || error.code === '22003') {
      return res.status(400).json({ error: `Invalid input: ${error.message.split('\n')[0]}` });
    }
    console.error('Create entity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:type/:id', requireAuth, async (req, res) => {
  try {
    const { type, id } = req.params;
    const config = getConfig(type);
    if (!config) {
      return res.status(403).json({ error: `Entity type '${type}' is not allowed` });
    }

    const userIsSystemAdmin = await isSystemAdmin(req.session.userId);

    if (SYSTEM_ADMIN_ONLY.includes(config.table)) {
      if (!userIsSystemAdmin) {
        return res.status(403).json({ error: 'Admin privileges required' });
      }
    }

    if (!userIsSystemAdmin && RLS_WRITE_TABLES.includes(config.table)) {
      const allowed = await verifyWriteOwnership(config.table, id, req.session.userId, req.body);
      if (!allowed) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const data = filterColumns(req.body, config.columns, config.table);
    delete data.created_by_user_id;
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid columns provided' });
    }

    const GUARDIAN_ONLY_FIELDS = ['parental_controls', 'guardian_ids'];
    if (config.table === 'people') {
      const hasGuardianFields = GUARDIAN_ONLY_FIELDS.some(f => f in data);
      if (hasGuardianFields) {
        const myPersonId = await getMyPersonId(req.session.userId);
        const { rows: targetRows } = await pool.query(
          `SELECT guardian_ids, role_type FROM people WHERE id = $1`, [id]
        );
        if (targetRows.length === 0) {
          return res.status(404).json({ error: 'Person not found' });
        }
        const target = targetRows[0];
        const guardianIds = target.guardian_ids || [];
        const isGuardian = myPersonId && guardianIds.includes(myPersonId);
        const isMinor = target.role_type === 'teen' || target.role_type === 'child';
        if (!(isGuardian && isMinor)) {
          return res.status(403).json({ error: 'Only guardians can modify parental controls' });
        }
      }

      const myPersonId2 = await getMyPersonId(req.session.userId);
      if (myPersonId2) {
        const { rows: callerRows } = await pool.query(
          `SELECT role_type FROM people WHERE id = $1`, [myPersonId2]
        );
        const callerRole = callerRows[0]?.role_type;
        if ((callerRole === 'teen' || callerRole === 'child') && hasGuardianFields) {
          return res.status(403).json({ error: 'Minors cannot modify parental controls' });
        }
      }
    }

    if (data.first_name) data.first_name = formatProperName(data.first_name);
    if (data.middle_name) data.middle_name = formatProperName(data.middle_name);
    if (data.last_name) data.last_name = formatProperName(data.last_name);
    if (config.table === 'people' && (data.first_name !== undefined || data.middle_name !== undefined || data.last_name !== undefined)) {
      const { rows: currentRows } = await pool.query(`SELECT first_name, middle_name, last_name FROM people WHERE id = $1`, [id]);
      const current = currentRows[0] || {};
      const fn = data.first_name !== undefined ? data.first_name : current.first_name;
      const mn = data.middle_name !== undefined ? data.middle_name : current.middle_name;
      const ln = data.last_name !== undefined ? data.last_name : current.last_name;
      data.name = [fn, mn, ln].filter(Boolean).join(' ');
    }
    if (data.name && !data.first_name && !data.last_name) data.name = formatProperName(data.name);
    if (data.nickname) data.nickname = formatProperName(data.nickname);

    if (config.table === 'people' && 'social_links' in data) {
      if (data.social_links === null || data.social_links === undefined) {
        data.social_links = {};
      }
      const validationError = validateSocialLinks(data.social_links);
      if (validationError) return res.status(400).json({ error: validationError });
    }

    let previousLinkedEmail = null;
    if (config.table === 'people') {
      const { rows: existingRows } = await pool.query(
        `SELECT role_type, linked_user_email FROM people WHERE id = $1`, [id]
      );
      if (data.birth_date) {
        const existingRole = existingRows[0]?.role_type;
        syncRoleFromBirthDate(data, existingRole);
      }
      previousLinkedEmail = existingRows[0]?.linked_user_email || null;
    }

    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    values.push(id);
    const query = `UPDATE ${config.table} SET ${setClause} WHERE id = $${values.length} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    let updated = result.rows[0];

    if (config.table === 'people') {
      updated = await autoCreateGalaxyIfNeeded(updated);

      if (data.city || data.state || data.birth_date || data.birth_year || data.first_name || data.last_name || data.name) {
        if (!updated.user_id) {
          rescorePerson(updated.id).catch(err => console.error('[ScoringTrigger] async rescorePerson error:', err.message));
        } else {
          rescoreForUser(updated.user_id).catch(err => console.error('[ScoringTrigger] async rescoreForUser error:', err.message));
        }
      }

      if (data.linked_user_email && updated.linked_user_email && updated.linked_user_email !== previousLinkedEmail) {
        try {
          const parentPersonRow = await pool.query(
            `SELECT name FROM people WHERE user_id = $1`, [req.session.userId]
          );
          const parentName = parentPersonRow.rows[0]?.name || 'Your family';
          const childName = updated.name || 'there';

          const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
          const host = req.get('host');
          const baseUrl = `${protocol}://${host}`;
          const registerUrl = `${baseUrl}/?register=true&email=${encodeURIComponent(updated.linked_user_email)}`;

          sendAccountReadyEmail(updated.linked_user_email, childName, parentName, registerUrl)
            .then(sent => {
              if (sent) console.log(`[EMAIL] Account ready email sent to ${updated.linked_user_email}`);
            })
            .catch(err => console.error('[EMAIL] Failed to send account ready email:', err));
        } catch (emailErr) {
          console.error('[EMAIL] Error preparing account ready email:', emailErr);
        }
      }
    }

    if (config.table === 'relationships') {
      const isNowConfirmed =
        (data.status_from_person === 'confirmed' || data.status_from_related === 'confirmed');
      if (isNowConfirmed && updated.person_id && updated.related_person_id) {
        const bothConfirmed =
          (updated.status_from_person === 'confirmed' || updated.status_from_person === 'claimed') &&
          (updated.status_from_related === 'confirmed' || updated.status_from_related === 'claimed');
        if (bothConfirmed) {
          rescoreNeighbors(updated.person_id).catch(err => console.error('[ScoringTrigger] async rescoreNeighbors error:', err.message));
          rescoreNeighbors(updated.related_person_id).catch(err => console.error('[ScoringTrigger] async rescoreNeighbors error:', err.message));
        }
      }
    }

    res.json(sanitizeResponse(updated, config.table));
  } catch (error) {
    if (error.code === '22P02' || error.code === '22007' || error.code === '22003') {
      return res.status(400).json({ error: `Invalid input: ${error.message.split('\n')[0]}` });
    }
    console.error('Update entity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:type/:id', requireAuth, async (req, res) => {
  try {
    const { type, id } = req.params;
    const config = getConfig(type);
    if (!config) {
      return res.status(403).json({ error: `Entity type '${type}' is not allowed` });
    }

    const userIsSystemAdmin = await isSystemAdmin(req.session.userId);

    if (SYSTEM_ADMIN_ONLY.includes(config.table)) {
      if (!userIsSystemAdmin) {
        return res.status(403).json({ error: 'Admin privileges required to delete this entity' });
      }
    }

    if (!userIsSystemAdmin && RLS_WRITE_TABLES.includes(config.table)) {
      const allowed = await verifyWriteOwnership(config.table, id, req.session.userId);
      if (!allowed) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await pool.query(`DELETE FROM ${config.table} WHERE id = $1 RETURNING *`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    res.json({ message: 'Entity deleted successfully', deleted: sanitizeResponse(result.rows[0], config.table) });
  } catch (error) {
    console.error('Delete entity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
