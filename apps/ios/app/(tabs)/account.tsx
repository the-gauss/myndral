import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { GlassSurface } from '@/src/components/GlassSurface';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { RemoteArtwork } from '@/src/components/RemoteArtwork';
import { ScreenView } from '@/src/components/ScreenView';
import { humanizePlan } from '@/src/lib/format';
import { useTheme } from '@/src/providers/ThemeProvider';
import { getTheme } from '@/src/theme';
import { useAuthStore } from '@/src/stores/authStore';
import { hasStudioAccess } from '@/src/types/studio';

export default function AccountScreen() {
  const router = useRouter();
  const { theme, themeName, options, setTheme } = useTheme();
  const user = useAuthStore((state) => state.user);
  const isPremium = useAuthStore((state) => state.isPremium);
  const clearSession = useAuthStore((state) => state.clearSession);

  const studioAccess = hasStudioAccess(user?.role);

  async function handleLogout() {
    await clearSession();
    router.replace('/login');
  }

  function handleOpenStudio() {
    if (studioAccess) {
      router.push('/(studio)/artists');
    } else {
      router.push('/studio-access');
    }
  }

  return (
    <ScreenView>
      <Text
        style={{
          color: theme.colors.text,
          fontSize: 30,
          fontWeight: '800',
          fontFamily: theme.typography.displayFontFamily,
        }}
      >
        Account
      </Text>

      <GlassSurface style={{ padding: 20, gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <RemoteArtwork
            uri={user?.avatarUrl}
            shape="circle"
            style={{ width: 64, height: 64 }}
            placeholderSymbol="person.crop.circle"
          />
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 22,
                fontWeight: '800',
                fontFamily: theme.typography.displayFontFamily,
              }}
            >
              {user?.displayName ?? user?.username ?? 'Listener'}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>{user?.email}</Text>
            <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '700' }}>
              {humanizePlan(user?.subscriptionPlan ?? 'free')}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <GlassSurface style={{ flex: 1, padding: 14, gap: 6 }}>
            <Text
              style={{
                color: theme.colors.textSubtle,
                fontSize: 11,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.7,
              }}
            >
              Privilege
            </Text>
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 15,
                fontWeight: '700',
                fontFamily: theme.typography.displayFontFamily,
              }}
            >
              {user?.role?.replace(/_/g, ' ') ?? 'listener'}
            </Text>
          </GlassSurface>

          <GlassSurface style={{ flex: 1, padding: 14, gap: 6 }}>
            <Text
              style={{
                color: theme.colors.textSubtle,
                fontSize: 11,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.7,
              }}
            >
              Streaming
            </Text>
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 15,
                fontWeight: '700',
                fontFamily: theme.typography.displayFontFamily,
              }}
            >
              {isPremium ? 'Premium' : 'Free'}
            </Text>
          </GlassSurface>
        </View>
      </GlassSurface>

      <GlassSurface style={{ padding: 18, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <SymbolView name="creditcard.fill" size={18} tintColor={theme.colors.secondary} />
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 20,
              fontWeight: '700',
              fontFamily: theme.typography.displayFontFamily,
            }}
          >
            Billing & Subscription
          </Text>
        </View>
        <View style={{ gap: 10 }}>
          <GlassSurface style={{ padding: 14, gap: 6 }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>
              {isPremium
                ? 'High-fidelity streaming, exports, and Minkowski theme are active on this account.'
                : 'Free access is active. Upgrade to unlock exports and Minkowski theme.'}
            </Text>
          </GlassSurface>
        </View>
      </GlassSurface>

      {/* ── Creator Studio section ─────────────────────────────────────────────
          Visible to all users. Creator-privileged accounts get a direct "Open
          Studio" button; listener accounts get an "Activate Studio Access" flow
          that lets them claim a studio role via a pre-shared access token.
      ──────────────────────────────────────────────────────────────────────── */}
      <GlassSurface style={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <SymbolView name="waveform.circle.fill" size={18} tintColor={theme.colors.primary} />
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 20,
              fontWeight: '700',
              fontFamily: theme.typography.displayFontFamily,
            }}
          >
            Creator Studio
          </Text>
        </View>

        <GlassSurface styleVariant="clear" style={{ padding: 14, gap: 6 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 }}>
            {studioAccess
              ? 'You have creator access. Open Studio to manage artists, albums, and music generation.'
              : 'Studio access lets you create artists, generate music, and manage the catalog. Activate with an access token.'}
          </Text>
        </GlassSurface>

        <Pressable
          onPress={handleOpenStudio}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: 22,
            backgroundColor: studioAccess ? theme.colors.cta : theme.colors.glassBgHeavy,
            borderWidth: studioAccess ? 0 : 1,
            borderColor: theme.colors.primary + '60',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <SymbolView
            name={studioAccess ? 'arrow.right.circle.fill' : 'key.fill'}
            size={17}
            tintColor={studioAccess ? theme.colors.ctaText : theme.colors.primary}
          />
          <Text
            style={{
              color: studioAccess ? theme.colors.ctaText : theme.colors.primary,
              fontSize: 15,
              fontWeight: '700',
            }}
          >
            {studioAccess ? 'Open Studio' : 'Activate Studio Access'}
          </Text>
        </Pressable>
      </GlassSurface>

      <View style={{ gap: 12 }}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 22,
            fontWeight: '700',
            fontFamily: theme.typography.displayFontFamily,
          }}
        >
          Settings
        </Text>
        {options.map((option) => {
          const previewTheme = getTheme(option.name);
          const locked = option.name === 'paper' && !isPremium;
          const active = option.name === themeName;

          return (
            <Pressable
              key={option.name}
              onPress={() => void setTheme(option.name)}
              disabled={locked}
            >
              <GlassSurface
                style={{
                  padding: 16,
                  gap: 12,
                  borderWidth: active ? 1.5 : 1,
                  borderColor: active ? theme.colors.primary : theme.colors.surfaceBorder,
                  opacity: locked ? 0.6 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ gap: 4, flex: 1 }}>
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontSize: 18,
                        fontWeight: '700',
                        fontFamily: theme.typography.displayFontFamily,
                      }}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={{
                        color: theme.colors.textMuted,
                        fontSize: 14,
                        lineHeight: 20,
                        fontFamily: theme.typography.bodyFontFamily,
                      }}
                    >
                      {option.description}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {[previewTheme.colors.background, previewTheme.colors.primary, previewTheme.colors.secondary].map(
                      (color) => (
                        <View
                          key={color}
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 8,
                            backgroundColor: color,
                            borderWidth: 1,
                            borderColor: previewTheme.colors.surfaceBorder,
                          }}
                        />
                      ),
                    )}
                  </View>
                </View>

                {locked ? (
                  <Text style={{ color: theme.colors.warning, fontSize: 13, fontWeight: '700' }}>
                    Premium only
                  </Text>
                ) : active ? (
                  <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '700' }}>
                    Active
                  </Text>
                ) : null}
              </GlassSurface>
            </Pressable>
          );
        })}
      </View>

      <PrimaryButton label="Log Out" onPress={handleLogout} variant="secondary" />
    </ScreenView>
  );
}
