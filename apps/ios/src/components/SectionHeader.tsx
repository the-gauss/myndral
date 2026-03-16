import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/src/providers/ThemeProvider';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function SectionHeader({ title, actionLabel, onActionPress }: SectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}
    >
      <Text
        style={{
          color: theme.colors.text,
          fontSize: 22,
          fontWeight: '700',
          fontFamily: theme.typography.displayFontFamily,
        }}
      >
        {title}
      </Text>

      {actionLabel && onActionPress ? (
        <Pressable
          onPress={onActionPress}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text
            style={{
              color: theme.colors.primary,
              fontSize: 13,
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 0.7,
            }}
          >
            {actionLabel}
          </Text>
          <SymbolView name="chevron.right" size={12} tintColor={theme.colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}
