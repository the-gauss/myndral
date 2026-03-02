export type ContentStatus = 'draft' | 'review' | 'published' | 'archived'
export type AlbumType = 'album' | 'single' | 'ep' | 'compilation'
export type UserRole = 'listener' | 'content_editor' | 'content_reviewer' | 'admin'
export type MusicGenerationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
export type LyriaScale =
  | 'SCALE_UNSPECIFIED'
  | 'C_MAJOR_A_MINOR'
  | 'D_FLAT_MAJOR_B_FLAT_MINOR'
  | 'D_MAJOR_B_MINOR'
  | 'E_FLAT_MAJOR_C_MINOR'
  | 'E_MAJOR_D_FLAT_MINOR'
  | 'F_MAJOR_D_MINOR'
  | 'G_FLAT_MAJOR_E_FLAT_MINOR'
  | 'G_MAJOR_E_MINOR'
  | 'A_FLAT_MAJOR_F_MINOR'
  | 'A_MAJOR_G_FLAT_MINOR'
  | 'B_FLAT_MAJOR_G_MINOR'
  | 'B_MAJOR_A_FLAT_MINOR'
export type LyriaGenerationMode =
  | 'MUSIC_GENERATION_MODE_UNSPECIFIED'
  | 'QUALITY'
  | 'DIVERSITY'
  | 'VOCALIZATION'

export interface InternalUser {
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl?: string | null
  role: UserRole
  subscriptionPlan: string
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
  prompt: string
  promptWeight: number
  weightedPrompts?: MusicPromptInput[]
  lengthSeconds: number
  fileName?: string
  model?: string
  temperature?: number
  topK?: number
  seed?: number
  guidance?: number
  bpm?: number
  density?: number
  brightness?: number
  scale?: LyriaScale
  muteBass?: boolean
  muteDrums?: boolean
  onlyBassAndDrums?: boolean
  musicGenerationMode?: LyriaGenerationMode
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
