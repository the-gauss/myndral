-- ═══════════════════════════════════════════════════════════════════════════════
-- MyndralAI — Production Database Schema
-- Engine: PostgreSQL 16+
--
-- This file is the canonical reference schema for a fresh database bootstrap.
-- Incremental changes are managed via Alembic migrations (db/migrations/).
-- Run seeds in order after applying this file:
--   psql -f db/schema.sql
--   psql -f db/seeds/01_genres.sql
--   psql -f db/seeds/02_subscription_plans.sql
--   psql -f db/seeds/03_dev_catalog.sql   # development only
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), gen_random_bytes()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram fuzzy / typo-tolerant search
CREATE EXTENSION IF NOT EXISTS unaccent;   -- accent-insensitive search (é → e)

-- ── Shared utility function: auto-bump updated_at ────────────────────────────

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Enum types ────────────────────────────────────────────────────────────────

-- Roles within the platform (users + internal tool access)
CREATE TYPE user_role AS ENUM (
  'listener',          -- regular end-user
  'content_editor',    -- can create / edit catalog entries via internal tool
  'content_reviewer',  -- can approve or reject catalog entries
  'admin'              -- full platform access
);

-- Content lifecycle for artists, albums, and tracks
CREATE TYPE content_status AS ENUM (
  'draft',      -- being worked on; not visible to listeners
  'review',     -- submitted for approval by a content_reviewer
  'published',  -- live and visible to listeners
  'archived'    -- hidden from listeners; retained for audit / re-publish
);

CREATE TYPE album_type AS ENUM ('album', 'single', 'ep', 'compilation');

-- The role an artist plays on a given track
CREATE TYPE track_artist_role AS ENUM ('primary', 'featured', 'producer', 'remixer');

-- Subscription billing lifecycle
CREATE TYPE subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'cancelled',
  'expired'
);

CREATE TYPE billing_interval AS ENUM ('monthly', 'annual');

-- Audio quality tiers (determines which track_audio_files row is served)
CREATE TYPE audio_quality AS ENUM (
  'low_128',       -- free tier  — 128 kbps MP3
  'standard_256',  -- mid tier   — 256 kbps AAC
  'high_320',      -- premium    — 320 kbps MP3
  'lossless'       -- premium+   — FLAC
);

CREATE TYPE audio_format AS ENUM ('mp3', 'aac', 'ogg', 'flac', 'opus');

-- Collaborative playlist permissions
CREATE TYPE playlist_collab_role AS ENUM ('editor', 'viewer');

-- Audit actions on collaborative playlists
CREATE TYPE playlist_edit_action AS ENUM (
  'track_added',
  'track_removed',
  'track_reordered',
  'metadata_updated'
);

-- Playback context: where was a track played from?
CREATE TYPE playback_context AS ENUM (
  'album',
  'playlist',
  'artist_page',
  'search',
  'radio',
  'library',
  'recommendations',
  'unknown'
);

-- Activity feed event types
CREATE TYPE feed_event_type AS ENUM (
  'artist_followed',   -- user followed an artist
  'user_followed',     -- user followed another user
  'track_liked',       -- user liked a track
  'album_saved',       -- user saved an album to library
  'playlist_created',  -- user created a new playlist
  'playlist_updated',  -- user added / removed tracks from a playlist
  'artist_released'    -- a followed artist published new content
);

-- Polymorphic subject reference (feed_events, ratings, reviews, audit)
CREATE TYPE content_subject_type AS ENUM (
  'artist', 'album', 'track', 'playlist', 'user'
);

-- AI content generation job types
CREATE TYPE generation_job_type AS ENUM (
  'artist', 'album', 'track', 'lyrics', 'cover_art', 'artist_image'
);

CREATE TYPE generation_job_status AS ENUM (
  'pending', 'in_progress', 'completed', 'failed', 'cancelled'
);

