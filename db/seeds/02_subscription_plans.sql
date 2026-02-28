-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed 02 — Subscription plans
-- Idempotent: ON CONFLICT (slug) DO UPDATE keeps features in sync with reality.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

INSERT INTO subscription_plans
  (slug, display_name, price_cents, currency, billing_interval, features, sort_order)
VALUES

-- ── Free ──────────────────────────────────────────────────────────────────────
(
  'free',
  'Free',
  0,
  'USD',
  NULL,
  '{
    "ads_enabled":         true,
    "max_skips_per_hour":  6,
    "max_audio_quality":   "low_128",
    "offline_downloads":   false,
    "max_offline_tracks":  0,
    "on_demand_playback":  false,
    "lossless_available":  false,
    "shuffle_only_mobile": true,
    "concurrent_streams":  1
  }'::jsonb,
  1
),

-- ── Premium Monthly ───────────────────────────────────────────────────────────
(
  'premium_monthly',
  'Premium',
  999,
  'USD',
  'monthly',
  '{
    "ads_enabled":         false,
    "max_skips_per_hour":  null,
    "max_audio_quality":   "high_320",
    "offline_downloads":   true,
    "max_offline_tracks":  10000,
    "on_demand_playback":  true,
    "lossless_available":  true,
    "shuffle_only_mobile": false,
    "concurrent_streams":  1
  }'::jsonb,
  2
),

-- ── Premium Annual (same features, 17 % saving over monthly) ─────────────────
(
  'premium_annual',
  'Premium (Annual)',
  9999,
  'USD',
  'annual',
  '{
    "ads_enabled":         false,
    "max_skips_per_hour":  null,
    "max_audio_quality":   "high_320",
    "offline_downloads":   true,
    "max_offline_tracks":  10000,
    "on_demand_playback":  true,
    "lossless_available":  true,
    "shuffle_only_mobile": false,
    "concurrent_streams":  1
  }'::jsonb,
  3
)

ON CONFLICT (slug) DO UPDATE
  SET display_name     = EXCLUDED.display_name,
      price_cents      = EXCLUDED.price_cents,
      billing_interval = EXCLUDED.billing_interval,
      features         = EXCLUDED.features,
      updated_at       = now();

COMMIT;
