import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { GlassSurface } from '@/src/components/GlassSurface';
import { RemoteArtwork } from '@/src/components/RemoteArtwork';
import { useTheme } from '@/src/providers/ThemeProvider';
import type { Playlist } from '@/src/types/domain';

interface PlaylistListItemProps {
  playlist: Playlist;
}

export function PlaylistListItem({ playlist }: PlaylistListItemProps) {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <Pressable onPress={() => router.push(`/playlist/${playlist.id}`)}>
      <GlassSurface
        style={{
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <RemoteArtwork uri={playlist.coverUrl} style={{ width: 64, height: 64 }} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.text,
              fontSize: 16,
              fontWeight: '700',
              fontFamily: theme.typography.displayFontFamily,
            }}
          >
            {playlist.name}
          </Text>
          {playlist.description ? (
            <Text
              numberOfLines={2}
              style={{
                color: theme.colors.textMuted,
                fontSize: 13,
                lineHeight: 18,
                fontFamily: theme.typography.bodyFontFamily,
              }}
            >
              {playlist.description}
            </Text>
          ) : null}
          <Text
            style={{
              color: theme.colors.textSubtle,
              fontSize: 12,
              fontFamily: theme.typography.bodyFontFamily,
            }}
          >
            {playlist.tracks.length} {playlist.tracks.length === 1 ? 'song' : 'songs'}
            {playlist.isAiCurated ? ' · AI Curated' : ''}
          </Text>
        </View>
      </GlassSurface>
    </Pressable>
  );
}
