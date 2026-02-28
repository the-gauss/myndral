-- MyndralAI — initial schema (reference only; migrations managed by Alembic)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fuzzy search

-- ── Users ────────────────────────────────────────────────────────────────────

CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    TEXT NOT NULL UNIQUE,
    email       TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    avatar_url  TEXT,
    hashed_password TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Artists ───────────────────────────────────────────────────────────────────

CREATE TABLE artists (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    bio             TEXT,
    image_url       TEXT,
    monthly_listeners INTEGER NOT NULL DEFAULT 0,
    verified        BOOLEAN NOT NULL DEFAULT false,
    -- AI generation metadata
    persona_prompt  TEXT,
    style_tags      TEXT[],
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Albums ────────────────────────────────────────────────────────────────────

CREATE TABLE albums (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    artist_id   UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    cover_url   TEXT,
    release_date DATE,
    album_type  TEXT NOT NULL DEFAULT 'album',   -- album | single | ep
    genre_tags  TEXT[],
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tracks ────────────────────────────────────────────────────────────────────

CREATE TABLE tracks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT NOT NULL,
    album_id     UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    artist_id    UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    track_number INTEGER NOT NULL DEFAULT 1,
    duration_ms  INTEGER NOT NULL DEFAULT 0,
    audio_url    TEXT,                          -- object storage URL
    play_count   BIGINT NOT NULL DEFAULT 0,
    explicit     BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Lyrics ────────────────────────────────────────────────────────────────────

CREATE TABLE lyrics (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id  UUID NOT NULL UNIQUE REFERENCES tracks(id) ON DELETE CASCADE,
    content   TEXT NOT NULL,
    language  TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Playlists ─────────────────────────────────────────────────────────────────

CREATE TABLE playlists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    cover_url   TEXT,
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_public   BOOLEAN NOT NULL DEFAULT true,
    is_ai_curated BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE playlist_tracks (
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id    UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (playlist_id, track_id)
);

-- ── User library ──────────────────────────────────────────────────────────────

CREATE TABLE user_liked_tracks (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id   UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    liked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, track_id)
);

CREATE TABLE user_followed_artists (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    artist_id   UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    followed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, artist_id)
);

CREATE TABLE user_saved_albums (
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    album_id  UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    saved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, album_id)
);

-- ── Play history ──────────────────────────────────────────────────────────────

CREATE TABLE play_history (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id   UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    played_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_played_ms INTEGER   -- how long the user actually listened
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_tracks_album_id ON tracks(album_id);
CREATE INDEX idx_tracks_artist_id ON tracks(artist_id);
CREATE INDEX idx_albums_artist_id ON albums(artist_id);
CREATE INDEX idx_play_history_user_id ON play_history(user_id);
CREATE INDEX idx_play_history_played_at ON play_history(played_at DESC);
CREATE INDEX idx_artists_name_trgm ON artists USING gin(name gin_trgm_ops);
CREATE INDEX idx_tracks_title_trgm ON tracks USING gin(title gin_trgm_ops);
