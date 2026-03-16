import { useEffect, useRef } from 'react';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Animated, Easing, Platform, View, type ViewProps } from 'react-native';
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
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 900,
        easing: Easing.out(Easing.poly(5)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  const sharedStyle = [
    {
      borderRadius: 28,
      overflow: 'hidden' as const,
      borderWidth: 1,
      borderColor: theme.colors.glassBorder,
      backgroundColor:
        styleVariant === 'clear' ? theme.colors.glassBg : theme.colors.glassBgHeavy,
      shadowColor: theme.isDark ? theme.colors.secondary : theme.colors.primary,
      shadowOpacity: theme.isDark ? 0.14 : 0.1,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 18 },
    },
    style,
  ];
  const animatedStyle = {
    opacity,
    transform: [{ translateY }],
  };

  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    return (
      <Animated.View style={animatedStyle}>
        <GlassView
          {...rest}
          style={sharedStyle}
          glassEffectStyle={styleVariant}
          tintColor={styleVariant === 'clear' ? theme.colors.glassBg : theme.colors.glassBgHeavy}
          colorScheme={theme.isDark ? 'dark' : 'light'}
        >
          {children}
        </GlassView>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animatedStyle}>
      <View {...rest} style={sharedStyle}>
        {children}
      </View>
    </Animated.View>
  );
}