-- ════════════════════════════════════════════════════════════════════════════
-- USERS & AUTH
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username          TEXT        NOT NULL,
  email             TEXT        NOT NULL,
  display_name      TEXT        NOT NULL,
  avatar_url        TEXT,
  hashed_password   TEXT        NOT NULL,
  role              user_role   NOT NULL DEFAULT 'listener',
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  email_verified    BOOLEAN     NOT NULL DEFAULT false,
  email_verified_at TIMESTAMPTZ,
  -- Profile
  bio               TEXT,
  country_code      CHAR(2),                -- ISO 3166-1 alpha-2
  date_of_birth     DATE,                   -- age-gate for explicit content
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_users_username UNIQUE (username),
  CONSTRAINT uq_users_email    UNIQUE (email),
  CONSTRAINT ck_users_dob      CHECK (date_of_birth IS NULL OR date_of_birth < CURRENT_DATE),
  CONSTRAINT ck_users_country  CHECK (country_code IS NULL OR length(country_code) = 2)
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Refresh-token sessions (one row per device/browser session).
-- Store a hash of the token, never the plaintext value.
CREATE TABLE user_sessions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash   TEXT        NOT NULL UNIQUE,
  device_name          TEXT,       -- "iPhone 15 Pro", "Chrome on macOS"
  device_fingerprint   TEXT,       -- optional stable browser/device fingerprint
  ip_address           INET,
  user_agent           TEXT,
  expires_at           TIMESTAMPTZ NOT NULL,
  revoked_at           TIMESTAMPTZ,  -- NULL = still valid
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_sessions_expiry CHECK (expires_at > created_at)
);

-- ════════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTIONS & BILLING
-- ════════════════════════════════════════════════════════════════════════════

-- Plan definitions (free, premium_monthly, premium_annual).
-- Features stored as JSONB so the set can evolve without schema migrations.
-- Expected JSONB keys:
--   ads_enabled          boolean
--   max_skips_per_hour   integer | null  (null = unlimited)
--   max_audio_quality    "low_128" | "standard_256" | "high_320" | "lossless"
--   offline_downloads    boolean
--   max_offline_tracks   integer
--   on_demand_playback   boolean
--   lossless_available   boolean
--   shuffle_only_mobile  boolean
--   concurrent_streams   integer
CREATE TABLE subscription_plans (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT             NOT NULL UNIQUE,
  display_name     TEXT             NOT NULL,
  price_cents      INTEGER          NOT NULL DEFAULT 0,
  currency         CHAR(3)          NOT NULL DEFAULT 'USD',
  billing_interval billing_interval,                   -- NULL for free tier
  features         JSONB            NOT NULL DEFAULT '{}',
  is_active        BOOLEAN          NOT NULL DEFAULT true,
  sort_order       SMALLINT         NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT now(),

  CONSTRAINT ck_plans_price CHECK (price_cents >= 0)
);

CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- One row per user-subscription lifecycle event.
-- A user has at most ONE active subscription at a time (enforced at app layer).
-- Historical rows are retained for billing audit.
CREATE TABLE subscriptions (
  id                       UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id                  UUID                NOT NULL REFERENCES subscription_plans(id),
  status                   subscription_status NOT NULL DEFAULT 'active',
  current_period_start     TIMESTAMPTZ         NOT NULL DEFAULT now(),
  current_period_end       TIMESTAMPTZ         NOT NULL,
  trial_start              TIMESTAMPTZ,
  trial_end                TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN             NOT NULL DEFAULT false,
  cancelled_at             TIMESTAMPTZ,
  -- External billing provider (Stripe, etc.)
  external_subscription_id TEXT,
  external_customer_id     TEXT,
  created_at               TIMESTAMPTZ         NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ         NOT NULL DEFAULT now(),

  CONSTRAINT ck_subs_period CHECK (current_period_end > current_period_start)
);

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- GENRES (hierarchical taxonomy)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE genres (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  slug        TEXT        NOT NULL UNIQUE,
  description TEXT,
  color_hex   CHAR(7),    -- UI accent color, e.g. '#3B82F6'
  parent_id   UUID        REFERENCES genres(id) ON DELETE SET NULL,
  sort_order  SMALLINT    NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_genre_color CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$')
);

