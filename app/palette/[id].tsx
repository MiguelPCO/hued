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

import { ArchetypeCanvas } from '@/components/compose/ArchetypeCanvas';
import { EditTabs } from '@/components/palette/EditTabs';
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
import { canExportToday } from '@/lib/subscription/exportGate';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { Colors, Spacing, Radius } from '@/lib/tokens';
import type { ExtractedColor, LayoutConfig, Palette } from '@/types/palette';

const RESOLUTION_LABELS: { value: ExportResolution; label: string }[] = [
  { value: '1x', label: '1×' },
  { value: '2x', label: '2×' },
  { value: '4x', label: '4×' },
];

export default function PaletteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [config, setConfig] = useState<LayoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [canvasMaxHeight, setCanvasMaxHeight] = useState(0);
  const [exportSheetVisible, setExportSheetVisible] = useState(false);
  const [exportState, setExportState] = useState<'idle' | 'exporting'>('idle');
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFlushRef = useRef<(() => void) | null>(null);
  const incrementDailyExportCount = useSettingsStore((s) => s.incrementExportCount);

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
    getPalette(id).then((p) => {
      if (p) {
        setPalette(p);
        setConfig(p.layoutConfig);
        // processCapture() saves with colors: [] and doesn't wait on
        // extraction — the photo shows immediately, colors populate here a
        // moment later instead of gating navigation on it.
        if (p.colors.length === 0) attemptExtraction(p);
      }
      setLoading(false);
    });
  }, [id, attemptExtraction]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
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
        onImageUpdated={(updates: { imageUri: string; thumbnailUri: string; colors: ExtractedColor[] }) => {
          setPalette((p) => (p ? { ...p, ...updates } : p));
        }}
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
