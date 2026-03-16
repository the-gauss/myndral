import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import { Redirect, Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/providers/ThemeProvider';
import { useAuthStore } from '@/src/stores/authStore';

export default function TabLayout() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!hydrated) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: {
          backgroundColor: 'transparent',
        },
        tabBarStyle: {
          position: 'absolute',
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 10),
          backgroundColor: theme.isPaper ? theme.colors.surfaceRaised : 'transparent',
          borderTopWidth: 1,
          borderTopColor: theme.isPaper ? theme.colors.surfaceBorder : theme.colors.glassBorder,
          shadowColor: theme.isPaper
            ? theme.colors.textMuted
            : theme.isDark
              ? theme.colors.secondary
              : theme.colors.primary,
          shadowOpacity: theme.isPaper ? 0.08 : theme.isDark ? 0.12 : 0.06,
          shadowRadius: theme.isPaper ? 14 : 24,
          shadowOffset: { width: 0, height: theme.isPaper ? -4 : -10 },
          overflow: 'hidden',
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' && !theme.isPaper ? (
            <BlurView
              style={StyleSheet.absoluteFill}
              intensity={82}
              tint={theme.isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: theme.colors.glassBgHeavy,
                },
              ]}
            />
          ),
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSubtle,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          fontFamily: theme.typography.bodyFontFamily,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <SymbolView name="house.fill" tintColor={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => (
            <SymbolView name="magnifyingglass" tintColor={color} size={19} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => (
            <SymbolView name="books.vertical.fill" tintColor={color} size={19} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => (
            <SymbolView name="person.crop.circle.fill" tintColor={color} size={20} />
          ),
        }}
      />
    </Tabs>
  );
}
