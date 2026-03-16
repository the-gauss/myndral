import { Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { LoadingView } from '@/src/components/LoadingView';
import { MiniPlayer } from '@/src/components/MiniPlayer';
import { ScreenView } from '@/src/components/ScreenView';
import { AppProviders } from '@/src/providers/AppProviders';
import { useTheme } from '@/src/providers/ThemeProvider';
import { useAuthStore } from '@/src/stores/authStore';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

function RootShell() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydrated = useAuthStore((state) => state.hydrated);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments();

  const isAuthRoute = segments[0] === '(auth)';
  const isPlayerRoute = segments[0] === 'player';
  const shouldShowMiniPlayer = !isAuthRoute && !isPlayerRoute;
  const miniPlayerBottomOffset = segments[0] === '(tabs)' ? insets.bottom + 78 : insets.bottom + 16;

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <ScreenView scroll={false} edges={['top', 'bottom']} bottomInset={40}>
        <LoadingView label="Restoring your listener session..." />
      </ScreenView>
    );
  }

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="artist/[id]" />
        <Stack.Screen name="album/[id]" />
        <Stack.Screen name="playlist/[id]" />
        <Stack.Screen
          name="player"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      {shouldShowMiniPlayer ? <MiniPlayer bottomOffset={miniPlayerBottomOffset} /> : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootShell />
    </AppProviders>
  );
}
