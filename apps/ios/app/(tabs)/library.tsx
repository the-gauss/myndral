import { Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { GlassSurface } from '@/src/components/GlassSurface';
import { ScreenView } from '@/src/components/ScreenView';
import { useTheme } from '@/src/providers/ThemeProvider';

const LIBRARY_SECTIONS = [
  {
    title: 'Artists',
    symbol: 'music.mic',
  },
  {
    title: 'Albums',
    symbol: 'square.stack.fill',
  },
  {
    title: 'Playlists',
    symbol: 'music.note.list',
  },
  {
    title: 'Songs',
    symbol: 'music.note',
  },
] as const;

export default function LibraryScreen() {
  const { theme } = useTheme();

  return (
    <ScreenView>
      <Text
        style={{
          color: theme.colors.text,
          fontSize: 30,
          fontWeight: '800',
          fontFamily: theme.typography.displayFontFamily,
        }}
      >
        Your Library
      </Text>

      <View style={{ gap: 12 }}>
        {LIBRARY_SECTIONS.map((section) => (
          <GlassSurface key={section.title} style={{ padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.primaryDim,
                }}
              >
                <SymbolView
                  name={section.symbol}
                  size={20}
                  tintColor={theme.colors.primary}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 18,
                    fontWeight: '700',
                    fontFamily: theme.typography.displayFontFamily,
                  }}
                >
                  {section.title}
                </Text>
                <Text
                  style={{
                    color: theme.colors.textSubtle,
                    fontSize: 12,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.7,
                    fontFamily: theme.typography.bodyFontFamily,
                  }}
                >
                  0 saved
                </Text>
              </View>
            </View>
          </GlassSurface>
        ))}
      </View>
    </ScreenView>
  );
}
