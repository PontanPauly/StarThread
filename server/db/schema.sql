-- =============================================================================
-- StarThread Database Schema
-- =============================================================================
-- NOTE: This file is for documentation and fresh-environment setup only.
--       server/db/migrate.js is the AUTHORITATIVE runtime source of truth.
--       migrate.js runs on every server start and applies all ALTER TABLE
--       migrations safely (ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS).
--       If this file and migrate.js ever diverge, migrate.js wins.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Core user / identity tables
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT        UNIQUE NOT NULL,
  password_hash        TEXT,
  full_name            TEXT        NOT NULL,
  role                 TEXT        DEFAULT 'user',
  subscription_tier    TEXT        DEFAULT 'free',
  google_id            TEXT,
  google_access_token  TEXT,
  google_refresh_token TEXT,
  google_token_expiry  TIMESTAMPTZ,
  calendar_preferences JSONB       DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

CREATE TABLE family_plans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT        DEFAULT 'My Family Plan',
  max_seats       INTEGER     DEFAULT 6,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_family_plans_owner ON family_plans(owner_user_id);

CREATE TABLE family_plan_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_plan_id  UUID        NOT NULL REFERENCES family_plans(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_plan_id, user_id)
);
CREATE INDEX idx_family_plan_members_plan ON family_plan_members(family_plan_id);
CREATE INDEX idx_family_plan_members_user ON family_plan_members(user_id);

CREATE TABLE password_reset_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT        UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);

CREATE TABLE households (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE people (
  id                                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                              TEXT        NOT NULL,
  nickname                          TEXT,
  photo_url                         TEXT,
  birth_date                        DATE,
  birth_year                        INTEGER,
  death_date                        DATE,
  role_type                         TEXT,           -- 'adult' | 'teen' | 'child' | 'ancestor'
  household_id                      UUID        REFERENCES households(id) ON DELETE SET NULL,
  household_status                  TEXT        DEFAULT 'primary',
  linked_user_email                 TEXT,           -- legacy; prefer user_id
  user_id                           UUID        REFERENCES users(id) ON DELETE SET NULL,
  allergies                         TEXT,
  dietary_preferences               TEXT,
  is_deceased                       BOOLEAN     DEFAULT false,
  about                             TEXT,
  medical_notes                     TEXT,           -- NOT exposed via public entities API
  star_profile                      JSONB,
  guardian_ids                      UUID[],
  star_pattern                      TEXT,
  star_intensity                    INTEGER,
  star_flare_count                  INTEGER,
  address                           TEXT,
  city                              TEXT,
  state                             TEXT,
  is_memorial                       BOOLEAN     DEFAULT false,
  memorial_date                     DATE,
  privacy_level                     TEXT        DEFAULT 'public',  -- 'public' | 'family' | 'private'
  parental_controls                 JSONB,
  onboarding_complete               BOOLEAN     DEFAULT false,
  social_links                      JSONB       DEFAULT '{}',
  created_at                        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_people_household_id      ON people(household_id);
CREATE INDEX idx_people_linked_user_email ON people(linked_user_email);
CREATE INDEX idx_people_user_id           ON people(user_id);

-- ---------------------------------------------------------------------------
-- Relationship graph (nodes = people, edges = relationships)
-- ---------------------------------------------------------------------------

CREATE TABLE relationships (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id            UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  related_person_id    UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship_type    TEXT NOT NULL CHECK (relationship_type IN (
                         'parent','child','partner','spouse','sibling',
                         'grandparent','grandchild','aunt_uncle','niece_nephew',
                         'cousin','in_law','chosen_family',
                         'step_parent','step_child','step_sibling','extended'
                       )),
  subtype              TEXT DEFAULT 'biological',
  status_from_person   TEXT DEFAULT 'confirmed',  -- 'confirmed' | 'pending' | 'claimed' | 'denied'
  status_from_related  TEXT DEFAULT 'pending',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (person_id, related_person_id, relationship_type)
);
CREATE INDEX idx_relationships_person_id         ON relationships(person_id);
CREATE INDEX idx_relationships_related_person_id ON relationships(related_person_id);

-- Allows a user to hide a relationship from their personal galaxy view
-- while it remains in the underlying graph.
CREATE TABLE relationship_visibility (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship_id UUID    NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  is_visible      BOOLEAN DEFAULT true,
  UNIQUE (user_id, relationship_id)
);

-- ---------------------------------------------------------------------------
-- Trust & memorial
-- ---------------------------------------------------------------------------

CREATE TABLE trusted_contacts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id         UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  trusted_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (person_id, trusted_person_id)
);

CREATE TABLE memorial_confirmations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id               UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  confirmed_by_person_id  UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (person_id, confirmed_by_person_id)
);

-- ---------------------------------------------------------------------------
-- Invite links
-- ---------------------------------------------------------------------------

CREATE TABLE invite_links (
  id                    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT  UNIQUE NOT NULL,
  created_by_person_id  UUID  NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship_type     TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  expires_at            TIMESTAMPTZ,
  used_by_user_id       UUID  REFERENCES users(id),
  used_at               TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Trips module
-- ---------------------------------------------------------------------------

CREATE TABLE trips (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  location       TEXT,
  description    TEXT,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  cover_image_url TEXT,
  planner_ids    UUID[],
  visibility     TEXT DEFAULT 'family_wide',
  status         TEXT DEFAULT 'planning',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_trips_start_date ON trips(start_date);

CREATE TABLE trip_participants (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id   UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  status    TEXT DEFAULT 'invited' CHECK (status IN ('accepted','maybe','declined','invited')),
  room_id   UUID
);
CREATE INDEX idx_trip_participants_trip_id   ON trip_participants(trip_id);
CREATE INDEX idx_trip_participants_person_id ON trip_participants(person_id);

CREATE TABLE rooms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  capacity            INTEGER,
  notes               TEXT,
  assigned_person_ids UUID[]
);
CREATE INDEX idx_rooms_trip_id ON rooms(trip_id);

CREATE TABLE meals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  meal_type   TEXT,
  title       TEXT,
  description TEXT,
  chef_ids    UUID[],
  location    TEXT,
  notes       TEXT
);
CREATE INDEX idx_meals_trip_id ON meals(trip_id);

