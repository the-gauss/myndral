import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { AlbumCard } from '@/src/components/AlbumCard';
import { ArtistCard } from '@/src/components/ArtistCard';
import { EmptyState } from '@/src/components/EmptyState';
import { LoadingView } from '@/src/components/LoadingView';
import { PlaylistListItem } from '@/src/components/PlaylistListItem';
import { ScreenView } from '@/src/components/ScreenView';
import { SectionHeader } from '@/src/components/SectionHeader';
import { TrackRow } from '@/src/components/TrackRow';
import { useAlbums, useArtists, usePlaylists, useTracks } from '@/src/hooks/useCatalog';
import { useTheme } from '@/src/providers/ThemeProvider';
import type { BrowseKind } from '@/src/types/domain';

const BROWSE_OPTIONS: { kind: BrowseKind; label: string }[] = [
  { kind: 'artists', label: 'Artists' },
  { kind: 'albums', label: 'Albums' },
  { kind: 'songs', label: 'Songs' },
  { kind: 'playlists', label: 'Playlists' },
];

function normalizeKind(value: string | string[] | undefined): BrowseKind {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'artists' || raw === 'albums' || raw === 'songs' || raw === 'playlists') {
    return raw;
  }
  return 'artists';
}

export default function BrowseScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<BrowseKind>(normalizeKind(params.kind));
  const { theme } = useTheme();

  const artists = useArtists(48);
  const albums = useAlbums(36);
  const tracks = useTracks(100);
  const playlists = usePlaylists(36);

  useEffect(() => {
    setKind(normalizeKind(params.kind));
  }, [params.kind]);

  return (
    <ScreenView>
      <View style={{ gap: 6 }}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 30,
            fontWeight: '800',
            fontFamily: theme.typography.displayFontFamily,
          }}
        >
          Browse
        </Text>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 15,
            lineHeight: 22,
            fontFamily: theme.typography.bodyFontFamily,
          }}
        >
          A touch-first version of the web catalog sections, reorganized into one native browse hub.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {BROWSE_OPTIONS.map((option) => {
          const isActive = kind === option.kind;
          return (
            <Pressable
              key={option.kind}
              onPress={() => setKind(option.kind)}
              style={{
                minHeight: 42,
                borderRadius: 18,
                paddingHorizontal: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isActive ? theme.colors.primaryDim : theme.colors.surfaceRaised,
                borderWidth: 1,
                borderColor: isActive ? theme.colors.primary : theme.colors.surfaceBorder,
              }}
            >
              <Text
                style={{
                  color: isActive ? theme.colors.primary : theme.colors.textMuted,
                  fontSize: 13,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 0.7,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {kind === 'artists' ? (
        artists.isLoading ? (
          <LoadingView label="Loading artists..." />
        ) : artists.data?.items.length ? (
          <View>
            <SectionHeader title="Artists" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {artists.data.items.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </View>
          </View>
        ) : (
          <EmptyState title="No artists yet" message="Published artists will appear here." symbol="music.mic" />
        )
      ) : null}

      {kind === 'albums' ? (
        albums.isLoading ? (
          <LoadingView label="Loading albums..." />
        ) : albums.data?.items.length ? (
          <View>
            <SectionHeader title="Albums" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {albums.data.items.map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </View>
          </View>
        ) : (
          <EmptyState title="No albums yet" message="Published albums will appear here." symbol="square.stack.fill" />
        )
      ) : null}

      {kind === 'songs' ? (
        tracks.isLoading ? (
          <LoadingView label="Loading songs..." />
        ) : tracks.data?.items.length ? (
          <View>
            <SectionHeader title="Songs" />
            <View style={{ gap: 10 }}>
              {tracks.data.items.map((track, index) => (
                <TrackRow key={track.id} track={track} index={index + 1} queue={tracks.data?.items} showAlbum />
              ))}
            </View>
          </View>
        ) : (
          <EmptyState title="No songs yet" message="Published songs will appear here." symbol="music.note" />
        )
      ) : null}

      {kind === 'playlists' ? (
        playlists.isLoading ? (
          <LoadingView label="Loading playlists..." />
        ) : playlists.data?.items.length ? (
          <View>
            <SectionHeader title="Playlists" />
            <View style={{ gap: 10 }}>
              {playlists.data.items.map((playlist) => (
                <PlaylistListItem key={playlist.id} playlist={playlist} />
              ))}
            </View>
          </View>
        ) : (
          <EmptyState title="No playlists yet" message="Published playlists will appear here." symbol="music.note.list" />
        )
      ) : null}
    </ScreenView>
  );
}
