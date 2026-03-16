/**
 * StudioAccess — lets an already-authenticated listener claim a Creator Studio role
 * using a pre-shared access token.
 *
 * The web version supports both "new account" and "existing account" flows because
 * it lives at a separate domain. Since this screen is reachable only when the user
 * is already logged in to the iOS app, we only expose the claim flow (existing
 * account + password verification). After a successful claim the backend issues a
 * fresh JWT with the upgraded role; we apply it immediately via setSession() and
 * navigate straight into the Studio — no re-login required.
 *
 * Privilege types:
 *   content_editor   — create artists, albums, and music; submit to staging
 *   content_reviewer — approve, reject, or request revisions on staged content
 *   admin            — full access including user management
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AxiosError } from 'axios';
import { GlassSurface } from '@/src/components/GlassSurface';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { useTheme } from '@/src/providers/ThemeProvider';
import { studioClaim } from '@/src/services/auth';
import { useAuthStore } from '@/src/stores/authStore';

function apiError(error: unknown): string {
  const e = error as AxiosError<{ detail?: string }>;
  if (e.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.';
  return e.response?.data?.detail ?? 'Something went wrong. Please try again.';
}

const ROLE_INFO = [
  {
    icon: 'pencil.and.outline',
    title: 'Content Editor',
    description: 'Create artists, albums, and music. Submit content to the staging queue.',
  },
  {
    icon: 'checkmark.seal',
    title: 'Content Reviewer',
    description: 'Review staged content and approve, reject, or request revisions.',
  },
  {
    icon: 'crown',
    title: 'Admin',
    description: 'Full access — content creation, review, and user management.',
  },
] as const;

export default function StudioAccessScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);

  const [password, setPassword] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim() {
    if (!user) return;
    if (!password.trim() || !accessToken.trim()) {
      setError('Both fields are required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await studioClaim({
        username: user.username,
        password: password.trim(),
        studio_access_token: accessToken.trim(),
      });
      // Apply the fresh session (new role + new JWT) immediately.
      await setSession(response.user, response.accessToken);
      router.replace('/(studio)/artists');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 40,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header row with back button */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.colors.glassBgHeavy,
              borderWidth: 1,
              borderColor: theme.colors.glassBorder,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <SymbolView name="chevron.left" size={18} tintColor={theme.colors.text} />
          </Pressable>
          <View>
            <Text
              style={{
                color: theme.colors.textSubtle,
                fontSize: 11,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 1.1,
              }}
            >
              MyndralAI Studio
            </Text>
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 26,
                fontWeight: '800',
                fontFamily: theme.typography.displayFontFamily,
              }}
            >
              Claim Studio Access
            </Text>
          </View>
        </View>

        {/* Role explanations */}
        <GlassSurface style={{ padding: 18, gap: 14 }}>
          <Text
            style={{
              color: theme.colors.textSubtle,
              fontSize: 11,
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 0.9,
            }}
          >
            Available Roles
          </Text>
          {ROLE_INFO.map((role) => (
            <View
              key={role.title}
              style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
            >
              <SymbolView name={role.icon} size={18} tintColor={theme.colors.primary} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 14,
                    fontWeight: '700',
                  }}
                >
                  {role.title}
                </Text>
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                >
                  {role.description}
                </Text>
              </View>
            </View>
          ))}
        </GlassSurface>

        {/* Claim form */}
        <GlassSurface style={{ padding: 20, gap: 16 }}>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 17,
              fontWeight: '700',
              fontFamily: theme.typography.displayFontFamily,
            }}
          >
            Activate for @{user?.username}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 }}>
            Enter your current password and the studio access token you received to upgrade your
            account.
          </Text>

          {/* Password */}
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
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Your current password"
              placeholderTextColor={theme.colors.textSubtle}
              style={{
                minHeight: 52,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: theme.colors.surfaceBorder,
                backgroundColor: theme.colors.glassBgHeavy,
                color: theme.colors.text,
                paddingHorizontal: 18,
                fontSize: 16,
              }}
            />
          </View>

          {/* Studio access token */}
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
              Studio Access Token
            </Text>
            <TextInput
              value={accessToken}
              onChangeText={setAccessToken}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Paste the token you received"
              placeholderTextColor={theme.colors.textSubtle}
              style={{
                minHeight: 52,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: theme.colors.surfaceBorder,
                backgroundColor: theme.colors.glassBgHeavy,
                color: theme.colors.text,
                paddingHorizontal: 18,
                fontSize: 15,
                fontFamily: 'Courier',
              }}
            />
          </View>

          {error ? (
            <View
              style={{
                backgroundColor: theme.colors.danger + '18',
                borderWidth: 1,
                borderColor: theme.colors.danger + '44',
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

          <PrimaryButton
            label={submitting ? 'Activating…' : 'Activate Studio Access'}
            onPress={handleClaim}
            disabled={submitting}
          />
        </GlassSurface>
      </ScrollView>
    </View>
  );
}
