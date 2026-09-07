import * as Sentry from '@sentry/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { trackEvent } from '@/lib/analytics/events';
import type { PaywallTrigger } from '@/lib/analytics/events';
import { getOfferings, purchasePackage, restorePurchases } from '@/lib/revenuecat/client';
import { Colors, Radius, Spacing } from '@/lib/tokens';

const PACKAGE_TYPE_LABELS: Record<string, string> = {
  MONTHLY: 'Mensual',
  ANNUAL: 'Anual',
  LIFETIME: 'De por vida',
};

const PACKAGE_TYPE_TO_PLAN: Record<string, 'monthly' | 'annual' | 'lifetime'> = {
  MONTHLY: 'monthly',
  ANNUAL: 'annual',
  LIFETIME: 'lifetime',
};

export default function PaywallScreen() {
  const { trigger } = useLocalSearchParams<{ trigger?: PaywallTrigger }>();
  const activeTrigger: PaywallTrigger = trigger ?? 'settings';

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackEvent('paywall_shown', { trigger: activeTrigger });
    getOfferings()
      .then((offering) => setPackages(offering?.availablePackages ?? []))
      .catch((err) => {
        Sentry.captureException(err);
        setError('No se pudieron cargar los planes. Intentalo de nuevo.');
      })
      .finally(() => setLoading(false));
    // trigger is read once on mount to attribute this paywall view — a
    // param change would mean navigating to a *new* paywall instance, not
    // re-showing this one, so this effect intentionally runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    trackEvent('paywall_dismissed', { trigger: activeTrigger });
    router.back();
  }

  async function handlePurchase(pkg: PurchasesPackage) {
    setPurchasingId(pkg.identifier);
    setError(null);
    try {
      await purchasePackage(pkg);
      const plan = PACKAGE_TYPE_TO_PLAN[pkg.packageType];
      trackEvent('subscription_purchased', { trigger: activeTrigger, plan });
      router.back();
    } catch (err) {
      const isCancelled = (err as { userCancelled?: boolean } | null)?.userCancelled === true;
      if (!isCancelled) {
        Sentry.captureException(err);
        setError('No se pudo completar la compra. Intentalo de nuevo.');
      }
    } finally {
      setPurchasingId(null);
    }
  }

  async function handleRestore() {
    setError(null);
    try {
      await restorePurchases();
      trackEvent('subscription_restored', {});
      router.back();
    } catch (err) {
      Sentry.captureException(err);
      setError('No se pudieron restaurar las compras.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="h1">Hued Pro</Text>
        <TouchableOpacity onPress={handleClose}>
          <Text variant="body" color={Colors.accent}>Cerrar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="body" color={Colors.textSecondary} style={styles.subtitle}>
          Exportaciones ilimitadas y sin marca de agua.
        </Text>

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={styles.loading} />
        ) : error && packages.length === 0 ? (
          <Text variant="small" color={Colors.error}>{error}</Text>
        ) : (
          packages.map((pkg) => (
            <View key={pkg.identifier} style={styles.card}>
              <Text variant="h3">{PACKAGE_TYPE_LABELS[pkg.packageType] ?? pkg.packageType}</Text>
              <Text variant="body" color={Colors.textSecondary}>{pkg.product.priceString}</Text>
              <Button
                label={purchasingId === pkg.identifier ? 'Procesando...' : 'Elegir'}
                onPress={() => handlePurchase(pkg)}
                loading={purchasingId === pkg.identifier}
                disabled={purchasingId !== null}
                fullWidth
              />
            </View>
          ))
        )}

        {error && packages.length > 0 && (
          <Text variant="small" color={Colors.error} style={styles.errorText}>{error}</Text>
        )}

        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
          <Text variant="small" color={Colors.textSecondary}>Restaurar compras</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  subtitle: { marginBottom: Spacing.md },
  loading: { marginTop: Spacing.xl },
  card: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: { marginTop: Spacing.sm },
  restoreBtn: { alignSelf: 'center', marginTop: Spacing.lg, padding: Spacing.sm },
});
