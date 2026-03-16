import { Text, View } from 'react-native';
import { EmptyState } from '@/src/components/EmptyState';
import { LoadingView } from '@/src/components/LoadingView';
import { PlaylistListItem } from '@/src/components/PlaylistListItem';
import { ScreenView } from '@/src/components/ScreenView';
import { useUserPlaylists } from '@/src/hooks/useCatalog';
import { useTheme } from '@/src/providers/ThemeProvider';

export default function LibraryScreen() {
  const { theme } = useTheme();
  const playlists = useUserPlaylists();

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
          Your Library
        </Text>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 15,
            lineHeight: 22,
            fontFamily: theme.typography.bodyFontFamily,
          }}
        >
          The same authenticated playlist library shown in the web sidebar, reformatted for touch.
        </Text>
      </View>

      {playlists.isLoading ? (
        <LoadingView label="Loading your playlists..." />
      ) : playlists.data?.items.length ? (
        <View style={{ gap: 10 }}>
          {playlists.data.items.map((playlist) => (
            <PlaylistListItem key={playlist.id} playlist={playlist} />
          ))}
        </View>
      ) : (
        <EmptyState
          title="Your library is empty"
          message="Follow or create playlists on the web, then they will appear here through the shared API."
          symbol="books.vertical"
        />
      )}
    </ScreenView>
  );
}
