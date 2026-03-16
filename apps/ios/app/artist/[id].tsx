import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { AlbumCard } from '@/src/components/AlbumCard';
import { GlassSurface } from '@/src/components/GlassSurface';
import { LoadingView } from '@/src/components/LoadingView';
import { RemoteArtwork } from '@/src/components/RemoteArtwork';
import { ScreenView } from '@/src/components/ScreenView';
import { SectionHeader } from '@/src/components/SectionHeader';
import { TrackRow } from '@/src/components/TrackRow';
import { formatListeners } from '@/src/lib/format';
import { useArtist, useArtistAlbums, useArtistTopTracks } from '@/src/hooks/useCatalog';
import { usePlayer } from '@/src/providers/PlayerProvider';
import { useTheme } from '@/src/providers/ThemeProvider';

export default function ArtistDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { playTrack } = usePlayer();
  const artist = useArtist(id ?? '');
  const topTracks = useArtistTopTracks(id ?? '');
  const albums = useArtistAlbums(id ?? '', 20);

  const details = artist.data;

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
            {topTracks.data?.items.length ? (
              <Pressable
                onPress={() => playTrack(topTracks.data.items[0], topTracks.data.items)}
                style={{
                  minHeight: 48,
                  borderRadius: 18,
                  backgroundColor: theme.colors.cta,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: theme.colors.ctaText, fontSize: 15, fontWeight: '700' }}>Play Artist</Text>
              </Pressable>
            ) : null}
          </GlassSurface>

          {topTracks.data?.items.length ? (
            <View>
              <SectionHeader title="Popular" />
              <View style={{ gap: 10 }}>
                {topTracks.data.items.map((track, index) => (
                  <TrackRow key={track.id} track={track} index={index + 1} queue={topTracks.data?.items} />
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

          {details.bio ? (
            <GlassSurface style={{ padding: 18, gap: 10 }}>
              <SectionHeader title="About" />
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 15,
                  lineHeight: 24,
                  fontFamily: theme.typography.bodyFontFamily,
                }}
              >
                {details.bio}
              </Text>
            </GlassSurface>
          ) : null}
        </>
      ) : null}
    </ScreenView>
  );
}
