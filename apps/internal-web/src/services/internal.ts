import api from './api'
import type {
  AudioInspection,
  AlbumItem,
  ArtistItem,
  Genre,
  LoginResponse,
  Paginated,
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

export const inspectAudio = (payload: { storageUrl: string }) =>
  api.post<AudioInspection>('/v1/internal/audio/inspect', payload).then((r) => r.data)

export const listArtists = (params?: { status?: ContentStatus; q?: string; limit?: number; offset?: number }) =>
  api.get<Paginated<ArtistItem>>('/v1/internal/artists', { params }).then((r) => r.data)

export const createArtist = (payload: {
  name: string
  slug?: string
  bio?: string
  imageUrl?: string
  headerImageUrl?: string
  status: ContentStatus
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
  status: ContentStatus
  personaPrompt: string
  styleTags: string[]
  genreIds: string[]
}>) => api.patch<ArtistItem>(`/v1/internal/artists/${artistId}`, payload).then((r) => r.data)

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
  status: ContentStatus
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
  status: ContentStatus
  genreIds: string[]
}>) => api.patch<AlbumItem>(`/v1/internal/albums/${albumId}`, payload).then((r) => r.data)

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
  status: ContentStatus
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
  status: ContentStatus
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
