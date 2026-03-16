import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { GlassSurface } from '@/src/components/GlassSurface';
import { RemoteArtwork } from '@/src/components/RemoteArtwork';
import { useTheme } from '@/src/providers/ThemeProvider';
import type { Artist } from '@/src/types/domain';

interface ArtistCardProps {
  artist: Artist;
}

export function ArtistCard({ artist }: ArtistCardProps) {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <Pressable onPress={() => router.push(`/artist/${artist.id}`)}>
      <GlassSurface
        style={{
          width: 148,
          padding: 12,
          gap: 12,
          alignItems: 'center',
        }}
      >
        <RemoteArtwork
          uri={artist.imageUrl}
          shape="circle"
          style={{ width: 108, height: 108 }}
          placeholderSymbol="music.mic"
        />
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.text,
              fontSize: 15,
              fontWeight: '700',
              textAlign: 'center',
              fontFamily: theme.typography.displayFontFamily,
            }}
          >
            {artist.name}
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 13,
              fontFamily: theme.typography.bodyFontFamily,
            }}
          >
            Artist
          </Text>
        </View>
      </GlassSurface>
    </Pressable>
  );
}
