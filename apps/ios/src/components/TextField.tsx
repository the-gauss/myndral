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
          letterSpacing: 0.7,
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
          minHeight: 52,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: theme.colors.surfaceBorder,
          backgroundColor: theme.colors.surfaceRaised,
          color: theme.colors.text,
          paddingHorizontal: 16,
          fontSize: 16,
          fontFamily: theme.typography.bodyFontFamily,
        }}
      />
    </View>
  );
}
