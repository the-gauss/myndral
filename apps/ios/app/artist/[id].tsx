import type { AxiosError } from 'axios';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { AlbumCard } from '@/src/components/AlbumCard';
import { GlassSurface } from '@/src/components/GlassSurface';
import { LoadingView } from '@/src/components/LoadingView';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { RemoteArtwork } from '@/src/components/RemoteArtwork';
import { ScreenView } from '@/src/components/ScreenView';
import { SectionHeader } from '@/src/components/SectionHeader';
import { TrackRow } from '@/src/components/TrackRow';
import { formatListeners } from '@/src/lib/format';
import { useArtist, useArtistAlbums, useArtistTopTracks, useCollectionState } from '@/src/hooks/useCatalog';
import { usePlayer } from '@/src/providers/PlayerProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import {
  favoriteArtist,
  removeArtistFromLibrary,
  saveArtistToLibrary,
  unfavoriteArtist,
} from '@/src/services/catalog';

function asErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ detail?: unknown }>;
  const detail = axiosError?.response?.data?.detail;
  return typeof detail === 'string' && detail.trim() ? detail.trim() : fallback;
}

export default function ArtistDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { playTrack } = usePlayer();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const artist = useArtist(id ?? '');
  const topTracks = useArtistTopTracks(id ?? '');
  const albums = useArtistAlbums(id ?? '', 20);

  const details = artist.data;
  const collection = useCollectionState({
    artistIds: details ? [details.id] : [],
    trackIds: topTracks.data?.items.map((track) => track.id) ?? [],
  });
  const isFavorite = Boolean(details && collection.data?.favorites.artistIds.includes(details.id));
  const isInLibrary = Boolean(details && collection.data?.library.artistIds.includes(details.id));
  const favoriteTrackIds = new Set(collection.data?.favorites.trackIds ?? []);
  const libraryTrackIds = new Set(collection.data?.library.trackIds ?? []);

  const favoriteMutation = useMutation({
    mutationFn: () => {
      if (!details) throw new Error('Artist not loaded');
      return isFavorite ? unfavoriteArtist(details.id) : favoriteArtist(details.id);
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['artist', id] });
      queryClient.invalidateQueries({ queryKey: ['favorite-artists'] });
      queryClient.invalidateQueries({ queryKey: ['collection-state'] });
    },
    onError: (error) => {
      setActionError(asErrorMessage(error, 'Could not update artist favorites.'));
    },
  });

  const libraryMutation = useMutation({
    mutationFn: () => {
      if (!details) throw new Error('Artist not loaded');
      return isInLibrary ? removeArtistFromLibrary(details.id) : saveArtistToLibrary(details.id);
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['artist', id] });
      queryClient.invalidateQueries({ queryKey: ['library-artists'] });
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

      {artist.isLoading ? (
        <LoadingView label="Loading artist..." />
      ) : details ? (
        <>
          <GlassSurface style={{ padding: 18, gap: 16 }}>
            <RemoteArtwork uri={details.imageUrl} style={{ width: '100%', height: 280 }} placeholderSymbol="music.mic" />
            <View style={{ gap: 6 }}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: 34,
                  fontWeight: '800',
                  fontFamily: theme.typography.displayFontFamily,
                }}
              >
                {details.name}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>
                {formatListeners(details.monthlyListeners)} monthly listeners
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {topTracks.data?.items.length ? (
                <PrimaryButton
                  label="Play Artist"
                  onPress={() => playTrack(topTracks.data!.items[0], topTracks.data!.items)}
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
            <PrimaryButton
              label={isFavorite ? 'Favorited' : 'Favorite'}
              onPress={() => favoriteMutation.mutate()}
              variant="secondary"
            />
            {actionError ? (
              <Text style={{ color: theme.colors.danger, fontSize: 14 }}>{actionError}</Text>
            ) : null}
          </GlassSurface>

          {topTracks.data?.items.length ? (
            <View>
              <SectionHeader title="Popular" />
              <View style={{ gap: 10 }}>
                {topTracks.data.items.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={index + 1}
                    queue={topTracks.data?.items}
                    isFavorite={favoriteTrackIds.has(track.id)}
                    isInLibrary={libraryTrackIds.has(track.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {albums.data?.items.length ? (
            <View>
              <SectionHeader title="Discography" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {albums.data.items.map((album) => <AlbumCard key={album.id} album={album} />)}
              </ScrollView>
            </View>
          ) : null}
        </>
      ) : null}
    </ScreenView>
  );
}
