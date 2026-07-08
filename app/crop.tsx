import * as Sentry from '@sentry/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// react-native-image-crop-picker is a native-only module with no web
// implementation — its top-level init throws immediately if required on
// web, which would otherwise crash the entire bundle (this app configures
// "web" as a target platform in app.json). Gate the require itself so its
// native init code never runs outside iOS/Android.
const ImageCropPicker: typeof import('react-native-image-crop-picker').default | null =
  process.env.EXPO_OS === 'web' ? null : require('react-native-image-crop-picker').default;

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { trackEvent } from '@/lib/analytics/events';
import { extractColors, ExtractError } from '@/lib/color/extract';
import { savePalette, updatePaletteColors } from '@/lib/db/palettes';
import { optimize, thumbnail } from '@/lib/utils/image';
import { ARCHETYPES } from '@/data/archetypes';
import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import type { CaptureSource } from '@/types/palette';
import { Colors, Radius, Spacing } from '@/lib/tokens';

type AspectRatio = '1:1' | '4:5' | '9:16' | 'original';

const ASPECT_SIZES: Record<AspectRatio, { width: number; height: number } | null> = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
  original: null,
};

const RATIOS: AspectRatio[] = ['1:1', '4:5', '9:16', 'original'];

type ScreenState = 'idle' | 'cropping' | 'saving' | 'extracting' | 'error';

export default function CropScreen() {
  const params = useLocalSearchParams<{ uri: string; source: string }>();
  const imageUri = params.uri as string | undefined;
  const captureSource = (params.source ?? 'camera') as CaptureSource;

  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('original');
  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cropStartRef = useRef<number>(0);

  useEffect(() => {
    if (!imageUri) router.replace('/(tabs)');
  }, [imageUri]);

  if (!imageUri) {
    return null;
  }

  function handleCancel() {
    trackEvent('capture_cancelled', { source: captureSource, stage: 'crop' });
    router.replace('/(tabs)');
  }

  async function handleCrop() {
    cropStartRef.current = Date.now();
    setScreenState('cropping');
    setErrorMessage(null);

    if (!ImageCropPicker) {
      setErrorMessage('Recortar no está disponible en esta plataforma.');
      setScreenState('error');
      return;
    }

    try {
      const sizes = ASPECT_SIZES[selectedRatio];
      const cropResult = await ImageCropPicker.openCropper({
        path: imageUri as string,
        ...(sizes ? { width: sizes.width, height: sizes.height } : { freeStyleCropEnabled: true }),
        mediaType: 'photo',
        cropperToolbarTitle: 'Recortar',
        cropperChooseText: 'Confirmar',
        cropperCancelText: 'Cancelar',
        includeExif: false,
        compressImageQuality: 1,
      });

      setScreenState('saving');

      const [optimizedUri, thumbUri] = await Promise.all([
        optimize(cropResult.path),
        thumbnail(cropResult.path),
      ]);

      const palette = await savePalette({
        imageUri: optimizedUri,
        thumbnailUri: thumbUri,
        colors: [],
        layoutConfig: {
          ...DEFAULT_LAYOUT_CONFIG,
          ...ARCHETYPES[DEFAULT_LAYOUT_CONFIG.archetypeId].defaultConfig,
        },
        meta: {
          capturedAt: Date.now(),
          source: captureSource,
          aspectRatio: selectedRatio,
        },
      });

      trackEvent('capture_completed', {
        source: captureSource,
        duration_ms: Date.now() - cropStartRef.current,
      });

      setScreenState('extracting');
      const extractStart = Date.now();
      try {
        const colors = await extractColors(palette.thumbnailUri);
        await updatePaletteColors(palette.id, colors);
        trackEvent('extract_completed', {
          duration_ms: Date.now() - extractStart,
          image_size_kb: 0,
        });
      } catch (extractErr) {
        const reason = extractErr instanceof ExtractError ? extractErr.message : 'unknown';
        trackEvent('extract_failed', { reason });
        Sentry.captureException(extractErr);
      }

      router.replace({ pathname: '/palette/[id]', params: { id: palette.id } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isUserCancel =
        msg.toLowerCase().includes('user cancelled') ||
        msg.toLowerCase().includes('user did not grant');

      if (isUserCancel) {
        trackEvent('capture_cancelled', { source: captureSource, stage: 'crop' });
        setScreenState('idle');
      } else {
        Sentry.captureException(err);
        setErrorMessage('No se pudo recortar la foto. Intentalo de nuevo.');
        setScreenState('error');
      }
    }
  }

  const SAVING_LABELS: Partial<Record<ScreenState, string>> = {
    saving: 'Guardando paleta...',
    extracting: 'Extrayendo colores...',
  };
  const savingLabel = SAVING_LABELS[screenState];

  if (savingLabel) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text variant="small" color={Colors.textSecondary} style={styles.savingLabel}>
          {savingLabel}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.cancelTap}>
          <Text variant="body" color={Colors.accent}>Cancelar</Text>
        </TouchableOpacity>
        <Text variant="h2">Recortar</Text>
        <View style={styles.cancelTap} />
      </View>

      <View style={styles.ratioSection}>
        <Text variant="label" color={Colors.textSecondary} style={styles.ratioLabel}>
          PROPORCION
        </Text>
        <View style={styles.ratioRow}>
          {RATIOS.map((ratio) => {
            const active = selectedRatio === ratio;
            return (
              <TouchableOpacity
                key={ratio}
                style={[styles.ratioPill, active && styles.ratioPillActive]}
                onPress={() => setSelectedRatio(ratio)}
              >
                <Text
                  variant="small"
                  weight={active ? 'semibold' : 'regular'}
                  color={active ? Colors.accentForeground : Colors.textPrimary}
                >
                  {ratio}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {errorMessage !== null && (
        <View style={styles.errorBanner}>
          <Text variant="small" color={Colors.error}>{errorMessage}</Text>
        </View>
      )}

      <View style={styles.actionBar}>
        <Button
          label={screenState === 'cropping' ? 'Abriendo...' : 'Recortar foto'}
          onPress={handleCrop}
          loading={screenState === 'cropping'}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgPrimary,
    gap: Spacing.md,
  },
  savingLabel: { marginTop: Spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  cancelTap: { minWidth: 70 },
  ratioSection: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  ratioLabel: { marginBottom: Spacing.sm },
  ratioRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  ratioPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
  },
  ratioPillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  errorBanner: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
    backgroundColor: Colors.bgPrimary,
  },
});
