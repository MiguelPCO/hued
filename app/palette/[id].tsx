// app/palette/[id].tsx
import * as Sentry from '@sentry/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArchetypeCanvas, CANVAS_H, CANVAS_W } from '@/components/compose/ArchetypeCanvas';
import {
  baseStyleConfig,
  libreSeed,
  NEUTRAL_SCALES,
  scaleSwatches,
} from '@/components/compose/archetypes/cardLayouts';
import { EditTabs } from '@/components/palette/EditTabs';
import type { ScaleKey } from '@/components/palette/EditTabs';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { StripeBar } from '@/components/ui/StripeBar';
import { Text } from '@/components/ui/Text';
import { extractColors, ExtractError } from '@/lib/color/extract';
import { exportPalette, RESOLUTIONS } from '@/lib/export/exportPalette';
import type { ExportResolution } from '@/lib/export/exportPalette';
import {
  deletePalette,
  getPalette,
  incrementExportCount,
  updatePaletteColors,
  updatePaletteLayout,
} from '@/lib/db/palettes';
import { trackEvent } from '@/lib/analytics/events';
import { isOptionLocked } from '@/lib/subscription/optionLock';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { Colors, Spacing, Radius } from '@/lib/tokens';
import type {
  ArchetypeId,
  ExtractedColor,
  FreeformSwatch,
  LayoutConfig,
  Palette,
} from '@/types/palette';

const RESOLUTION_LABELS: { value: ExportResolution; label: string; premium?: boolean }[] = [
  { value: '1x', label: '1×' },
  { value: '2x', label: '2×' },
  { value: '4x', label: '4×', premium: true },
];

