import * as Sentry from '@sentry/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArchetypeCanvas } from '@/components/compose/ArchetypeCanvas';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { extractColors, ExtractError } from '@/lib/color/extract';
import { getPalette, updatePaletteColors, updatePaletteLayout } from '@/lib/db/palettes';
import { trackEvent } from '@/lib/analytics/events';
import { Colors, Spacing, Radius } from '@/lib/tokens';
import type { ArchetypeId, LayoutConfig, Palette } from '@/types/palette';

const ARCHETYPES: { id: ArchetypeId; label: string }[] = [
  { id: 'strip', label: 'Franja' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'grid', label: 'Cuadrícula' },
  { id: 'banner', label: 'Banner' },
  { id: 'side', label: 'Lateral' },
];

export default function PaletteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [config, setConfig] = useState<LayoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFlushRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!id) return;
    getPalette(id).then((p) => {
      if (p) { setPalette(p); setConfig(p.layoutConfig); }
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        // Flush any pending edit immediately instead of dropping it — the
        // debounce timer never gets to fire once this screen unmounts.
        pendingFlushRef.current?.();
      }
    };
  }, []);

  const updateConfig = useCallback((partial: Partial<LayoutConfig>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const flush = () => {
        pendingFlushRef.current = null;
        if (id) {
          updatePaletteLayout(id, next).catch(Sentry.captureException);
        }
      };
      pendingFlushRef.current = flush;
      debounceRef.current = setTimeout(flush, 500);
      return next;
    });
  }, [id]);

  async function handleRetry() {
    if (!palette) return;
    setExtracting(true);
    try {
      const colors = await extractColors(palette.thumbnailUri);
      await updatePaletteColors(palette.id, colors);
      setPalette((p) => p ? { ...p, colors } : p);
    } catch (err) {
      const reason = err instanceof ExtractError ? err.message : 'unknown';
      trackEvent('extract_failed', { reason });
      Sentry.captureException(err);
    } finally {
      setExtracting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingBox]}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  if (!palette || !config) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingBox]}>
        <Text variant="body" color={Colors.textSecondary}>Paleta no encontrada.</Text>
        <Button label="Volver" onPress={() => router.back()} variant="ghost" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text variant="body" color={Colors.accent}>← Volver</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ArchetypeCanvas palette={palette} config={config} />

        {palette.colors.length === 0 ? (
          <View style={styles.errorBanner}>
            <Text variant="small" color={Colors.error}>
              No se pudieron extraer los colores.
            </Text>
            <Button
              label={extracting ? 'Extrayendo...' : 'Reintentar'}
              onPress={handleRetry}
              loading={extracting}
              variant="ghost"
            />
          </View>
        ) : (
          <View style={styles.swatchRow}>
            {palette.colors.map((c, i) => (
              <View key={i} style={[styles.swatch, { backgroundColor: c.hex }]} />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text variant="label" color={Colors.textSecondary} style={styles.sectionLabel}>
            ARQUETIPOS
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.archetypeScroll}>
            {ARCHETYPES.map((a) => {
              const active = config.archetypeId === a.id;
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.archPill, active && styles.archPillActive]}
                  onPress={() => {
                    updateConfig({ archetypeId: a.id });
                    trackEvent('archetype_selected', { archetype_id: a.id });
                  }}
                >
                  <Text
                    variant="small"
                    weight={active ? 'semibold' : 'regular'}
                    color={active ? Colors.accentForeground : Colors.textPrimary}
                  >
                    {a.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text variant="label" color={Colors.textSecondary} style={styles.sectionLabel}>
            ETIQUETAS
          </Text>
          {[
            { label: 'Mostrar hex', key: 'showHex' as const },
            { label: 'Mostrar nombre', key: 'showName' as const },
            { label: 'Mostrar RGB', key: 'showRGB' as const },
          ].map(({ label, key }) => (
            <View key={key} style={styles.toggleRow}>
              <Text variant="body">{label}</Text>
              <Switch
                value={config[key]}
                onValueChange={(val) => {
                  updateConfig({ [key]: val });
                  trackEvent('config_changed', { config_key: key });
                }}
                trackColor={{ true: Colors.accent }}
              />
            </View>
          ))}
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  loadingBox: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  backBtn: { alignSelf: 'flex-start' },
  scroll: { paddingBottom: Spacing['2xl'] },
  swatchRow: {
    flexDirection: 'row',
    height: 36,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  swatch: { flex: 1 },
  errorBanner: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.error,
    gap: Spacing.sm,
  },
  section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.md },
  sectionLabel: { marginBottom: Spacing.sm },
  archetypeScroll: { marginHorizontal: -Spacing.md, paddingHorizontal: Spacing.md },
  archPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
    marginRight: Spacing.sm,
  },
  archPillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  bottomPad: { height: Spacing.xl },
});
