import { Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { GlassSurface } from '@/src/components/GlassSurface';
import { ScreenView } from '@/src/components/ScreenView';
import { useTheme } from '@/src/providers/ThemeProvider';

const LIBRARY_SECTIONS = [
  {
    title: 'Artists',
    symbol: 'music.mic',
    description: 'Artists you follow or save for quick return listening.',
  },
  {
    title: 'Albums',
    symbol: 'square.stack.fill',
    description: 'Full releases you have pinned to your personal library.',
  },
  {
    title: 'Playlists',
    symbol: 'music.note.list',
    description: 'Curated or personal mixes you want close at hand.',
  },
  {
    title: 'Songs',
    symbol: 'music.note',
    description: 'Individual tracks you have saved for repeat plays.',
  },
] as const;

export default function LibraryScreen() {
  const { theme } = useTheme();

  return (
    <ScreenView>
      <View style={{ gap: 6 }}>
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
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 15,
            lineHeight: 22,
            fontFamily: theme.typography.bodyFontFamily,
          }}
        >
          A dedicated home for everything you save. Artists, albums, playlists, and songs will
          appear here once library sync lands in the shared API.
        </Text>
      </View>

      <GlassSurface style={{ padding: 18, gap: 8 }}>
        <Text
          style={{
            color: theme.colors.textSubtle,
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.7,
          }}
        >
          Saved Items
        </Text>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 22,
            fontWeight: '800',
            fontFamily: theme.typography.displayFontFamily,
          }}
        >
          Library syncing is the next layer.
        </Text>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 14,
            lineHeight: 21,
            fontFamily: theme.typography.bodyFontFamily,
          }}
        >
          This interface is ready for saved-library support without changing the rest of the app
          structure later.
        </Text>
      </GlassSurface>

      <View style={{ gap: 12 }}>
        {LIBRARY_SECTIONS.map((section) => (
          <GlassSurface key={section.title} style={{ padding: 18, gap: 14 }}>
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
                  0 saved right now
                </Text>
              </View>
            </View>
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: 14,
                lineHeight: 21,
                fontFamily: theme.typography.bodyFontFamily,
              }}
            >
              {section.description}
            </Text>
          </GlassSurface>
        ))}
      </View>
    </ScreenView>
  );
}
