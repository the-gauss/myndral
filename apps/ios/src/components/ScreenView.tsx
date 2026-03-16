import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
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

interface AnimatedBubbleProps {
  color: string;
  opacity: number;
  size: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  xRange: [number, number, number];
  yRange: [number, number, number];
  scaleRange: [number, number, number];
  duration: number;
}

function AnimatedBubble({
  color,
  opacity,
  size,
  top,
  right,
  bottom,
  left,
  xRange,
  yRange,
  scaleRange,
  duration,
}: AnimatedBubbleProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: duration + 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [duration, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: xRange,
  });
  const translateY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: yRange,
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: scaleRange,
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top,
        right,
        bottom,
        left,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        shadowColor: color,
        shadowOpacity: opacity * 0.75,
        shadowRadius: size * 0.18,
        shadowOffset: { width: 0, height: 0 },
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: size * 0.12,
          left: size * 0.16,
          width: size * 0.26,
          height: size * 0.26,
          borderRadius: size * 0.13,
          backgroundColor: 'rgba(255,255,255,0.16)',
        }}
      />
    </Animated.View>
  );
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
      <AnimatedBubble
        color={theme.colors.primary}
        opacity={theme.isDark ? 0.22 : 0.17}
        size={300}
        top={-108}
        left={-92}
        xRange={[0, 18, -8]}
        yRange={[0, 14, -18]}
        scaleRange={[0.92, 1.08, 0.98]}
        duration={12200}
      />
      <AnimatedBubble
        color={theme.colors.secondary}
        opacity={theme.isDark ? 0.18 : 0.14}
        size={320}
        right={-96}
        bottom={42}
        xRange={[0, -22, 10]}
        yRange={[0, -16, 20]}
        scaleRange={[0.94, 1.12, 0.99]}
        duration={13800}
      />
      <View
        style={{
          position: 'absolute',
          right: 30,
          bottom: -56,
          width: 150,
          height: 150,
          borderRadius: 75,
          backgroundColor: theme.colors.backgroundOffset,
          opacity: theme.isDark ? 0.34 : 0.46,
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
