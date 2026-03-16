/**
 * StudioHeader — sticky branded header used at the top of every Creator Studio screen.
 *
 * Shows the "MyndralAI Studio" wordmark, the current user's role, and a "Music Player"
 * back button that navigates the user out of the Studio into the listener experience.
 * This visual treatment deliberately distinguishes Studio mode from the Music player.
 */
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/src/providers/ThemeProvider';
import { useAuthStore } from '@/src/stores/authStore';
import { humanizeRole } from '@/src/types/studio';

interface StudioHeaderProps {
  /** Optional sub-title shown below the wordmark (e.g. current screen name). */
  subtitle?: string;
}

export function StudioHeader({ subtitle }: StudioHeaderProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const user = useAuthStore((s) => s.user);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
      }}
    >
      {/* Brand + role */}
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <SymbolView name="waveform.circle.fill" size={16} tintColor={theme.colors.primary} />
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
        </View>
        {subtitle ? (
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 28,
              fontWeight: '800',
              fontFamily: theme.typography.displayFontFamily,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
        {user?.role ? (
          <Text
            style={{
              color: theme.colors.primary,
              fontSize: 12,
              fontWeight: '600',
              textTransform: 'capitalize',
            }}
          >
            {humanizeRole(user.role)}
          </Text>
        ) : null}
      </View>

      {/* Back to Music Player */}
      <Pressable
        onPress={() => router.replace('/')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
          backgroundColor: theme.colors.glassBgHeavy,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <SymbolView name="headphones" size={14} tintColor={theme.colors.textMuted} />
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>
          Music
        </Text>
      </Pressable>
    </View>
  );
}
