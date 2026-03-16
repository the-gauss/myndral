import { authedRequest } from '@/src/lib/authedRequest';
import api from '@/src/lib/api';
import type {
  Album,
  Artist,
  CollectionState,
  Paginated,
  Playlist,
  SearchResults,
  Track,
} from '@/src/types/domain';

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

export function getEditableUserPlaylists(limit = 50) {
  return api
    .get<Paginated<Playlist>>(
      '/v1/users/me/playlists',
      authedRequest({ params: { limit, editableOnly: true } }),
    )
    .then((response) => response.data);
}

export function createPlaylist(payload: {
  name: string;
  description?: string;
  isPublic: boolean;
  trackIds?: string[];
}) {
  return api
    .post<Playlist>('/v1/playlists/', payload, authedRequest())
    .then((response) => response.data);
}

export function updatePlaylist(
  playlistId: string,
  payload: Partial<{
    name: string;
    description: string;
    isPublic: boolean;
  }>,
) {
  return api
    .patch<Playlist>(`/v1/playlists/${playlistId}`, payload, authedRequest())
    .then((response) => response.data);
}

export function addTracksToPlaylist(playlistId: string, trackIds: string[]) {
  return api
    .post<Playlist>(`/v1/playlists/${playlistId}/tracks`, { trackIds }, authedRequest())
    .then((response) => response.data);
}

export function removeTracksFromPlaylist(playlistId: string, trackIds: string[]) {
  return api
    .delete<Playlist>(`/v1/playlists/${playlistId}/tracks`, authedRequest({ data: { trackIds } }))
    .then((response) => response.data);
}

export function getCollectionState(params: {
  trackIds?: string[];
  albumIds?: string[];
  artistIds?: string[];
  playlistIds?: string[];
}) {
  return api
    .get<CollectionState>('/v1/users/me/collection-state', authedRequest({ params }))
    .then((response) => response.data);
}

export function getLibraryTracks(limit = 50, offset = 0) {
  return api
    .get<Paginated<Track>>(
      '/v1/users/me/library/tracks',
      authedRequest({ params: { limit, offset } }),
    )
    .then((response) => response.data);
}

export function saveTrackToLibrary(trackId: string) {
  return api
    .put<{ trackId: string; inLibrary: boolean }>(
      `/v1/users/me/library/tracks/${trackId}`,
      undefined,
      authedRequest(),
    )
    .then((response) => response.data);
}

export function removeTrackFromLibrary(trackId: string) {
  return api
    .delete<{ trackId: string; inLibrary: boolean }>(
      `/v1/users/me/library/tracks/${trackId}`,
      authedRequest(),
    )
    .then((response) => response.data);
}

export function getLibraryAlbums(limit = 50, offset = 0) {
  return api
    .get<Paginated<Album>>(
      '/v1/users/me/library/albums',
      authedRequest({ params: { limit, offset } }),
    )
    .then((response) => response.data);
}

export function saveAlbumToLibrary(albumId: string) {
  return api
    .put<{ albumId: string; inLibrary: boolean }>(
      `/v1/users/me/library/albums/${albumId}`,
      undefined,
      authedRequest(),
    )
    .then((response) => response.data);
}

export function removeAlbumFromLibrary(albumId: string) {
  return api
    .delete<{ albumId: string; inLibrary: boolean }>(
      `/v1/users/me/library/albums/${albumId}`,
      authedRequest(),
    )
    .then((response) => response.data);
}

export function getLibraryArtists(limit = 50, offset = 0) {
  return api
    .get<Paginated<Artist>>(
      '/v1/users/me/library/artists',
      authedRequest({ params: { limit, offset } }),
    )
    .then((response) => response.data);
}

export function saveArtistToLibrary(artistId: string) {
  return api
    .put<{ artistId: string; inLibrary: boolean }>(
      `/v1/users/me/library/artists/${artistId}`,
      undefined,
      authedRequest(),
    )
    .then((response) => response.data);
}

export function removeArtistFromLibrary(artistId: string) {
  return api
    .delete<{ artistId: string; inLibrary: boolean }>(
      `/v1/users/me/library/artists/${artistId}`,
      authedRequest(),
    )
    .then((response) => response.data);
}

export function getLibraryPlaylists(limit = 50, offset = 0) {
  return api
    .get<Paginated<Playlist>>(
      '/v1/users/me/library/playlists',
      authedRequest({ params: { limit, offset } }),
    )
    .then((response) => response.data);
}

export function savePlaylistToLibrary(playlistId: string) {
  return api
    .put<{ playlistId: string; inLibrary: boolean }>(
      `/v1/users/me/library/playlists/${playlistId}`,
      undefined,
      authedRequest(),
    )
    .then((response) => response.data);
}

export function removePlaylistFromLibrary(playlistId: string) {
  return api
    .delete<{ playlistId: string; inLibrary: boolean }>(
      `/v1/users/me/library/playlists/${playlistId}`,
      authedRequest(),
    )
    .then((response) => response.data);
}

export function getFavoriteTracks(limit = 50, offset = 0) {
  return api
    .get<Paginated<Track>>(
      '/v1/users/me/favorites/tracks',
      authedRequest({ params: { limit, offset } }),
    )
    .then((response) => response.data);
}

export function favoriteTrack(trackId: string) {
  return api
    .put<{ trackId: string; isFavorite: boolean }>(
      `/v1/tracks/${trackId}/like`,
      undefined,
      authedRequest(),
    )
    .then((response) => response.data);
}

export function unfavoriteTrack(trackId: string) {
  return api
    .delete<{ trackId: string; isFavorite: boolean }>(`/v1/tracks/${trackId}/like`, authedRequest())
    .then((response) => response.data);
}

export function getFavoriteAlbums(limit = 50, offset = 0) {
  return api
    .get<Paginated<Album>>(
      '/v1/users/me/favorites/albums',
      authedRequest({ params: { limit, offset } }),
    )
    .then((response) => response.data);
}

export function favoriteAlbum(albumId: string) {
  return api
    .put<{ albumId: string; isFavorite: boolean }>(
      `/v1/users/me/favorites/albums/${albumId}`,
      undefined,
      authedRequest(),
    )
    .then((response) => response.data);
}

export function unfavoriteAlbum(albumId: string) {
  return api
    .delete<{ albumId: string; isFavorite: boolean }>(
      `/v1/users/me/favorites/albums/${albumId}`,
      authedRequest(),
    )
    .then((response) => response.data);
}

export function getFavoriteArtists(limit = 50, offset = 0) {
  return api
    .get<Paginated<Artist>>(
      '/v1/users/me/favorites/artists',
      authedRequest({ params: { limit, offset } }),
    )
    .then((response) => response.data);
}

export function favoriteArtist(artistId: string) {
  return api
    .put<{ artistId: string; isFavorite: boolean }>(
      `/v1/users/me/favorites/artists/${artistId}`,
      undefined,
      authedRequest(),
    )
    .then((response) => response.data);
}

export function unfavoriteArtist(artistId: string) {
  return api
    .delete<{ artistId: string; isFavorite: boolean }>(
      `/v1/users/me/favorites/artists/${artistId}`,
      authedRequest(),
    )
    .then((response) => response.data);
}

export function search(query: string, limit = 10) {
  return api
    .get<SearchResults>('/v1/search/', authedRequest({ params: { q: query, limit } }))
    .then((response) => response.data);
}
