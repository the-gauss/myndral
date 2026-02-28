import api from './api'
import type { Album, Artist, Paginated, Playlist, SearchResults, Track } from '../types'

// ── Artists ───────────────────────────────────────────────────────────────────

export const getArtists = (limit = 20, offset = 0) =>
  api.get<Paginated<Artist>>('/v1/artists', { params: { limit, offset } }).then((r) => r.data)

export const getArtist = (id: string) =>
  api.get<Artist>(`/v1/artists/${id}`).then((r) => r.data)

export const getArtistAlbums = (artistId: string, limit = 20) =>
  api.get<Paginated<Album>>(`/v1/artists/${artistId}/albums`, { params: { limit } }).then((r) => r.data)

export const getArtistTopTracks = (artistId: string, limit = 10) =>
  api.get<Paginated<Track>>(`/v1/artists/${artistId}/top-tracks`, { params: { limit } }).then((r) => r.data)

// ── Albums ────────────────────────────────────────────────────────────────────

export const getAlbums = (limit = 20, offset = 0) =>
  api.get<Paginated<Album>>('/v1/albums', { params: { limit, offset } }).then((r) => r.data)

export const getAlbum = (id: string) =>
  api.get<Album>(`/v1/albums/${id}`).then((r) => r.data)

export const getAlbumTracks = (albumId: string) =>
  api.get<Paginated<Track>>(`/v1/albums/${albumId}/tracks`).then((r) => r.data)

// ── Tracks ────────────────────────────────────────────────────────────────────

export const getTracks = (limit = 20, offset = 0) =>
  api.get<Paginated<Track>>('/v1/tracks', { params: { limit, offset } }).then((r) => r.data)

export const getTrack = (id: string) =>
  api.get<Track>(`/v1/tracks/${id}`).then((r) => r.data)

export const getFeaturedTracks = (limit = 10) =>
  api.get<Paginated<Track>>('/v1/tracks/featured', { params: { limit } }).then((r) => r.data)

// ── Playlists ─────────────────────────────────────────────────────────────────

export const getPlaylist = (id: string) =>
  api.get<Playlist>(`/v1/playlists/${id}`).then((r) => r.data)

export const getUserPlaylists = (limit = 50) =>
  api.get<Paginated<Playlist>>('/v1/users/me/playlists', { params: { limit } }).then((r) => r.data)

// ── Search ────────────────────────────────────────────────────────────────────

export const search = (query: string, limit = 10) =>
  api.get<SearchResults>('/v1/search', { params: { q: query, limit } }).then((r) => r.data)
