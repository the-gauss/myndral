-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed 01 — Genre taxonomy
-- Idempotent: safe to re-run (ON CONFLICT DO NOTHING).
-- Two-pass insert: top-level genres first, then sub-genres referencing parents.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Top-level genres ──────────────────────────────────────────────────────────

INSERT INTO genres (name, slug, description, color_hex, parent_id, sort_order) VALUES
  ('Electronic',       'electronic',       'Machine-made beats and synthesised sound.',                    '#3B82F6', NULL,  1),
  ('Hip-Hop & Rap',    'hip-hop-rap',      'Rhythm, rhyme, and beats rooted in urban culture.',           '#8B5CF6', NULL,  2),
  ('Pop',              'pop',              'Catchy, melodic music built for wide appeal.',                 '#EC4899', NULL,  3),
  ('Rock',             'rock',             'Guitar-driven energy from garage to stadium.',                 '#EF4444', NULL,  4),
  ('R&B & Soul',       'rnb-soul',         'Warm vocals, groove, and emotional depth.',                   '#F59E0B', NULL,  5),
  ('Jazz',             'jazz',             'Improvisation, swing, and harmonic complexity.',               '#10B981', NULL,  6),
  ('Classical',        'classical',        'Orchestral and composed traditions spanning centuries.',       '#6366F1', NULL,  7),
  ('Folk & Acoustic',  'folk-acoustic',    'Storytelling through voice and acoustic instruments.',        '#84CC16', NULL,  8),
  ('Country',          'country',          'Heartfelt narratives with roots in Americana.',                '#F97316', NULL,  9),
  ('Latin',            'latin',            'Rhythmic energy from across Latin America.',                  '#DC2626', NULL, 10),
  ('Reggae',           'reggae',           'Laid-back rhythms and conscious lyrics from Jamaica.',        '#22C55E', NULL, 11),
  ('Blues',            'blues',            'Raw emotion and the root of modern popular music.',           '#2563EB', NULL, 12),
  ('Metal',            'metal',            'Heavy, aggressive, and technically demanding music.',         '#374151', NULL, 13),
  ('World Music',      'world-music',      'Global sounds beyond Western genres.',                        '#14B8A6', NULL, 14),
  ('Ambient & New Age','ambient-new-age',  'Atmospheric soundscapes for focus and relaxation.',           '#7C3AED', NULL, 15),
  ('Funk',             'funk',             'Groove-first music built on syncopated bass and rhythm.',     '#D97706', NULL, 16)
ON CONFLICT (slug) DO NOTHING;

-- ── Electronic sub-genres ─────────────────────────────────────────────────────

INSERT INTO genres (name, slug, description, color_hex, parent_id, sort_order)
SELECT
  sub.name, sub.slug, sub.description, sub.color_hex,
  p.id AS parent_id,
  sub.sort_order
FROM (VALUES
  ('House',              'house',              'Four-on-the-floor rhythms and soulful synthesisers.',        '#60A5FA',  1),
  ('Techno',             'techno',             'Relentless mechanical pulse from the dance floor.',          '#1D4ED8',  2),
  ('Drum & Bass',        'drum-and-bass',      'High-tempo breakbeats and rolling sub-bass.',               '#2563EB',  3),
  ('Dubstep',            'dubstep',            'Wobbly bass drops and syncopated half-time rhythms.',       '#4F46E5',  4),
  ('Trance',             'trance',             'Hypnotic arpeggios and euphoric breakdowns.',               '#7C3AED',  5),
  ('IDM',                'idm',                'Intricate, experimental electronic compositions.',          '#6D28D9',  6),
  ('Lo-fi Electronic',   'lofi-electronic',    'Dusty textures and relaxed electronic beats.',             '#3B82F6',  7),
  ('Ambient Electronic', 'ambient-electronic', 'Evolving pads and textural sound design.',                  '#93C5FD',  8),
  ('Electro',            'electro',            'Robotic funk with drum-machine rhythms.',                   '#BFDBFE',  9),
  ('UK Garage',          'uk-garage',          'Skippy rhythms and pitched vocals from the UK underground.','#5B21B6', 10)
) AS sub(name, slug, description, color_hex, sort_order)
JOIN genres p ON p.slug = 'electronic'
ON CONFLICT (slug) DO NOTHING;

-- ── Hip-Hop & Rap sub-genres ──────────────────────────────────────────────────

