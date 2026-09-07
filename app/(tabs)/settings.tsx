import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { StripeBar } from '@/components/ui/StripeBar';
import { Text } from '@/components/ui/Text';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { Colors, Radius, Spacing } from '@/lib/tokens';

function formatExpiration(expiresAt: number | null): string {
  if (expiresAt === null) return 'De por vida';
  return new Date(expiresAt).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function SettingsScreen() {
  const subscriptionStatus = useSettingsStore((s) => s.subscriptionStatus);
  const subscriptionExpiresAt = useSettingsStore((s) => s.subscriptionExpiresAt);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StripeBar />
      <View style={styles.header}>
        <Text variant="h1">Ajustes</Text>
      </View>

      <View style={styles.section}>
        {subscriptionStatus === 'premium' ? (
          <View style={styles.proCard}>
            <Text variant="label" color={Colors.textPrimary}>HUED PRO</Text>
            <Text variant="body" color={Colors.textPrimary}>
              {formatExpiration(subscriptionExpiresAt)}
            </Text>
          </View>
        ) : (
          <Button
            label="Mejorar a Pro"
            onPress={() => router.push({ pathname: '/paywall', params: { trigger: 'settings' } })}
            variant="primary"
            fullWidth
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  proCard: {
    backgroundColor: Colors.accentSubtle,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
});
