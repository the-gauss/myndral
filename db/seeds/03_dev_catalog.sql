-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed 03 — Development catalog
-- Creates 5 AI artists, 2 releases each, and sample users / playlists.
--
-- ⚠  DEV / STAGING ONLY — do NOT run in production.
--
-- Idempotent: wrapped in a single transaction with existence checks; safe to
-- re-run. Re-running skips creation where the slug already exists.
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
  -- ── System user (owns all seeded content) ───────────────────────────────
  v_system            UUID;

  -- ── Test accounts ────────────────────────────────────────────────────────
  v_user_admin        UUID;
  v_user_alice        UUID;
  v_user_bob          UUID;

  -- ── Artists ───────────────────────────────────────────────────────────────
  v_nyx               UUID;  -- Nyx Cascade        (Electronic / Ambient)
  v_hollow            UUID;  -- The Hollow Pattern (Indie Rock / Post-Rock)
  v_lyra              UUID;  -- Lyra Voss          (Pop / Synth-Pop)
  v_frac              UUID;  -- Fractured Meridian (Hip-Hop / Trap)
  v_solenne           UUID;  -- Solenne            (R&B / Neo-Soul)

  -- ── Albums ────────────────────────────────────────────────────────────────
  v_signal_decay      UUID;  -- Nyx Cascade         album
  v_resonant_freq     UUID;  -- Nyx Cascade         single
  v_lithic            UUID;  -- The Hollow Pattern  album
  v_post_season       UUID;  -- The Hollow Pattern  EP
  v_electric_past     UUID;  -- Lyra Voss           album
  v_analog_heart      UUID;  -- Lyra Voss           single
  v_null_zone         UUID;  -- Fractured Meridian  album
  v_interrupt         UUID;  -- Fractured Meridian  EP
  v_amber_hours       UUID;  -- Solenne             album
  v_slow_burn         UUID;  -- Solenne             single

  -- ── Genre IDs (looked up by slug) ────────────────────────────────────────
  v_g_electronic      UUID;
  v_g_ambient_elec    UUID;
  v_g_ambient_new_age UUID;
  v_g_lofi_elec       UUID;
  v_g_indie_rock      UUID;
  v_g_post_rock       UUID;
  v_g_alt_rock        UUID;
  v_g_pop             UUID;
  v_g_synth_pop       UUID;
  v_g_indie_pop       UUID;
  v_g_dream_pop       UUID;
  v_g_hip_hop         UUID;
  v_g_trap            UUID;
  v_g_drill           UUID;
  v_g_rnb             UUID;
  v_g_neo_soul        UUID;

  -- ── Playlists ─────────────────────────────────────────────────────────────
  v_pl_staff_picks    UUID;
  v_pl_late_night     UUID;

  -- ── Temp track holders (reused per album) ────────────────────────────────
  v_t1  UUID;  v_t2  UUID;  v_t3  UUID;  v_t4  UUID;
  v_t5  UUID;  v_t6  UUID;  v_t7  UUID;  v_t8  UUID;

