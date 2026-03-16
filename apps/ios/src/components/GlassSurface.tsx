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
  const isPaper = theme.isPaper;
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
      borderColor: isPaper ? theme.colors.surfaceBorder : theme.colors.glassBorder,
      backgroundColor:
        styleVariant === 'clear'
          ? (isPaper ? theme.colors.surface : theme.colors.glassBg)
          : (isPaper ? theme.colors.surfaceRaised : theme.colors.glassBgHeavy),
      shadowColor: isPaper
        ? theme.colors.textMuted
        : theme.isDark
          ? theme.colors.secondary
          : theme.colors.primary,
      shadowOpacity: isPaper ? 0.08 : theme.isDark ? 0.14 : 0.1,
      shadowRadius: isPaper ? 18 : 30,
      shadowOffset: { width: 0, height: isPaper ? 10 : 18 },
    },
    style,
  ];
  const animatedStyle = {
    opacity,
    transform: [{ translateY }],
  };

  if (!isPaper && Platform.OS === 'ios' && isLiquidGlassAvailable()) {
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
        {isPaper ? (
          <>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(255, 252, 248, 0.16)',
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 16,
                left: '-8%',
                width: '118%',
                height: 1,
                backgroundColor: theme.effects.textureFiber,
                opacity: 0.26,
                transform: [{ rotate: '-3deg' }],
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                bottom: 22,
                right: '-10%',
                width: '122%',
                height: 1,
                backgroundColor: theme.effects.textureFiber,
                opacity: 0.2,
                transform: [{ rotate: '2deg' }],
              }}
            />
          </>
        ) : null}
        {children}
      </View>
    </Animated.View>
  );
}
