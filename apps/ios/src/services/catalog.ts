import { authedRequest } from '@/src/lib/authedRequest';
import api from '@/src/lib/api';
import type { Album, Artist, Paginated, Playlist, SearchResults, Track } from '@/src/types/domain';

export function getArtists(limit = 20, offset = 0) {
  return api
    .get<Paginated<Artist>>('/v1/artists/', authedRequest({ params: { limit, offset } }))
    .then((response) => response.data);
}

export function getArtist(id: string) {
  return api.get<Artist>(`/v1/artists/${id}`, authedRequest()).then((response) => response.data);
}

export function getArtistAlbums(artistId: string, limit = 20, offset = 0) {
  return api
    .get<Paginated<Album>>(
      `/v1/artists/${artistId}/albums`,
      authedRequest({ params: { limit, offset } }),
    )
    .then((response) => response.data);
}

export function getArtistTopTracks(artistId: string, limit = 10) {
  return api
    .get<Paginated<Track>>(
      `/v1/artists/${artistId}/top-tracks`,
      authedRequest({ params: { limit } }),
    )
    .then((response) => response.data);
}

export function getAlbums(limit = 20, offset = 0) {
  return api
    .get<Paginated<Album>>('/v1/albums/', authedRequest({ params: { limit, offset } }))
    .then((response) => response.data);
}

export function getAlbum(id: string) {
  return api.get<Album>(`/v1/albums/${id}`, authedRequest()).then((response) => response.data);
}

export function getAlbumTracks(albumId: string) {
  return api
    .get<Paginated<Track>>(`/v1/albums/${albumId}/tracks`, authedRequest())
    .then((response) => response.data);
}

export function getTracks(limit = 20, offset = 0) {
  return api
    .get<Paginated<Track>>('/v1/tracks/', authedRequest({ params: { limit, offset } }))
    .then((response) => response.data);
}

export function getFeaturedTracks(limit = 10) {
  return api
    .get<Paginated<Track>>('/v1/tracks/featured', authedRequest({ params: { limit } }))
    .then((response) => response.data);
}

export function getPlaylist(id: string) {
  return api
    .get<Playlist>(`/v1/playlists/${id}`, authedRequest())
    .then((response) => response.data);
}

export function getPlaylists(limit = 20, offset = 0) {
  return api
    .get<Paginated<Playlist>>('/v1/playlists/', authedRequest({ params: { limit, offset } }))
    .then((response) => response.data);
}

export function getUserPlaylists(limit = 50, offset = 0) {
  return api
    .get<Paginated<Playlist>>(
      '/v1/users/me/playlists',
      authedRequest({ params: { limit, offset } }),
    )
    .then((response) => response.data);
}

export function search(query: string, limit = 10) {
  return api
    .get<SearchResults>('/v1/search/', authedRequest({ params: { q: query, limit } }))
    .then((response) => response.data);
}
