-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 20260316_01 — extend audio_format enum with WAV
--
-- WAV (PCM/RIFF) is accepted by the upload and link-external handlers but was
-- missing from the enum, causing InvalidTextRepresentationError on every .wav
-- upload.  ADD VALUE IF NOT EXISTS is safe to replay.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE audio_format ADD VALUE IF NOT EXISTS 'wav';
