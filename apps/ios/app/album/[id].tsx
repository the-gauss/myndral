import type { AxiosError } from 'axios';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ExportSheet } from '@/src/components/ExportSheet';
import { GlassSurface } from '@/src/components/GlassSurface';
import { LoadingView } from '@/src/components/LoadingView';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { RemoteArtwork } from '@/src/components/RemoteArtwork';
import { ScreenView } from '@/src/components/ScreenView';
import { TrackRow } from '@/src/components/TrackRow';
import { formatReleaseYear } from '@/src/lib/format';
import { useAlbum, useAlbumTracks, useCollectionState } from '@/src/hooks/useCatalog';
import { usePlayer } from '@/src/providers/PlayerProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import {
  favoriteAlbum,
  removeAlbumFromLibrary,
  saveAlbumToLibrary,
  unfavoriteAlbum,
} from '@/src/services/catalog';
import { useAuthStore } from '@/src/stores/authStore';

function asErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ detail?: unknown }>;
  const detail = axiosError?.response?.data?.detail;
  return typeof detail === 'string' && detail.trim() ? detail.trim() : fallback;
}

export default function AlbumDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { playTrack } = usePlayer();
  const isPremium = useAuthStore((state) => state.isPremium);
  const queryClient = useQueryClient();
  const [exportOpen, setExportOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const album = useAlbum(id ?? '');
  const tracks = useAlbumTracks(id ?? '');
  const details = album.data;
  const collection = useCollectionState({
    albumIds: details ? [details.id] : [],
    trackIds: tracks.data?.items.map((track) => track.id) ?? [],
  });
  const isFavorite = Boolean(details && collection.data?.favorites.albumIds.includes(details.id));
  const isInLibrary = Boolean(details && collection.data?.library.albumIds.includes(details.id));
  const favoriteTrackIds = new Set(collection.data?.favorites.trackIds ?? []);
  const libraryTrackIds = new Set(collection.data?.library.trackIds ?? []);

  const favoriteMutation = useMutation({
    mutationFn: () => {
      if (!details) throw new Error('Album not loaded');
      return isFavorite ? unfavoriteAlbum(details.id) : favoriteAlbum(details.id);
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['album', id] });
      queryClient.invalidateQueries({ queryKey: ['favorite-albums'] });
      queryClient.invalidateQueries({ queryKey: ['collection-state'] });
    },
    onError: (error) => {
      setActionError(asErrorMessage(error, 'Could not update album favorites.'));
    },
  });

  const libraryMutation = useMutation({
    mutationFn: () => {
      if (!details) throw new Error('Album not loaded');
      return isInLibrary ? removeAlbumFromLibrary(details.id) : saveAlbumToLibrary(details.id);
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['album', id] });
      queryClient.invalidateQueries({ queryKey: ['library-albums'] });
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

      {album.isLoading ? (
        <LoadingView label="Loading album..." />
      ) : details ? (
        <>
          <GlassSurface style={{ padding: 18, gap: 18 }}>
            <RemoteArtwork uri={details.coverUrl} style={{ width: '100%', aspectRatio: 1 }} />
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.textSubtle, fontSize: 12, fontWeight: '700' }}>
                {details.albumType.toUpperCase()}
              </Text>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: 32,
                  fontWeight: '800',
                  fontFamily: theme.typography.displayFontFamily,
                }}
              >
                {details.title}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>
                {details.artist.name} · {formatReleaseYear(details.releaseDate)} · {details.trackCount}{' '}
                {details.trackCount === 1 ? 'song' : 'songs'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PrimaryButton
                label="Play"
                onPress={() => {
                  if (tracks.data?.items.length) {
                    playTrack(tracks.data.items[0], tracks.data.items);
                  }
                }}
                style={{ flex: 1 }}
              />
              {isPremium ? (
                <PrimaryButton
                  label="Export"
                  onPress={() => setExportOpen(true)}
                  variant="secondary"
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PrimaryButton
                label={isInLibrary ? 'Saved' : 'Add to Library'}
                onPress={() => libraryMutation.mutate()}
                variant="secondary"
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label={isFavorite ? 'Favorited' : 'Favorite'}
                onPress={() => favoriteMutation.mutate()}
                variant="secondary"
                style={{ flex: 1 }}
              />
            </View>

            {actionError ? (
              <Text style={{ color: theme.colors.danger, fontSize: 14 }}>{actionError}</Text>
            ) : null}
          </GlassSurface>

          <View style={{ gap: 10 }}>
            {tracks.isLoading ? (
              <LoadingView label="Loading tracks..." />
            ) : (
              tracks.data?.items.map((track, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={index + 1}
                  queue={tracks.data?.items}
                  isFavorite={favoriteTrackIds.has(track.id)}
                  isInLibrary={libraryTrackIds.has(track.id)}
                />
              ))
            )}
          </View>

          <ExportSheet
            open={exportOpen}
            target={{ kind: 'album', id: details.id, title: details.title }}
            onClose={() => setExportOpen(false)}
          />
        </>
      ) : null}
    </ScreenView>
  );
}