CREATE TABLE activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  date          DATE,
  time          TEXT,
  location      TEXT,
  description   TEXT,
  organizer_ids UUID[]
);
CREATE INDEX idx_activities_trip_id ON activities(trip_id);

CREATE TABLE expenses (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             UUID          NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  description         TEXT,
  amount              NUMERIC(10,2),
  paid_by_person_id   UUID          REFERENCES people(id) ON DELETE SET NULL,
  category            TEXT,
  date                DATE,
  split_among_ids     UUID[]
);
CREATE INDEX idx_expenses_trip_id ON expenses(trip_id);

CREATE TABLE packing_items (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id   UUID    NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  person_id UUID    REFERENCES people(id) ON DELETE SET NULL,
  item      TEXT    NOT NULL,
  category  TEXT,
  is_packed BOOLEAN DEFAULT false
);
CREATE INDEX idx_packing_items_trip_id ON packing_items(trip_id);

CREATE TABLE shared_trip_items (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id               UUID    NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  item                  TEXT    NOT NULL,
  assigned_to_person_id UUID    REFERENCES people(id) ON DELETE SET NULL,
  is_confirmed          BOOLEAN DEFAULT false
);
CREATE INDEX idx_shared_trip_items_trip_id ON shared_trip_items(trip_id);

CREATE TABLE trip_comments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  author_person_id UUID        REFERENCES people(id) ON DELETE SET NULL,
  content          TEXT        NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_trip_comments_trip_id    ON trip_comments(trip_id);
CREATE INDEX idx_trip_comments_created_at ON trip_comments(created_at);

-- ---------------------------------------------------------------------------
-- Content / social
-- ---------------------------------------------------------------------------

CREATE TABLE moments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content          TEXT,
  media_urls       TEXT[],
  media_type       TEXT,
  trip_id          UUID        REFERENCES trips(id) ON DELETE SET NULL,
  tagged_person_ids UUID[],
  captured_date    DATE,
  author_person_id UUID        REFERENCES people(id) ON DELETE SET NULL,
  created_date     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_moments_author_person_id ON moments(author_person_id);
CREATE INDEX idx_moments_created_date     ON moments(created_date);

CREATE TABLE love_notes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content        TEXT        NOT NULL,
  from_person_id UUID        NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  to_person_id   UUID        NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  trip_id        UUID        REFERENCES trips(id) ON DELETE SET NULL,
  created_date   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_love_notes_from_person_id ON love_notes(from_person_id);
CREATE INDEX idx_love_notes_to_person_id   ON love_notes(to_person_id);

CREATE TABLE family_stories (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT        NOT NULL,
  content           TEXT,
  author_person_id  UUID        REFERENCES people(id) ON DELETE SET NULL,
  related_person_ids UUID[],
  era               TEXT,
  created_date      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rituals (
  id                                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                              TEXT        NOT NULL,
  description                       TEXT,
  frequency                         TEXT,       -- 'weekly' | 'monthly' | 'annually' | 'custom'
  assigned_person_ids               UUID[],
  household_id                      UUID        REFERENCES households(id) ON DELETE SET NULL,
  next_occurrence                   DATE,
  category                          TEXT,
  typical_month                     TEXT,
  host_rotation                     UUID[],
  current_host_index                INTEGER,
  custom_frequency                  TEXT,
  cover_image_url                   TEXT,
  typical_participant_household_ids UUID[],
  created_at                        TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------

CREATE TABLE conversations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_ids UUID[],
  type            TEXT        NOT NULL DEFAULT 'direct',  -- 'direct' | 'group'
  name            TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_conversations_participant_ids ON conversations USING gin(participant_ids);

CREATE TABLE messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  from_person_id  UUID        REFERENCES people(id) ON DELETE SET NULL,
  content         TEXT,
  media_url       TEXT,
  is_read         BOOLEAN     DEFAULT false,
  created_date    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_from_person_id  ON messages(from_person_id);
CREATE INDEX idx_messages_created_date    ON messages(created_date);

-- ---------------------------------------------------------------------------
-- Settings / admin / other
-- ---------------------------------------------------------------------------

CREATE TABLE family_settings (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_name    TEXT,
  invite_code    TEXT,
  timezone       TEXT,
  tagline        TEXT,
  admin_emails   TEXT[],
  planner_emails TEXT[],
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE join_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT        NOT NULL,
  message           TEXT,
  status            TEXT        DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by_email TEXT,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_join_requests_status ON join_requests(status);
CREATE INDEX idx_join_requests_email  ON join_requests(email);

CREATE TABLE calendar_events (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT    NOT NULL,
  description     TEXT,
  date            DATE    NOT NULL,
  end_date        DATE,
  start_time      TIME,
  end_time        TIME,
  event_type      TEXT,
  person_ids      UUID[],
  is_recurring    BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  color           TEXT,
  location        TEXT,
  created_by      UUID    REFERENCES people(id),
  visibility      TEXT    DEFAULT 'galaxy' CHECK (visibility IN ('private', 'galaxy', 'universe', 'custom')),
  shared_with     UUID[],
  google_event_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Support access tokens (temporary admin access to user accounts)
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

-- Session store (managed by connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid"    VARCHAR     NOT NULL COLLATE "default",
  "sess"   JSON        NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session"("expire");
