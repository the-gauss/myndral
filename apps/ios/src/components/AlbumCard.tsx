import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { GlassSurface } from '@/src/components/GlassSurface';
import { RemoteArtwork } from '@/src/components/RemoteArtwork';
import { formatReleaseYear } from '@/src/lib/format';
import { useTheme } from '@/src/providers/ThemeProvider';
import type { Album } from '@/src/types/domain';

interface AlbumCardProps {
  album: Album;
}

export function AlbumCard({ album }: AlbumCardProps) {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <Pressable onPress={() => router.push(`/album/${album.id}`)}>
      <GlassSurface
        style={{
          width: 168,
          padding: 12,
          gap: 12,
        }}
      >
        <RemoteArtwork uri={album.coverUrl} style={{ width: '100%', aspectRatio: 1 }} />
        <View style={{ gap: 4 }}>
          <Text
            numberOfLines={2}
            style={{
              color: theme.colors.text,
              fontSize: 15,
              fontWeight: '700',
              fontFamily: theme.typography.displayFontFamily,
            }}
          >
            {album.title}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.textMuted,
              fontSize: 13,
              fontFamily: theme.typography.bodyFontFamily,
            }}
          >
            {formatReleaseYear(album.releaseDate)} · {album.artist.name}
          </Text>
        </View>
      </GlassSurface>
    </Pressable>
  );
}