INSERT INTO genres (name, slug, description, color_hex, parent_id, sort_order)
SELECT sub.name, sub.slug, sub.description, sub.color_hex, p.id, sub.sort_order
FROM (VALUES
  ('Trap',          'trap',          'Heavy 808s, hi-hat rolls, and street narratives.',          '#7C3AED', 1),
  ('Lo-fi Hip-Hop', 'lofi-hip-hop',  'Mellow beats with vinyl crackle and jazzy samples.',       '#A78BFA', 2),
  ('Boom Bap',      'boom-bap',      'Classic sampled breaks and lyrical dexterity.',             '#8B5CF6', 3),
  ('Conscious Rap', 'conscious-rap', 'Politically and socially aware lyricism.',                  '#6D28D9', 4),
  ('Drill',         'drill',         'Dark, menacing beats and street reportage.',                '#4C1D95', 5),
  ('Cloud Rap',     'cloud-rap',     'Hazy, ethereal textures and introspective lyrics.',         '#C4B5FD', 6),
  ('Phonk',         'phonk',         'Memphis rap aesthetics with distorted 808s.',               '#5B21B6', 7)
) AS sub(name, slug, description, color_hex, sort_order)
JOIN genres p ON p.slug = 'hip-hop-rap'
ON CONFLICT (slug) DO NOTHING;

-- ── Pop sub-genres ────────────────────────────────────────────────────────────

INSERT INTO genres (name, slug, description, color_hex, parent_id, sort_order)
SELECT sub.name, sub.slug, sub.description, sub.color_hex, p.id, sub.sort_order
FROM (VALUES
  ('Indie Pop',     'indie-pop',     'Lo-fi charm with hook-driven songwriting.',                '#F9A8D4', 1),
  ('Synth-Pop',     'synth-pop',     'Neon-lit melodies powered by analogue synthesisers.',      '#EC4899', 2),
  ('Dance-Pop',     'dance-pop',     'Radio-ready beats engineered for the dance floor.',        '#DB2777', 3),
  ('Bedroom Pop',   'bedroom-pop',   'Intimate home-recorded aesthetics and confessional lyrics.','#FBCFE8', 4),
  ('Dream Pop',     'dream-pop',     'Shimmering guitars, reverb-drenched vocals.',              '#FDF4FF', 5),
  ('Art Pop',       'art-pop',       'Experimental ideas wrapped in accessible pop structure.',  '#E879F9', 6),
  ('K-Pop',         'k-pop',         'High-production Korean pop with synchronised choreography.','#F0ABFC', 7)
) AS sub(name, slug, description, color_hex, sort_order)
JOIN genres p ON p.slug = 'pop'
ON CONFLICT (slug) DO NOTHING;

-- ── Rock sub-genres ───────────────────────────────────────────────────────────

INSERT INTO genres (name, slug, description, color_hex, parent_id, sort_order)
SELECT sub.name, sub.slug, sub.description, sub.color_hex, p.id, sub.sort_order
FROM (VALUES
  ('Indie Rock',       'indie-rock',       'Independent spirit with guitar-led songwriting.',       '#FCA5A5', 1),
  ('Alternative Rock', 'alternative-rock', 'Unconventional sounds on the mainstream edge.',         '#EF4444', 2),
  ('Psychedelic Rock', 'psychedelic-rock', 'Mind-expanding textures and extended jams.',            '#F87171', 3),
  ('Post-Rock',        'post-rock',        'Instrumental builds and cinematic soundscapes.',        '#DC2626', 4),
  ('Punk Rock',        'punk-rock',        'Fast, raw, and rebellious three-chord energy.',         '#B91C1C', 5),
  ('Garage Rock',      'garage-rock',      'Rough, live-feeling rock stripped to its essentials.', '#FECACA', 6)
) AS sub(name, slug, description, color_hex, sort_order)
JOIN genres p ON p.slug = 'rock'
ON CONFLICT (slug) DO NOTHING;

-- ── Metal sub-genres ──────────────────────────────────────────────────────────

INSERT INTO genres (name, slug, description, color_hex, parent_id, sort_order)
SELECT sub.name, sub.slug, sub.description, sub.color_hex, p.id, sub.sort_order
FROM (VALUES
  ('Heavy Metal',  'heavy-metal',  'Loud, distorted, and powerful guitar riffs.',              '#4B5563', 1),
  ('Black Metal',  'black-metal',  'Atmospheric darkness, blast beats, and tremolo picking.', '#1F2937', 2),
  ('Death Metal',  'death-metal',  'Extreme aggression with growled vocals and speed.',        '#374151', 3),
  ('Doom Metal',   'doom-metal',   'Slow, heavy riffs evoking dread and melancholy.',          '#6B7280', 4),
  ('Post-Metal',   'post-metal',   'Atmospheric and dynamic metallic soundscapes.',            '#9CA3AF', 5),
  ('Nu-Metal',     'nu-metal',     'Hip-hop grooves fused with heavy guitar textures.',        '#111827', 6)
) AS sub(name, slug, description, color_hex, sort_order)
JOIN genres p ON p.slug = 'metal'
ON CONFLICT (slug) DO NOTHING;

-- ── R&B & Soul sub-genres ─────────────────────────────────────────────────────

