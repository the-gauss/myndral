import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, View, type ViewProps } from 'react-native';
import { useTheme } from '@/src/providers/ThemeProvider';

interface GlassSurfaceProps extends ViewProps {
  styleVariant?: 'regular' | 'clear';
}

export function GlassSurface({
  children,
  style,
  styleVariant = 'regular',
  ...rest
}: GlassSurfaceProps) {
  const { theme } = useTheme();
  const sharedStyle = [
    {
      borderRadius: 24,
      overflow: 'hidden' as const,
      borderWidth: 1,
      borderColor: theme.colors.glassBorder,
      backgroundColor:
        styleVariant === 'clear' ? theme.colors.glassBg : theme.colors.surfaceRaised,
    },
    style,
  ];

  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    return (
      <GlassView
        {...rest}
        style={sharedStyle}
        glassEffectStyle={styleVariant}
        tintColor={styleVariant === 'clear' ? theme.colors.glassBg : theme.colors.surfaceRaised}
        colorScheme={theme.isDark ? 'dark' : 'light'}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View {...rest} style={sharedStyle}>
      {children}
    </View>
  );
}
