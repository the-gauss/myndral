/**
 * Studio API service — wraps the /v1/internal/ endpoints for the Creator Studio.
 *
 * All calls inject the current user's JWT via authedRequest() which reads
 * useAuthStore.getState() synchronously (safe outside React for service modules).
 *
 * Image and audio uploads use React Native's FormData with native file descriptors
 * ({uri, type, name}) instead of browser File objects. The Content-Type is set to
 * 'multipart/form-data' so that React Native's XMLHttpRequest layer attaches the
 * correct multipart boundary, matching how the web client sets it to null to let
 * the browser do the same.
 */
import { authedRequest } from '@/src/lib/authedRequest'
import api from '@/src/lib/api'
import type {
  ArtistItem,
  AlbumItem,
  TrackItem,
  Genre,
  MusicGenerationJob,
  MusicGenerateRequest,
  Paginated,
  StagingQueue,
  ContentStatus,
  AlbumType,
} from '@/src/types/studio'

// ── Types ──────────────────────────────────────────────────────────────────────

/** Native file reference produced by expo-image-picker or expo-document-picker. */
export interface NativeFile {
  uri: string
  type: string
  name: string
}

/** Builds an axios config with auth header plus multipart content-type for FormData uploads. */
function multipartConfig() {
  return authedRequest({ headers: { 'Content-Type': 'multipart/form-data' } })
}

// ── Genres ─────────────────────────────────────────────────────────────────────

export const listGenres = () =>
  api.get<Genre[]>('/v1/internal/genres', authedRequest()).then((r) => r.data)

// ── Image upload ───────────────────────────────────────────────────────────────

export const uploadImage = (file: NativeFile) => {
  const form = new FormData()
  // React Native accepts a plain object with uri/type/name as a FormData value.
  form.append('file', { uri: file.uri, type: file.type, name: file.name } as unknown as Blob)
  return api
    .post<{ storageUrl: string }>('/v1/internal/images/upload', form, multipartConfig())
    .then((r) => r.data)
}

// ── Artists ────────────────────────────────────────────────────────────────────

export const listArtists = (params?: {
  status?: ContentStatus
  q?: string
  limit?: number
  offset?: number
}) =>
  api
    .get<Paginated<ArtistItem>>('/v1/internal/artists', authedRequest({ params }))
    .then((r) => r.data)

export const createArtist = (payload: {
  name: string
  slug?: string
  bio?: string
  imageUrl?: string
  headerImageUrl?: string
  personaPrompt?: string
  styleTags: string[]
  genreIds: string[]
}) =>
  api.post<ArtistItem>('/v1/internal/artists', payload, authedRequest()).then((r) => r.data)

export const updateArtist = (
  artistId: string,
  payload: Partial<{
    bio: string
    imageUrl: string
    headerImageUrl: string
    personaPrompt: string
    styleTags: string[]
    genreIds: string[]
  }>,
) =>
  api
    .patch<ArtistItem>(`/v1/internal/artists/${artistId}`, payload, authedRequest())
    .then((r) => r.data)

// ── Albums ─────────────────────────────────────────────────────────────────────

export const listAlbums = (params?: {
  status?: ContentStatus
  artistId?: string
  q?: string
  limit?: number
  offset?: number
}) =>
  api
    .get<Paginated<AlbumItem>>('/v1/internal/albums', authedRequest({ params }))
    .then((r) => r.data)

export const createAlbum = (payload: {
  title: string
  slug?: string
  artistId: string
  coverUrl?: string
  description?: string
  releaseDate?: string
  albumType: AlbumType
  genreIds: string[]
}) =>
  api.post<AlbumItem>('/v1/internal/albums', payload, authedRequest()).then((r) => r.data)

export const updateAlbum = (
  albumId: string,
  payload: Partial<{
    title: string
    artistId: string
    coverUrl: string
    description: string
    releaseDate: string
    albumType: AlbumType
    genreIds: string[]
  }>,
) =>
  api
    .patch<AlbumItem>(`/v1/internal/albums/${albumId}`, payload, authedRequest())
    .then((r) => r.data)

// ── Tracks ─────────────────────────────────────────────────────────────────────