INSERT INTO genres (name, slug, description, color_hex, parent_id, sort_order)
SELECT sub.name, sub.slug, sub.description, sub.color_hex, p.id, sub.sort_order
FROM (VALUES
  ('Neo-Soul',         'neo-soul',         'Soulful vocals with jazz, funk, and hip-hop influences.',   '#FCD34D', 1),
  ('Contemporary R&B', 'contemporary-rnb', 'Modern production with silky vocals and hip-hop rhythms.',  '#F59E0B', 2),
  ('Nu-Soul',          'nu-soul',          'Organic textures updating classic soul for modern ears.',    '#D97706', 3),
  ('Gospel',           'gospel',           'Uplifting spiritual music rooted in the Black church.',     '#FEF3C7', 4)
) AS sub(name, slug, description, color_hex, sort_order)
JOIN genres p ON p.slug = 'rnb-soul'
ON CONFLICT (slug) DO NOTHING;

-- ── Jazz sub-genres ───────────────────────────────────────────────────────────

INSERT INTO genres (name, slug, description, color_hex, parent_id, sort_order)
SELECT sub.name, sub.slug, sub.description, sub.color_hex, p.id, sub.sort_order
FROM (VALUES
  ('Smooth Jazz',  'smooth-jazz',  'Accessible, polished jazz with crossover appeal.',          '#6EE7B7', 1),
  ('Bebop',        'bebop',        'Fast tempos, complex chord changes, and virtuoso solos.',   '#10B981', 2),
  ('Jazz Fusion',  'jazz-fusion',  'Jazz blended with rock, funk, and electronic elements.',    '#34D399', 3),
  ('Free Jazz',    'free-jazz',    'Avant-garde improvisation with minimal harmonic constraints.','#059669', 4),
  ('Nu Jazz',      'nu-jazz',      'Jazz aesthetics applied to electronic and downtempo beats.','#A7F3D0', 5)
) AS sub(name, slug, description, color_hex, sort_order)
JOIN genres p ON p.slug = 'jazz'
ON CONFLICT (slug) DO NOTHING;

-- ── Classical sub-genres ──────────────────────────────────────────────────────

INSERT INTO genres (name, slug, description, color_hex, parent_id, sort_order)
SELECT sub.name, sub.slug, sub.description, sub.color_hex, p.id, sub.sort_order
FROM (VALUES
  ('Contemporary Classical', 'contemporary-classical', 'Post-tonal composition for the modern era.',          '#A5B4FC', 1),
  ('Orchestral',             'orchestral',             'Full symphony and chamber orchestra compositions.',    '#818CF8', 2),
  ('Chamber Music',          'chamber-music',          'Intimate ensemble music from quartets to quintets.', '#6366F1', 3),
  ('Film Score',             'film-score',             'Cinematic music composed to accompany visual media.', '#4F46E5', 4),
  ('Minimalist',             'minimalist',             'Repetitive structures and gradual textural shifts.',  '#C7D2FE', 5)
) AS sub(name, slug, description, color_hex, sort_order)
JOIN genres p ON p.slug = 'classical'
ON CONFLICT (slug) DO NOTHING;

-- ── Folk & Acoustic sub-genres ────────────────────────────────────────────────

INSERT INTO genres (name, slug, description, color_hex, parent_id, sort_order)
SELECT sub.name, sub.slug, sub.description, sub.color_hex, p.id, sub.sort_order
FROM (VALUES
  ('Indie Folk',        'indie-folk',        'Folk aesthetics with indie sensibility.',                  '#BEF264', 1),
  ('Singer-Songwriter', 'singer-songwriter', 'Personal narratives performed solo or in small groups.',  '#A3E635', 2),
  ('Americana',         'americana',         'Hybrid of folk, country, blues, and rock.',               '#65A30D', 3)
) AS sub(name, slug, description, color_hex, sort_order)
JOIN genres p ON p.slug = 'folk-acoustic'
ON CONFLICT (slug) DO NOTHING;

-- ── Latin sub-genres ──────────────────────────────────────────────────────────

INSERT INTO genres (name, slug, description, color_hex, parent_id, sort_order)
SELECT sub.name, sub.slug, sub.description, sub.color_hex, p.id, sub.sort_order
FROM (VALUES
  ('Reggaeton', 'reggaeton', 'Spanish-language rap over dembow rhythms.',                     '#FCA5A5', 1),
  ('Latin Pop', 'latin-pop', 'Pop production applied to Latin American song traditions.',     '#F87171', 2),
  ('Bossa Nova', 'bossa-nova', 'Brazilian samba fused with jazz harmonies and cool vocals.', '#FECACA', 3),
  ('Salsa',     'salsa',     'Afro-Cuban rhythms with brass and percussion energy.',          '#DC2626', 4)
) AS sub(name, slug, description, color_hex, sort_order)
JOIN genres p ON p.slug = 'latin'
ON CONFLICT (slug) DO NOTHING;

COMMIT;
