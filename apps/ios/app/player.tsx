import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { EmptyState } from '@/src/components/EmptyState';
import { GlassSurface } from '@/src/components/GlassSurface';
import { RemoteArtwork } from '@/src/components/RemoteArtwork';
import { ScreenView } from '@/src/components/ScreenView';
import { formatDuration } from '@/src/lib/format';
import { usePlayer } from '@/src/providers/PlayerProvider';
import { useTheme } from '@/src/providers/ThemeProvider';

export default function PlayerScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    progress,
    elapsedSeconds,
    durationSeconds,
    volume,
    shuffle,
    repeat,
    togglePlay,
    next,
    previous,
    seekTo,
    setVolume,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();

  if (!currentTrack) {
    return (
      <ScreenView edges={['top', 'bottom']} bottomInset={48}>
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
        >
          <SymbolView name="chevron.down" size={14} tintColor={theme.colors.textMuted} />
          <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>Close</Text>
        </Pressable>
        <EmptyState
          title="Nothing is playing"
          message="Start playback from Home, Search, Browse, or any album or playlist screen."
          symbol="play.slash"
        />
      </ScreenView>
    );
  }

  return (
    <ScreenView edges={['top', 'bottom']} bottomInset={48}>
      <Pressable
        onPress={() => router.back()}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
      >
        <SymbolView name="chevron.down" size={14} tintColor={theme.colors.textMuted} />
        <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>Now Playing</Text>
      </Pressable>

      <GlassSurface style={{ padding: 20, gap: 22 }}>
        <RemoteArtwork uri={currentTrack.album.coverUrl} style={{ width: '100%', aspectRatio: 1 }} />

        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 30,
              fontWeight: '800',
              fontFamily: theme.typography.displayFontFamily,
            }}
          >
            {currentTrack.title}
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 16,
              fontFamily: theme.typography.bodyFontFamily,
            }}
          >
            {currentTrack.artist.name} · {currentTrack.album.title}
          </Text>
          {isBuffering ? (
            <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '700' }}>
              Buffering...
            </Text>
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <Slider
            value={progress}
            minimumValue={0}
            maximumValue={1}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.fillSoft}
            thumbTintColor={theme.colors.primary}
            onSlidingComplete={(value) => {
              void seekTo(value);
            }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
              {formatDuration(elapsedSeconds * 1000)}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
              {formatDuration(durationSeconds * 1000)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={toggleShuffle} hitSlop={10} style={{ opacity: shuffle ? 1 : 0.6 }}>
            <SymbolView name="shuffle" size={20} tintColor={shuffle ? theme.colors.primary : theme.colors.textMuted} />
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}>
            <Pressable onPress={previous} hitSlop={10}>
              <SymbolView name="backward.fill" size={22} tintColor={theme.colors.text} />
            </Pressable>
            <Pressable onPress={togglePlay} hitSlop={12}>
              <SymbolView
                name={isPlaying ? 'pause.circle.fill' : 'play.circle.fill'}
                size={62}
                tintColor={theme.colors.primary}
              />
            </Pressable>
            <Pressable onPress={next} hitSlop={10}>
              <SymbolView name="forward.fill" size={22} tintColor={theme.colors.text} />
            </Pressable>
          </View>

          <Pressable onPress={cycleRepeat} hitSlop={10} style={{ opacity: repeat === 'none' ? 0.6 : 1 }}>
            <SymbolView
              name={repeat === 'one' ? 'repeat.1' : 'repeat'}
              size={20}
              tintColor={repeat === 'none' ? theme.colors.textMuted : theme.colors.primary}
            />
          </Pressable>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '700' }}>Volume</Text>
          <Slider
            value={volume}
            minimumValue={0}
            maximumValue={1}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.fillSoft}
            thumbTintColor={theme.colors.primary}
            onValueChange={setVolume}
          />
        </View>
      </GlassSurface>
    </ScreenView>
  );
}
