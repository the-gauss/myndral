import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { ExportSheet } from '@/src/components/ExportSheet';
import { formatDuration } from '@/src/lib/format';
import { usePlayer } from '@/src/providers/PlayerProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import { useAuthStore } from '@/src/stores/authStore';
import type { Track } from '@/src/types/domain';

interface TrackRowProps {
  track: Track;
  index?: number;
  queue?: Track[];
  showAlbum?: boolean;
}

export function TrackRow({ track, index, queue, showAlbum = false }: TrackRowProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();
  const isPremium = useAuthStore((state) => state.isPremium);
  const isActive = currentTrack?.id === track.id;
  const [exportOpen, setExportOpen] = useState(false);

  function handlePlay() {
    if (isActive) {
      togglePlay();
      return;
    }

    playTrack(track, queue);
  }

  return (
    <>
      <Pressable
        onPress={handlePlay}
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
            <Pressable onPress={() => router.push(`/artist/${track.artistId}`)}>
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
            </Pressable>
            {showAlbum ? (
              <Pressable onPress={() => router.push(`/album/${track.albumId}`)}>
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
              </Pressable>
            ) : null}
          </View>
        </View>

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
      </Pressable>

      <ExportSheet
        open={exportOpen}
        target={{ kind: 'track', id: track.id, title: track.title }}
        onClose={() => setExportOpen(false)}
      />
    </>
  );
}
