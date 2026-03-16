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
  const { theme, themeName } = useTheme();
  const borderRadius = shape === 'circle' ? 999 : 22;
  const resolvedUri = resolveMediaUrl(uri);
  const isPaper = themeName === 'paper';

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
                opacity: isPaper ? 0.48 : 1,
              },
              imageStyle,
            ]}
          />
          {isPaper ? (
            <>
              <View
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#e5cfb2',
                  opacity: 0.34,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#caa37d',
                  opacity: 0.18,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#7c5b41',
                  opacity: 0.08,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderWidth: 1,
                  borderColor: 'rgba(125, 94, 66, 0.18)',
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
