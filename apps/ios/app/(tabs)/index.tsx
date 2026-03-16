import { ScrollView, Text, View } from 'react-native';
import { AlbumCard } from '@/src/components/AlbumCard';
import { ArtistCard } from '@/src/components/ArtistCard';
import { GlassSurface } from '@/src/components/GlassSurface';
import { LoadingView } from '@/src/components/LoadingView';
import { PlaylistListItem } from '@/src/components/PlaylistListItem';
import { ScreenView } from '@/src/components/ScreenView';
import { SectionHeader } from '@/src/components/SectionHeader';
import { TrackRow } from '@/src/components/TrackRow';
import { greeting } from '@/src/lib/format';
import {
  useFeaturedTracks,
  useAlbums,
  useArtists,
  usePlaylists,
  useTracks,
} from '@/src/hooks/useCatalog';
import { useTheme } from '@/src/providers/ThemeProvider';
import { useAuthStore } from '@/src/stores/authStore';

export default function HomeScreen() {
  const { theme } = useTheme();
  const user = useAuthStore((state) => state.user);
  const albums = useAlbums(10);
  const artists = useArtists(8);
  const featuredTracks = useFeaturedTracks(10);
  const browseTracks = useTracks(8);
  const playlists = usePlaylists(4);

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
        <SectionHeader title="New Releases" />
        {albums.isLoading ? (
          <LoadingView label="Loading new releases..." />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {albums.data?.items.map((album) => <AlbumCard key={album.id} album={album} />)}
          </ScrollView>
        )}
      </View>

      <View>
        <SectionHeader title="Featured Artists" />
        {artists.isLoading ? (
          <LoadingView label="Loading artists..." />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {artists.data?.items.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}
          </ScrollView>
        )}
      </View>

      <View>
        <SectionHeader title="Trending Tracks" />
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

      <GlassSurface style={{ padding: 18, gap: 8 }}>
        <Text
          style={{
            color: theme.colors.textSubtle,
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.7,
          }}
        >
          Explore More
        </Text>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 24,
            fontWeight: '800',
            fontFamily: theme.typography.displayFontFamily,
          }}
        >
          Browse now lives right here in Home.
        </Text>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 14,
            lineHeight: 21,
            fontFamily: theme.typography.bodyFontFamily,
          }}
        >
          Artists, albums, playlists, and songs from the full catalog are now woven into the
          home feed instead of sitting behind a separate tab.
        </Text>
      </GlassSurface>

      <View>
        <SectionHeader title="Artists" />
        {artists.isLoading ? (
          <LoadingView label="Loading artists..." />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {artists.data?.items.map((artist) => <ArtistCard key={`browse-${artist.id}`} artist={artist} />)}
          </ScrollView>
        )}
      </View>

      <View>
        <SectionHeader title="Albums" />
        {albums.isLoading ? (
          <LoadingView label="Loading albums..." />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {albums.data?.items.map((album) => <AlbumCard key={`browse-${album.id}`} album={album} />)}
          </ScrollView>
        )}
      </View>

      <View>
        <SectionHeader title="Songs" />
        {browseTracks.isLoading ? (
          <LoadingView label="Loading songs..." />
        ) : (
          <View style={{ gap: 10 }}>
            {browseTracks.data?.items.map((track, index) => (
              <TrackRow
                key={`browse-${track.id}`}
                track={track}
                index={index + 1}
                queue={browseTracks.data?.items}
                showAlbum
              />
            ))}
          </View>
        )}
      </View>

      <View>
        <SectionHeader title="Playlists" />
        {playlists.isLoading ? (
          <LoadingView label="Loading playlists..." />
        ) : (
          <View style={{ gap: 10 }}>
            {playlists.data?.items.map((playlist) => (
              <PlaylistListItem key={`browse-${playlist.id}`} playlist={playlist} />
            ))}
          </View>
        )}
      </View>
    </ScreenView>
  );
}
