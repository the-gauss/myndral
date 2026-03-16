import api from './api'
import type {
  Album,
  Artist,
  CollectionState,
  Paginated,
  Playlist,
  SearchResults,
  Track,
} from '../types'

// ── Artists ───────────────────────────────────────────────────────────────────

export const getArtists = (limit = 20, offset = 0) =>
  api.get<Paginated<Artist>>('/v1/artists/', { params: { limit, offset } }).then((r) => r.data)

export const getArtist = (id: string) =>
  api.get<Artist>(`/v1/artists/${id}`).then((r) => r.data)

export const getArtistAlbums = (artistId: string, limit = 20) =>
  api.get<Paginated<Album>>(`/v1/artists/${artistId}/albums`, { params: { limit } }).then((r) => r.data)

export const getArtistTopTracks = (artistId: string, limit = 10) =>
  api.get<Paginated<Track>>(`/v1/artists/${artistId}/top-tracks`, { params: { limit } }).then((r) => r.data)

// ── Albums ────────────────────────────────────────────────────────────────────

export const getAlbums = (limit = 20, offset = 0) =>
  api.get<Paginated<Album>>('/v1/albums/', { params: { limit, offset } }).then((r) => r.data)

export const getAlbum = (id: string) =>
  api.get<Album>(`/v1/albums/${id}`).then((r) => r.data)

export const getAlbumTracks = (albumId: string) =>
  api.get<Paginated<Track>>(`/v1/albums/${albumId}/tracks`).then((r) => r.data)

// ── Tracks ────────────────────────────────────────────────────────────────────

export const getTracks = (limit = 20, offset = 0) =>
  api.get<Paginated<Track>>('/v1/tracks/', { params: { limit, offset } }).then((r) => r.data)

export const getTrack = (id: string) =>
  api.get<Track>(`/v1/tracks/${id}`).then((r) => r.data)

export const getFeaturedTracks = (limit = 10) =>
  api.get<Paginated<Track>>('/v1/tracks/featured', { params: { limit } }).then((r) => r.data)

// ── Playlists ─────────────────────────────────────────────────────────────────

export const getPlaylist = (id: string) =>
  api.get<Playlist>(`/v1/playlists/${id}`).then((r) => r.data)

export const getPlaylists = (limit = 20, offset = 0) =>
  api.get<Paginated<Playlist>>('/v1/playlists/', { params: { limit, offset } }).then((r) => r.data)

export const getUserPlaylists = (limit = 50) =>
  api.get<Paginated<Playlist>>('/v1/users/me/playlists', { params: { limit } }).then((r) => r.data)

export const getEditableUserPlaylists = (limit = 50) =>
  api
    .get<Paginated<Playlist>>('/v1/users/me/playlists', { params: { limit, editableOnly: true } })
    .then((r) => r.data)

export const createPlaylist = (payload: {
  name: string
  description?: string
  isPublic: boolean
  trackIds?: string[]
}) => api.post<Playlist>('/v1/playlists/', payload).then((r) => r.data)

export const updatePlaylist = (playlistId: string, payload: Partial<{
  name: string
  description: string
  isPublic: boolean
}>) => api.patch<Playlist>(`/v1/playlists/${playlistId}`, payload).then((r) => r.data)

export const addTracksToPlaylist = (playlistId: string, trackIds: string[]) =>
  api.post<Playlist>(`/v1/playlists/${playlistId}/tracks`, { trackIds }).then((r) => r.data)

export const removeTracksFromPlaylist = (playlistId: string, trackIds: string[]) =>
  api.delete<Playlist>(`/v1/playlists/${playlistId}/tracks`, { data: { trackIds } }).then((r) => r.data)

export const savePlaylistToLibrary = (playlistId: string) =>
  api.put<{ playlistId: string; inLibrary: boolean }>(`/v1/users/me/library/playlists/${playlistId}`).then((r) => r.data)

export const removePlaylistFromLibrary = (playlistId: string) =>
  api.delete<{ playlistId: string; inLibrary: boolean }>(`/v1/users/me/library/playlists/${playlistId}`).then((r) => r.data)

// ── Collection state ──────────────────────────────────────────────────────────

