import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from '@/src/providers/ThemeProvider';

interface LoadingViewProps {
  label?: string;
}

export function LoadingView({ label = 'Loading...' }: LoadingViewProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        paddingVertical: 48,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <ActivityIndicator size="small" color={theme.colors.primary} />
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 14,
          fontFamily: theme.typography.bodyFontFamily,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
