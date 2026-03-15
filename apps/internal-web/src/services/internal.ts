import api from './api'
import type {
  AudioInspection,
  AlbumItem,
  ArtistItem,
  Genre,
  MusicGenerateRequest,
  MusicGenerationJob,
  LoginResponse,
  Notification,
  NotificationList,
  Paginated,
  StagingQueue,
  TrackItem,
  ContentStatus,
  AlbumType,
  InternalUser,
} from '../types'

export const internalLogin = (payload: { username: string; password: string }) =>
  api.post<LoginResponse>('/v1/internal/auth/login', payload).then((r) => r.data)

export const getInternalMe = () =>
  api.get<InternalUser>('/v1/internal/auth/me').then((r) => r.data)

export const listGenres = () =>
  api.get<Genre[]>('/v1/internal/genres').then((r) => r.data)

export const uploadImage = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  // Axios 1.x JSON-stringifies FormData when the instance default Content-Type is
  // 'application/json'. Clearing it per-request lets the browser set the correct
  // 'multipart/form-data; boundary=...' header automatically.
  return api.post<{ storageUrl: string }>('/v1/internal/images/upload', form, {
    headers: { 'Content-Type': null },
  }).then((r) => r.data)
}

export const inspectAudio = (payload: { storageUrl: string }) =>
  api.post<AudioInspection>('/v1/internal/audio/inspect', payload).then((r) => r.data)

// ── Artists ───────────────────────────────────────────────────────────────────

export const listArtists = (params?: { status?: ContentStatus; q?: string; limit?: number; offset?: number }) =>
  api.get<Paginated<ArtistItem>>('/v1/internal/artists', { params }).then((r) => r.data)

export const createArtist = (payload: {
  name: string
  slug?: string
  bio?: string
  imageUrl?: string
  headerImageUrl?: string
  personaPrompt?: string
  styleTags: string[]
  genreIds: string[]
}) => api.post<ArtistItem>('/v1/internal/artists', payload).then((r) => r.data)

export const updateArtist = (artistId: string, payload: Partial<{
  name: string
  slug: string
  bio: string
  imageUrl: string
  headerImageUrl: string
  personaPrompt: string
  styleTags: string[]
  genreIds: string[]
}>) => api.patch<ArtistItem>(`/v1/internal/artists/${artistId}`, payload).then((r) => r.data)

// ── Albums ────────────────────────────────────────────────────────────────────

export const listAlbums = (params?: {
  status?: ContentStatus
  artistId?: string
  q?: string
  limit?: number
  offset?: number
}) => api.get<Paginated<AlbumItem>>('/v1/internal/albums', { params }).then((r) => r.data)

export const createAlbum = (payload: {
  title: string
  slug?: string
  artistId: string
  coverUrl?: string
  description?: string
  releaseDate?: string
  albumType: AlbumType
  genreIds: string[]
}) => api.post<AlbumItem>('/v1/internal/albums', payload).then((r) => r.data)

export const updateAlbum = (albumId: string, payload: Partial<{
  title: string
  slug: string
  artistId: string
  coverUrl: string
  description: string
  releaseDate: string
  albumType: AlbumType
  genreIds: string[]
}>) => api.patch<AlbumItem>(`/v1/internal/albums/${albumId}`, payload).then((r) => r.data)

// ── Tracks ────────────────────────────────────────────────────────────────────

export const listTracks = (params?: {
  status?: ContentStatus
  albumId?: string
  artistId?: string
  q?: string
  limit?: number
  offset?: number
}) => api.get<Paginated<TrackItem>>('/v1/internal/tracks', { params }).then((r) => r.data)

export const createTrack = (payload: {
  title: string
  albumId: string
  primaryArtistId?: string
  trackNumber: number
  discNumber: number
  durationMs: number
  explicit: boolean
  genreIds: string[]
  audioFiles: Array<{
    quality: 'low_128' | 'standard_256' | 'high_320' | 'lossless'
    format: 'mp3' | 'aac' | 'ogg' | 'flac' | 'opus'
    storageUrl: string
    bitrateKbps?: number
    sampleRateHz?: number
    channels?: number
    fileSizeBytes?: number
    durationMs?: number
    checksumSha256?: string
  }>
}) => api.post<TrackItem>('/v1/internal/tracks', payload).then((r) => r.data)

export const updateTrack = (trackId: string, payload: Partial<{
  title: string
  albumId: string
  primaryArtistId: string
  trackNumber: number
  discNumber: number
  durationMs: number
  explicit: boolean
  genreIds: string[]
  audioFiles: Array<{
    quality: 'low_128' | 'standard_256' | 'high_320' | 'lossless'
    format: 'mp3' | 'aac' | 'ogg' | 'flac' | 'opus'
    storageUrl: string
    bitrateKbps?: number
    sampleRateHz?: number
    channels?: number
    fileSizeBytes?: number
    durationMs?: number
    checksumSha256?: string
  }>
  replaceAudioFiles: boolean
}>) => api.patch<TrackItem>(`/v1/internal/tracks/${trackId}`, payload).then((r) => r.data)

// ── Music generation ──────────────────────────────────────────────────────────

export const generateMusic = (payload: MusicGenerateRequest) =>
  api.post<MusicGenerationJob>('/v1/internal/music/generate', payload).then((r) => r.data)

export interface UploadMusicPayload {
  file: File
  artistId: string
  albumId: string
  trackTitle: string
  explicit: boolean
  lyrics?: string
}

