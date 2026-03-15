# Decisions Log

Senior engineering decisions, notable architectural choices, and meaningful bugs fixed.
Each entry follows STAR format (Situation → Task → Action → Result).

---

## 2026-03-15 — Polymorphic Staging Pipeline: Full Content Flow (Artist → Album → Track → Player)

**Situation:** Tracks approved in staging never appeared in the user-facing player. Two root causes: (1) public catalog APIs filter on `artists.status='published' AND albums.status='published'` — approving a track in isolation left the parent album/artist unpublished, making the track invisible. (2) Staging only supported tracks; artists and albums had no review lifecycle, making the hierarchy incomplete.

**Task:** Build a complete end-to-end flow: Create → Staging → Player (approve) or Archive (reject) or Notification (revision), consistent across all three entity types.

**Action:**
1. **Polymorphic `staging_reviews` + `notifications` tables** — added nullable FK columns (`artist_id`, `album_id`) alongside existing `track_id`, with an `entity_type` discriminator and XOR `CHECK` constraint (`(track_id IS NOT NULL)::int + (artist_id IS NOT NULL)::int + (album_id IS NOT NULL)::int = 1`). This preserves FK integrity and indexability while supporting all entity types in a single table — avoiding a generic UUID antipattern.

2. **No-draft consistency** — removed `status` from all `Create*Request` pydantic models. Every artist/album/track is born at `status='review'`. Status transitions happen exclusively through staging endpoints, making it impossible to bypass the review cycle via the API.

3. **Auto-cascade approval for tracks** — when a track is approved, the backend checks and auto-publishes its parent album and grandparent artist if they are not yet published. This solves the visibility gap without requiring reviewers to manually approve the full hierarchy before the track can appear in the player.

4. **Preview-before-submit UX** — all three creation panels (Artist, Album, Song) use a two-step form → preview card → confirm flow, consistent with how downstream actions (approve/reject) work. Prevents accidental submissions and gives a last review moment.

5. **External URL linking** — `POST /v1/internal/music/link` accepts a pre-hosted CDN or local `data/` URL instead of uploading bytes. Uses the same DB pipeline as file upload (job record + track + audio_file). Format is inferred from the URL file extension; local metadata (duration, bitrate) is read via Mutagen where available.

6. **Archive + restore** — rejected items go to `status='archived'`. `GET /archive` returns the same `StagingQueue` shape as staging. Restore endpoints (`POST /archive/{entity_type}/{id}/restore`) return items to `status='review'` so they re-enter the staging queue for another review cycle.

7. **Dashboard refactor** — the 53KB monolithic Dashboard was replaced with a thin nav shell that delegates entirely to self-contained panel components (`CreateArtistPanel`, `CreateAlbumPanel`, `CreateMusicPanel`, `StagingPanel`, `ArchivePanel`). The old "Tracks" tab was removed; track catalog browse is now embedded in `CreateMusicPanel`.

**Result:** Complete end-to-end content pipeline. A content editor creates an artist, album, and song — all three go to staging for review. Approving the track automatically surfaces it in the player (via cascade publish). Rejecting sends a notification with the reviewer's note and archives the item. Archive items are recoverable. Notification bell deep-links to the relevant entity in the staging panel via a `StagingNavTarget` discriminated union.

---
