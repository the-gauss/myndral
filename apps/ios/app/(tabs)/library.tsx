import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { GlassSurface } from '@/src/components/GlassSurface';
import { PlaylistListItem } from '@/src/components/PlaylistListItem';
import { PlaylistSheet } from '@/src/components/PlaylistSheet';
import { ScreenView } from '@/src/components/ScreenView';
import { TrackRow } from '@/src/components/TrackRow';
import {
  useCollectionState,
  useFavoriteAlbums,
  useFavoriteArtists,
  useFavoriteTracks,
  useLibraryAlbums,
  useLibraryArtists,
  useLibraryPlaylists,
  useLibraryTracks,
} from '@/src/hooks/useCatalog';
import { useTheme } from '@/src/providers/ThemeProvider';

type LibraryView = 'saved' | 'favorites';

function SegmentedControl({
  view,
  onChange,
}: {
  view: LibraryView;
  onChange: (next: LibraryView) => void;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        borderRadius: 22,
        padding: 4,
        backgroundColor: theme.colors.surfaceRaised,
        borderWidth: 1,
        borderColor: theme.colors.surfaceBorder,
      }}
    >
      {(['saved', 'favorites'] as LibraryView[]).map((option) => (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          style={{
            flex: 1,
            minHeight: 42,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: view === option ? theme.colors.primaryDim : 'transparent',
          }}
        >
          <Text
            style={{
              color: view === option ? theme.colors.primary : theme.colors.textMuted,
              fontSize: 13,
              fontWeight: '700',
              textTransform: 'capitalize',
            }}
          >
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function RowItem({
  title,
  subtitle,
  symbol,
  onPress,
}: {
  title: string;
  subtitle: string;
  symbol: SymbolViewProps['name'];
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable onPress={onPress}>
      <GlassSurface
        style={{
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.primaryDim,
          }}
        >
          <SymbolView name={symbol} size={20} tintColor={theme.colors.primary} />
        </View>
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
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.textMuted,
              fontSize: 13,
              fontFamily: theme.typography.bodyFontFamily,
            }}
          >
            {subtitle}
          </Text>
        </View>
      </GlassSurface>
    </Pressable>
  );
}

function SectionBlock({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <GlassSurface style={{ padding: 18, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 19,
            fontWeight: '700',
            fontFamily: theme.typography.displayFontFamily,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: theme.colors.textSubtle,
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.7,
          }}
        >
          {count} {count === 1 ? 'item' : 'items'}
        </Text>
      </View>
      <View style={{ gap: 10 }}>{children}</View>
    </GlassSurface>
  );
}

export default function LibraryScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [view, setView] = useState<LibraryView>('saved');
  const [playlistSheetOpen, setPlaylistSheetOpen] = useState(false);

  const libraryTracks = useLibraryTracks();
  const libraryAlbums = useLibraryAlbums();
  const libraryArtists = useLibraryArtists();
  const libraryPlaylists = useLibraryPlaylists();
  const favoriteTracks = useFavoriteTracks();
  const favoriteAlbums = useFavoriteAlbums();
  const favoriteArtists = useFavoriteArtists();

  const savedTrackIds = libraryTracks.data?.items.map((track) => track.id) ?? [];
  const favoriteTrackIdsRaw = favoriteTracks.data?.items.map((track) => track.id) ?? [];
  const collection = useCollectionState({
    trackIds: Array.from(new Set([...savedTrackIds, ...favoriteTrackIdsRaw])),
  });
  const favoriteTrackIds = useMemo(
    () => new Set(collection.data?.favorites.trackIds ?? favoriteTrackIdsRaw),
    [collection.data?.favorites.trackIds, favoriteTrackIdsRaw],
  );
  const libraryTrackIds = useMemo(
    () => new Set(collection.data?.library.trackIds ?? savedTrackIds),
    [collection.data?.library.trackIds, savedTrackIds],
  );

  const savedLoading =
    libraryTracks.isLoading ||
    libraryAlbums.isLoading ||
    libraryArtists.isLoading ||
    libraryPlaylists.isLoading;
  const favoritesLoading =
    favoriteTracks.isLoading || favoriteAlbums.isLoading || favoriteArtists.isLoading;

  return (
    <ScreenView>
      <View style={{ gap: 14 }}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 30,
            fontWeight: '800',
            fontFamily: theme.typography.displayFontFamily,
          }}
        >
          Your Library
        </Text>
        <SegmentedControl view={view} onChange={setView} />
        <Pressable
          onPress={() => setPlaylistSheetOpen(true)}
          style={{
            minHeight: 52,
            borderRadius: 22,
            backgroundColor: theme.colors.cta,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: theme.colors.ctaText,
              fontSize: 15,
              fontWeight: '700',
              fontFamily: theme.typography.bodyFontFamily,
            }}
          >
            Create Playlist
          </Text>
        </Pressable>
      </View>

      {view === 'saved' ? (
        savedLoading ? (
          <GlassSurface style={{ padding: 18 }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>
              Loading your saved library...
            </Text>
          </GlassSurface>
        ) : (
          <View style={{ gap: 14 }}>
            <SectionBlock title="Artists" count={libraryArtists.data?.items.length ?? 0}>
              {libraryArtists.data?.items.length ? (
                libraryArtists.data.items.map((artist) => (
                  <RowItem
                    key={artist.id}
                    title={artist.name}
                    subtitle="Saved artist"
                    symbol="music.mic"
                    onPress={() => router.push(`/artist/${artist.id}`)}
                  />
                ))
              ) : (
                <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No saved artists yet.</Text>
              )}
            </SectionBlock>

            <SectionBlock title="Albums" count={libraryAlbums.data?.items.length ?? 0}>
              {libraryAlbums.data?.items.length ? (
                libraryAlbums.data.items.map((album) => (
                  <RowItem
                    key={album.id}
                    title={album.title}
                    subtitle={`${album.artist.name} · ${album.trackCount} songs`}
                    symbol="square.stack.fill"
                    onPress={() => router.push(`/album/${album.id}`)}
                  />
                ))
              ) : (
                <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No saved albums yet.</Text>
              )}
            </SectionBlock>

            <SectionBlock title="Playlists" count={libraryPlaylists.data?.items.length ?? 0}>
              {libraryPlaylists.data?.items.length ? (
                libraryPlaylists.data.items.map((playlist) => (
                  <PlaylistListItem key={playlist.id} playlist={playlist} />
                ))
              ) : (
                <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No saved playlists yet.</Text>
              )}
            </SectionBlock>

            <SectionBlock title="Songs" count={libraryTracks.data?.items.length ?? 0}>
              {libraryTracks.data?.items.length ? (
                libraryTracks.data.items.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={index + 1}
                    queue={libraryTracks.data?.items}
                    showAlbum
                    isFavorite={favoriteTrackIds.has(track.id)}
                    isInLibrary={libraryTrackIds.has(track.id)}
                  />
                ))
              ) : (
                <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No saved songs yet.</Text>
              )}
            </SectionBlock>
          </View>
        )
      ) : favoritesLoading ? (
        <GlassSurface style={{ padding: 18 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>
            Loading your favorites...
          </Text>
        </GlassSurface>
      ) : (
        <View style={{ gap: 14 }}>
          <SectionBlock title="Favorite Artists" count={favoriteArtists.data?.items.length ?? 0}>
            {favoriteArtists.data?.items.length ? (
              favoriteArtists.data.items.map((artist) => (
                <RowItem
                  key={artist.id}
                  title={artist.name}
                  subtitle="Liked artist"
                  symbol="heart.fill"
                  onPress={() => router.push(`/artist/${artist.id}`)}
                />
              ))
            ) : (
              <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No favorite artists yet.</Text>
            )}
          </SectionBlock>

          <SectionBlock title="Favorite Albums" count={favoriteAlbums.data?.items.length ?? 0}>
            {favoriteAlbums.data?.items.length ? (
              favoriteAlbums.data.items.map((album) => (
                <RowItem
                  key={album.id}
                  title={album.title}
                  subtitle={`${album.artist.name} · liked album`}
                  symbol="heart.fill"
                  onPress={() => router.push(`/album/${album.id}`)}
                />
              ))
            ) : (
              <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No favorite albums yet.</Text>
            )}
          </SectionBlock>

          <SectionBlock title="Favorite Songs" count={favoriteTracks.data?.items.length ?? 0}>
            {favoriteTracks.data?.items.length ? (
              favoriteTracks.data.items.map((track, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={index + 1}
                  queue={favoriteTracks.data?.items}
                  showAlbum
                  isFavorite
                  isInLibrary={libraryTrackIds.has(track.id)}
                />
              ))
            ) : (
              <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No favorite songs yet.</Text>
            )}
          </SectionBlock>
        </View>
      )}

      <PlaylistSheet
        open={playlistSheetOpen}
        onClose={() => setPlaylistSheetOpen(false)}
        heading="Create a new playlist"
      />
    </ScreenView>
  );
}