export const uploadCustomMusic = ({ file, artistId, albumId, trackTitle, explicit, lyrics }: UploadMusicPayload) => {
  const form = new FormData()
  form.append('file', file)
  form.append('artist_id', artistId)
  form.append('album_id', albumId)
  form.append('track_title', trackTitle)
  form.append('explicit', String(explicit))
  if (lyrics?.trim()) form.append('lyrics', lyrics.trim())
  // Same reason as uploadImage: clear JSON Content-Type so FormData is sent as multipart.
  return api.post<MusicGenerationJob>('/v1/internal/music/upload', form, {
    headers: { 'Content-Type': null },
  }).then((r) => r.data)
}

export interface LinkExternalUrlPayload {
  storageUrl: string
  artistId: string
  albumId: string
  trackTitle: string
  explicit: boolean
  lyrics?: string
}

export const linkExternalUrl = ({ storageUrl, artistId, albumId, trackTitle, explicit, lyrics }: LinkExternalUrlPayload) =>
  api.post<MusicGenerationJob>('/v1/internal/music/link', {
    storage_url: storageUrl,
    artist_id: artistId,
    album_id: albumId,
    track_title: trackTitle,
    explicit,
    lyrics: lyrics?.trim() || undefined,
  }).then((r) => r.data)

export const listMusicJobs = (params?: { limit?: number; offset?: number }) =>
  api.get<Paginated<MusicGenerationJob>>('/v1/internal/music/jobs', { params }).then((r) => r.data)

export const fetchGeneratedMusicFile = (storageUrl: string) =>
  api.get<Blob>('/v1/internal/music/file', {
    params: { storageUrl },
    responseType: 'blob',
  }).then((r) => r.data)

// ── Staging ───────────────────────────────────────────────────────────────────

export const listStaging = () =>
  api.get<StagingQueue>('/v1/internal/staging').then((r) => r.data)

// Artists
export const approveStagingArtist = (artistId: string) =>
  api.post<{ artistId: string; action: string }>(`/v1/internal/staging/artists/${artistId}/approve`).then((r) => r.data)

export const rejectStagingArtist = (artistId: string, notes: string) =>
  api.post<{ artistId: string; action: string }>(`/v1/internal/staging/artists/${artistId}/reject`, { notes }).then((r) => r.data)

export const sendArtistForReview = (artistId: string, notes: string) =>
  api.post<{ artistId: string; action: string }>(`/v1/internal/staging/artists/${artistId}/review`, { notes }).then((r) => r.data)

// Albums
export const approveStagingAlbum = (albumId: string) =>
  api.post<{ albumId: string; action: string }>(`/v1/internal/staging/albums/${albumId}/approve`).then((r) => r.data)

export const rejectStagingAlbum = (albumId: string, notes: string) =>
  api.post<{ albumId: string; action: string }>(`/v1/internal/staging/albums/${albumId}/reject`, { notes }).then((r) => r.data)

export const sendAlbumForReview = (albumId: string, notes: string) =>
  api.post<{ albumId: string; action: string }>(`/v1/internal/staging/albums/${albumId}/review`, { notes }).then((r) => r.data)

// Tracks
export const approveTrack = (trackId: string) =>
  api.post<{ trackId: string; action: string }>(`/v1/internal/staging/${trackId}/approve`).then((r) => r.data)

export const rejectTrack = (trackId: string, notes: string) =>
  api.post<{ trackId: string; action: string }>(`/v1/internal/staging/${trackId}/reject`, { notes }).then((r) => r.data)

export const sendTrackForReview = (trackId: string, notes: string) =>
  api.post<{ trackId: string; action: string }>(`/v1/internal/staging/${trackId}/review`, { notes }).then((r) => r.data)

// Revoke (published → review, admin only)
export const revokeArtist = (artistId: string, notes?: string) =>
  api.post<{ artistId: string; action: string }>(`/v1/internal/staging/artists/${artistId}/revoke`, { notes: notes || undefined }).then((r) => r.data)

export const revokeAlbum = (albumId: string, notes?: string) =>
  api.post<{ albumId: string; action: string }>(`/v1/internal/staging/albums/${albumId}/revoke`, { notes: notes || undefined }).then((r) => r.data)

export const revokeTrack = (trackId: string, notes?: string) =>
  api.post<{ trackId: string; action: string }>(`/v1/internal/staging/${trackId}/revoke`, { notes: notes || undefined }).then((r) => r.data)

// ── Archive ───────────────────────────────────────────────────────────────────

export const listArchive = () =>
  api.get<StagingQueue>('/v1/internal/archive').then((r) => r.data)

export const restoreArtistFromArchive = (artistId: string) =>
  api.post<{ artistId: string; action: string }>(`/v1/internal/archive/artists/${artistId}/restore`).then((r) => r.data)

export const restoreAlbumFromArchive = (albumId: string) =>
  api.post<{ albumId: string; action: string }>(`/v1/internal/archive/albums/${albumId}/restore`).then((r) => r.data)

export const restoreTrackFromArchive = (trackId: string) =>
  api.post<{ trackId: string; action: string }>(`/v1/internal/archive/tracks/${trackId}/restore`).then((r) => r.data)

// ── Notifications ─────────────────────────────────────────────────────────────

export const listNotifications = (params?: { unreadOnly?: boolean; limit?: number; offset?: number }) =>
  api.get<NotificationList>('/v1/internal/notifications', { params }).then((r) => r.data)

export const markNotificationRead = (notificationId: string) =>
  api.patch<Notification>(`/v1/internal/notifications/${notificationId}/read`).then((r) => r.data)

export const markAllNotificationsRead = () =>
  api.post<{ markedRead: number }>('/v1/internal/notifications/read-all').then((r) => r.data)
