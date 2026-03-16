import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { GlassSurface } from '@/src/components/GlassSurface';
import { RemoteArtwork } from '@/src/components/RemoteArtwork';
import { usePlayer } from '@/src/providers/PlayerProvider';
import { useTheme } from '@/src/providers/ThemeProvider';

interface MiniPlayerProps {
  bottomOffset: number;
}

export function MiniPlayer({ bottomOffset }: MiniPlayerProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { currentTrack, isPlaying, togglePlay, next } = usePlayer();

  if (!currentTrack) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: bottomOffset,
      }}
    >
      <Pressable onPress={() => router.push('/player')}>
        <GlassSurface
          styleVariant="clear"
          style={{
            padding: 10,
            paddingRight: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            shadowColor: theme.isDark ? theme.colors.secondary : theme.colors.primary,
            shadowOpacity: theme.isDark ? 0.16 : 0.1,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 14 },
          }}
        >
          <RemoteArtwork uri={currentTrack.album.coverUrl} style={{ width: 48, height: 48 }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              numberOfLines={1}
              style={{
                color: theme.colors.text,
                fontSize: 15,
                fontWeight: '700',
                fontFamily: theme.typography.displayFontFamily,
              }}
            >
              {currentTrack.title}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: theme.colors.textMuted,
                fontSize: 13,
                fontFamily: theme.typography.bodyFontFamily,
              }}
            >
              {currentTrack.artist.name}
            </Text>
          </View>
          <Pressable onPress={togglePlay} hitSlop={12} style={{ padding: 4 }}>
            <SymbolView
              name={isPlaying ? 'pause.circle.fill' : 'play.circle.fill'}
              size={28}
              tintColor={theme.colors.primary}
            />
          </Pressable>
          <Pressable onPress={next} hitSlop={12} style={{ padding: 4 }}>
            <SymbolView name="forward.fill" size={16} tintColor={theme.colors.textMuted} />
          </Pressable>
        </GlassSurface>
      </Pressable>
    </View>
  );
}
