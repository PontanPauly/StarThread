import { pool } from './index.js';
import bcrypt from 'bcrypt';

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS households (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS people (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        nickname TEXT,
        photo_url TEXT,
        birth_date DATE,
        birth_year INTEGER,
        death_date DATE,
        role_type TEXT,
        household_id UUID REFERENCES households(id),
        household_status TEXT DEFAULT 'primary',
        linked_user_email TEXT,
        allergies TEXT,
        dietary_preferences TEXT,
        is_deceased BOOLEAN DEFAULT false,
        about TEXT,
        medical_notes TEXT,
        star_profile JSONB,
        guardian_ids UUID[],
        star_pattern TEXT,
        star_intensity INTEGER,
        star_flare_count INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id UUID NOT NULL REFERENCES people(id),
        related_person_id UUID NOT NULL REFERENCES people(id),
        relationship_type TEXT NOT NULL,
        subtype TEXT DEFAULT 'biological'
      );

      CREATE TABLE IF NOT EXISTS trips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        location TEXT,
        description TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        cover_image_url TEXT,
        planner_ids UUID[],
        visibility TEXT DEFAULT 'family_wide',
        status TEXT DEFAULT 'planning',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS trip_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        person_id UUID NOT NULL REFERENCES people(id),
        status TEXT DEFAULT 'invited',
        room_id UUID
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        capacity INTEGER,
        notes TEXT,
        assigned_person_ids UUID[]
      );

      CREATE TABLE IF NOT EXISTS meals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        meal_type TEXT,
        title TEXT,
        description TEXT,
        chef_ids UUID[],
        location TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        date DATE,
        time TEXT,
        location TEXT,
        description TEXT,
        organizer_ids UUID[]
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        description TEXT,
        amount NUMERIC(10,2),
        paid_by_person_id UUID REFERENCES people(id),
        category TEXT,
        date DATE,
        split_among_ids UUID[]
      );

      CREATE TABLE IF NOT EXISTS packing_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        person_id UUID REFERENCES people(id),
        item TEXT NOT NULL,
        category TEXT,
        is_packed BOOLEAN DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS shared_trip_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        item TEXT NOT NULL,
        assigned_to_person_id UUID REFERENCES people(id),
        is_confirmed BOOLEAN DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS moments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT,
        media_urls TEXT[],
        media_type TEXT,
        trip_id UUID,
        tagged_person_ids UUID[],
        captured_date DATE,
        author_person_id UUID,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS love_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        from_person_id UUID NOT NULL REFERENCES people(id),
        to_person_id UUID NOT NULL REFERENCES people(id),
        trip_id UUID,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS family_stories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT,
        author_person_id UUID,
        related_person_ids UUID[],
        era TEXT,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS family_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        family_name TEXT,
        invite_code TEXT,
        timezone TEXT,
        tagline TEXT,
        admin_emails TEXT[],
        planner_emails TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS join_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        message TEXT,
        status TEXT DEFAULT 'pending',
        reviewed_by_email TEXT,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS rituals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        frequency TEXT,
        assigned_person_ids UUID[],
        household_id UUID,
        next_occurrence DATE,
        category TEXT,
        typical_month TEXT,
        host_rotation UUID[],
        current_host_index INTEGER,
        custom_frequency TEXT,
        cover_image_url TEXT,
        typical_participant_household_ids UUID[],
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        participant_ids UUID[],
        type TEXT NOT NULL DEFAULT 'direct',
        name TEXT,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        from_person_id UUID REFERENCES people(id),
        content TEXT,
        media_url TEXT,
        is_read BOOLEAN DEFAULT false,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS calendar_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        event_type TEXT,
        person_ids UUID[],
        is_recurring BOOLEAN DEFAULT false,
        color TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "session" (
        "sid" VARCHAR NOT NULL COLLATE "default",
        "sess" JSON NOT NULL,
        "expire" TIMESTAMP(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

    await client.query(`
      ALTER TABLE people ADD COLUMN IF NOT EXISTS about TEXT;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS medical_notes TEXT;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS star_profile JSONB;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS birth_year INTEGER;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS death_date DATE;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS guardian_ids UUID[];
      ALTER TABLE people ADD COLUMN IF NOT EXISTS star_pattern TEXT;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS star_intensity INTEGER;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS star_flare_count INTEGER;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS household_status TEXT DEFAULT 'primary';
    `);

    await client.query(`
      ALTER TABLE trips ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'family_wide';
      ALTER TABLE trips ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'planning';
    `);

    await client.query(`
      ALTER TABLE trip_participants ADD COLUMN IF NOT EXISTS room_id UUID;
    `);
    await client.query(`
      ALTER TABLE trip_participants DROP CONSTRAINT IF EXISTS trip_participants_status_check;
      ALTER TABLE trip_participants ADD CONSTRAINT trip_participants_status_check
        CHECK (status IN ('accepted', 'maybe', 'declined', 'invited'));
    `);

    await client.query(`
      ALTER TABLE households ADD COLUMN IF NOT EXISTS description TEXT;
    `);

    await client.query(`
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES activities(id) ON DELETE SET NULL;
    `);

    await client.query(`
      ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS tagline TEXT;
      ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS admin_emails TEXT[];
      ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS planner_emails TEXT[];
    `);

    await client.query(`
      ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS reviewed_by_email TEXT;
      ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
    `);

    await client.query(`
      ALTER TABLE relationships ADD COLUMN IF NOT EXISTS subtype TEXT DEFAULT 'biological';
    `);

    await client.query(`
      ALTER TABLE people ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
      ALTER TABLE people ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS city TEXT;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS state TEXT;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS is_memorial BOOLEAN DEFAULT false;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS memorial_date DATE;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS privacy_level TEXT DEFAULT 'public';
      ALTER TABLE people ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;
    `);

    await client.query(`
      ALTER TABLE relationships ADD COLUMN IF NOT EXISTS status_from_person TEXT DEFAULT 'confirmed';
      ALTER TABLE relationships ADD COLUMN IF NOT EXISTS status_from_related TEXT DEFAULT 'pending';
      ALTER TABLE relationships ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS relationship_visibility (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
        is_visible BOOLEAN DEFAULT true,
        UNIQUE(user_id, relationship_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS trusted_contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        trusted_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(person_id, trusted_person_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS invite_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE NOT NULL,
        created_by_person_id UUID NOT NULL REFERENCES people(id),
        relationship_type TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        used_by_user_id UUID REFERENCES users(id),
        used_at TIMESTAMPTZ
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS memorial_confirmations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        confirmed_by_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(person_id, confirmed_by_person_id)
      );
    `);

    await client.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'direct';
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name TEXT;
    `);

    await client.query(`
      ALTER TABLE rituals ADD COLUMN IF NOT EXISTS typical_month TEXT;
      ALTER TABLE rituals ADD COLUMN IF NOT EXISTS host_rotation UUID[];
      ALTER TABLE rituals ADD COLUMN IF NOT EXISTS current_host_index INTEGER;
      ALTER TABLE rituals ADD COLUMN IF NOT EXISTS custom_frequency TEXT;
      ALTER TABLE rituals ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
      ALTER TABLE rituals ADD COLUMN IF NOT EXISTS typical_participant_household_ids UUID[];
    `);

    await client.query(`
      ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES people(id);
      ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'galaxy';
      ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS shared_with UUID[];
      ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS start_time TIME;
      ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS end_time TIME;
      ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS end_date DATE;
      ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS location TEXT;
      ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS google_event_id TEXT;
      ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_preferences JSONB DEFAULT '{}';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
      ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
    `);
    await client.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;
      ALTER TABLE users ADD CONSTRAINT users_subscription_tier_check
        CHECK (subscription_tier IN ('free', 'premium', 'family'));
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS family_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT DEFAULT 'My Family Plan',
        max_seats INTEGER DEFAULT 6,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_family_plans_owner ON family_plans(owner_user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS family_plan_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        family_plan_id UUID NOT NULL REFERENCES family_plans(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(family_plan_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_family_plan_members_plan ON family_plan_members(family_plan_id);
      CREATE INDEX IF NOT EXISTS idx_family_plan_members_user ON family_plan_members(user_id);
    `);

    await client.query(`ALTER TABLE relationships DROP CONSTRAINT IF EXISTS relationships_relationship_type_check`);
    await client.query(`ALTER TABLE relationships ADD CONSTRAINT relationships_relationship_type_check 
      CHECK (relationship_type IN ('parent', 'child', 'partner', 'spouse', 'sibling', 'grandparent', 'grandchild', 'aunt_uncle', 'niece_nephew', 'cousin', 'in_law', 'chosen_family', 'step_parent', 'step_child', 'step_sibling', 'extended'))`);

    const reciprocalMap = {
      parent: 'child',
      child: 'parent',
      partner: 'partner',
      spouse: 'spouse',
      sibling: 'sibling',
      grandparent: 'grandchild',
      grandchild: 'grandparent',
      aunt_uncle: 'niece_nephew',
      niece_nephew: 'aunt_uncle',
      cousin: 'cousin',
      in_law: 'in_law',
      chosen_family: 'chosen_family',
      step_parent: 'step_child',
      step_child: 'step_parent',
      step_sibling: 'step_sibling',
      extended: 'extended',
    };

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_unique_pair
      ON relationships (person_id, related_person_id, relationship_type)
    `);

    const { rows: existingRels } = await client.query('SELECT person_id, related_person_id, relationship_type, subtype FROM relationships');
    const existingSet = new Set(existingRels.map(r => `${r.person_id}:${r.related_person_id}:${r.relationship_type}`));
    let backfilled = 0;
    let backfillErrors = 0;

    for (const rel of existingRels) {
      const recipType = reciprocalMap[rel.relationship_type] || rel.relationship_type;
      const reverseKey = `${rel.related_person_id}:${rel.person_id}:${recipType}`;
      if (!existingSet.has(reverseKey)) {
        try {
          await client.query(
            `INSERT INTO relationships (person_id, related_person_id, relationship_type, subtype, status_from_person, status_from_related)
             VALUES ($1, $2, $3, $4, 'confirmed', 'confirmed')
             ON CONFLICT (person_id, related_person_id, relationship_type) DO NOTHING`,
            [rel.related_person_id, rel.person_id, recipType, rel.subtype || 'biological']
          );
          existingSet.add(reverseKey);
          backfilled++;
        } catch (e) {
          backfillErrors++;
          console.warn(`Failed to backfill reciprocal for ${rel.person_id}->${rel.related_person_id} (${rel.relationship_type}): ${e.message}`);
        }
      }
    }
    if (backfilled > 0) {
      console.log(`Backfilled ${backfilled} reciprocal relationships`);
    }
    if (backfillErrors > 0) {
      console.warn(`${backfillErrors} reciprocal backfill errors (see above)`);
    }

    // Auto-sync role_type from birth_date for all people
    const { rowCount: roleSyncCount } = await client.query(`
      UPDATE people SET role_type = CASE
        WHEN EXTRACT(YEAR FROM age(birth_date)) >= 18 THEN 'adult'
        WHEN EXTRACT(YEAR FROM age(birth_date)) >= 13 THEN 'teen'
        ELSE 'child'
      END
      WHERE birth_date IS NOT NULL
        AND (role_type IS DISTINCT FROM 'ancestor')
        AND role_type IS DISTINCT FROM CASE
          WHEN EXTRACT(YEAR FROM age(birth_date)) >= 18 THEN 'adult'
          WHEN EXTRACT(YEAR FROM age(birth_date)) >= 13 THEN 'teen'
          ELSE 'child'
        END
    `);
    if (roleSyncCount > 0) {
      console.log(`Auto-corrected role_type for ${roleSyncCount} people based on birth_date`);
    }

    const { rows: adultsNeedingGalaxy } = await client.query(`
      SELECT p.id, p.name FROM people p
      WHERE p.role_type = 'adult'
        AND p.is_deceased IS NOT TRUE
        AND p.is_memorial IS NOT TRUE
        AND (
          p.household_id IS NULL
          OR EXISTS (
            SELECT 1 FROM relationships r
            WHERE r.relationship_type = 'child'
              AND r.person_id = p.id
              AND r.related_person_id IN (
                SELECT id FROM people WHERE household_id = p.household_id AND id != p.id
              )
          )
        )
    `);
    for (const adult of adultsNeedingGalaxy) {
      const householdName = `${adult.name}'s Galaxy`;
      const { rows: newH } = await client.query(
        `INSERT INTO households (name) VALUES ($1) RETURNING id`,
        [householdName]
      );
      if (newH.length > 0) {
        await client.query(
          `UPDATE people SET household_id = $1 WHERE id = $2`,
          [newH[0].id, adult.id]
        );
        console.log(`Auto-created galaxy "${householdName}" for ${adult.name}`);
      }
    }

    await client.query(`
      ALTER TABLE people ADD COLUMN IF NOT EXISTS parental_controls JSONB;
    `);

    const { rows: msgCols } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'messages' AND column_name = 'media_url'
    `);
    if (msgCols.length === 0) {
      await client.query(`ALTER TABLE messages ADD COLUMN media_url TEXT`);
      await client.query(`ALTER TABLE messages ALTER COLUMN content DROP NOT NULL`);
      console.log('Added media_url column to messages');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS support_access_tokens (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID        REFERENCES users(id) ON DELETE CASCADE,
        person_id       UUID        REFERENCES people(id),
        token           TEXT        NOT NULL,
        status          TEXT        DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'resolved', 'expired')),
        used_by_admin_id UUID      REFERENCES users(id),
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        expires_at      TIMESTAMPTZ NOT NULL,
        resolved_at     TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_support_tokens_token ON support_access_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_support_tokens_status_expires ON support_access_tokens(status, expires_at);
      CREATE INDEX IF NOT EXISTS idx_support_tokens_user_id ON support_access_tokens(user_id);
    `);

    const { rows: adminExists } = await client.query(
      `SELECT id FROM users WHERE email = 'support@starthread.app'`
    );
    if (adminExists.length === 0) {
      const adminHash = await bcrypt.hash('StarAdmin_2026!Secure', 10);
      await client.query(
        `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'admin')`,
        ['support@starthread.app', adminHash, 'StarThread Support']
      );
      console.log('Created admin user: support@starthread.app');
    }

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_participant BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_joined_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_discount_applied BOOLEAN DEFAULT false;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_people_household_id ON people(household_id);
      CREATE INDEX IF NOT EXISTS idx_people_user_id ON people(user_id);
      CREATE INDEX IF NOT EXISTS idx_people_linked_user_email ON people(linked_user_email);
      CREATE INDEX IF NOT EXISTS idx_relationships_related_person_id ON relationships(related_person_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_person_type ON relationships(person_id, relationship_type);
      CREATE INDEX IF NOT EXISTS idx_relationships_related_type ON relationships(related_person_id, relationship_type);
      CREATE INDEX IF NOT EXISTS idx_moments_author ON moments(author_person_id);
      CREATE INDEX IF NOT EXISTS idx_love_notes_from ON love_notes(from_person_id);
      CREATE INDEX IF NOT EXISTS idx_love_notes_to ON love_notes(to_person_id);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_person_id);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);
      CREATE INDEX IF NOT EXISTS idx_trip_participants_person ON trip_participants(person_id);
      CREATE INDEX IF NOT EXISTS idx_trip_participants_trip ON trip_participants(trip_id, person_id);
      CREATE INDEX IF NOT EXISTS idx_packing_items_person ON packing_items(person_id);
      CREATE INDEX IF NOT EXISTS idx_packing_items_trip ON packing_items(trip_id, person_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by_person_id);
      CREATE INDEX IF NOT EXISTS idx_family_stories_author ON family_stories(author_person_id);
    `);

    const cascadeMigrations = [
      {
        table: 'relationships', column: 'person_id', ref: 'people(id)',
        oldConstraint: 'relationships_person_id_fkey', action: 'CASCADE'
      },
      {
        table: 'relationships', column: 'related_person_id', ref: 'people(id)',
        oldConstraint: 'relationships_related_person_id_fkey', action: 'CASCADE'
      },
      {
        table: 'love_notes', column: 'from_person_id', ref: 'people(id)',
        oldConstraint: 'love_notes_from_person_id_fkey', action: 'CASCADE'
      },
      {
        table: 'love_notes', column: 'to_person_id', ref: 'people(id)',
        oldConstraint: 'love_notes_to_person_id_fkey', action: 'CASCADE'
      },
      {
        table: 'trip_participants', column: 'person_id', ref: 'people(id)',
        oldConstraint: 'trip_participants_person_id_fkey', action: 'CASCADE'
      },
      {
        table: 'expenses', column: 'paid_by_person_id', ref: 'people(id)',
        oldConstraint: 'expenses_paid_by_person_id_fkey', action: 'SET NULL'
      },
    ];

    for (const m of cascadeMigrations) {
      try {
        await client.query(`ALTER TABLE ${m.table} DROP CONSTRAINT IF EXISTS ${m.oldConstraint}`);
        await client.query(`ALTER TABLE ${m.table} ADD CONSTRAINT ${m.oldConstraint} FOREIGN KEY (${m.column}) REFERENCES ${m.ref} ON DELETE ${m.action}`);
      } catch (e) {
        console.log(`Cascade migration for ${m.table}.${m.column} skipped:`, e.message);
      }
    }

    await client.query(`
      ALTER TABLE people ADD COLUMN IF NOT EXISTS first_name TEXT;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS middle_name TEXT;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS last_name TEXT;
    `);

    const { rows: needsNameSplit } = await client.query(
      `SELECT id, name FROM people WHERE first_name IS NULL AND name IS NOT NULL`
    );
    for (const row of needsNameSplit) {
      const parts = row.name.trim().split(/\s+/);
      let first, middle, last;
      if (parts.length === 1) {
        first = parts[0]; middle = null; last = null;
      } else if (parts.length === 2) {
        first = parts[0]; middle = null; last = parts[1];
      } else {
        first = parts[0]; last = parts[parts.length - 1]; middle = parts.slice(1, -1).join(' ');
      }
      await client.query(
        `UPDATE people SET first_name = $1, middle_name = $2, last_name = $3 WHERE id = $4`,
        [first, middle, last, row.id]
      );
    }

    await client.query(`
      ALTER TABLE people ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES people(id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS person_match_suggestions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        suggested_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        confidence TEXT NOT NULL,
        breakdown JSONB,
        explanations TEXT[],
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, suggested_person_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS merge_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        keep_person_id UUID NOT NULL REFERENCES people(id),
        merged_person_id UUID NOT NULL REFERENCES people(id),
        merged_by_user_id UUID NOT NULL REFERENCES users(id),
        merged_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS merge_conflicts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        person_a_id UUID NOT NULL REFERENCES people(id),
        person_b_id UUID NOT NULL REFERENCES people(id),
        reported_by_user_id UUID NOT NULL REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'pending',
        resolution_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_person_match_suggestions_user ON person_match_suggestions(user_id);
      CREATE INDEX IF NOT EXISTS idx_person_match_suggestions_status ON person_match_suggestions(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_merge_history_keep ON merge_history(keep_person_id);
      CREATE INDEX IF NOT EXISTS idx_merge_conflicts_status ON merge_conflicts(status);
      CREATE INDEX IF NOT EXISTS idx_people_merged_into ON people(merged_into_id);
    `);

    await client.query(`
      ALTER TABLE people ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id);
    `);

    await client.query(`
      ALTER TABLE people ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
    `);

    await client.query('COMMIT');
    console.log('Database migrations completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function tryCreateTrigram() {
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_people_name_trgm ON people USING gin (name gin_trgm_ops)`);
    console.log('Trigram index ready');
  } catch (err) {
    console.log('Trigram index not available (non-critical):', err.message);
  }
}
