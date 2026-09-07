import * as Sentry from '@sentry/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
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
import { Sheet } from '@/components/ui/Sheet';
import { StripeBar } from '@/components/ui/StripeBar';
import { Text } from '@/components/ui/Text';
import { extractColors, ExtractError } from '@/lib/color/extract';
import { exportPalette, RESOLUTIONS } from '@/lib/export/exportPalette';
import type { ExportResolution } from '@/lib/export/exportPalette';
import { getPalette, incrementExportCount, updatePaletteColors, updatePaletteLayout } from '@/lib/db/palettes';
import { trackEvent } from '@/lib/analytics/events';
import { canExportToday } from '@/lib/subscription/exportGate';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { Colors, Spacing, Radius } from '@/lib/tokens';
import { PILL_CORNER_RADIUS } from '@/components/compose/archetypes/shared';
import { ARCHETYPES } from '@/data/archetypes';
import type { LayoutConfig, Palette } from '@/types/palette';

const RESOLUTION_LABELS: { value: ExportResolution; label: string }[] = [
  { value: '1x', label: '1×' },
  { value: '2x', label: '2×' },
  { value: '4x', label: '4×' },
];

// "Difuminado" (blur) is filtered out per-archetype below (see
// ArchetypeDefinition.supportsBlur in src/data/archetypes.ts) — it's a
// visual no-op on strip/grid/side, where the blurred backdrop is just the
// same flat swatch color already drawn underneath it.
const CARD_STYLE_OPTIONS = [
  { label: 'Sólido', key: 'filled' as const },
  { label: 'Contorno', key: 'outlined' as const },
  { label: 'Difuminado', key: 'blur' as const },
];

