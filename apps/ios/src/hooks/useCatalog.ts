import { useQuery } from '@tanstack/react-query';
import * as catalog from '@/src/services/catalog';

export const useArtists = (limit = 20, offset = 0) =>
  useQuery({
    queryKey: ['artists', limit, offset],
    queryFn: () => catalog.getArtists(limit, offset),
  });

export const useArtist = (id: string) =>
  useQuery({
    queryKey: ['artist', id],
    queryFn: () => catalog.getArtist(id),
    enabled: Boolean(id),
  });

export const useArtistAlbums = (artistId: string, limit = 20, offset = 0) =>
  useQuery({
    queryKey: ['artist-albums', artistId, limit, offset],
    queryFn: () => catalog.getArtistAlbums(artistId, limit, offset),
    enabled: Boolean(artistId),
  });

export const useArtistTopTracks = (artistId: string, limit = 10) =>
  useQuery({
    queryKey: ['artist-top-tracks', artistId, limit],
    queryFn: () => catalog.getArtistTopTracks(artistId, limit),
    enabled: Boolean(artistId),
  });

export const useAlbums = (limit = 20, offset = 0) =>
  useQuery({
    queryKey: ['albums', limit, offset],
    queryFn: () => catalog.getAlbums(limit, offset),
  });

export const useAlbum = (id: string) =>
  useQuery({
    queryKey: ['album', id],
    queryFn: () => catalog.getAlbum(id),
    enabled: Boolean(id),
  });

export const useAlbumTracks = (albumId: string) =>
  useQuery({
    queryKey: ['album-tracks', albumId],
    queryFn: () => catalog.getAlbumTracks(albumId),
    enabled: Boolean(albumId),
  });

export const useTracks = (limit = 20, offset = 0) =>
  useQuery({
    queryKey: ['tracks', limit, offset],
    queryFn: () => catalog.getTracks(limit, offset),
  });

export const useFeaturedTracks = (limit = 10) =>
  useQuery({
    queryKey: ['featured-tracks', limit],
    queryFn: () => catalog.getFeaturedTracks(limit),
  });

export const usePlaylists = (limit = 20, offset = 0) =>
  useQuery({
    queryKey: ['playlists', limit, offset],
    queryFn: () => catalog.getPlaylists(limit, offset),
  });

export const usePlaylist = (id: string) =>
  useQuery({
    queryKey: ['playlist', id],
    queryFn: () => catalog.getPlaylist(id),
    enabled: Boolean(id),
  });

export const useUserPlaylists = (limit = 50, offset = 0) =>
  useQuery({
    queryKey: ['user-playlists', limit, offset],
    queryFn: () => catalog.getUserPlaylists(limit, offset),
  });

export const useSearch = (query: string, limit = 10) =>
  useQuery({
    queryKey: ['search', query, limit],
    queryFn: () => catalog.search(query, limit),
    enabled: query.trim().length > 0,
  });