-- ════════════════════════════════════════════════════════════════════════════
-- CATALOG: ARTISTS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE artists (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT           NOT NULL,
  slug              TEXT           NOT NULL UNIQUE,
  bio               TEXT,
  image_url         TEXT,          -- profile / avatar
  header_image_url  TEXT,          -- banner / hero
  -- Denormalised counters (refreshed by a scheduled background job)
  monthly_listeners BIGINT         NOT NULL DEFAULT 0,
  total_plays       BIGINT         NOT NULL DEFAULT 0,
  follower_count    INTEGER        NOT NULL DEFAULT 0,
  -- Lifecycle
  status            content_status NOT NULL DEFAULT 'draft',
  -- AI persona definition: the seed prompt that shaped this artist
  persona_prompt    TEXT,
  style_tags        TEXT[]         NOT NULL DEFAULT '{}',
  -- Provenance & review trail
  created_by        UUID           REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by       UUID           REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  published_at      TIMESTAMPTZ,
  archived_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  -- Auto-maintained full-text search vector
  search_vector     TSVECTOR       GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(bio, ''))
  ) STORED,

  CONSTRAINT ck_artists_published CHECK (
    status != 'published' OR published_at IS NOT NULL
  )
);

CREATE TRIGGER trg_artists_updated_at
  BEFORE UPDATE ON artists
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE artist_genres (
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  genre_id  UUID NOT NULL REFERENCES genres(id)  ON DELETE CASCADE,
  PRIMARY KEY (artist_id, genre_id)
);

-- ════════════════════════════════════════════════════════════════════════════
-- CATALOG: ALBUMS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE albums (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT           NOT NULL,
  slug             TEXT,
  artist_id        UUID           NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  cover_url        TEXT,
  description      TEXT,
  release_date     DATE,
  album_type       album_type     NOT NULL DEFAULT 'album',
  -- Denormalised
  total_plays      BIGINT         NOT NULL DEFAULT 0,
  track_count      SMALLINT       NOT NULL DEFAULT 0,
  -- Lifecycle
  status           content_status NOT NULL DEFAULT 'draft',
  created_by       UUID           REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by      UUID           REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  published_at     TIMESTAMPTZ,
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  search_vector    TSVECTOR       GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED,

  CONSTRAINT uq_album_artist_slug UNIQUE (artist_id, slug),
  CONSTRAINT ck_albums_published  CHECK (status != 'published' OR published_at IS NOT NULL)
);

CREATE TRIGGER trg_albums_updated_at
  BEFORE UPDATE ON albums
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE album_genres (
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  genre_id UUID NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (album_id, genre_id)
);

-- ════════════════════════════════════════════════════════════════════════════
-- CATALOG: TRACKS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE tracks (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT           NOT NULL,
  album_id          UUID           NOT NULL REFERENCES albums(id)  ON DELETE CASCADE,
  -- Denormalised primary artist for query convenience; full list is in track_artists
  primary_artist_id UUID           NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  track_number      SMALLINT       NOT NULL DEFAULT 1,
  disc_number       SMALLINT       NOT NULL DEFAULT 1,
  duration_ms       INTEGER        NOT NULL DEFAULT 0,
  explicit          BOOLEAN        NOT NULL DEFAULT false,
  -- Denormalised counters (updated by background job, not inline on writes)
  play_count        BIGINT         NOT NULL DEFAULT 0,
  skip_count        BIGINT         NOT NULL DEFAULT 0,
  -- skip_ratio = skip_count::float / NULLIF(play_count, 0)  (compute in queries)
  -- Lifecycle
  status            content_status NOT NULL DEFAULT 'draft',
  created_by        UUID           REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by       UUID           REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  published_at      TIMESTAMPTZ,
  archived_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  search_vector     TSVECTOR       GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, ''))
  ) STORED,

  CONSTRAINT ck_tracks_duration  CHECK (duration_ms  >= 0),
  CONSTRAINT ck_tracks_track_num CHECK (track_number  > 0),
  CONSTRAINT ck_tracks_disc_num  CHECK (disc_number   > 0),
  CONSTRAINT ck_tracks_published CHECK (status != 'published' OR published_at IS NOT NULL)
);

