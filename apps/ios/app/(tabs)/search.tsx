import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { AlbumCard } from '@/src/components/AlbumCard';
import { ArtistCard } from '@/src/components/ArtistCard';
import { EmptyState } from '@/src/components/EmptyState';
import { LoadingView } from '@/src/components/LoadingView';
import { PlaylistListItem } from '@/src/components/PlaylistListItem';
import { ScreenView } from '@/src/components/ScreenView';
import { SectionHeader } from '@/src/components/SectionHeader';
import { TrackRow } from '@/src/components/TrackRow';
import { useSearch } from '@/src/hooks/useCatalog';
import { useTheme } from '@/src/providers/ThemeProvider';

function useDebouncedValue(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

export default function SearchScreen() {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const searchQuery = useSearch(debouncedQuery, 12);

  const hasResults =
    Boolean(searchQuery.data?.tracks.items.length) ||
    Boolean(searchQuery.data?.albums.items.length) ||
    Boolean(searchQuery.data?.artists.items.length) ||
    Boolean(searchQuery.data?.playlists.items.length);

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
          Search
        </Text>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 15,
            lineHeight: 22,
            fontFamily: theme.typography.bodyFontFamily,
          }}
        >
          Artists, albums, songs, and playlists all search through the same API as the web player.
        </Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Artists, albums, songs..."
        placeholderTextColor={theme.colors.textSubtle}
        autoFocus
        style={{
          minHeight: 54,
          borderRadius: 20,
          paddingHorizontal: 18,
          backgroundColor: theme.colors.surfaceRaised,
          borderWidth: 1,
          borderColor: theme.colors.surfaceBorder,
          color: theme.colors.text,
          fontSize: 16,
          fontFamily: theme.typography.bodyFontFamily,
        }}
      />

      {!debouncedQuery ? (
        <EmptyState
          title="Start typing to search"
          message="The iOS app mirrors the listener-facing web search surface, including cross-entity results."
          symbol="magnifyingglass"
        />
      ) : searchQuery.isLoading ? (
        <LoadingView label={`Searching for “${debouncedQuery}”...`} />
      ) : !hasResults ? (
        <EmptyState
          title="No results"
          message={`Nothing matched “${debouncedQuery}” in the current catalog.`}
          symbol="sparkles"
        />
      ) : (
        <View style={{ gap: 22 }}>
          {searchQuery.data?.tracks.items.length ? (
            <View>
              <SectionHeader title="Songs" />
              <View style={{ gap: 10 }}>
                {searchQuery.data?.tracks.items.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={index + 1}
                    queue={searchQuery.data?.tracks.items}
                    showAlbum
                  />
                ))}
              </View>
            </View>
          ) : null}

          {searchQuery.data?.artists.items.length ? (
            <View>
              <SectionHeader title="Artists" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {searchQuery.data?.artists.items.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}
              </ScrollView>
            </View>
          ) : null}

          {searchQuery.data?.albums.items.length ? (
            <View>
              <SectionHeader title="Albums" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {searchQuery.data?.albums.items.map((album) => <AlbumCard key={album.id} album={album} />)}
              </ScrollView>
            </View>
          ) : null}

          {searchQuery.data?.playlists.items.length ? (
            <View>
              <SectionHeader title="Playlists" />
              <View style={{ gap: 10 }}>
                {searchQuery.data?.playlists.items.map((playlist) => (
                  <PlaylistListItem key={playlist.id} playlist={playlist} />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </ScreenView>
  );
}
