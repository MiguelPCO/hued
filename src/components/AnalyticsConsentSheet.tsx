import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { posthog } from '@/lib/analytics/posthog';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { Colors, Spacing } from '@/lib/tokens';

// Se pregunta una sola vez (art. 22.2 LSSI). Cerrar sin elegir cuenta como rechazo.
// Sin clave de PostHog no hay analítica que consentir, así que no se muestra.
export function AnalyticsConsentSheet() {
  const shown = useSettingsStore((s) => s.analyticsPromptShown);
  const markShown = useSettingsStore((s) => s.markAnalyticsPromptShown);

  function answer(accepted: boolean) {
    if (accepted) posthog?.optIn();
    else posthog?.optOut();
    markShown();
  }

  return (
    <Sheet visible={!!posthog && !shown} onClose={() => answer(false)}>
      <View style={styles.body}>
        <Text variant="h3">¿Nos ayudas a mejorar Hued?</Text>
        <Text variant="body" color={Colors.textSecondary}>
          Si aceptas, medimos qué pantallas y funciones se usan, con un identificador anónimo del
          dispositivo. Nunca incluye tus fotos ni tus colores. Puedes cambiarlo cuando quieras en
          Ajustes.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label="Aceptar" onPress={() => answer(true)} variant="primary" fullWidth />
        <Button label="No, gracias" onPress={() => answer(false)} variant="secondary" fullWidth />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.sm, marginBottom: Spacing.lg },
  actions: { gap: Spacing.sm },
});
