import { Redirect, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { GlassSurface } from '@/src/components/GlassSurface';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenView } from '@/src/components/ScreenView';
import { useTheme } from '@/src/providers/ThemeProvider';
import { useAuthStore } from '@/src/stores/authStore';

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    description: 'Full listener access with playlists and streaming.',
    features: ['Full catalog access', 'Unlimited playlists', 'Ad-free listening', 'Standard audio'],
    comingSoon: false,
  },
  {
    key: 'premium_monthly',
    name: 'Premium',
    price: '$4.99 / month',
    description: 'Unlock export, premium theme access, and higher-fidelity perks.',
    features: ['Everything in Free', 'Personal-use exports', 'Exclusive theme access', 'High-fidelity perks'],
    comingSoon: true,
  },
  {
    key: 'premium_annual',
    name: 'Premium Annual',
    price: '$39.99 / year',
    description: 'Best value once subscriptions ship on mobile.',
    features: ['Everything in Premium', 'Two months free', 'Early feature access'],
    comingSoon: true,
  },
] as const;

export default function ChoosePlanScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const pendingAuth = useAuthStore((state) => state.pendingAuth);
  const applyPendingAuth = useAuthStore((state) => state.applyPendingAuth);

  if (!pendingAuth) {
    return <Redirect href="/register" />;
  }

  async function handleContinueFree() {
    await applyPendingAuth();
    router.replace('/');
  }

  return (
    <ScreenView edges={['top', 'bottom']} bottomInset={48}>
      <View style={{ gap: 8 }}>
        <Text
          style={{
            color: theme.colors.textSubtle,
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          Choose your plan
        </Text>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 32,
            fontWeight: '800',
            fontFamily: theme.typography.displayFontFamily,
          }}
        >
          Your account is ready.
        </Text>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 15,
            lineHeight: 22,
            fontFamily: theme.typography.bodyFontFamily,
          }}
        >
          Match the current web experience: free listener access works today, while premium checkout
          remains a coming-soon upgrade path.
        </Text>
      </View>

      <View style={{ gap: 14 }}>
        {PLANS.map((plan) => (
          <GlassSurface
            key={plan.key}
            style={{
              padding: 18,
              gap: 14,
              borderWidth: plan.key === 'free' ? 1.5 : 1,
              borderColor: plan.key === 'free' ? theme.colors.primary : theme.colors.surfaceBorder,
            }}
          >
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: 22,
                  fontWeight: '800',
                  fontFamily: theme.typography.displayFontFamily,
                }}
              >
                {plan.name}
              </Text>
              <Text style={{ color: theme.colors.primary, fontSize: 16, fontWeight: '700' }}>
                {plan.price}
              </Text>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 14,
                  lineHeight: 20,
                  fontFamily: theme.typography.bodyFontFamily,
                }}
              >
                {plan.description}
              </Text>
            </View>

            <View style={{ gap: 8 }}>
              {plan.features.map((feature) => (
                <Text
                  key={feature}
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: 14,
                    lineHeight: 20,
                    fontFamily: theme.typography.bodyFontFamily,
                  }}
                >
                  • {feature}
                </Text>
              ))}
            </View>

            {plan.comingSoon ? (
              <PrimaryButton label="Coming Soon" onPress={() => {}} disabled />
            ) : (
              <PrimaryButton label="Continue with Free" onPress={handleContinueFree} />
            )}
          </GlassSurface>
        ))}
      </View>
    </ScreenView>
  );
}
