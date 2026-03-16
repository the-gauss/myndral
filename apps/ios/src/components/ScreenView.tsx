import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  useWindowDimensions,
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

const PAPER_FIBERS = [
  { x: 0.08, y: 0.12, width: 0.28, height: 2, rotate: '-8deg', opacity: 0.34 },
  { x: 0.44, y: 0.16, width: 0.22, height: 1, rotate: '12deg', opacity: 0.26 },
  { x: 0.68, y: 0.24, width: 0.18, height: 2, rotate: '-14deg', opacity: 0.28 },
  { x: 0.14, y: 0.38, width: 0.2, height: 1, rotate: '18deg', opacity: 0.22 },
  { x: 0.54, y: 0.44, width: 0.24, height: 2, rotate: '-10deg', opacity: 0.25 },
  { x: 0.22, y: 0.66, width: 0.26, height: 1, rotate: '9deg', opacity: 0.2 },
  { x: 0.62, y: 0.72, width: 0.2, height: 2, rotate: '-7deg', opacity: 0.22 },
  { x: 0.34, y: 0.84, width: 0.16, height: 1, rotate: '13deg', opacity: 0.18 },
] as const;

const PAPER_SPECKS = [
  { x: 0.12, y: 0.18, size: 4, opacity: 0.3 },
  { x: 0.26, y: 0.22, size: 3, opacity: 0.24 },
  { x: 0.72, y: 0.18, size: 5, opacity: 0.2 },
  { x: 0.82, y: 0.28, size: 3, opacity: 0.18 },
  { x: 0.16, y: 0.46, size: 5, opacity: 0.22 },
  { x: 0.48, y: 0.52, size: 4, opacity: 0.18 },
  { x: 0.76, y: 0.58, size: 4, opacity: 0.2 },
  { x: 0.2, y: 0.78, size: 3, opacity: 0.2 },
  { x: 0.58, y: 0.82, size: 5, opacity: 0.16 },
  { x: 0.88, y: 0.86, size: 3, opacity: 0.14 },
] as const;

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
  const { width, height } = useWindowDimensions();

  if (theme.isPaper) {
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
            top: -height * 0.08,
            left: -width * 0.12,
            width: width * 0.78,
            height: width * 0.78,
            borderRadius: width * 0.39,
            backgroundColor: theme.effects.textureBlotch,
            opacity: 0.72,
            transform: [{ rotate: '-14deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            right: -width * 0.16,
            bottom: height * 0.08,
            width: width * 0.66,
            height: width * 0.66,
            borderRadius: width * 0.33,
            backgroundColor: theme.colors.backgroundOffset,
            opacity: 0.28,
            transform: [{ rotate: '18deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: width * 0.18,
            bottom: -height * 0.08,
            width: width * 0.5,
            height: width * 0.34,
            borderRadius: width * 0.18,
            backgroundColor: theme.effects.textureBlotch,
            opacity: 0.26,
            transform: [{ rotate: '-8deg' }],
          }}
        />
        {PAPER_FIBERS.map((fiber, index) => (
          <View
            key={`fiber-${index}`}
            style={{
              position: 'absolute',
              left: width * fiber.x,
              top: height * fiber.y,
              width: width * fiber.width,
              height: fiber.height,
              borderRadius: 999,
              backgroundColor: theme.effects.textureFiber,
              opacity: fiber.opacity,
              transform: [{ rotate: fiber.rotate }],
            }}
          />
        ))}
        {PAPER_SPECKS.map((speck, index) => (
          <View
            key={`speck-${index}`}
            style={{
              position: 'absolute',
              left: width * speck.x,
              top: height * speck.y,
              width: speck.size,
              height: speck.size,
              borderRadius: speck.size / 2,
              backgroundColor: theme.effects.textureSpeck,
              opacity: speck.opacity,
            }}
          />
        ))}
      </View>
    );
  }

  const primaryX = Math.max(96, width * 0.44);
  const primaryY = Math.max(110, height * 0.5);
  const secondaryX = Math.max(104, width * 0.48);
  const secondaryY = Math.max(124, height * 0.56);

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
        xRange={[0, primaryX, width * 0.12]}
        yRange={[0, height * 0.12, primaryY]}
        scaleRange={[0.92, 1.08, 0.98]}
        duration={12200}
      />
      <AnimatedBubble
        color={theme.colors.secondary}
        opacity={theme.isDark ? 0.18 : 0.14}
        size={320}
        right={-96}
        bottom={42}
        xRange={[0, -secondaryX, -(width * 0.1)]}
        yRange={[0, -(height * 0.18), -secondaryY]}
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
