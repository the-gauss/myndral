import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/providers/ThemeProvider';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  style,
}: PrimaryButtonProps) {
  const { theme } = useTheme();
  const backgroundColor = variant === 'primary' ? theme.colors.cta : theme.colors.surfaceRaised;
  const textColor = variant === 'primary' ? theme.colors.ctaText : theme.colors.text;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 56,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          backgroundColor,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: theme.colors.surfaceBorder,
          shadowColor: variant === 'primary' ? theme.colors.primary : theme.colors.secondary,
          shadowOpacity: disabled ? 0 : variant === 'primary' ? 0.2 : 0.08,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }, { translateY: pressed ? 0 : -1 }],
        },
        style,
      ]}
    >
      <Text
        style={{
          color: textColor,
          fontSize: 15,
          fontWeight: '700',
          letterSpacing: 0.2,
          fontFamily: theme.typography.bodyFontFamily,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