CREATE TRIGGER trg_tracks_updated_at
  BEFORE UPDATE ON tracks
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Many-to-many: tracks ↔ artists with a typed role.
-- tracks.primary_artist_id is a convenience denorm; the authoritative list lives here.
CREATE TABLE track_artists (
  track_id      UUID              NOT NULL REFERENCES tracks(id)  ON DELETE CASCADE,
  artist_id     UUID              NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  role          track_artist_role NOT NULL DEFAULT 'primary',
  display_order SMALLINT          NOT NULL DEFAULT 0,
  PRIMARY KEY (track_id, artist_id)
);

-- One row per track per quality tier.
-- Serves the correct audio file to free (low_128) vs premium (high_320 / lossless) users.
CREATE TABLE track_audio_files (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id        UUID          NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  quality         audio_quality NOT NULL,
  format          audio_format  NOT NULL DEFAULT 'mp3',
  bitrate_kbps    SMALLINT,
  sample_rate_hz  INTEGER,
  channels        SMALLINT      NOT NULL DEFAULT 2,    -- 1 = mono, 2 = stereo
  file_size_bytes BIGINT,
  storage_url     TEXT          NOT NULL,              -- object storage key / CDN path
  duration_ms     INTEGER,                             -- actual file duration
  checksum_sha256 TEXT,                                -- integrity verification
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT uq_track_audio_quality UNIQUE (track_id, quality),
  CONSTRAINT ck_audio_bitrate       CHECK (bitrate_kbps IS NULL OR bitrate_kbps > 0),
  CONSTRAINT ck_audio_channels      CHECK (channels IN (1, 2))
);

CREATE TABLE track_genres (
  track_id UUID NOT NULL REFERENCES tracks(id)  ON DELETE CASCADE,
  genre_id UUID NOT NULL REFERENCES genres(id)  ON DELETE CASCADE,
  PRIMARY KEY (track_id, genre_id)
);

-- Plain text or LRC (timed) lyrics
CREATE TABLE lyrics (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id        UUID        NOT NULL UNIQUE REFERENCES tracks(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL,
  language        CHAR(2)     NOT NULL DEFAULT 'en',   -- ISO 639-1
  has_timestamps  BOOLEAN     NOT NULL DEFAULT false,  -- true = LRC format [mm:ss.xx]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_lyrics_updated_at
  BEFORE UPDATE ON lyrics
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- USER LIBRARY & SOCIAL GRAPH
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE user_liked_tracks (
  user_id  UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  track_id UUID        NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  liked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);

CREATE TABLE user_saved_albums (
  user_id  UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  album_id UUID        NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, album_id)
);

CREATE TABLE user_followed_artists (
  user_id     UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  artist_id   UUID        NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artist_id)
);

CREATE TABLE user_followed_users (
  follower_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT ck_no_self_follow CHECK (follower_id != followee_id)
);

-- Tracks downloaded for offline playback (premium-only; enforced at app layer)
CREATE TABLE user_offline_tracks (
  user_id         UUID          NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  track_id        UUID          NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  device_id       TEXT          NOT NULL,          -- stable device identifier
  audio_quality   audio_quality NOT NULL,
  downloaded_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,                     -- NULL = active; set on subscription lapse
  file_size_bytes BIGINT,
  PRIMARY KEY (user_id, track_id, device_id)
);

