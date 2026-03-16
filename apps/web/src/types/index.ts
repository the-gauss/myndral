// ── Domain types ─────────────────────────────────────────────────────────────

export interface Artist {
  id: string
  name: string
  slug: string
  bio?: string
  imageUrl?: string
  monthlyListeners: number
  verified: boolean
  styleTags: string[]
}

export interface Album {
  id: string
  title: string
  artistId: string
  artist: Artist
  coverUrl?: string
  releaseDate: string
  albumType: 'album' | 'single' | 'ep'
  genreTags: string[]
  trackCount: number
}

export interface Track {
  id: string
  title: string
  albumId: string
  album: Album
  artistId: string
  artist: Artist
  trackNumber: number
  durationMs: number
  audioUrl?: string
  playCount: number
  explicit: boolean
}

export interface Lyrics {
  trackId: string
  content: string
  language: string
}

export interface Playlist {
  id: string
  name: string
  description?: string
  coverUrl?: string
  ownerId: string
  ownerDisplayName?: string
  isPublic: boolean
  isAiCurated: boolean
  tracks: Track[]
  trackCount?: number
  followerCount?: number
  totalDurationMs?: number
  canEdit?: boolean
  isInLibrary?: boolean
  createdAt: string
  updatedAt: string
}

export type SubscriptionPlan = 'free' | 'premium_monthly' | 'premium_annual'
export type UserRole = 'listener' | 'content_editor' | 'content_reviewer' | 'admin'

export interface User {
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl?: string
  role: UserRole
  subscriptionPlan: SubscriptionPlan
  createdAt: string
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

// ── Exports ───────────────────────────────────────────────────────────────────

export type LicenseType = 'personal' | 'business'

export interface TrackLicenseResponse {
  licenseId: string
  licenseType: LicenseType
  subjectType: 'track'
  subjectId: string
  trackTitle: string
  downloadUrl: string
}

export interface AlbumLicenseResponse {
  licenseType: LicenseType
  subjectType: 'album'
  albumId: string
  albumTitle: string
  tracks: {
    licenseId: string
    trackId: string
    trackTitle: string
    trackNumber: number
    downloadUrl: string
  }[]
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchResults {
  tracks: Paginated<Track>
  albums: Paginated<Album>
  artists: Paginated<Artist>
  playlists: Paginated<Playlist>
}

export interface CollectionState {
  library: {
    trackIds: string[]
    albumIds: string[]
    artistIds: string[]
    playlistIds: string[]
  }
  favorites: {
    trackIds: string[]
    albumIds: string[]
    artistIds: string[]
  }
}
