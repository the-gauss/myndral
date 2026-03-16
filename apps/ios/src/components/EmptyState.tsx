import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Text, View } from 'react-native';
import { GlassSurface } from '@/src/components/GlassSurface';
import { useTheme } from '@/src/providers/ThemeProvider';

interface EmptyStateProps {
  title: string;
  message: string;
  symbol?: SymbolViewProps['name'];
}

export function EmptyState({
  title,
  message,
  symbol = 'sparkles.rectangle.stack',
}: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <GlassSurface
      style={{
        padding: 20,
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primaryDim,
        }}
      >
        <SymbolView name={symbol} size={24} tintColor={theme.colors.primary} />
      </View>
      <Text
        style={{
          color: theme.colors.text,
          fontSize: 18,
          fontWeight: '700',
          textAlign: 'center',
          fontFamily: theme.typography.displayFontFamily,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 14,
          lineHeight: 21,
          textAlign: 'center',
          maxWidth: 320,
          fontFamily: theme.typography.bodyFontFamily,
        }}
      >
        {message}
      </Text>
    </GlassSurface>
  );
}