export const listTracks = (params?: {
  status?: ContentStatus
  albumId?: string
  artistId?: string
  q?: string
  limit?: number
  offset?: number
}) =>
  api
    .get<Paginated<TrackItem>>('/v1/internal/tracks', authedRequest({ params }))
    .then((r) => r.data)

// ── Music generation ───────────────────────────────────────────────────────────

export const generateMusic = (payload: MusicGenerateRequest) =>
  api
    .post<MusicGenerationJob>('/v1/internal/music/generate', payload, authedRequest())
    .then((r) => r.data)

export const uploadCustomMusic = (
  file: NativeFile,
  payload: {
    artistId: string
    albumId: string
    trackTitle: string
    explicit: boolean
    lyrics?: string
  },
) => {
  const form = new FormData()
  form.append('file', { uri: file.uri, type: file.type, name: file.name } as unknown as Blob)
  form.append('artist_id', payload.artistId)
  form.append('album_id', payload.albumId)
  form.append('track_title', payload.trackTitle)
  form.append('explicit', String(payload.explicit))
  if (payload.lyrics?.trim()) form.append('lyrics', payload.lyrics.trim())
  return api
    .post<MusicGenerationJob>('/v1/internal/music/upload', form, multipartConfig())
    .then((r) => r.data)
}

export const linkExternalUrl = (payload: {
  storageUrl: string
  artistId: string
  albumId: string
  trackTitle: string
  explicit: boolean
  lyrics?: string
}) =>
  api
    .post<MusicGenerationJob>(
      '/v1/internal/music/link',
      {
        storage_url: payload.storageUrl,
        artist_id: payload.artistId,
        album_id: payload.albumId,
        track_title: payload.trackTitle,
        explicit: payload.explicit,
        lyrics: payload.lyrics?.trim() || undefined,
      },
      authedRequest(),
    )
    .then((r) => r.data)

export const listMusicJobs = (params?: { limit?: number; offset?: number }) =>
  api
    .get<Paginated<MusicGenerationJob>>('/v1/internal/music/jobs', authedRequest({ params }))
    .then((r) => r.data)

// ── Staging ────────────────────────────────────────────────────────────────────

export const listStaging = () =>
  api.get<StagingQueue>('/v1/internal/staging', authedRequest()).then((r) => r.data)

export const approveStagingArtist = (artistId: string) =>
  api
    .post<void>(`/v1/internal/staging/artists/${artistId}/approve`, {}, authedRequest())
    .then((r) => r.data)

export const rejectStagingArtist = (artistId: string, notes: string) =>
  api
    .post<void>(`/v1/internal/staging/artists/${artistId}/reject`, { notes }, authedRequest())
    .then((r) => r.data)

export const sendArtistForReview = (artistId: string, notes: string) =>
  api
    .post<void>(`/v1/internal/staging/artists/${artistId}/review`, { notes }, authedRequest())
    .then((r) => r.data)

export const approveStagingAlbum = (albumId: string) =>
  api
    .post<void>(`/v1/internal/staging/albums/${albumId}/approve`, {}, authedRequest())
    .then((r) => r.data)

export const rejectStagingAlbum = (albumId: string, notes: string) =>
  api
    .post<void>(`/v1/internal/staging/albums/${albumId}/reject`, { notes }, authedRequest())
    .then((r) => r.data)

export const sendAlbumForReview = (albumId: string, notes: string) =>
  api
    .post<void>(`/v1/internal/staging/albums/${albumId}/review`, { notes }, authedRequest())
    .then((r) => r.data)

export const approveTrack = (trackId: string) =>
  api
    .post<void>(`/v1/internal/staging/${trackId}/approve`, {}, authedRequest())
    .then((r) => r.data)

export const rejectTrack = (trackId: string, notes: string) =>
  api
    .post<void>(`/v1/internal/staging/${trackId}/reject`, { notes }, authedRequest())
    .then((r) => r.data)

export const sendTrackForReview = (trackId: string, notes: string) =>
  api
    .post<void>(`/v1/internal/staging/${trackId}/review`, { notes }, authedRequest())
    .then((r) => r.data)