export default function PaletteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [config, setConfig] = useState<LayoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [canvasMaxHeight, setCanvasMaxHeight] = useState(0);
  const [exportSheetVisible, setExportSheetVisible] = useState(false);
  const [exportState, setExportState] = useState<'idle' | 'exporting'>('idle');
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFlushRef = useRef<(() => void) | null>(null);
  const subscriptionStatus = useSettingsStore((s) => s.subscriptionStatus);

  const attemptExtraction = useCallback(async (target: Palette) => {
    setExtracting(true);
    try {
      const colors = await extractColors(target.thumbnailUri);
      await updatePaletteColors(target.id, colors);
      setPalette((p) => (p ? { ...p, colors } : p));
    } catch (err) {
      const reason = err instanceof ExtractError ? err.message : 'unknown';
      trackEvent('extract_failed', { reason });
      Sentry.captureException(err);
    } finally {
      setExtracting(false);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    getPalette(id)
      .then((p) => {
        if (p) {
          setPalette(p);
          setConfig(p.layoutConfig);
          // processCapture() saves with colors: [] and doesn't wait on
          // extraction — the photo shows immediately, colors populate here a
          // moment later instead of gating navigation on it.
          if (p.colors.length === 0) attemptExtraction(p);
        }
      })
      .catch((err) => {
        Sentry.captureException(err);
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
  }, [id, attemptExtraction, loadAttempt]);

  function retryLoad() {
    setLoadFailed(false);
    setLoading(true);
    setLoadAttempt((n) => n + 1);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        pendingFlushRef.current?.();
      }
    };
  }, []);

  const updateConfig = useCallback(
    (partialOrFn: Partial<LayoutConfig> | ((prev: LayoutConfig) => Partial<LayoutConfig>)) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const partial = typeof partialOrFn === 'function' ? partialOrFn(prev) : partialOrFn;
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
    },
    [id]
  );

  const updateLibreSwatches = useCallback(
    (updater: (prev: FreeformSwatch[]) => FreeformSwatch[]) => {
      updateConfig((prev) => ({ freeformSwatches: updater(prev.freeformSwatches) }));
    },
    [updateConfig]
  );

  // Seed the base layout libre came from the moment libre becomes active with no (or
  // stale) swatch data — first time switching to it, or right after a
  // paletteSize change reset freeformSwatches to [] (ADR-0001). Runs through
  // the same updateConfig path as every other config field, so it's
  // debounced/persisted identically instead of needing its own write path.
  useEffect(() => {
    if (!palette || !config) return;
    if (config.archetypeId !== 'libre') return;
    if (config.freeformSwatches.length === palette.colors.length) return;
    updateConfig({
      freeformSwatches: libreSeed(config.libreSource, palette.colors.length, config),
    });
  }, [palette, config, updateConfig]);

  const resetLibreLayout = useCallback(() => {
    if (!palette) return;
    updateConfig((prev) => ({
      ...NEUTRAL_SCALES,
      freeformSwatches: libreSeed(prev.libreSource, palette.colors.length, NEUTRAL_SCALES),
    }));
    trackEvent('config_changed', { config_key: 'freeformSwatches_reset' });
  }, [palette, updateConfig]);

  // Picking a card archetype applies its whole base look (see baseStyleConfig); picking libre keeps the
  // current look and starts from the layout you were on, with your size and spacing already applied.
  const selectArchetype = useCallback(
    (archetypeId: ArchetypeId) => {
      if (!palette) return;
      const count = palette.colors.length || palette.layoutConfig.paletteSize;
      updateConfig((prev) => {
        if (archetypeId === prev.archetypeId) return {};
        if (archetypeId !== 'libre') {
          return { archetypeId, freeformSwatches: [], ...baseStyleConfig(archetypeId, count) };
        }
        const libreSource = prev.archetypeId === 'libre' ? prev.libreSource : prev.archetypeId;
        return { archetypeId, libreSource, freeformSwatches: libreSeed(libreSource, count, prev) };
      });
    },
    [palette, updateConfig],
  );

  // In libre the cards are placed by hand, so a size change resizes them (relative to the previous
  // value) instead of re-scaling a base layout; spacing doesn't apply there.
  const handleScaleChange = useCallback(
    (key: ScaleKey, value: number) => {
      updateConfig((prev) => {
        if (prev.archetypeId !== 'libre' || key === 'gapScale') return { [key]: value };
        const ratio = value / prev[key];
        return {
          [key]: value,
          freeformSwatches: scaleSwatches(
            prev.freeformSwatches,
            key === 'cardWidthScale' ? ratio : 1,
            key === 'cardHeightScale' ? ratio : 1,
            CANVAS_W,
            CANVAS_H,
          ),
        };
      });
    },
    [updateConfig],
  );

  const handlePaletteSizeChange = useCallback(
    async (newSize: number) => {
      if (!palette) return;
      if (newSize === palette.colors.length) return; // no-op: same size already extracted
      setExtracting(true);
      try {
        const colors = await extractColors(palette.thumbnailUri, newSize);
        await updatePaletteColors(palette.id, colors);
        setPalette((p) => (p ? { ...p, colors } : p));
        // Reset (not remap) per ADR-0001: colors re-sort by luminosity on
        // every extraction, so an old position's index no longer points at
        // "the same" color.
        // A new count means a new base layout: libre goes back to the one it came from, the rest take
        // the look of the base for that count.
        updateConfig((prev) => ({
          paletteSize: newSize,
          ...(prev.archetypeId === 'libre'
            ? {
                ...NEUTRAL_SCALES,
                freeformSwatches: libreSeed(prev.libreSource, newSize, NEUTRAL_SCALES),
              }
            : { ...baseStyleConfig(prev.archetypeId, newSize), freeformSwatches: [] }),
        }));
        trackEvent('config_changed', { config_key: 'paletteSize' });
      } catch (err) {
        const reason = err instanceof ExtractError ? err.message : 'unknown';
        trackEvent('extract_failed', { reason });
        Sentry.captureException(err);
      } finally {
        setExtracting(false);
      }
    },
    [palette, updateConfig]
  );

  // After a camera capture the palette is the only screen in the stack, so back would be unhandled.
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }

  async function handleDelete() {
    if (!palette) return;
    setDeleting(true);
    try {
      await deletePalette(palette.id);
      trackEvent('palette_deleted', { palette_id: palette.id, source: 'detail' });
      setDeleteSheetVisible(false);
      if (router.canDismiss()) {
        router.dismissAll();
      } else {
        router.replace('/(tabs)');
      }
    } catch (err) {
      Sentry.captureException(err);
      setDeleting(false);
    }
  }

  async function handleExport(resolution: ExportResolution) {
    if (!palette || !config) return;

    const premium = RESOLUTION_LABELS.find((r) => r.value === resolution)?.premium;
    if (isOptionLocked(premium, useSettingsStore.getState().subscriptionStatus)) {
      setExportSheetVisible(false);
      router.push({ pathname: '/paywall', params: { trigger: 'resolution_locked' } });
      return;
    }

    setExportState('exporting');
    setExportError(null);
    try {
      const uri = await exportPalette(palette, config, resolution);

      // writeOnly: solo guardar. Android 13+ no pide nada (sin READ_MEDIA_IMAGES) e iOS pide "solo añadir".
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        setExportError('Activa el permiso de fotos en Ajustes del dispositivo.');
        setExportState('idle');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);

      await incrementExportCount(palette.id);
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

  if (loadFailed) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingBox]}>
        <Text variant="body" color={Colors.textSecondary}>No se pudo cargar la paleta.</Text>
        <Button label="Reintentar" onPress={retryLoad} />
        <Button label="Volver" onPress={() => goBack()} variant="ghost" />
      </SafeAreaView>
    );
  }

  if (!palette || !config) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingBox]}>
        <Text variant="body" color={Colors.textSecondary}>Paleta no encontrada.</Text>
        <Button label="Volver" onPress={() => goBack()} variant="ghost" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StripeBar />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack()} style={styles.backBtn}>
          <Text variant="body" color={Colors.accent}>← Volver</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setDeleteSheetVisible(true)} hitSlop={8}>
            <Icon name="delete" size={22} color={Colors.error} />
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
      </View>

      <View
        style={styles.canvasRegion}
        onLayout={(e) => setCanvasMaxHeight(e.nativeEvent.layout.height)}
      >
        {canvasMaxHeight > 0 && (
          <ArchetypeCanvas
            palette={palette}
            config={config}
            maxHeight={canvasMaxHeight}
            onWatermarkPress={() => {
              router.push({ pathname: '/paywall', params: { trigger: 'watermark_tap' } });
            }}
            onLibreSwatchesChange={updateLibreSwatches}
          />
        )}
      </View>

      <View style={styles.swatchStrip}>
        {palette.colors.length === 0 ? (
          <TouchableOpacity
            style={styles.retryPill}
            onPress={() => attemptExtraction(palette)}
            disabled={extracting}
          >
            <Text variant="small" color={Colors.error}>
              {extracting ? 'Extrayendo...' : 'Reintentar'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.swatchRow}>
            {palette.colors.map((c, i) => (
              <View key={i} style={[styles.swatch, { backgroundColor: c.hex }]} />
            ))}
          </View>
        )}
      </View>

      <EditTabs
        paletteId={palette.id}
        imageUri={palette.imageUri}
        config={config}
        updateConfig={updateConfig}
        onSelectArchetype={selectArchetype}
        onScaleChange={handleScaleChange}
        onImageUpdated={(updates: { imageUri: string; thumbnailUri: string; colors: ExtractedColor[] }) => {
          setPalette((p) => (p ? { ...p, ...updates } : p));
        }}
        onPaletteSizeChange={handlePaletteSizeChange}
        onResetLibreLayout={resetLibreLayout}
        paletteSizeChanging={extracting}
        onLockedPress={() => {
          router.push({ pathname: '/paywall', params: { trigger: 'watermark_tap' } });
        }}
      />

      <View style={styles.exportBar}>
        <Button label="Exportar" onPress={() => setExportSheetVisible(true)} variant="primary" fullWidth />
      </View>

      <Sheet visible={exportSheetVisible} onClose={() => setExportSheetVisible(false)}>
        <Text variant="h3" style={styles.sheetTitle}>Exportar paleta</Text>
        {exportError && (
          <View style={styles.errorBanner}>
            <Text variant="small" color={Colors.error}>{exportError}</Text>
          </View>
        )}
        {RESOLUTION_LABELS.map(({ value, label, premium }) => {
          const { width, height } = RESOLUTIONS[value];
          const locked = isOptionLocked(premium, subscriptionStatus);
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
              {locked && <Text variant="small" color={Colors.accent} weight="semibold">Pro</Text>}
              {exportState === 'exporting' && <ActivityIndicator size="small" color={Colors.accent} />}
            </TouchableOpacity>
          );
        })}
      </Sheet>

      <Sheet visible={deleteSheetVisible} onClose={() => setDeleteSheetVisible(false)}>
        <Text variant="body">¿Eliminar esta paleta? Esta acción no se puede deshacer.</Text>
        <View style={styles.confirmRow}>
          <TouchableOpacity
            style={styles.sheetAction}
            onPress={() => setDeleteSheetVisible(false)}
            disabled={deleting}
          >
            <Text variant="body">Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetAction} onPress={handleDelete} disabled={deleting}>
            <Text variant="body" color={Colors.error} weight="semibold">
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Text>
          </TouchableOpacity>
        </View>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  confirmRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg, marginTop: Spacing.md },
  sheetAction: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  canvasRegion: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  swatchStrip: {
    height: 52,
    marginHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  swatchRow: {
    flexDirection: 'row',
    height: 36,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  swatch: { flex: 1 },
  retryPill: { alignSelf: 'flex-start' },
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
  exportBar: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
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
