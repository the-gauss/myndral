import type { AxiosError } from 'axios';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { GlassSurface } from '@/src/components/GlassSurface';
import { LoadingView } from '@/src/components/LoadingView';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { RemoteArtwork } from '@/src/components/RemoteArtwork';
import { ScreenView } from '@/src/components/ScreenView';
import { TrackRow } from '@/src/components/TrackRow';
import { useCollectionState, usePlaylist } from '@/src/hooks/useCatalog';
import { usePlayer } from '@/src/providers/PlayerProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import { removePlaylistFromLibrary, savePlaylistToLibrary } from '@/src/services/catalog';

function asErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ detail?: unknown }>;
  const detail = axiosError?.response?.data?.detail;
  return typeof detail === 'string' && detail.trim() ? detail.trim() : fallback;
}

export default function PlaylistDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { playTrack } = usePlayer();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const playlist = usePlaylist(id ?? '');
  const details = playlist.data;
  const collection = useCollectionState({
    playlistIds: details ? [details.id] : [],
    trackIds: details?.tracks.map((track) => track.id) ?? [],
  });
  const isInLibrary = Boolean(details && collection.data?.library.playlistIds.includes(details.id));
  const favoriteTrackIds = new Set(collection.data?.favorites.trackIds ?? []);
  const libraryTrackIds = new Set(collection.data?.library.trackIds ?? []);

  const libraryMutation = useMutation({
    mutationFn: () => {
      if (!details) throw new Error('Playlist not loaded');
      return isInLibrary ? removePlaylistFromLibrary(details.id) : savePlaylistToLibrary(details.id);
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['playlist', id] });
      queryClient.invalidateQueries({ queryKey: ['library-playlists'] });
      queryClient.invalidateQueries({ queryKey: ['user-playlists'] });
      queryClient.invalidateQueries({ queryKey: ['editable-user-playlists'] });
      queryClient.invalidateQueries({ queryKey: ['collection-state'] });
    },
    onError: (error) => {
      setActionError(asErrorMessage(error, 'Could not update your library.'));
    },
  });

  return (
    <ScreenView>
      <Pressable
        onPress={() => router.back()}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
      >
        <SymbolView name="chevron.left" size={14} tintColor={theme.colors.textMuted} />
        <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>Back</Text>
      </Pressable>

      {playlist.isLoading ? (
        <LoadingView label="Loading playlist..." />
      ) : details ? (
        <>
          <GlassSurface style={{ padding: 18, gap: 18 }}>
            <RemoteArtwork uri={details.coverUrl} style={{ width: '100%', aspectRatio: 1 }} placeholderSymbol="music.note.list" />
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.textSubtle, fontSize: 12, fontWeight: '700' }}>
                {details.isAiCurated ? 'AI CURATED PLAYLIST' : 'PLAYLIST'}
              </Text>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: 32,
                  fontWeight: '800',
                  fontFamily: theme.typography.displayFontFamily,
                }}
              >
                {details.name}
              </Text>
              {details.description ? (
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: 14,
                    lineHeight: 20,
                    fontFamily: theme.typography.bodyFontFamily,
                  }}
                >
                  {details.description}
                </Text>
              ) : null}
              <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>
                {details.ownerDisplayName ? `${details.ownerDisplayName} · ` : ''}
                {details.tracks.length} {details.tracks.length === 1 ? 'song' : 'songs'}
                {details.isPublic ? ' · Public' : ' · Private'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {details.tracks.length ? (
                <PrimaryButton
                  label="Play Playlist"
                  onPress={() => playTrack(details.tracks[0], details.tracks)}
                  style={{ flex: 1 }}
                />
              ) : null}
              <PrimaryButton
                label={isInLibrary ? 'Saved' : 'Add to Library'}
                onPress={() => libraryMutation.mutate()}
                variant="secondary"
                style={{ flex: 1 }}
              />
            </View>

            {actionError ? (
              <Text style={{ color: theme.colors.danger, fontSize: 14 }}>{actionError}</Text>
            ) : null}
          </GlassSurface>

          {details.tracks.length ? (
            <View style={{ gap: 10 }}>
              {details.tracks.map((track, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={index + 1}
                  queue={details.tracks}
                  showAlbum
                  isFavorite={favoriteTrackIds.has(track.id)}
                  isInLibrary={libraryTrackIds.has(track.id)}
                />
              ))}
            </View>
          ) : (
            <GlassSurface style={{ padding: 18 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>
                This playlist does not have any published tracks yet.
              </Text>
            </GlassSurface>
          )}
        </>
      ) : null}
    </ScreenView>
  );
}
