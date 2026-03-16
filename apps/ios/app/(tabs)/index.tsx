import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { AlbumCard } from '@/src/components/AlbumCard';
import { ArtistCard } from '@/src/components/ArtistCard';
import { GlassSurface } from '@/src/components/GlassSurface';
import { LoadingView } from '@/src/components/LoadingView';
import { ScreenView } from '@/src/components/ScreenView';
import { SectionHeader } from '@/src/components/SectionHeader';
import { TrackRow } from '@/src/components/TrackRow';
import { greeting } from '@/src/lib/format';
import { useFeaturedTracks, useAlbums, useArtists } from '@/src/hooks/useCatalog';
import { useTheme } from '@/src/providers/ThemeProvider';
import { useAuthStore } from '@/src/stores/authStore';

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const user = useAuthStore((state) => state.user);
  const albums = useAlbums(10);
  const artists = useArtists(8);
  const featuredTracks = useFeaturedTracks(10);

  return (
    <ScreenView>
      <GlassSurface style={{ padding: 20, gap: 10 }}>
        <Text
          style={{
            color: theme.colors.textSubtle,
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.7,
            }}
        >
          Listener Home
        </Text>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 30,
            fontWeight: '800',
            fontFamily: theme.typography.displayFontFamily,
          }}
        >
          {greeting()}
          {user?.displayName ? `, ${user.displayName}` : ''}.
        </Text>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 15,
            lineHeight: 22,
            fontFamily: theme.typography.bodyFontFamily,
          }}
        >
          Every artist, album, and lyric here is AI-born. No catalog filler, no copyright risk,
          just an always-on synthetic music universe.
        </Text>
      </GlassSurface>

      <View>
        <SectionHeader
          title="New Releases"
          actionLabel="See all"
          onActionPress={() => router.push({ pathname: '/browse', params: { kind: 'albums' } })}
        />
        {albums.isLoading ? (
          <LoadingView label="Loading new releases..." />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {albums.data?.items.map((album) => <AlbumCard key={album.id} album={album} />)}
          </ScrollView>
        )}
      </View>

      <View>
        <SectionHeader
          title="Featured Artists"
          actionLabel="See all"
          onActionPress={() => router.push({ pathname: '/browse', params: { kind: 'artists' } })}
        />
        {artists.isLoading ? (
          <LoadingView label="Loading artists..." />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {artists.data?.items.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}
          </ScrollView>
        )}
      </View>

      <View>
        <SectionHeader
          title="Trending Tracks"
          actionLabel="See all"
          onActionPress={() => router.push({ pathname: '/browse', params: { kind: 'songs' } })}
        />
        {featuredTracks.isLoading ? (
          <LoadingView label="Loading tracks..." />
        ) : (
          <View style={{ gap: 10 }}>
            {featuredTracks.data?.items.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index + 1}
                queue={featuredTracks.data?.items}
                showAlbum
              />
            ))}
          </View>
        )}
      </View>
    </ScreenView>
  );
}