-- ════════════════════════════════════════════════════════════════════════════
-- PLAYLISTS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE playlists (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  description       TEXT,
  cover_url         TEXT,
  owner_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_public         BOOLEAN     NOT NULL DEFAULT true,
  is_collaborative  BOOLEAN     NOT NULL DEFAULT false,
  is_ai_curated     BOOLEAN     NOT NULL DEFAULT false,
  -- Opaque token bumped on any structural change (Spotify snapshot_id pattern).
  -- Lets clients detect stale cached versions without re-fetching the full track list.
  snapshot_id       TEXT        NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  -- Denormalised
  track_count       INTEGER     NOT NULL DEFAULT 0,
  follower_count    INTEGER     NOT NULL DEFAULT 0,
  total_duration_ms BIGINT      NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_playlists_updated_at
  BEFORE UPDATE ON playlists
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Users who follow (but do not own) a playlist
CREATE TABLE user_followed_playlists (
  user_id     UUID        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  playlist_id UUID        NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, playlist_id)
);

-- Users invited to co-edit a collaborative playlist
CREATE TABLE playlist_collaborators (
  playlist_id  UUID                 NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  user_id      UUID                 NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  role         playlist_collab_role NOT NULL DEFAULT 'editor',
  invited_by   UUID                 REFERENCES users(id) ON DELETE SET NULL,
  invited_at   TIMESTAMPTZ          NOT NULL DEFAULT now(),
  accepted_at  TIMESTAMPTZ,         -- NULL = invitation pending
  PRIMARY KEY  (playlist_id, user_id)
);

-- Ordered track list for a playlist
CREATE TABLE playlist_tracks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID        NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    UUID        NOT NULL REFERENCES tracks(id)    ON DELETE CASCADE,
  position    INTEGER     NOT NULL,                          -- 0-indexed
  added_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_playlist_track_position UNIQUE (playlist_id, position),
  CONSTRAINT uq_playlist_track          UNIQUE (playlist_id, track_id),
  CONSTRAINT ck_position_non_negative   CHECK  (position >= 0)
);

-- Immutable audit log for all collaborative playlist mutations
CREATE TABLE playlist_track_edits (
  id              UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id     UUID                 NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  user_id         UUID                 REFERENCES users(id) ON DELETE SET NULL,
  action          playlist_edit_action NOT NULL,
  track_id        UUID                 REFERENCES tracks(id) ON DELETE SET NULL,
  position_before INTEGER,
  position_after  INTEGER,
  metadata        JSONB,
  created_at      TIMESTAMPTZ          NOT NULL DEFAULT now()
  -- Immutable — no updated_at
);

-- ════════════════════════════════════════════════════════════════════════════
-- PLAYBACK EVENTS
-- ════════════════════════════════════════════════════════════════════════════
-- NOTE: play_events and skip_events grow very fast (millions/day at scale).
-- Consider RANGE-partitioning by month on played_at / skipped_at once
-- volume warrants it. Can be applied without downtime using pg_partman.

-- Groups individual play/skip events into a single browsing session
CREATE TABLE listening_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,  -- NULL = anonymous
  device_type TEXT,       -- 'web' | 'ios' | 'android' | 'desktop'
  device_id   TEXT,
  ip_address  INET,
  user_agent  TEXT,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  is_active   BOOLEAN     NOT NULL DEFAULT true
);

CREATE TABLE play_events (
  id                 UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID             REFERENCES users(id)              ON DELETE SET NULL,
  track_id           UUID             NOT NULL REFERENCES tracks(id)    ON DELETE CASCADE,
  session_id         UUID             REFERENCES listening_sessions(id) ON DELETE SET NULL,
  duration_played_ms INTEGER          NOT NULL DEFAULT 0,
  completed          BOOLEAN          NOT NULL DEFAULT false, -- TRUE if >= 80% played
  context_type       playback_context NOT NULL DEFAULT 'unknown',
  context_id         UUID,            -- polymorphic FK to album/playlist/artist
  audio_quality      audio_quality,
  shuffle_active     BOOLEAN,
  played_at          TIMESTAMPTZ      NOT NULL DEFAULT now(),

  CONSTRAINT ck_play_duration CHECK (duration_played_ms >= 0)
);

