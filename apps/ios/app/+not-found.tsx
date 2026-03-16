import { Stack, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { EmptyState } from '@/src/components/EmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenView } from '@/src/components/ScreenView';
import { useTheme } from '@/src/providers/ThemeProvider';

export default function NotFoundScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <ScreenView scroll={false} edges={['top', 'bottom']} bottomInset={48}>
        <EmptyState
          title="That page drifted off the map"
          message="The route you asked for does not exist in this build of the iOS app."
          symbol="map"
        />
        <PrimaryButton label="Go Home" onPress={() => router.replace('/')} />
        <Text
          style={{
            color: theme.colors.textSubtle,
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          If you hit this from the app UI, it is a bug and should be fixed.
        </Text>
      </ScreenView>
    </>
  );
}
