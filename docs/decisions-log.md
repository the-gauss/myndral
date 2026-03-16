# Decisions Log

Senior engineering decisions, notable architectural choices, and meaningful bugs fixed.
Each entry follows STAR format (Situation → Task → Action → Result).

---

## 2026-03-16 — Minkowski Theme Mode: Paper Texture + Neutralized Media Across Web, Studio, and iOS

**Situation:** The premium Minkowski theme was still inheriting the new glass/orb language from Light and Dark, which diluted its identity. On iOS it also failed to feel typographically distinct, and several listener screens had grown explanatory copy blocks that competed with the actual content.

**Task:** Re-establish Minkowski as a calm paper-mode experience without regressing the Light/Dark redesign, and do it through the shared brand layer so future theme-kit changes remain centralized.

**Action:**
1. **Paper-mode semantics pushed into shared brand tokens** — updated `shared/brand/tokens.css` so Minkowski now defines opaque paper surfaces, muted beige secondary tones, texture helper tokens, and media wash overlays. This gives web and iOS the same shared source for texture-adjacent theme behavior instead of ad hoc per-app overrides.

2. **Theme-specific rendering instead of palette swapping** — web and Studio gained `data-theme="paper"` CSS overrides that disable glass blur/orb motion, replace them with layered parchment backgrounds, and soften surface shadows into printed-paper depth. On iOS, `ScreenView`, `GlassSurface`, and the tab bar now branch for `paper` so Minkowski uses textured, non-vibrant surfaces rather than translucent glass.

3. **Media neutralization as a system rule** — paper theme artwork now receives a consistent sepia/beige wash in both web and iOS, including artist hero media on the web side and shared `RemoteArtwork` rendering on iOS. This keeps user/content imagery from fighting the warm editorial palette.

4. **iOS content density reset** — removed non-essential descriptive copy cards from the listener app's visible tabs so Home, Library, Search, and Account emphasize actions and catalog content rather than onboarding prose.

**Result:** Minkowski now behaves like a distinct premium mode instead of “Light/Dark with different colors.” The texture, media treatment, and typography are theme-scoped, Light/Dark stay untouched, and the shared brand layer remains the place to evolve cross-platform visual identity.

---

## 2026-03-16 — Cross-Platform Glass Redesign: Shared Palette Translation Across Web, Studio, and iOS

**Situation:** The repo had three user-facing surfaces with diverging presentation layers: the web player, the internal Studio app, and the new iOS client. A major redesign needed to land consistently across all of them, while keeping future brand-kit updates centralized in `shared/brand` instead of duplicated inside each app.

**Task:** Re-theme Light and Dark mode around a new slate/steel/orange palette, introduce a more premium glass-and-vibrancy visual system, and keep Minkowski visually stable while making the redesign reusable across platforms.

**Action:**
1. **Palette moved through the shared brand source of truth** — updated `shared/brand/tokens.css` and `shared/brand/theme.ts` so Light and Dark now derive from the new palette directly at the token layer. Semantic RGB helpers were added so web Tailwind themes and native iOS theme generation can both consume the same shared values without app-specific color duplication.

2. **Semantic remapping in each web client** — both `apps/web` and `apps/internal-web` now import the shared token file and map Tailwind semantic colors (`background`, `foreground`, `accent`, `danger`, etc.) from shared brand variables. This made it possible to redesign cards, navigation, overlays, and auth forms with token-driven classes rather than hardcoded palette values.

3. **Reusable glass primitives instead of one-off styling** — introduced shared UI affordances such as glass panels, pills, and glass inputs in the web CSS layers, and strengthened the native `GlassSurface` primitive plus translucent tab bar treatment on iOS. The redesign therefore propagates by composing a small set of branded primitives rather than repainting every screen by hand.

4. **Motion tuned as a system, not decoration** — slowed interaction timing curves and added soft entrance/ambient movement patterns so the redesign feels deliberate and premium without introducing flashy, high-frequency animation. Motion remains tied to surfaces, transitions, and hierarchy rather than ornamental effects.

**Result:** The repo now has a unified first-pass redesign spanning the listener web player, Studio, and iOS, with Light/Dark palette changes flowing from `shared/brand` into all three clients. Future brand updates can primarily happen in the shared token layer, while platform-specific code focuses on layout and interaction patterns instead of duplicating visual constants.

---

## 2026-03-16 — iOS Client First Draft: Shared Brand Sync + Web-Parity API Surface

**Situation:** The repo had a production web client and API, but no iOS app. The new client needed to match the currently working web listener experience without changing existing backend or web code, and brand-sensitive presentation had to stay centralized in `shared/brand`.

**Task:** Introduce a new iOS app that is functionally aligned with the web app, consumes the same API contract, and minimizes brand drift by treating `shared/brand` as the source of truth for listener-facing theme values.

**Action:**
1. **Isolated Expo/React Native app under `apps/ios`** — kept all implementation inside the new app so existing `apps/api`, `apps/web`, and other repo surfaces remained untouched. This made the platform expansion additive rather than risky to the current product.

2. **API-parity service layer** — mirrored the web client's auth, catalog, search, playlist, and export endpoints in dedicated iOS service modules so the mobile app tracks the backend contract the same way the web app does. The app uses the same production API host and local-dev conventions.

3. **Brand token sync from `shared/brand`** — added a generation step that parses `shared/brand/theme.ts` and `shared/brand/tokens.css` into native-consumable theme tokens. App runtime theming flows through the generated file, while Expo config reads the same shared brand source for shell-level colors such as splash/adaptive backgrounds.

4. **Native-first interaction model** — translated the web feature set into iOS patterns: tab navigation, stack detail screens, a mini player plus full player, secure local auth storage, and share-sheet based export flows. This preserved product parity while respecting Apple UI expectations.

**Result:** The repo now has a first-draft iOS client that is API-compatible with the current web product, keeps brand-driven styling centralized, and can evolve without entangling existing platforms. Validation passed through TypeScript checks, Expo iOS bundling, and native prebuild/CocoaPods setup; the only remaining host-side blocker was the machine missing Apple's simulator platform package for final Xcode compilation.

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