CREATE TABLE skip_events (
  id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID             REFERENCES users(id)              ON DELETE SET NULL,
  track_id     UUID             NOT NULL REFERENCES tracks(id)    ON DELETE CASCADE,
  session_id   UUID             REFERENCES listening_sessions(id) ON DELETE SET NULL,
  played_ms    INTEGER          NOT NULL DEFAULT 0,  -- ms heard before skip
  context_type playback_context NOT NULL DEFAULT 'unknown',
  context_id   UUID,
  skipped_at   TIMESTAMPTZ      NOT NULL DEFAULT now(),

  CONSTRAINT ck_skip_played CHECK (played_ms >= 0)
);

-- ════════════════════════════════════════════════════════════════════════════
-- RATINGS & REVIEWS
-- ════════════════════════════════════════════════════════════════════════════

-- 1–5 star ratings for tracks and albums (polymorphic).
-- subject_id has no FK because PostgreSQL cannot enforce polymorphic FKs;
-- referential integrity enforced at the application layer.
CREATE TABLE content_ratings (
  id           UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID                 NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_type content_subject_type NOT NULL,
  subject_id   UUID                 NOT NULL,
  rating       SMALLINT             NOT NULL,
  created_at   TIMESTAMPTZ          NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ          NOT NULL DEFAULT now(),

  CONSTRAINT uq_content_rating      UNIQUE (user_id, subject_type, subject_id),
  CONSTRAINT ck_rating_range        CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT ck_rating_subject_type CHECK (subject_type IN ('track', 'album'))
);

CREATE TRIGGER trg_content_ratings_updated_at
  BEFORE UPDATE ON content_ratings
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Short-form text reviews, one per user per subject
CREATE TABLE content_reviews (
  id           UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID                 NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_type content_subject_type NOT NULL,
  subject_id   UUID                 NOT NULL,
  body         TEXT                 NOT NULL,
  is_public    BOOLEAN              NOT NULL DEFAULT true,
  likes_count  INTEGER              NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ          NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ          NOT NULL DEFAULT now(),

  CONSTRAINT uq_content_review      UNIQUE (user_id, subject_type, subject_id),
  CONSTRAINT ck_review_body_length  CHECK (char_length(body) BETWEEN 10 AND 2000),
  CONSTRAINT ck_review_subject_type CHECK (subject_type IN ('track', 'album'))
);

CREATE TRIGGER trg_content_reviews_updated_at
  BEFORE UPDATE ON content_reviews
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE review_likes (
  user_id    UUID        NOT NULL REFERENCES users(id)           ON DELETE CASCADE,
  review_id  UUID        NOT NULL REFERENCES content_reviews(id) ON DELETE CASCADE,
  liked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, review_id)
);

-- ════════════════════════════════════════════════════════════════════════════
-- ACTIVITY FEED
-- ════════════════════════════════════════════════════════════════════════════
-- Fan-out-on-read model for MVP:
--
--   SELECT fe.*
--   FROM   feed_events fe
--   JOIN   user_followed_users ufu ON ufu.followee_id = fe.actor_id
--   WHERE  ufu.follower_id = :me
--     AND  fe.created_at   > now() - interval '7 days'
--   ORDER BY fe.created_at DESC
--   LIMIT 50;
--
-- At scale: replace with a fan-out-on-write worker that materialises a
-- per-user `user_feed` table for O(1) reads.

CREATE TABLE feed_events (
  id           UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID                 NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type   feed_event_type      NOT NULL,
  subject_type content_subject_type NOT NULL,
  subject_id   UUID                 NOT NULL,
  -- Denormalised snapshot for fast feed rendering without joins
  -- e.g. {"subject_name": "Amber Hours", "cover_url": "...", "artist_name": "Solenne"}
  metadata     JSONB                NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ          NOT NULL DEFAULT now()
  -- Immutable — no updated_at
);

-- ════════════════════════════════════════════════════════════════════════════
-- ADS (FREE TIER)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE ad_campaigns (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  advertiser_name  TEXT        NOT NULL,
  start_date       DATE        NOT NULL,
  end_date         DATE        NOT NULL,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_campaign_dates CHECK (end_date >= start_date)
);

