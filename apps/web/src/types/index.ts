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
  isPublic: boolean
  isAiCurated: boolean
  tracks: Track[]
  createdAt: string
  updatedAt: string
}

export type SubscriptionPlan = 'free' | 'premium_monthly' | 'premium_annual'

export interface User {
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl?: string
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

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchResults {
  tracks: Paginated<Track>
  albums: Paginated<Album>
  artists: Paginated<Artist>
  playlists: Paginated<Playlist>
}
