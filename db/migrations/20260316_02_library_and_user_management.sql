BEGIN;

CREATE TABLE IF NOT EXISTS user_saved_tracks (
  user_id  UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  track_id UUID        NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);

CREATE TABLE IF NOT EXISTS user_liked_albums (
  user_id  UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  album_id UUID        NOT NULL REFERENCES albums(id)  ON DELETE CASCADE,
  liked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, album_id)
);

CREATE TABLE IF NOT EXISTS user_liked_artists (
  user_id   UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  artist_id UUID        NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  liked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artist_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_tracks
  ON user_saved_tracks (user_id, saved_at DESC);

CREATE INDEX IF NOT EXISTS idx_liked_albums
  ON user_liked_albums (user_id, liked_at DESC);

CREATE INDEX IF NOT EXISTS idx_liked_artists_u
  ON user_liked_artists (user_id, liked_at DESC);

CREATE INDEX IF NOT EXISTS idx_liked_artists_a
  ON user_liked_artists (artist_id);

COMMIT;