CREATE TRIGGER trg_ad_campaigns_updated_at
  BEFORE UPDATE ON ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE ad_assets (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          UUID        NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  audio_url            TEXT        NOT NULL,
  duration_ms          INTEGER     NOT NULL,
  target_genre_ids     UUID[],     -- NULL = no genre restriction
  target_country_codes CHAR(2)[],  -- NULL = no geo restriction
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_ad_duration CHECK (duration_ms > 0)
);

-- High-volume impression log — partition by month if needed
CREATE TABLE ad_impressions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id)              ON DELETE SET NULL,
  ad_asset_id UUID        NOT NULL REFERENCES ad_assets(id) ON DELETE CASCADE,
  session_id  UUID        REFERENCES listening_sessions(id) ON DELETE SET NULL,
  completed   BOOLEAN     NOT NULL DEFAULT false,
  played_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- CONTENT GENERATION JOBS
-- ════════════════════════════════════════════════════════════════════════════
-- Records every CLI / GUI-initiated AI generation request.
-- subject_id is NULL until the agent successfully creates the catalog record.

CREATE TABLE generation_jobs (
  id              UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type        generation_job_type   NOT NULL,
  status          generation_job_status NOT NULL DEFAULT 'pending',
  -- Linked catalog record (populated on job completion)
  subject_id      UUID,
  subject_type    TEXT,  -- 'artist' | 'album' | 'track' | 'lyrics' | 'cover_art'
  -- Agent inputs / outputs
  input_params    JSONB                 NOT NULL DEFAULT '{}',
  output_metadata JSONB,  -- CDN URLs, model version, token usage, generation duration, etc.
  error_message   TEXT,
  -- Timing
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  created_by      UUID                  REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ           NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ           NOT NULL DEFAULT now(),

  CONSTRAINT ck_gen_subject_type CHECK (
    subject_type IS NULL OR subject_type IN (
      'artist', 'album', 'track', 'lyrics', 'cover_art', 'artist_image'
    )
  )
);

CREATE TRIGGER trg_generation_jobs_updated_at
  BEFORE UPDATE ON generation_jobs
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- ADMIN & AUDIT TRAIL
-- ════════════════════════════════════════════════════════════════════════════
-- Immutable append-only log of every status transition and significant edit
-- on catalog content. Written by the internal review tool and agent pipeline.

CREATE TABLE content_audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT        NOT NULL,   -- 'artist' | 'album' | 'track'
  subject_id   UUID        NOT NULL,
  -- Standardised action tokens:
  --   'created' | 'submitted_for_review' | 'approved' | 'rejected'
  --   | 'published' | 'archived' | 'restored' | 'field_updated'
  action       TEXT        NOT NULL,
  old_value    JSONB,
  new_value    JSONB,
  performed_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  note         TEXT,       -- reviewer comment / rejection reason
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  -- Immutable — no updated_at
);

-- ════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════════════════════

-- Users
CREATE UNIQUE INDEX idx_users_email_ci     ON users (lower(email));
CREATE UNIQUE INDEX idx_users_username_ci  ON users (lower(username));
CREATE        INDEX idx_users_role         ON users (role) WHERE role != 'listener';

-- Sessions
CREATE INDEX idx_sessions_user     ON user_sessions (user_id, expires_at DESC);
CREATE INDEX idx_sessions_active   ON user_sessions (expires_at) WHERE revoked_at IS NULL;

-- Subscriptions
CREATE INDEX idx_subs_user         ON subscriptions (user_id);
CREATE INDEX idx_subs_active       ON subscriptions (user_id, status) WHERE status = 'active';

-- Artists
CREATE INDEX idx_artists_status    ON artists (status);
CREATE INDEX idx_artists_search    ON artists USING GIN (search_vector);
CREATE INDEX idx_artists_trgm      ON artists USING GIN (name        gin_trgm_ops);
CREATE INDEX idx_artists_listeners ON artists (monthly_listeners DESC) WHERE status = 'published';

