import type { ReactNode } from 'react';
import {
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/src/providers/ThemeProvider';

interface ScreenViewProps extends ScrollViewProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentContainerStyle?: StyleProp<ViewStyle>;
  bottomInset?: number;
}

function Atmosphere() {
  const { theme } = useTheme();

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        inset: 0,
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: -110,
          right: -60,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: theme.colors.primary,
          opacity: theme.isDark ? 0.16 : 0.12,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: -70,
          bottom: 120,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: theme.colors.secondary,
          opacity: theme.isDark ? 0.12 : 0.08,
        }}
      />
    </View>
  );
}

export function ScreenView({
  children,
  scroll = true,
  edges = ['top'],
  contentContainerStyle,
  bottomInset = 148,
  ...rest
}: ScreenViewProps) {
  const { theme } = useTheme();
  const sharedContentStyle = [
    {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: bottomInset,
      gap: 18,
    },
    contentContainerStyle,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Atmosphere />
      <SafeAreaView edges={edges} style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView
            {...rest}
            style={{ flex: 1 }}
            contentContainerStyle={sharedContentStyle}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, sharedContentStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}
