-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed 03 — Development users
-- Creates dev login accounts only. No catalog data — content is generated via
-- the internal studio using the ElevenLabs music generation workflow.
--
-- ⚠  DEV / STAGING ONLY — do NOT run in production.
--
-- Idempotent: wrapped in a single transaction; safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF current_setting('app.environment', true) = 'production' THEN
    RAISE EXCEPTION 'Refusing to run dev seed in a production environment.';
  END IF;
END $$;

BEGIN;

DO $$
DECLARE
  v_user_admin  UUID;
  v_user_editor UUID;
  v_user_reviewer UUID;
  v_user_alice  UUID;
  v_user_bob    UUID;

BEGIN

  -- ══════════════════════════════════════════════════════════════════════════
  -- SYSTEM USER (content attribution)
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO users (username, email, display_name, hashed_password, role,
                     email_verified, is_active)
  VALUES ('system', 'system@myndral.ai', 'MyndralAI System',
          '$2b$12$devplaceholderhashneverloginXXXXXXXXXXXXXXXX',
          'admin', true, true)
  ON CONFLICT (username) DO NOTHING;

  -- ══════════════════════════════════════════════════════════════════════════
  -- INTERNAL STUDIO ACCOUNTS
  -- ══════════════════════════════════════════════════════════════════════════

  -- Admin (bypass-user) — username: admin_test / password: AdminPass123!
  INSERT INTO users (username, email, display_name, hashed_password, role,
                     email_verified, is_active, country_code)
  VALUES (
    'admin_test',
    'admin@dev.myndral.ai',
    'Admin Test',
    crypt('AdminPass123!', gen_salt('bf', 12)),
    'admin',
    true, true, 'US'
  )
  ON CONFLICT (username) DO UPDATE
    SET email           = EXCLUDED.email,
        display_name    = EXCLUDED.display_name,
        hashed_password = EXCLUDED.hashed_password,
        role            = EXCLUDED.role,
        email_verified  = EXCLUDED.email_verified,
        is_active       = EXCLUDED.is_active,
        country_code    = EXCLUDED.country_code;
  SELECT id INTO v_user_admin FROM users WHERE username = 'admin_test';

  -- Content reviewer (publisher) — username: reviewer_test / password: ReviewerPass123!
  INSERT INTO users (username, email, display_name, hashed_password, role,
                     email_verified, is_active, country_code)
  VALUES (
    'reviewer_test',
    'reviewer@dev.myndral.ai',
    'Reviewer Test',
    crypt('ReviewerPass123!', gen_salt('bf', 12)),
    'content_reviewer',
    true, true, 'US'
  )
  ON CONFLICT (username) DO UPDATE
    SET email           = EXCLUDED.email,
        display_name    = EXCLUDED.display_name,
        hashed_password = EXCLUDED.hashed_password,
        role            = EXCLUDED.role,
        email_verified  = EXCLUDED.email_verified,
        is_active       = EXCLUDED.is_active,
        country_code    = EXCLUDED.country_code;
  SELECT id INTO v_user_reviewer FROM users WHERE username = 'reviewer_test';

  -- Content editor (creator) — username: editor_test / password: EditorPass123!
  INSERT INTO users (username, email, display_name, hashed_password, role,
                     email_verified, is_active, country_code)
  VALUES (
    'editor_test',
    'editor@dev.myndral.ai',
    'Editor Test',
    crypt('EditorPass123!', gen_salt('bf', 12)),
    'content_editor',
    true, true, 'US'
  )
  ON CONFLICT (username) DO UPDATE
    SET email           = EXCLUDED.email,
        display_name    = EXCLUDED.display_name,
        hashed_password = EXCLUDED.hashed_password,
        role            = EXCLUDED.role,
        email_verified  = EXCLUDED.email_verified,
        is_active       = EXCLUDED.is_active,
        country_code    = EXCLUDED.country_code;
  SELECT id INTO v_user_editor FROM users WHERE username = 'editor_test';

  -- ══════════════════════════════════════════════════════════════════════════
  -- LISTENER TEST ACCOUNTS (for player app dev/testing)
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO users (username, email, display_name, hashed_password, role,
                     email_verified, is_active, country_code)
  VALUES ('alice_dev', 'alice@dev.myndral.ai', 'Alice Dev',
          '$2b$12$devplaceholderhashneverloginXXXXXXXXXXXXXXXX',
          'listener', true, true, 'US')
  ON CONFLICT (username) DO NOTHING;
  SELECT id INTO v_user_alice FROM users WHERE username = 'alice_dev';

  INSERT INTO users (username, email, display_name, hashed_password, role,
                     email_verified, is_active, country_code)
  VALUES ('bob_dev', 'bob@dev.myndral.ai', 'Bob Dev',
          '$2b$12$devplaceholderhashneverloginXXXXXXXXXXXXXXXX',
          'listener', true, true, 'GB')
  ON CONFLICT (username) DO NOTHING;
  SELECT id INTO v_user_bob FROM users WHERE username = 'bob_dev';

  -- ══════════════════════════════════════════════════════════════════════════
  -- SUBSCRIPTIONS (player app listener accounts only)
  -- Studio accounts (admin, reviewer, editor) have no subscription plan —
  -- access is governed by role, not plan.
  -- ══════════════════════════════════════════════════════════════════════════

  -- Alice gets premium monthly, Bob gets free
  INSERT INTO subscriptions (user_id, plan_id, status,
                             current_period_start, current_period_end)
  SELECT v_user_alice, id, 'active', now(), now() + interval '30 days'
  FROM   subscription_plans WHERE slug = 'premium_monthly'
  ON CONFLICT DO NOTHING;

  INSERT INTO subscriptions (user_id, plan_id, status,
                             current_period_start, current_period_end)
  SELECT v_user_bob, id, 'active', now(), 'infinity'
  FROM   subscription_plans WHERE slug = 'free'
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Dev seed complete.';
  RAISE NOTICE '  Studio accounts: admin_test (admin), reviewer_test (content_reviewer), editor_test (content_editor)';
  RAISE NOTICE '  Listener accounts: alice_dev, bob_dev';
  RAISE NOTICE '  No catalog data seeded — generate content via the internal studio.';

END $$;

COMMIT;