-- Albums
CREATE INDEX idx_albums_artist     ON albums (artist_id);
CREATE INDEX idx_albums_status     ON albums (status);
CREATE INDEX idx_albums_release    ON albums (release_date DESC) WHERE status = 'published';
CREATE INDEX idx_albums_search     ON albums USING GIN (search_vector);
CREATE INDEX idx_albums_trgm       ON albums USING GIN (title        gin_trgm_ops);

-- Tracks
CREATE INDEX idx_tracks_album      ON tracks (album_id, track_number, disc_number);
CREATE INDEX idx_tracks_artist     ON tracks (primary_artist_id);
CREATE INDEX idx_tracks_status     ON tracks (status);
CREATE INDEX idx_tracks_search     ON tracks USING GIN (search_vector);
CREATE INDEX idx_tracks_trgm       ON tracks USING GIN (title        gin_trgm_ops);
CREATE INDEX idx_tracks_plays      ON tracks (play_count DESC) WHERE status = 'published';

-- Track relationships
CREATE INDEX idx_track_artists_a   ON track_artists  (artist_id);
CREATE INDEX idx_track_audio       ON track_audio_files (track_id, quality);
CREATE INDEX idx_artist_genres_g   ON artist_genres  (genre_id);
CREATE INDEX idx_album_genres_g    ON album_genres   (genre_id);
CREATE INDEX idx_track_genres_g    ON track_genres   (genre_id);

-- User library
CREATE INDEX idx_liked_tracks      ON user_liked_tracks   (user_id, liked_at DESC);
CREATE INDEX idx_saved_albums      ON user_saved_albums   (user_id, saved_at DESC);
CREATE INDEX idx_followed_art_u    ON user_followed_artists (user_id);
CREATE INDEX idx_followed_art_a    ON user_followed_artists (artist_id);
CREATE INDEX idx_followed_users_f  ON user_followed_users (follower_id);
CREATE INDEX idx_followed_users_e  ON user_followed_users (followee_id);

-- Playlists
CREATE INDEX idx_playlists_owner   ON playlists       (owner_id);
CREATE INDEX idx_playlists_public  ON playlists       (updated_at DESC) WHERE is_public = true;
CREATE INDEX idx_pl_tracks_pos     ON playlist_tracks (playlist_id, position);
CREATE INDEX idx_pl_edits          ON playlist_track_edits (playlist_id, created_at DESC);

-- Playback
CREATE INDEX idx_sessions_u_time   ON listening_sessions (user_id, started_at DESC);
CREATE INDEX idx_plays_user        ON play_events  (user_id,  played_at DESC);
CREATE INDEX idx_plays_track       ON play_events  (track_id, played_at DESC);
CREATE INDEX idx_plays_session     ON play_events  (session_id);
CREATE INDEX idx_skips_track       ON skip_events  (track_id, skipped_at DESC);
CREATE INDEX idx_skips_user        ON skip_events  (user_id,  skipped_at DESC);

-- Feed
CREATE INDEX idx_feed_actor        ON feed_events (actor_id,    created_at DESC);
CREATE INDEX idx_feed_subject      ON feed_events (subject_type, subject_id, created_at DESC);

-- Ratings & reviews
CREATE INDEX idx_ratings_subject   ON content_ratings (subject_type, subject_id);
CREATE INDEX idx_reviews_subject   ON content_reviews (subject_type, subject_id, created_at DESC);
CREATE INDEX idx_review_likes      ON review_likes    (review_id);

-- Generation jobs
CREATE INDEX idx_gen_pending       ON generation_jobs (status) WHERE status IN ('pending', 'in_progress');
CREATE INDEX idx_gen_subject       ON generation_jobs (subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX idx_gen_creator       ON generation_jobs (created_by, created_at DESC);

-- Audit
CREATE INDEX idx_audit_subject     ON content_audit_log (subject_type, subject_id, created_at DESC);
CREATE INDEX idx_audit_performer   ON content_audit_log (performed_by, created_at DESC);

-- Ads
CREATE INDEX idx_ad_impr_user      ON ad_impressions (user_id,     played_at DESC);
CREATE INDEX idx_ad_impr_asset     ON ad_impressions (ad_asset_id, played_at DESC);

COMMIT;