export default function PaletteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [config, setConfig] = useState<LayoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [exportSheetVisible, setExportSheetVisible] = useState(false);
  const [exportState, setExportState] = useState<'idle' | 'exporting'>('idle');
  const [exportError, setExportError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFlushRef = useRef<(() => void) | null>(null);
  const incrementDailyExportCount = useSettingsStore((s) => s.incrementExportCount);

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

  async function handleExport(resolution: ExportResolution) {
    if (!palette || !config) return;

    // Reset the daily count BEFORE reading it below — otherwise a free user
    // who hit the limit yesterday stays permanently blocked, since
    // incrementExportCount() (which also runs this check) never executes
    // once the gate below routes them to /paywall instead of exporting.
    useSettingsStore.getState().resetExportCountIfNewDay();
    const { subscriptionStatus: currentSubscriptionStatus, exportDailyCount: currentExportDailyCount } =
      useSettingsStore.getState();

    if (!canExportToday(currentSubscriptionStatus, currentExportDailyCount)) {
      setExportSheetVisible(false);
      router.push({ pathname: '/paywall', params: { trigger: 'export_limit' } });
      return;
    }

    setExportState('exporting');
    setExportError(null);
    try {
      const uri = await exportPalette(palette, config, resolution);

      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        setExportError('Activa el permiso de fotos en Ajustes del dispositivo.');
        setExportState('idle');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);

      await incrementExportCount(palette.id);
      incrementDailyExportCount();
      trackEvent('palette_exported', {
        palette_id: palette.id,
        resolution,
        archetype_id: config.archetypeId,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
        trackEvent('palette_shared', { palette_id: palette.id });
      }

      setExportSheetVisible(false);
    } catch (err) {
      Sentry.captureException(err);
      setExportError('No se pudo exportar la paleta. Intentalo de nuevo.');
    } finally {
      setExportState('idle');
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
      <StripeBar />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text variant="body" color={Colors.accent}>← Volver</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (router.canDismiss()) {
              router.dismissAll();
            } else {
              router.replace('/(tabs)');
            }
          }}
        >
          <Text variant="body" weight="semibold" color={Colors.accent}>Listo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ArchetypeCanvas
          palette={palette}
          config={config}
          onWatermarkPress={() => {
            router.push({ pathname: '/paywall', params: { trigger: 'watermark_tap' } });
          }}
        />

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
            {Object.values(ARCHETYPES).map((a) => {
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
                    {a.displayName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text variant="label" color={Colors.textSecondary} style={styles.sectionLabel}>
            TIPOGRAFÍA
          </Text>
          <View style={styles.fontRow}>
            {[
              { label: 'Moderna', key: 'sans' as const },
              { label: 'Clásica', key: 'serif' as const },
              { label: 'Técnica', key: 'mono' as const },
            ].map(({ label, key }) => {
              const active = config.fontFamily === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.archPill, active && styles.archPillActive]}
                  onPress={() => {
                    updateConfig({ fontFamily: key });
                    trackEvent('config_changed', { config_key: 'fontFamily' });
                  }}
                >
                  <Text
                    variant="small"
                    weight={active ? 'semibold' : 'regular'}
                    color={active ? Colors.accentForeground : Colors.textPrimary}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="label" color={Colors.textSecondary} style={styles.sectionLabel}>
            ESQUINAS
          </Text>
          <View style={styles.fontRow}>
            {[
              { label: 'Recta', value: 0 },
              { label: 'Redonda', value: 16 },
              { label: 'Píldora', value: PILL_CORNER_RADIUS },
            ].map(({ label, value }) => {
              const active = config.cornerRadius === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.archPill, active && styles.archPillActive]}
                  onPress={() => {
                    updateConfig({ cornerRadius: value });
                    trackEvent('config_changed', { config_key: 'cornerRadius' });
                  }}
                >
                  <Text
                    variant="small"
                    weight={active ? 'semibold' : 'regular'}
                    color={active ? Colors.accentForeground : Colors.textPrimary}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="label" color={Colors.textSecondary} style={styles.sectionLabel}>
            ESTILO DE TARJETA
          </Text>
          <View style={styles.fontRow}>
            {CARD_STYLE_OPTIONS.filter(
              (opt) => opt.key !== 'blur' || ARCHETYPES[config.archetypeId].supportsBlur
            ).map(({ label, key }) => {
              const active = config.cardStyle === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.archPill, active && styles.archPillActive]}
                  onPress={() => {
                    updateConfig({ cardStyle: key });
                    trackEvent('config_changed', { config_key: 'cardStyle' });
                  }}
                >
                  <Text
                    variant="small"
                    weight={active ? 'semibold' : 'regular'}
                    color={active ? Colors.accentForeground : Colors.textPrimary}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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

        <View style={styles.exportSection}>
          <Button
            label="Exportar"
            onPress={() => setExportSheetVisible(true)}
            variant="primary"
            fullWidth
          />
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      <Sheet visible={exportSheetVisible} onClose={() => setExportSheetVisible(false)}>
        <Text variant="h3" style={styles.sheetTitle}>Exportar paleta</Text>
        {exportError && (
          <View style={styles.errorBanner}>
            <Text variant="small" color={Colors.error}>{exportError}</Text>
          </View>
        )}
        {RESOLUTION_LABELS.map(({ value, label }) => {
          const { width, height } = RESOLUTIONS[value];
          return (
            <TouchableOpacity
              key={value}
              style={styles.resolutionRow}
              onPress={() => handleExport(value)}
              disabled={exportState === 'exporting'}
            >
              <Text variant="body" weight="semibold">{label}</Text>
              <Text variant="small" color={Colors.textSecondary}>
                {width} × {height}
              </Text>
              {exportState === 'exporting' && <ActivityIndicator size="small" color={Colors.accent} />}
            </TouchableOpacity>
          );
        })}
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  loadingBox: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  fontRow: { flexDirection: 'row' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  bottomPad: { height: Spacing.xl },
  exportSection: { marginTop: Spacing.lg, paddingHorizontal: Spacing.md },
  sheetTitle: { marginBottom: Spacing.md },
  resolutionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
    gap: Spacing.sm,
  },
});