BEGIN

  -- ── Resolve genre IDs ─────────────────────────────────────────────────────
  SELECT id INTO v_g_electronic      FROM genres WHERE slug = 'electronic';
  SELECT id INTO v_g_ambient_elec    FROM genres WHERE slug = 'ambient-electronic';
  SELECT id INTO v_g_ambient_new_age FROM genres WHERE slug = 'ambient-new-age';
  SELECT id INTO v_g_lofi_elec       FROM genres WHERE slug = 'lofi-electronic';
  SELECT id INTO v_g_indie_rock      FROM genres WHERE slug = 'indie-rock';
  SELECT id INTO v_g_post_rock       FROM genres WHERE slug = 'post-rock';
  SELECT id INTO v_g_alt_rock        FROM genres WHERE slug = 'alternative-rock';
  SELECT id INTO v_g_pop             FROM genres WHERE slug = 'pop';
  SELECT id INTO v_g_synth_pop       FROM genres WHERE slug = 'synth-pop';
  SELECT id INTO v_g_indie_pop       FROM genres WHERE slug = 'indie-pop';
  SELECT id INTO v_g_dream_pop       FROM genres WHERE slug = 'dream-pop';
  SELECT id INTO v_g_hip_hop         FROM genres WHERE slug = 'hip-hop-rap';
  SELECT id INTO v_g_trap            FROM genres WHERE slug = 'trap';
  SELECT id INTO v_g_drill           FROM genres WHERE slug = 'drill';
  SELECT id INTO v_g_rnb             FROM genres WHERE slug = 'rnb-soul';
  SELECT id INTO v_g_neo_soul        FROM genres WHERE slug = 'neo-soul';

  -- ══════════════════════════════════════════════════════════════════════════
  -- USERS
  -- ══════════════════════════════════════════════════════════════════════════

  -- System / internal user (content attribution)
  INSERT INTO users (username, email, display_name, hashed_password, role,
                     email_verified, is_active)
  VALUES ('system', 'system@myndral.ai', 'MyndralAI System',
          -- bcrypt hash of 'dev-only-not-a-real-password' — never log in with this
          '$2b$12$devplaceholderhashneverloginXXXXXXXXXXXXXXXX',
          'admin', true, true)
  ON CONFLICT (username) DO NOTHING;
  SELECT id INTO v_system FROM users WHERE username = 'system';

  -- Full-access admin login for local development
  -- username: admin_test
  -- password: AdminPass123!
  INSERT INTO users (username, email, display_name, hashed_password, role,
                     email_verified, is_active, country_code)
  VALUES (
    'admin_test',
    'admin@dev.myndral.ai',
    'Admin Test',
    crypt('AdminPass123!', gen_salt('bf', 12)),
    'admin',
    true,
    true,
    'US'
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

  -- Test listener: Alice
  INSERT INTO users (username, email, display_name, hashed_password, role,
                     email_verified, is_active, country_code)
  VALUES ('alice_dev', 'alice@dev.myndral.ai', 'Alice',
          '$2b$12$devplaceholderhashneverloginXXXXXXXXXXXXXXXX',
          'listener', true, true, 'US')
  ON CONFLICT (username) DO NOTHING;
  SELECT id INTO v_user_alice FROM users WHERE username = 'alice_dev';

  -- Test listener: Bob
  INSERT INTO users (username, email, display_name, hashed_password, role,
                     email_verified, is_active, country_code)
  VALUES ('bob_dev', 'bob@dev.myndral.ai', 'Bob',
          '$2b$12$devplaceholderhashneverloginXXXXXXXXXXXXXXXX',
          'listener', true, true, 'GB')
  ON CONFLICT (username) DO NOTHING;
  SELECT id INTO v_user_bob FROM users WHERE username = 'bob_dev';

  -- Give Alice an active premium subscription
  INSERT INTO subscriptions (user_id, plan_id, status,
                             current_period_start, current_period_end)
  SELECT v_user_alice, id, 'active', now(), now() + interval '30 days'
  FROM   subscription_plans WHERE slug = 'premium_monthly'
  ON CONFLICT DO NOTHING;

  -- Give Bob a free subscription (every user should have one)
  INSERT INTO subscriptions (user_id, plan_id, status,
                             current_period_start, current_period_end)
  SELECT v_user_bob, id, 'active', now(), 'infinity'
  FROM   subscription_plans WHERE slug = 'free'
  ON CONFLICT DO NOTHING;

  -- Full-access account gets premium annual subscription
  INSERT INTO subscriptions (user_id, plan_id, status,
                             current_period_start, current_period_end)
  SELECT v_user_admin, id, 'active', now(), now() + interval '365 days'
  FROM   subscription_plans WHERE slug = 'premium_annual'
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════════════════════════════════════
  -- ARTIST 1 — Nyx Cascade (Electronic / Ambient)
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO artists (name, slug, bio, status, persona_prompt, style_tags,
                       monthly_listeners, follower_count, created_by, published_at)
  VALUES (
    'Nyx Cascade',
    'nyx-cascade',
    'Born from feedback loops and half-forgotten signal chains, Nyx Cascade renders the space between sleep and wakefulness into sound. Her productions live in the margin where digital precision dissolves into organic drift.',
    'published',
    'An AI artist persona: introspective electronic producer, ambient textures, dark minimalism, late-night aesthetic, Berlin-influenced, fuses generative synthesis with human imperfection.',
    ARRAY['ambient','electronic','dark','minimalist','nocturnal'],
    187420, 9821, v_system, now() - interval '120 days'
  )
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO v_nyx FROM artists WHERE slug = 'nyx-cascade';

  INSERT INTO artist_genres (artist_id, genre_id)
  VALUES (v_nyx, v_g_electronic), (v_nyx, v_g_ambient_elec), (v_nyx, v_g_ambient_new_age)
  ON CONFLICT DO NOTHING;

  -- Album: Signal Decay
  INSERT INTO albums (title, slug, artist_id, description, release_date,
                      album_type, track_count, status, created_by, published_at)
  VALUES (
    'Signal Decay',
    'signal-decay',
    v_nyx,
    'Eight studies in entropy — electronic compositions that document the beautiful degradation of a signal over time.',
    '2024-09-15',
    'album', 8, 'published', v_system, now() - interval '100 days'
  )
  ON CONFLICT (artist_id, slug) DO NOTHING;
  SELECT id INTO v_signal_decay FROM albums WHERE artist_id = v_nyx AND slug = 'signal-decay';

  INSERT INTO album_genres (album_id, genre_id)
  VALUES (v_signal_decay, v_g_electronic), (v_signal_decay, v_g_ambient_elec)
  ON CONFLICT DO NOTHING;

  -- Tracks: Signal Decay
  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at)
  VALUES ('Pulse Width',       v_signal_decay, v_nyx, 1, 312000, 'published', v_system, now() - interval '100 days')
  ON CONFLICT DO NOTHING RETURNING id INTO v_t1;
  IF v_t1 IS NULL THEN SELECT id INTO v_t1 FROM tracks WHERE album_id = v_signal_decay AND track_number = 1; END IF;

  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at)
  VALUES ('Carrier Wave',      v_signal_decay, v_nyx, 2, 284000, 'published', v_system, now() - interval '100 days')
  ON CONFLICT DO NOTHING RETURNING id INTO v_t2;
  IF v_t2 IS NULL THEN SELECT id INTO v_t2 FROM tracks WHERE album_id = v_signal_decay AND track_number = 2; END IF;

  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at)
  VALUES ('Static Dreams',     v_signal_decay, v_nyx, 3, 355000, 'published', v_system, now() - interval '100 days')
  ON CONFLICT DO NOTHING RETURNING id INTO v_t3;
  IF v_t3 IS NULL THEN SELECT id INTO v_t3 FROM tracks WHERE album_id = v_signal_decay AND track_number = 3; END IF;

  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at)
  VALUES ('Filtered Light',    v_signal_decay, v_nyx, 4, 298000, 'published', v_system, now() - interval '100 days')
  ON CONFLICT DO NOTHING;
  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at)
  VALUES ('Envelope Follower', v_signal_decay, v_nyx, 5, 320000, 'published', v_system, now() - interval '100 days')
  ON CONFLICT DO NOTHING;
  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at)
  VALUES ('Bit Depth',         v_signal_decay, v_nyx, 6, 267000, 'published', v_system, now() - interval '100 days')
  ON CONFLICT DO NOTHING;
  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at)
  VALUES ('Threshold',         v_signal_decay, v_nyx, 7, 391000, 'published', v_system, now() - interval '100 days')
  ON CONFLICT DO NOTHING;
  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at)
  VALUES ('Clock Divide',      v_signal_decay, v_nyx, 8, 428000, 'published', v_system, now() - interval '100 days')
  ON CONFLICT DO NOTHING;

  -- Register primary artist for all Signal Decay tracks
  INSERT INTO track_artists (track_id, artist_id, role)
  SELECT t.id, v_nyx, 'primary' FROM tracks t WHERE t.album_id = v_signal_decay
  ON CONFLICT DO NOTHING;

  -- Genre tags on tracks
  INSERT INTO track_genres (track_id, genre_id)
  SELECT t.id, v_g_electronic FROM tracks t WHERE t.album_id = v_signal_decay
  ON CONFLICT DO NOTHING;
  INSERT INTO track_genres (track_id, genre_id)
  SELECT t.id, v_g_ambient_elec FROM tracks t WHERE t.album_id = v_signal_decay
  ON CONFLICT DO NOTHING;

  -- Single: Resonant Frequency
  INSERT INTO albums (title, slug, artist_id, release_date, album_type,
                      track_count, status, created_by, published_at)
  VALUES ('Resonant Frequency', 'resonant-frequency', v_nyx,
          '2025-01-20', 'single', 1, 'published', v_system, now() - interval '30 days')
  ON CONFLICT (artist_id, slug) DO NOTHING;
  SELECT id INTO v_resonant_freq FROM albums WHERE artist_id = v_nyx AND slug = 'resonant-frequency';

  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at)
  VALUES ('Resonant Frequency', v_resonant_freq, v_nyx, 1, 345000, 'published', v_system, now() - interval '30 days')
  ON CONFLICT DO NOTHING;
  INSERT INTO track_artists (track_id, artist_id, role)
  SELECT t.id, v_nyx, 'primary' FROM tracks t WHERE t.album_id = v_resonant_freq
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════════════════════════════════════
  -- ARTIST 2 — The Hollow Pattern (Indie Rock / Post-Rock)
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO artists (name, slug, bio, status, persona_prompt, style_tags,
                       monthly_listeners, follower_count, created_by, published_at)
  VALUES (
    'The Hollow Pattern',
    'the-hollow-pattern',
    'The Hollow Pattern emerged from the tension between geological time and human attention span. Their music builds slowly — layers of feedback and delayed guitar accreting into forms that feel both ancient and freshly broken.',
    'published',
    'An AI band persona: post-rock / indie rock, cinematic builds, introspective, instrumental-leaning, influences include Mogwai and American Football, uses unconventional time signatures.',
    ARRAY['post-rock','indie-rock','cinematic','instrumental','angular'],
    94310, 5204, v_system, now() - interval '200 days'
  )
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO v_hollow FROM artists WHERE slug = 'the-hollow-pattern';

  INSERT INTO artist_genres (artist_id, genre_id)
  VALUES (v_hollow, v_g_indie_rock), (v_hollow, v_g_post_rock), (v_hollow, v_g_alt_rock)
  ON CONFLICT DO NOTHING;

  -- Album: Lithic Forms
  INSERT INTO albums (title, slug, artist_id, description, release_date,
                      album_type, track_count, status, created_by, published_at)
  VALUES (
    'Lithic Forms',
    'lithic-forms',
    v_hollow,
    'Eight tracks inspired by geological formations — the slow violence of rock becoming landscape.',
    '2024-06-01',
    'album', 8, 'published', v_system, now() - interval '180 days'
  )
  ON CONFLICT (artist_id, slug) DO NOTHING;
  SELECT id INTO v_lithic FROM albums WHERE artist_id = v_hollow AND slug = 'lithic-forms';

  INSERT INTO album_genres (album_id, genre_id)
  VALUES (v_lithic, v_g_post_rock), (v_lithic, v_g_indie_rock)
  ON CONFLICT DO NOTHING;

  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at) VALUES
    ('Basalt',        v_lithic, v_hollow, 1, 267000, 'published', v_system, now() - interval '180 days'),
    ('Feldspar',      v_lithic, v_hollow, 2, 398000, 'published', v_system, now() - interval '180 days'),
    ('Mineral Vein',  v_lithic, v_hollow, 3, 312000, 'published', v_system, now() - interval '180 days'),
    ('Fault Line',    v_lithic, v_hollow, 4, 504000, 'published', v_system, now() - interval '180 days'),
    ('Stratum',       v_lithic, v_hollow, 5, 289000, 'published', v_system, now() - interval '180 days'),
    ('Sediment',      v_lithic, v_hollow, 6, 421000, 'published', v_system, now() - interval '180 days'),
    ('Core Sample',   v_lithic, v_hollow, 7, 338000, 'published', v_system, now() - interval '180 days'),
    ('Pressure Point',v_lithic, v_hollow, 8, 573000, 'published', v_system, now() - interval '180 days')
  ON CONFLICT DO NOTHING;

  INSERT INTO track_artists (track_id, artist_id, role)
  SELECT t.id, v_hollow, 'primary' FROM tracks t WHERE t.album_id = v_lithic
  ON CONFLICT DO NOTHING;

  INSERT INTO track_genres (track_id, genre_id)
  SELECT t.id, v_g_post_rock FROM tracks t WHERE t.album_id = v_lithic
  ON CONFLICT DO NOTHING;

  -- EP: Post-Season
  INSERT INTO albums (title, slug, artist_id, release_date, album_type,
                      track_count, status, created_by, published_at)
  VALUES ('Post-Season', 'post-season', v_hollow,
          '2025-02-10', 'ep', 3, 'published', v_system, now() - interval '18 days')
  ON CONFLICT (artist_id, slug) DO NOTHING;
  SELECT id INTO v_post_season FROM albums WHERE artist_id = v_hollow AND slug = 'post-season';

  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at) VALUES
    ('Dormant',        v_post_season, v_hollow, 1, 348000, 'published', v_system, now() - interval '18 days'),
    ('Overwintering',  v_post_season, v_hollow, 2, 412000, 'published', v_system, now() - interval '18 days'),
    ('First Melt',     v_post_season, v_hollow, 3, 497000, 'published', v_system, now() - interval '18 days')
  ON CONFLICT DO NOTHING;

  INSERT INTO track_artists (track_id, artist_id, role)
  SELECT t.id, v_hollow, 'primary' FROM tracks t WHERE t.album_id = v_post_season
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════════════════════════════════════
  -- ARTIST 3 — Lyra Voss (Pop / Synth-Pop)
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO artists (name, slug, bio, status, persona_prompt, style_tags,
                       monthly_listeners, follower_count, created_by, published_at)
  VALUES (
    'Lyra Voss',
    'lyra-voss',
    'Lyra Voss makes pop music for people who have memorised the periodic table but still cry at sunsets. Her hooks are engineered with scientific precision and delivered with the warmth of someone who genuinely means it.',
    'published',
    'An AI artist persona: synth-pop / indie pop, hooks-first songwriting, bright production, pastoral-meets-electronic imagery, influences include Caroline Polachek and Robyn.',
    ARRAY['synth-pop','pop','catchy','bright','nostalgic'],
    512800, 28300, v_system, now() - interval '300 days'
  )
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO v_lyra FROM artists WHERE slug = 'lyra-voss';

  INSERT INTO artist_genres (artist_id, genre_id)
  VALUES (v_lyra, v_g_synth_pop), (v_lyra, v_g_indie_pop), (v_lyra, v_g_dream_pop)
  ON CONFLICT DO NOTHING;

  -- Album: Electric Pastoral
  INSERT INTO albums (title, slug, artist_id, description, release_date,
                      album_type, track_count, status, created_by, published_at)
  VALUES (
    'Electric Pastoral',
    'electric-pastoral',
    v_lyra,
    'What happens when voltage meets verdure? Eight songs at the intersection of the garden and the grid.',
    '2024-03-21',
    'album', 8, 'published', v_system, now() - interval '280 days'
  )
  ON CONFLICT (artist_id, slug) DO NOTHING;
  SELECT id INTO v_electric_past FROM albums WHERE artist_id = v_lyra AND slug = 'electric-pastoral';

  INSERT INTO album_genres (album_id, genre_id)
  VALUES (v_electric_past, v_g_synth_pop), (v_electric_past, v_g_pop)
  ON CONFLICT DO NOTHING;

  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at) VALUES
    ('Garden Gate',       v_electric_past, v_lyra, 1, 218000, 'published', v_system, now() - interval '280 days'),
    ('Meadow Wire',       v_electric_past, v_lyra, 2, 234000, 'published', v_system, now() - interval '280 days'),
    ('Chlorophyll Kiss',  v_electric_past, v_lyra, 3, 198000, 'published', v_system, now() - interval '280 days'),
    ('Voltage Bloom',     v_electric_past, v_lyra, 4, 241000, 'published', v_system, now() - interval '280 days'),
    ('Dew Circuit',       v_electric_past, v_lyra, 5, 209000, 'published', v_system, now() - interval '280 days'),
    ('Neon Fern',         v_electric_past, v_lyra, 6, 227000, 'published', v_system, now() - interval '280 days'),
    ('Current and Stone', v_electric_past, v_lyra, 7, 254000, 'published', v_system, now() - interval '280 days'),
    ('Photosynthesize',   v_electric_past, v_lyra, 8, 263000, 'published', v_system, now() - interval '280 days')
  ON CONFLICT DO NOTHING;

  INSERT INTO track_artists (track_id, artist_id, role)
  SELECT t.id, v_lyra, 'primary' FROM tracks t WHERE t.album_id = v_electric_past
  ON CONFLICT DO NOTHING;

  INSERT INTO track_genres (track_id, genre_id)
  SELECT t.id, v_g_synth_pop FROM tracks t WHERE t.album_id = v_electric_past
  ON CONFLICT DO NOTHING;

  -- Single: Analog Heart (features Nyx Cascade)
  INSERT INTO albums (title, slug, artist_id, release_date, album_type,
                      track_count, status, created_by, published_at)
  VALUES ('Analog Heart', 'analog-heart', v_lyra,
          '2025-01-06', 'single', 1, 'published', v_system, now() - interval '52 days')
  ON CONFLICT (artist_id, slug) DO NOTHING;
  SELECT id INTO v_analog_heart FROM albums WHERE artist_id = v_lyra AND slug = 'analog-heart';

  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at)
  VALUES ('Analog Heart', v_analog_heart, v_lyra, 1, 231000, 'published', v_system, now() - interval '52 days')
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_t1 FROM tracks WHERE album_id = v_analog_heart AND track_number = 1;

  -- Primary: Lyra Voss; Featured: Nyx Cascade
  INSERT INTO track_artists (track_id, artist_id, role, display_order) VALUES
    (v_t1, v_lyra, 'primary',  0),
    (v_t1, v_nyx,  'featured', 1)
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════════════════════════════════════
  -- ARTIST 4 — Fractured Meridian (Hip-Hop / Trap)
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO artists (name, slug, bio, status, persona_prompt, style_tags,
                       monthly_listeners, follower_count, created_by, published_at)
  VALUES (
    'Fractured Meridian',
    'fractured-meridian',
    'Fractured Meridian raps from inside the machine. His lyrics borrow the vocabulary of systems programming and exploit the ambiguity between technical failure and emotional collapse.',
    'published',
    'An AI rapper persona: dark trap / experimental hip-hop, computer science and hacker imagery, introspective and paranoid tone, influences include Death Grips and JPEGmafia.',
    ARRAY['trap','hip-hop','experimental','dark','technical'],
    321400, 17600, v_system, now() - interval '250 days'
  )
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO v_frac FROM artists WHERE slug = 'fractured-meridian';

  INSERT INTO artist_genres (artist_id, genre_id)
  VALUES (v_frac, v_g_hip_hop), (v_frac, v_g_trap), (v_frac, v_g_drill)
  ON CONFLICT DO NOTHING;

  -- Album: Null Zone
  INSERT INTO albums (title, slug, artist_id, description, release_date,
                      album_type, track_count, status, created_by, published_at)
  VALUES (
    'Null Zone',
    'null-zone',
    v_frac,
    'Ten tracks mapping the undefined behaviour between consciousness and code. May contain explicit content.',
    '2024-07-04',
    'album', 10, 'published', v_system, now() - interval '230 days'
  )
  ON CONFLICT (artist_id, slug) DO NOTHING;
  SELECT id INTO v_null_zone FROM albums WHERE artist_id = v_frac AND slug = 'null-zone';

  INSERT INTO album_genres (album_id, genre_id)
  VALUES (v_null_zone, v_g_trap), (v_null_zone, v_g_hip_hop)
  ON CONFLICT DO NOTHING;

  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, explicit, status, created_by, published_at) VALUES
    ('Void Address',          v_null_zone, v_frac,  1, 198000, false, 'published', v_system, now() - interval '230 days'),
    ('Buffer Overflow',       v_null_zone, v_frac,  2, 215000, true,  'published', v_system, now() - interval '230 days'),
    ('Heap Corruption',       v_null_zone, v_frac,  3, 234000, false, 'published', v_system, now() - interval '230 days'),
    ('Zero Day',              v_null_zone, v_frac,  4, 187000, true,  'published', v_system, now() - interval '230 days'),
    ('Root Access',           v_null_zone, v_frac,  5, 222000, false, 'published', v_system, now() - interval '230 days'),
    ('Stack Trace',           v_null_zone, v_frac,  6, 241000, false, 'published', v_system, now() - interval '230 days'),
    ('Memory Leak',           v_null_zone, v_frac,  7, 209000, true,  'published', v_system, now() - interval '230 days'),
    ('Segfault',              v_null_zone, v_frac,  8, 196000, false, 'published', v_system, now() - interval '230 days'),
    ('Core Dump',             v_null_zone, v_frac,  9, 258000, true,  'published', v_system, now() - interval '230 days'),
    ('Privilege Escalation',  v_null_zone, v_frac, 10, 271000, true,  'published', v_system, now() - interval '230 days')
  ON CONFLICT DO NOTHING;

  INSERT INTO track_artists (track_id, artist_id, role)
  SELECT t.id, v_frac, 'primary' FROM tracks t WHERE t.album_id = v_null_zone
  ON CONFLICT DO NOTHING;

  INSERT INTO track_genres (track_id, genre_id)
  SELECT t.id, v_g_trap FROM tracks t WHERE t.album_id = v_null_zone
  ON CONFLICT DO NOTHING;

  -- EP: Interrupt Vectors (features Nyx Cascade on track 2)
  INSERT INTO albums (title, slug, artist_id, release_date, album_type,
                      track_count, status, created_by, published_at)
  VALUES ('Interrupt Vectors', 'interrupt-vectors', v_frac,
          '2025-02-01', 'ep', 3, 'published', v_system, now() - interval '25 days')
  ON CONFLICT (artist_id, slug) DO NOTHING;
  SELECT id INTO v_interrupt FROM albums WHERE artist_id = v_frac AND slug = 'interrupt-vectors';

  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at) VALUES
    ('IRQ0', v_interrupt, v_frac, 1, 201000, 'published', v_system, now() - interval '25 days'),
    ('IRQ1', v_interrupt, v_frac, 2, 218000, 'published', v_system, now() - interval '25 days'),
    ('IRQ4', v_interrupt, v_frac, 3, 245000, 'published', v_system, now() - interval '25 days')
  ON CONFLICT DO NOTHING;

  -- IRQ1 features Nyx Cascade
  SELECT id INTO v_t2 FROM tracks WHERE album_id = v_interrupt AND track_number = 2;
  INSERT INTO track_artists (track_id, artist_id, role, display_order) VALUES
    (v_t2, v_frac, 'primary',  0),
    (v_t2, v_nyx,  'featured', 1)
  ON CONFLICT DO NOTHING;

  INSERT INTO track_artists (track_id, artist_id, role)
  SELECT t.id, v_frac, 'primary'
  FROM tracks t
  WHERE t.album_id = v_interrupt
    AND NOT EXISTS (
      SELECT 1 FROM track_artists ta WHERE ta.track_id = t.id
    )
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════════════════════════════════════
  -- ARTIST 5 — Solenne (R&B / Neo-Soul)
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO artists (name, slug, bio, status, persona_prompt, style_tags,
                       monthly_listeners, follower_count, created_by, published_at)
  VALUES (
    'Solenne',
    'solenne',
    'Solenne operates at the frequency of late afternoon light. Her music sits somewhere between a warm conversation and a carefully constructed algorithm — lush, unhurried, and quietly devastating.',
    'published',
    'An AI artist persona: neo-soul / R&B, warm analogue production, introspective lyricism, French-inflected aesthetics, influenced by Erykah Badu and Hiatus Kaiyote.',
    ARRAY['neo-soul','r&b','warm','soulful','organic'],
    408700, 23150, v_system, now() - interval '350 days'
  )
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO v_solenne FROM artists WHERE slug = 'solenne';

  INSERT INTO artist_genres (artist_id, genre_id)
  VALUES (v_solenne, v_g_rnb), (v_solenne, v_g_neo_soul)
  ON CONFLICT DO NOTHING;

  -- Album: Amber Hours
  INSERT INTO albums (title, slug, artist_id, description, release_date,
                      album_type, track_count, status, created_by, published_at)
  VALUES (
    'Amber Hours',
    'amber-hours',
    v_solenne,
    'Seven songs written in the hour before golden hour ends — that narrow window when everything looks like it means more than it does.',
    '2024-04-12',
    'album', 7, 'published', v_system, now() - interval '320 days'
  )
  ON CONFLICT (artist_id, slug) DO NOTHING;
  SELECT id INTO v_amber_hours FROM albums WHERE artist_id = v_solenne AND slug = 'amber-hours';

  INSERT INTO album_genres (album_id, genre_id)
  VALUES (v_amber_hours, v_g_neo_soul), (v_amber_hours, v_g_rnb)
  ON CONFLICT DO NOTHING;

  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at) VALUES
    ('Golden Ratio',          v_amber_hours, v_solenne, 1, 231000, 'published', v_system, now() - interval '320 days'),
    ('Chamomile and Chrome',  v_amber_hours, v_solenne, 2, 278000, 'published', v_system, now() - interval '320 days'),
    ('Soft Architecture',     v_amber_hours, v_solenne, 3, 254000, 'published', v_system, now() - interval '320 days'),
    ('Slow Burn Protocol',    v_amber_hours, v_solenne, 4, 312000, 'published', v_system, now() - interval '320 days'),
    ('Velvet Algorithm',      v_amber_hours, v_solenne, 5, 267000, 'published', v_system, now() - interval '320 days'),
    ('Harmonic Debt',         v_amber_hours, v_solenne, 6, 289000, 'published', v_system, now() - interval '320 days'),
    ('Last Light Frequency',  v_amber_hours, v_solenne, 7, 341000, 'published', v_system, now() - interval '320 days')
  ON CONFLICT DO NOTHING;

  INSERT INTO track_artists (track_id, artist_id, role)
  SELECT t.id, v_solenne, 'primary' FROM tracks t WHERE t.album_id = v_amber_hours
  ON CONFLICT DO NOTHING;

  INSERT INTO track_genres (track_id, genre_id)
  SELECT t.id, v_g_neo_soul FROM tracks t WHERE t.album_id = v_amber_hours
  ON CONFLICT DO NOTHING;

  -- Single: Slow Burn (features Lyra Voss)
  INSERT INTO albums (title, slug, artist_id, release_date, album_type,
                      track_count, status, created_by, published_at)
  VALUES ('Slow Burn', 'slow-burn', v_solenne,
          '2025-01-14', 'single', 1, 'published', v_system, now() - interval '44 days')
  ON CONFLICT (artist_id, slug) DO NOTHING;
  SELECT id INTO v_slow_burn FROM albums WHERE artist_id = v_solenne AND slug = 'slow-burn';

  INSERT INTO tracks (title, album_id, primary_artist_id, track_number, duration_ms, status, created_by, published_at)
  VALUES ('Slow Burn', v_slow_burn, v_solenne, 1, 248000, 'published', v_system, now() - interval '44 days')
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_t1 FROM tracks WHERE album_id = v_slow_burn AND track_number = 1;

  INSERT INTO track_artists (track_id, artist_id, role, display_order) VALUES
    (v_t1, v_solenne, 'primary',  0),
    (v_t1, v_lyra,   'featured', 1)
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════════════════════════════════════
  -- SAMPLE PLAY COUNTS (rough data for dev queries)
  -- ══════════════════════════════════════════════════════════════════════════

  UPDATE tracks SET play_count = floor(random() * 50000 + 1000)
  WHERE status = 'published';

  -- ══════════════════════════════════════════════════════════════════════════
  -- SOCIAL DATA — Alice follows artists and likes tracks
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO user_followed_artists (user_id, artist_id) VALUES
    (v_user_alice, v_nyx),
    (v_user_alice, v_lyra),
    (v_user_alice, v_solenne),
    (v_user_bob,   v_hollow),
    (v_user_bob,   v_frac)
  ON CONFLICT DO NOTHING;

  INSERT INTO user_followed_users (follower_id, followee_id) VALUES
    (v_user_alice, v_user_bob),
    (v_user_bob,   v_user_alice)
  ON CONFLICT DO NOTHING;

  -- Alice likes some tracks
  INSERT INTO user_liked_tracks (user_id, track_id)
  SELECT v_user_alice, t.id
  FROM tracks t
  JOIN albums a ON a.id = t.album_id
  WHERE a.artist_id IN (v_nyx, v_lyra)
    AND t.track_number <= 3
  ON CONFLICT DO NOTHING;

  -- Bob saves the Lithic Forms album
  INSERT INTO user_saved_albums (user_id, album_id) VALUES (v_user_bob, v_lithic)
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════════════════════════════════════
  -- PLAYLISTS
  -- ══════════════════════════════════════════════════════════════════════════

  -- Staff picks — AI-curated public playlist
  INSERT INTO playlists (name, description, owner_id, is_public, is_ai_curated, is_collaborative)
  VALUES (
    'Staff Picks: Late February',
    'Hand-selected from the MyndralAI catalog — the editors'' current favourites.',
    v_system, true, true, false
  )
  ON CONFLICT DO NOTHING RETURNING id INTO v_pl_staff_picks;
  IF v_pl_staff_picks IS NULL THEN
    SELECT id INTO v_pl_staff_picks FROM playlists WHERE name = 'Staff Picks: Late February';
  END IF;

  -- Insert a cross-artist selection into staff picks
  INSERT INTO playlist_tracks (playlist_id, track_id, position, added_by)
  SELECT
    v_pl_staff_picks,
    t.id,
    row_number() OVER (ORDER BY t.play_count DESC) - 1,
    v_system
  FROM tracks t
  JOIN albums a ON a.id = t.album_id
  WHERE a.artist_id IN (v_nyx, v_lyra, v_solenne, v_hollow, v_frac)
    AND t.track_number = 1
    AND t.status = 'published'
  ON CONFLICT DO NOTHING;

  UPDATE playlists
  SET track_count = (SELECT count(*) FROM playlist_tracks WHERE playlist_id = v_pl_staff_picks)
  WHERE id = v_pl_staff_picks;

  -- Alice's personal playlist
  INSERT INTO playlists (name, description, owner_id, is_public, is_ai_curated, is_collaborative)
  VALUES ('Late Night Coding', 'What I play at 2am.', v_user_alice, true, false, false)
  ON CONFLICT DO NOTHING RETURNING id INTO v_pl_late_night;
  IF v_pl_late_night IS NULL THEN
    SELECT id INTO v_pl_late_night FROM playlists WHERE name = 'Late Night Coding';
  END IF;

  INSERT INTO playlist_tracks (playlist_id, track_id, position, added_by)
  SELECT
    v_pl_late_night,
    t.id,
    row_number() OVER (ORDER BY a.release_date DESC, t.track_number) - 1,
    v_user_alice
  FROM tracks t
  JOIN albums a ON a.id = t.album_id
  WHERE a.artist_id IN (v_nyx, v_frac)
    AND t.status = 'published'
  ON CONFLICT DO NOTHING;

  UPDATE playlists
  SET track_count = (SELECT count(*) FROM playlist_tracks WHERE playlist_id = v_pl_late_night)
  WHERE id = v_pl_late_night;

  -- Bob follows Alice's playlist
  INSERT INTO user_followed_playlists (user_id, playlist_id) VALUES (v_user_bob, v_pl_late_night)
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════════════════════════════════════
  -- RATINGS & REVIEWS (sample data)
  -- ══════════════════════════════════════════════════════════════════════════

  -- Alice rates Amber Hours album
  INSERT INTO content_ratings (user_id, subject_type, subject_id, rating)
  VALUES (v_user_alice, 'album', v_amber_hours, 5)
  ON CONFLICT (user_id, subject_type, subject_id) DO NOTHING;

  -- Bob rates Null Zone album
  INSERT INTO content_ratings (user_id, subject_type, subject_id, rating)
  VALUES (v_user_bob, 'album', v_null_zone, 4)
  ON CONFLICT (user_id, subject_type, subject_id) DO NOTHING;

  -- Alice reviews Signal Decay
  INSERT INTO content_reviews (user_id, subject_type, subject_id, body)
  VALUES (
    v_user_alice, 'album', v_signal_decay,
    'Clock Divide alone is worth the whole album. Nyx Cascade builds these incredibly patient structures and then just lets them decay in the most beautiful way.'
  )
  ON CONFLICT (user_id, subject_type, subject_id) DO NOTHING;

  RAISE NOTICE 'Dev catalog seed complete.';
  RAISE NOTICE '  Artists created: Nyx Cascade, The Hollow Pattern, Lyra Voss, Fractured Meridian, Solenne';
  RAISE NOTICE '  Users created:   system, alice_dev, bob_dev';

END $$;

COMMIT;
