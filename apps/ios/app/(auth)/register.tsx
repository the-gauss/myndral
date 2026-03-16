import { AxiosError } from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { GlassSurface } from '@/src/components/GlassSurface';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenView } from '@/src/components/ScreenView';
import { TextField } from '@/src/components/TextField';
import { API_BASE_URL } from '@/src/lib/env';
import { useTheme } from '@/src/providers/ThemeProvider';
import { register } from '@/src/services/auth';
import { useAuthStore } from '@/src/stores/authStore';

function errorMessage(error: unknown) {
  const axiosError = error as AxiosError<{ detail?: string }>;
  if (axiosError.code === 'ERR_NETWORK') {
    return `Cannot reach the API at ${API_BASE_URL}. Start the backend or set EXPO_PUBLIC_API_URL.`;
  }

  return axiosError.response?.data?.detail ?? 'Registration failed. Please try again.';
}

export default function RegisterScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const setPendingAuth = useAuthStore((state) => state.setPendingAuth);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await register({ username, email, password });
      setPendingAuth(response);
      router.replace('/choose-plan');
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenView edges={['top', 'bottom']} bottomInset={48}>
      <GlassSurface style={{ padding: 22, gap: 18 }}>
        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: theme.colors.textSubtle,
              fontSize: 12,
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}
          >
            Listener Access
          </Text>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 32,
              fontWeight: '800',
              fontFamily: theme.typography.displayFontFamily,
            }}
          >
            Create your account
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 15,
              lineHeight: 22,
              fontFamily: theme.typography.bodyFontFamily,
            }}
          >
            Register once, then pick a plan before entering the iOS app.
          </Text>
        </View>

        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          placeholder="future_listener"
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="listener@example.com"
          keyboardType="email-address"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 8 characters"
        />
        <TextField
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Repeat password"
        />

        {error ? (
          <Text style={{ color: theme.colors.danger, fontSize: 14, lineHeight: 20 }}>{error}</Text>
        ) : null}

        <PrimaryButton
          label={isSubmitting ? 'Creating Account...' : 'Create Account'}
          onPress={handleSubmit}
          disabled={isSubmitting}
        />
      </GlassSurface>

      <PrimaryButton label="Back to Sign In" onPress={() => router.push('/login')} variant="secondary" />
    </ScreenView>
  );
}
