-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 20260315_02 — Export licenses
--
-- Tracks download rights granted to users. Designed to be payment-processor
-- agnostic: personal licenses are granted freely (premium users), business
-- licenses will be fulfilled via a payment processor (Stripe, etc.) once
-- integrated. The payment_reference column is the hook for that integration.
--
-- Scalability note: this table is the single source of truth for download
-- rights across web, desktop, and mobile native clients. All platforms check
-- the same API endpoints — no platform-specific logic here.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS export_licenses (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    license_type      text        NOT NULL CHECK (license_type IN ('personal', 'business')),
    subject_type      text        NOT NULL CHECK (subject_type IN ('track', 'album')),
    subject_id        uuid        NOT NULL,
    price_paid_cents  int         NOT NULL DEFAULT 0,
    payment_status    text        NOT NULL DEFAULT 'completed'
                                  CHECK (payment_status IN ('pending', 'completed', 'refunded')),
    -- TODO: store Stripe payment intent ID here once payment processor is integrated
    payment_reference text,
    created_at        timestamptz NOT NULL DEFAULT now()
);

-- One completed license per user per subject (prevents duplicate grants)
CREATE UNIQUE INDEX IF NOT EXISTS export_licenses_unique_completed
    ON export_licenses(user_id, license_type, subject_type, subject_id)
    WHERE payment_status = 'completed';

CREATE INDEX IF NOT EXISTS export_licenses_user_id
    ON export_licenses(user_id, created_at DESC);

COMMIT;
