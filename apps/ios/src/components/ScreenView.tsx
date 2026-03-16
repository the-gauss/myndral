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
          top: -120,
          right: -70,
          width: 270,
          height: 270,
          borderRadius: 135,
          backgroundColor: theme.colors.primary,
          opacity: theme.isDark ? 0.18 : 0.14,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: -90,
          bottom: 104,
          width: 250,
          height: 250,
          borderRadius: 125,
          backgroundColor: theme.colors.secondary,
          opacity: theme.isDark ? 0.12 : 0.1,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: 36,
          bottom: -70,
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: theme.colors.backgroundOffset,
          opacity: theme.isDark ? 0.42 : 0.6,
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
