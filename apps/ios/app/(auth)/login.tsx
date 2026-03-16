import { AxiosError } from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GlassSurface } from '@/src/components/GlassSurface';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenView } from '@/src/components/ScreenView';
import { TextField } from '@/src/components/TextField';
import { API_BASE_URL } from '@/src/lib/env';
import { useTheme } from '@/src/providers/ThemeProvider';
import { login } from '@/src/services/auth';
import { useAuthStore } from '@/src/stores/authStore';

function errorMessage(error: unknown) {
  const axiosError = error as AxiosError<{ detail?: string }>;
  if (axiosError.code === 'ERR_NETWORK') {
    return `Cannot reach the API at ${API_BASE_URL}. Start the backend or set EXPO_PUBLIC_API_URL.`;
  }

  return axiosError.response?.data?.detail ?? 'Unable to sign in with those credentials.';
}

export default function LoginScreen() {
  const router = useRouter();
  const { theme, cycleTheme } = useTheme();
  const setSession = useAuthStore((state) => state.setSession);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await login({ username, password });
      await setSession(response.user, response.accessToken);
      router.replace('/');
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenView edges={['top', 'bottom']} bottomInset={48}>
      <View style={{ alignItems: 'flex-end' }}>
        <Pressable onPress={() => void cycleTheme()}>
          <Text
            style={{
              color: theme.colors.primary,
              fontSize: 12,
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}
          >
            Theme: {theme.label}
          </Text>
        </Pressable>
      </View>

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
            Sign in to listen
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 15,
              lineHeight: 22,
              fontFamily: theme.typography.bodyFontFamily,
            }}
          >
            Use the same API-backed account as the web app. User playlists and premium export
            status carry over automatically.
          </Text>
        </View>

        <TextField
          label="Username or Email"
          value={username}
          onChangeText={setUsername}
          placeholder="admin_test"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />

        {error ? (
          <Text style={{ color: theme.colors.danger, fontSize: 14, lineHeight: 20 }}>{error}</Text>
        ) : null}

        <PrimaryButton
          label={isSubmitting ? 'Signing In...' : 'Sign In'}
          onPress={handleSubmit}
          disabled={isSubmitting}
        />
      </GlassSurface>

      <View style={{ alignItems: 'center', gap: 10 }}>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 14,
            fontFamily: theme.typography.bodyFontFamily,
          }}
        >
          New listener?
        </Text>
        <PrimaryButton label="Create Account" onPress={() => router.push('/register')} variant="secondary" />
      </View>
    </ScreenView>
  );
}
