/**
 * Studio domain types — mirrors the shape returned by the /v1/internal/ API endpoints.
 * Kept separate from the listener-facing domain.ts to keep the privilege boundary explicit.
 */

export type ContentStatus = 'review' | 'published' | 'archived'
export type AlbumType = 'album' | 'single' | 'ep' | 'compilation'
export type MusicGenerationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
export type StagingReviewAction = 'sent_for_review' | 'approved' | 'rejected'
export type EntityType = 'artist' | 'album' | 'track'
export type StudioRole = 'content_editor' | 'content_reviewer' | 'admin'

export interface Genre {
  id: string
  name: string
  slug: string
}

export interface ArtistItem {
  id: string
  name: string
  slug: string
  bio?: string | null
  imageUrl?: string | null
  headerImageUrl?: string | null
  status: ContentStatus
  personaPrompt?: string | null
  styleTags: string[]
  genreIds: string[]
  createdAt: string
  updatedAt: string
}

export interface AlbumItem {
  id: string
  title: string
  slug: string
  artistId: string
  artistName: string
  coverUrl?: string | null
  description?: string | null
  releaseDate?: string | null
  albumType: AlbumType
  status: ContentStatus
  trackCount: number
  genreIds: string[]
  createdAt: string
  updatedAt: string
}

export interface TrackItem {
  id: string
  title: string
  albumId: string
  albumTitle: string
  albumType: AlbumType
  primaryArtistId?: string | null
  primaryArtistName?: string | null
  trackNumber: number
  discNumber: number
  durationMs?: number | null
  explicit: boolean
  status: ContentStatus
  genreIds: string[]
  createdAt: string
  updatedAt: string
}

export interface MusicGenerationJob {
  id: string
  status: MusicGenerationStatus
  artistId: string
  albumId: string
  trackTitle: string
  explicit: boolean
  prompt?: string | null
  lyrics?: string | null
  outputStorageUrl?: string | null
  outputMetadata?: {
    durationMs?: number
    fileSizeBytes?: number
    songMetadata?: Record<string, unknown>
    lyrics?: string
  } | null
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
  artistName?: string | null
  albumTitle?: string | null
}

export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface StagingReview {
  action: StagingReviewAction
  notes: string | null
  reviewerName: string | null
  createdAt: string | null
}

export interface StagingArtist {
  id: string
  name: string
  slug: string
  bio?: string | null
  status: ContentStatus
  createdByName: string
  createdByRole: string
  latestReview: StagingReview | null
  createdAt: string
}

export interface StagingAlbum {
  id: string
  title: string
  slug: string
  artistName: string
  albumType: AlbumType
  trackCount: number
  status: ContentStatus
  createdByName: string
  createdByRole: string
  latestReview: StagingReview | null
  createdAt: string
}

export interface StagingTrack {
  id: string
  title: string
  primaryArtistName?: string | null
  albumTitle: string
  albumType: AlbumType
  durationMs?: number | null
  explicit: boolean
  status: ContentStatus
  outputStorageUrl?: string | null
  createdByName: string
  createdByRole: string
  latestReview: StagingReview | null
  createdAt: string
}

export interface StagingQueue {
  artists: StagingArtist[]
  albums: StagingAlbum[]
  tracks: StagingTrack[]
  totalArtists: number
  totalAlbums: number
  totalTracks: number
}

export interface MusicGenerateRequest {
  artist_id: string
  album_id: string
  track_title: string
  explicit: boolean
  prompt?: string
  style_note?: string
  negative_prompt?: string
  length_seconds?: number
  seed?: number
  force_instrumental?: boolean
  use_custom_lyrics?: boolean
  lyrics?: string
  with_timestamps?: boolean
  file_name?: string
}

// ── Privilege helpers ──────────────────────────────────────────────────────────

const STUDIO_ROLES = new Set<StudioRole>(['content_editor', 'content_reviewer', 'admin'])

/** Returns true if the role has access to the Creator Studio. */
export function hasStudioAccess(role?: string | null): role is StudioRole {
  return Boolean(role && STUDIO_ROLES.has(role as StudioRole))
}

/** Content reviewers and admins can approve / reject / revision items in staging. */
export function canReview(role?: string | null): boolean {
  return role === 'content_reviewer' || role === 'admin'
}

/** Content editors and admins can create artists, albums, and songs. */
export function canEdit(role?: string | null): boolean {
  return role === 'content_editor' || role === 'admin'
}

export function humanizeRole(role: string): string {
  return role.replace(/_/g, ' ')
}

export function humanizeStatus(status: ContentStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function formatStagingDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '-'
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}
