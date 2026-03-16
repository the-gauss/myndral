import type { AxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExportSheet } from '@/src/components/ExportSheet';
import { PlaylistSheet } from '@/src/components/PlaylistSheet';
import { TrackActionSheet } from '@/src/components/TrackActionSheet';
import { formatDuration } from '@/src/lib/format';
import { usePlayer } from '@/src/providers/PlayerProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import {
  favoriteTrack,
  removeTrackFromLibrary,
  saveTrackToLibrary,
  unfavoriteTrack,
} from '@/src/services/catalog';
import { useAuthStore } from '@/src/stores/authStore';
import type { Track } from '@/src/types/domain';

interface TrackRowProps {
  track: Track;
  index?: number;
  queue?: Track[];
  showAlbum?: boolean;
  isFavorite?: boolean;
  isInLibrary?: boolean;
}

function asErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ detail?: unknown }>;
  const detail = axiosError?.response?.data?.detail;
  return typeof detail === 'string' && detail.trim() ? detail.trim() : fallback;
}

export function TrackRow({
  track,
  index,
  queue,
  showAlbum = false,
  isFavorite = false,
  isInLibrary = false,
}: TrackRowProps) {
  const { theme } = useTheme();
  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue, playNext } = usePlayer();
  const isPremium = useAuthStore((state) => state.isPremium);
  const isActive = currentTrack?.id === track.id;
  const queryClient = useQueryClient();
  const suppressTapRef = useRef(false);

  const [exportOpen, setExportOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [playlistSheetOpen, setPlaylistSheetOpen] = useState(false);
  const [favorite, setFavorite] = useState(isFavorite);
  const [inLibrary, setInLibrary] = useState(isInLibrary);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setFavorite(isFavorite);
  }, [isFavorite]);

  useEffect(() => {
    setInLibrary(isInLibrary);
  }, [isInLibrary]);

  const favoriteMutation = useMutation({
    mutationFn: () => (favorite ? unfavoriteTrack(track.id) : favoriteTrack(track.id)),
    onSuccess: () => {
      setFavorite((current) => !current);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['collection-state'] });
      queryClient.invalidateQueries({ queryKey: ['favorite-tracks'] });
    },
    onError: (error) => {
      setActionError(asErrorMessage(error, 'Could not update favorites.'));
    },
  });

  const libraryMutation = useMutation({
    mutationFn: () => (inLibrary ? removeTrackFromLibrary(track.id) : saveTrackToLibrary(track.id)),
    onSuccess: () => {
      setInLibrary((current) => !current);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['collection-state'] });
      queryClient.invalidateQueries({ queryKey: ['library-tracks'] });
    },
    onError: (error) => {
      setActionError(asErrorMessage(error, 'Could not update the library.'));
    },
  });

  function handlePlay() {
    if (suppressTapRef.current) {
      suppressTapRef.current = false;
      return;
    }

    if (isActive) {
      togglePlay();
      return;
    }

    playTrack(track, queue);
  }

  function openActions() {
    suppressTapRef.current = true;
    setActionSheetOpen(true);
  }

  return (
    <>
      <View style={{ gap: 6 }}>
        <Pressable
          onPress={handlePlay}
          onLongPress={openActions}
          delayLongPress={220}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 22,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: isActive ? theme.colors.primaryDim : theme.colors.surfaceRaised,
            borderWidth: 1,
            borderColor: isActive ? theme.colors.primary : theme.colors.surfaceBorder,
          }}
        >
          <View
            style={{
              width: 28,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isActive ? (
              <SymbolView
                name={isPlaying ? 'pause.fill' : 'play.fill'}
                size={14}
                tintColor={theme.colors.primary}
              />
            ) : (
              <Text
                style={{
                  color: theme.colors.textSubtle,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {index ?? ''}
              </Text>
            )}
          </View>

          <View style={{ flex: 1, gap: 3 }}>
            <Text
              numberOfLines={1}
              style={{
                color: isActive ? theme.colors.primary : theme.colors.text,
                fontSize: 15,
                fontWeight: '700',
                fontFamily: theme.typography.displayFontFamily,
              }}
            >
              {track.title}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Text
                numberOfLines={1}
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 13,
                  fontFamily: theme.typography.bodyFontFamily,
                }}
              >
                {track.artist.name}
              </Text>
              {showAlbum ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: theme.colors.textSubtle,
                    fontSize: 12,
                    fontFamily: theme.typography.bodyFontFamily,
                  }}
                >
                  · {track.album.title}
                </Text>
              ) : null}
            </View>
          </View>

          {favorite ? (
            <SymbolView name="heart.fill" size={15} tintColor={theme.colors.primary} />
          ) : null}

          {isPremium ? (
            <Pressable
              onPress={() => setExportOpen(true)}
              hitSlop={10}
              style={{ padding: 2 }}
            >
              <SymbolView name="arrow.down.circle" size={18} tintColor={theme.colors.textMuted} />
            </Pressable>
          ) : null}

          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 13,
              minWidth: 40,
              textAlign: 'right',
              fontFamily: theme.typography.bodyFontFamily,
            }}
          >
            {formatDuration(track.durationMs)}
          </Text>

          <Pressable
            onPress={openActions}
            hitSlop={10}
            style={{ paddingLeft: 2 }}
          >
            <SymbolView name="ellipsis.circle" size={18} tintColor={theme.colors.textMuted} />
          </Pressable>
        </Pressable>

        {actionError ? (
          <Text style={{ color: theme.colors.danger, fontSize: 12, paddingHorizontal: 8 }}>
            {actionError}
          </Text>
        ) : null}
      </View>

      <TrackActionSheet
        open={actionSheetOpen}
        track={track}
        isFavorite={favorite}
        isInLibrary={inLibrary}
        onClose={() => setActionSheetOpen(false)}
        onPlayNow={() => {
          playTrack(track, queue);
          setActionSheetOpen(false);
        }}
        onPlayNext={() => {
          playNext(track);
          setActionSheetOpen(false);
        }}
        onAddToQueue={() => {
          addToQueue(track);
          setActionSheetOpen(false);
        }}
        onAddToPlaylist={() => {
          setActionSheetOpen(false);
          setPlaylistSheetOpen(true);
        }}
        onToggleFavorite={() => {
          favoriteMutation.mutate();
          setActionSheetOpen(false);
        }}
        onToggleLibrary={() => {
          libraryMutation.mutate();
          setActionSheetOpen(false);
        }}
      />

      <PlaylistSheet
        open={playlistSheetOpen}
        onClose={() => setPlaylistSheetOpen(false)}
        trackIds={[track.id]}
        heading={`Add "${track.title}" to a playlist`}
      />

      <ExportSheet
        open={exportOpen}
        target={{ kind: 'track', id: track.id, title: track.title }}
        onClose={() => setExportOpen(false)}
      />
    </>
  );
}
