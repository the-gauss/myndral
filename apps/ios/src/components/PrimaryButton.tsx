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
          minHeight: 52,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 18,
          backgroundColor,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: theme.colors.surfaceBorder,
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: textColor,
          fontSize: 15,
          fontWeight: '700',
          fontFamily: theme.typography.bodyFontFamily,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
