-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 20260315_01 — Staging reviews + in-app notifications
--
-- staging_reviews: audit log of every approval/rejection/review action taken on
--   a track that is in the 'review' (staging) state.
--
-- notifications: in-app bell notifications delivered to internal users, e.g.
--   when a publisher sends a track back for revision with notes.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── staging_reviews ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staging_reviews (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id     uuid        NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    reviewer_id  uuid        NOT NULL REFERENCES users(id),
    action       text        NOT NULL CHECK (action IN ('sent_for_review', 'approved', 'rejected')),
    notes        text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staging_reviews_track_id
    ON staging_reviews(track_id);

CREATE INDEX IF NOT EXISTS staging_reviews_track_action
    ON staging_reviews(track_id, created_at DESC);

-- ── notifications ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id     uuid        REFERENCES tracks(id) ON DELETE SET NULL,
    message      text        NOT NULL,
    is_read      boolean     NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- Partial index for fast unread count queries
CREATE INDEX IF NOT EXISTS notifications_recipient_unread
    ON notifications(recipient_id)
    WHERE NOT is_read;

CREATE INDEX IF NOT EXISTS notifications_recipient_created
    ON notifications(recipient_id, created_at DESC);

COMMIT;
