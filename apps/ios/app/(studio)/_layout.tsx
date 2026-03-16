/**
 * Studio tab layout — the root navigator for the Creator Studio "app mode".
 *
 * Architecture decision: rather than a runtime mode-store toggle, the Studio is
 * a separate Expo Router route group with its own Tabs navigator. Switching from
 * Music → Studio is a router.replace('/(studio)/artists') call; switching back is
 * router.replace('/(tabs)/'). This gives the "two completely different apps within
 * one binary" experience while keeping navigation state clean and predictable.
 *
 * Auth gate: if the current user does not hold a studio-capable role, they are
 * redirected to the studio-access screen to claim one. This check happens after
 * auth hydration so unauthenticated users still go through the normal login flow.
 */
import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import { Redirect, Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/providers/ThemeProvider';
import { useAuthStore } from '@/src/stores/authStore';
import { hasStudioAccess } from '@/src/types/studio';

export default function StudioTabLayout() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const { theme, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const isPaper = themeName === 'paper';

  // Wait for auth hydration before gating.
  if (!hydrated) return null;

  // Unauthenticated users should go through the music-app login flow.
  if (!isAuthenticated) return <Redirect href="/login" />;

  // Listeners without a studio role land on the claim screen.
  if (!hasStudioAccess(user?.role)) return <Redirect href="/studio-access" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: {
          position: 'absolute',
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 10),
          // Use a solid surface in paper theme; glass otherwise — same as music tabs.
          backgroundColor: isPaper ? theme.colors.surfaceRaised : 'transparent',
          borderTopWidth: 1,
          borderTopColor: isPaper ? theme.colors.surfaceBorder : theme.colors.glassBorder,
          shadowColor: theme.colors.primary,
          shadowOpacity: isPaper ? 0.06 : (theme.isDark ? 0.12 : 0.06),
          shadowRadius: isPaper ? 18 : 24,
          shadowOffset: { width: 0, height: -10 },
          overflow: 'hidden',
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' && !isPaper ? (
            <BlurView
              style={StyleSheet.absoluteFill}
              intensity={82}
              tint={theme.isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            />
          ) : (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.glassBgHeavy }]}
            />
          ),
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSubtle,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="artists"
        options={{
          title: 'Artists',
          tabBarIcon: ({ color }) => (
            <SymbolView name="person.2.fill" tintColor={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="albums"
        options={{
          title: 'Albums',
          tabBarIcon: ({ color }) => (
            <SymbolView name="square.stack.fill" tintColor={color} size={19} />
          ),
        }}
      />
      <Tabs.Screen
        name="songs"
        options={{
          title: 'Songs',
          tabBarIcon: ({ color }) => (
            <SymbolView name="waveform" tintColor={color} size={19} />
          ),
        }}
      />
      <Tabs.Screen
        name="staging"
        options={{
          title: 'Staging',
          tabBarIcon: ({ color }) => (
            <SymbolView name="tray.2.fill" tintColor={color} size={19} />
          ),
        }}
      />
    </Tabs>
  );
}
