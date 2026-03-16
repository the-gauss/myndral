import { Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { useTheme } from '@/src/providers/ThemeProvider';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType,
  autoCapitalize = 'none',
  autoCorrect = false,
}: TextFieldProps) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 12,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.85,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSubtle}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        style={{
          minHeight: 56,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: theme.colors.surfaceBorder,
          backgroundColor: theme.colors.glassBgHeavy,
          color: theme.colors.text,
          paddingHorizontal: 18,
          fontSize: 16,
          shadowColor: theme.isDark ? theme.colors.primary : theme.colors.secondary,
          shadowOpacity: theme.isDark ? 0.08 : 0.05,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          fontFamily: theme.typography.bodyFontFamily,
        }}
      />
    </View>
  );
}
