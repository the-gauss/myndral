BEGIN;

DO $$
BEGIN
  ALTER TYPE generation_job_type ADD VALUE IF NOT EXISTS 'music_generation';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE generation_jobs
  DROP CONSTRAINT IF EXISTS ck_gen_subject_type;

ALTER TABLE generation_jobs
  ADD CONSTRAINT ck_gen_subject_type CHECK (
    subject_type IS NULL OR subject_type IN (
      'artist', 'album', 'track', 'lyrics', 'cover_art', 'artist_image', 'music_generation'
    )
  );

COMMIT;