export const getCollectionState = (params: {
  trackIds?: string[]
  albumIds?: string[]
  artistIds?: string[]
  playlistIds?: string[]
}) => api.get<CollectionState>('/v1/users/me/collection-state', { params }).then((r) => r.data)

export const getLibraryTracks = (limit = 50, offset = 0) =>
  api.get<Paginated<Track>>('/v1/users/me/library/tracks', { params: { limit, offset } }).then((r) => r.data)

export const saveTrackToLibrary = (trackId: string) =>
  api.put<{ trackId: string; inLibrary: boolean }>(`/v1/users/me/library/tracks/${trackId}`).then((r) => r.data)

export const removeTrackFromLibrary = (trackId: string) =>
  api.delete<{ trackId: string; inLibrary: boolean }>(`/v1/users/me/library/tracks/${trackId}`).then((r) => r.data)

export const getLibraryAlbums = (limit = 50, offset = 0) =>
  api.get<Paginated<Album>>('/v1/users/me/library/albums', { params: { limit, offset } }).then((r) => r.data)

export const saveAlbumToLibrary = (albumId: string) =>
  api.put<{ albumId: string; inLibrary: boolean }>(`/v1/users/me/library/albums/${albumId}`).then((r) => r.data)

export const removeAlbumFromLibrary = (albumId: string) =>
  api.delete<{ albumId: string; inLibrary: boolean }>(`/v1/users/me/library/albums/${albumId}`).then((r) => r.data)

export const getLibraryArtists = (limit = 50, offset = 0) =>
  api.get<Paginated<Artist>>('/v1/users/me/library/artists', { params: { limit, offset } }).then((r) => r.data)

export const saveArtistToLibrary = (artistId: string) =>
  api.put<{ artistId: string; inLibrary: boolean }>(`/v1/users/me/library/artists/${artistId}`).then((r) => r.data)

export const removeArtistFromLibrary = (artistId: string) =>
  api.delete<{ artistId: string; inLibrary: boolean }>(`/v1/users/me/library/artists/${artistId}`).then((r) => r.data)

export const getLibraryPlaylists = (limit = 50, offset = 0) =>
  api.get<Paginated<Playlist>>('/v1/users/me/library/playlists', { params: { limit, offset } }).then((r) => r.data)

export const getFavoriteTracks = (limit = 50, offset = 0) =>
  api.get<Paginated<Track>>('/v1/users/me/favorites/tracks', { params: { limit, offset } }).then((r) => r.data)

export const favoriteTrack = (trackId: string) =>
  api.put<{ trackId: string; isFavorite: boolean }>(`/v1/tracks/${trackId}/like`).then((r) => r.data)

export const unfavoriteTrack = (trackId: string) =>
  api.delete<{ trackId: string; isFavorite: boolean }>(`/v1/tracks/${trackId}/like`).then((r) => r.data)

export const getFavoriteAlbums = (limit = 50, offset = 0) =>
  api.get<Paginated<Album>>('/v1/users/me/favorites/albums', { params: { limit, offset } }).then((r) => r.data)

export const favoriteAlbum = (albumId: string) =>
  api.put<{ albumId: string; isFavorite: boolean }>(`/v1/users/me/favorites/albums/${albumId}`).then((r) => r.data)

export const unfavoriteAlbum = (albumId: string) =>
  api.delete<{ albumId: string; isFavorite: boolean }>(`/v1/users/me/favorites/albums/${albumId}`).then((r) => r.data)

export const getFavoriteArtists = (limit = 50, offset = 0) =>
  api.get<Paginated<Artist>>('/v1/users/me/favorites/artists', { params: { limit, offset } }).then((r) => r.data)

export const favoriteArtist = (artistId: string) =>
  api.put<{ artistId: string; isFavorite: boolean }>(`/v1/users/me/favorites/artists/${artistId}`).then((r) => r.data)

export const unfavoriteArtist = (artistId: string) =>
  api.delete<{ artistId: string; isFavorite: boolean }>(`/v1/users/me/favorites/artists/${artistId}`).then((r) => r.data)

// ── Search ────────────────────────────────────────────────────────────────────

export const search = (query: string, limit = 10) =>
  api.get<SearchResults>('/v1/search/', { params: { q: query, limit } }).then((r) => r.data)
