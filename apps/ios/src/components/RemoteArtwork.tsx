import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Image } from 'expo-image';
import { View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { resolveMediaUrl } from '@/src/lib/media';
import { useTheme } from '@/src/providers/ThemeProvider';

interface RemoteArtworkProps {
  uri?: string | null;
  shape?: 'square' | 'circle';
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  placeholderSymbol?: SymbolViewProps['name'];
}

export function RemoteArtwork({
  uri,
  shape = 'square',
  style,
  imageStyle,
  placeholderSymbol = 'music.note',
}: RemoteArtworkProps) {
  const { theme } = useTheme();
  const borderRadius = shape === 'circle' ? 999 : 22;
  const resolvedUri = resolveMediaUrl(uri);

  return (
    <View
      style={[
        {
          overflow: 'hidden',
          borderRadius,
          backgroundColor: theme.colors.fillSoft,
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}
    >
      {resolvedUri ? (
        <>
          <Image
            source={{ uri: resolvedUri }}
            contentFit="cover"
            transition={180}
            style={[
              {
                width: '100%',
                height: '100%',
                opacity: theme.isPaper ? 0.78 : 1,
              },
              imageStyle,
            ]}
          />
          {theme.isPaper ? (
            <>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: theme.effects.mediaWash,
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: theme.effects.mediaWashStrong,
                  opacity: 0.56,
                }}
              />
            </>
          ) : null}
        </>
      ) : (
        <SymbolView
          name={placeholderSymbol}
          size={shape === 'circle' ? 26 : 20}
          tintColor={theme.colors.textSubtle}
        />
      )}
    </View>
  );
}
