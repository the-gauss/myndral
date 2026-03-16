-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 20260315_02 — Polymorphic staging for artists, albums, and tracks
--
-- Extends staging_reviews and notifications so that both tables can reference
-- any catalog entity type (artist, album, or track), not just tracks.
--
-- Design: nullable FK per entity type + a discriminator column.  A CHECK
-- constraint enforces exactly one FK per row (XOR pattern).  This keeps
-- foreign-key semantics and indexing clean without a polymorphic UUID column.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── staging_reviews ───────────────────────────────────────────────────────────

-- 1. Make the existing track_id nullable (previously NOT NULL).
ALTER TABLE staging_reviews ALTER COLUMN track_id DROP NOT NULL;

-- 2. Add FK columns for the other two entity types.
ALTER TABLE staging_reviews
    ADD COLUMN artist_id uuid REFERENCES artists(id) ON DELETE CASCADE,
    ADD COLUMN album_id  uuid REFERENCES albums(id)  ON DELETE CASCADE;

-- 3. Discriminator column so queries can filter without checking three FKs.
ALTER TABLE staging_reviews
    ADD COLUMN entity_type text NOT NULL DEFAULT 'track'
    CHECK (entity_type IN ('artist', 'album', 'track'));

-- 4. Mutual-exclusion constraint: exactly one entity FK must be set per row.
ALTER TABLE staging_reviews
    ADD CONSTRAINT staging_reviews_entity_xor CHECK (
        (track_id  IS NOT NULL)::int
      + (artist_id IS NOT NULL)::int
      + (album_id  IS NOT NULL)::int
      = 1
    );

-- 5. Indexes for the new FK columns (sparse — only rows where the column is set).
CREATE INDEX IF NOT EXISTS staging_reviews_artist_id
    ON staging_reviews(artist_id) WHERE artist_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS staging_reviews_album_id
    ON staging_reviews(album_id) WHERE album_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS staging_reviews_entity_type
    ON staging_reviews(entity_type, created_at DESC);

-- ── notifications ─────────────────────────────────────────────────────────────

-- notifications.track_id was already nullable (ON DELETE SET NULL), so no
-- ALTER COLUMN needed there.

ALTER TABLE notifications
    ADD COLUMN artist_id  uuid REFERENCES artists(id) ON DELETE SET NULL,
    ADD COLUMN album_id   uuid REFERENCES albums(id)  ON DELETE SET NULL;

ALTER TABLE notifications
    ADD COLUMN entity_type text NOT NULL DEFAULT 'track'
    CHECK (entity_type IN ('artist', 'album', 'track'));

CREATE INDEX IF NOT EXISTS notifications_entity_type
    ON notifications(recipient_id, entity_type, created_at DESC);

COMMIT;
