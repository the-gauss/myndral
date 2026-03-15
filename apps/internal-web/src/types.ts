export type ContentStatus = 'draft' | 'review' | 'published' | 'archived'
export type AlbumType = 'album' | 'single' | 'ep' | 'compilation'
export type UserRole = 'listener' | 'content_editor' | 'content_reviewer' | 'admin'
export type MusicGenerationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
export type ElevenLabsOutputFormat =
  | 'mp3_22050_32'
  | 'mp3_24000_48'
  | 'mp3_44100_32'
  | 'mp3_44100_64'
  | 'mp3_44100_96'
  | 'mp3_44100_128'
  | 'mp3_44100_192'
  | 'pcm_8000'
  | 'pcm_16000'
  | 'pcm_22050'
  | 'pcm_24000'
  | 'pcm_32000'
  | 'pcm_44100'
  | 'pcm_48000'
  | 'ulaw_8000'
  | 'alaw_8000'
  | 'opus_48000_32'
  | 'opus_48000_64'
  | 'opus_48000_96'
  | 'opus_48000_128'
  | 'opus_48000_192'

export interface InternalUser {
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl?: string | null
  role: UserRole
  createdAt: string
}

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

export interface TrackArtistLink {
  artistId: string
  role: 'primary' | 'featured' | 'producer' | 'remixer'
  displayOrder: number
}

export interface TrackAudioFile {
  id?: string
  quality: 'low_128' | 'standard_256' | 'high_320' | 'lossless'
  format: 'mp3' | 'aac' | 'ogg' | 'flac' | 'opus'
  storageUrl: string
  bitrateKbps?: number | null
  sampleRateHz?: number | null
  channels: number
  fileSizeBytes?: number | null
  durationMs?: number | null
  checksumSha256?: string | null
}

export interface AudioInspection {
  storageUrl: string
  format?: 'mp3' | 'aac' | 'ogg' | 'flac' | 'opus' | null
  durationMs?: number | null
  bitrateKbps?: number | null
  sampleRateHz?: number | null
  channels?: number | null
  fileSizeBytes?: number | null
  checksumSha256?: string | null
}

export interface TrackLyrics {
  content: string
  language: string
  hasTimestamps: boolean
}

export interface TrackItem {
  id: string
  title: string
  albumId: string
  albumTitle: string
  primaryArtistId: string
  primaryArtistName: string
  trackNumber: number
  discNumber: number
  durationMs: number
  explicit: boolean
  status: ContentStatus
  genreIds: string[]
  artistLinks: TrackArtistLink[]
  audioFiles: TrackAudioFile[]
  lyrics?: TrackLyrics | null
  createdAt: string
  updatedAt: string
}

export interface MusicPromptInput {
  text: string
  weight: number
}

export interface MusicGenerateRequest {
  // Catalog linking
  artistId: string
  albumId: string
  trackTitle: string
  explicit?: boolean
  // Generation params
  prompt: string
  promptWeight?: number
  weightedPrompts?: MusicPromptInput[]
  negativePrompt?: string
  lengthSeconds: number
  fileName?: string
  model?: string
  seed?: number
  outputFormat?: ElevenLabsOutputFormat
  forceInstrumental?: boolean
  lyrics?: string
  lyricsLanguage?: string
  withTimestamps?: boolean
}

export interface MusicGenerationJob {
  id: string
  status: MusicGenerationStatus
  prompt?: string
  lengthSeconds?: number
  model?: string
  inputParams: Record<string, unknown>
  outputMetadata: Record<string, unknown>
  outputStorageUrl?: string
  errorMessage?: string | null
  createdAt: string
  startedAt?: string | null
  completedAt?: string | null
  failedAt?: string | null
}

export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface LoginResponse {
  accessToken: string
  tokenType: 'bearer'
  expiresIn: number
  user: InternalUser
}

export type StagingReviewAction = 'sent_for_review' | 'approved' | 'rejected'

export interface StagingReview {
  action: StagingReviewAction
  notes: string | null
  reviewerName: string | null
  createdAt: string | null
}

export interface StagingTrack {
  id: string
  title: string
  status: ContentStatus
  explicit: boolean
  durationMs: number | null
  albumId: string
  albumTitle: string
  albumType: AlbumType
  primaryArtistId: string
  primaryArtistName: string
  createdById: string
  createdByName: string
  createdByRole: UserRole
  outputStorageUrl: string | null
  createdAt: string
  latestReview: StagingReview | null
}

export interface Notification {
  id: string
  trackId: string | null
  trackTitle: string | null
  message: string
  isRead: boolean
  createdAt: string
}

export interface NotificationList extends Paginated<Notification> {
  unreadCount: number
}
