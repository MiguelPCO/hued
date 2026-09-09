import * as Sentry from '@sentry/react-native';
import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

// Same web-gating pattern as the old app/crop.tsx — the native module has no
// web implementation and throws at require-time if loaded there.
const ImageCropPicker: typeof import('react-native-image-crop-picker').default | null =
  process.env.EXPO_OS === 'web' ? null : require('react-native-image-crop-picker').default;

import { Text } from '@/components/ui/Text';
import { trackEvent } from '@/lib/analytics/events';
import { extractColors, ExtractError } from '@/lib/color/extract';
import { updatePaletteColors, updatePaletteImage } from '@/lib/db/palettes';
import { optimize, thumbnail } from '@/lib/utils/image';
import { Colors, Radius, Spacing } from '@/lib/tokens';
import type { ExtractedColor } from '@/types/palette';

type AspectRatio = '1:1' | '4:5' | '9:16' | 'original';

const ASPECT_SIZES: Record<AspectRatio, { width: number; height: number } | null> = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
  original: null,
};

const RATIOS: AspectRatio[] = ['1:1', '4:5', '9:16', 'original'];

interface Props {
  paletteId: string;
  imageUri: string;
  onImageUpdated: (updates: { imageUri: string; thumbnailUri: string; colors: ExtractedColor[] }) => void;
}

export function CropTab({ paletteId, imageUri, onImageUpdated }: Props) {
  const [cropping, setCropping] = useState<AspectRatio | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRatioPress(ratio: AspectRatio) {
    if (cropping) return;
    setCropping(ratio);
    setError(null);

    if (!ImageCropPicker) {
      setError('Recortar no está disponible en esta plataforma.');
      setCropping(null);
      return;
    }

    try {
      const sizes = ASPECT_SIZES[ratio];
      const cropResult = await ImageCropPicker.openCropper({
        path: imageUri,
        ...(sizes ? { width: sizes.width, height: sizes.height } : { freeStyleCropEnabled: true }),
        mediaType: 'photo',
        cropperToolbarTitle: 'Recortar',
        cropperChooseText: 'Confirmar',
        cropperCancelText: 'Cancelar',
        includeExif: false,
        compressImageQuality: 1,
      });

      const [optimizedUri, thumbUri] = await Promise.all([
        optimize(cropResult.path),
        thumbnail(cropResult.path),
      ]);

      const { imageUri: newImageUri, thumbnailUri: newThumbnailUri } = await updatePaletteImage(
        paletteId,
        optimizedUri,
        thumbUri
      );

      let colors: ExtractedColor[] = [];
      try {
        colors = await extractColors(newThumbnailUri);
        await updatePaletteColors(paletteId, colors);
      } catch (extractErr) {
        const reason = extractErr instanceof ExtractError ? extractErr.message : 'unknown';
        trackEvent('extract_failed', { reason });
        Sentry.captureException(extractErr);
      }

      trackEvent('config_changed', { config_key: 'crop_ratio' });
      onImageUpdated({ imageUri: newImageUri, thumbnailUri: newThumbnailUri, colors });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isUserCancel =
        msg.toLowerCase().includes('user cancelled') || msg.toLowerCase().includes('user did not grant');

      if (!isUserCancel) {
        Sentry.captureException(err);
        setError('No se pudo recortar la foto. Intentalo de nuevo.');
      }
    } finally {
      setCropping(null);
    }
  }

  return (
    <View>
      {error !== null && (
        <View style={styles.errorBanner}>
          <Text variant="small" color={Colors.error}>{error}</Text>
        </View>
      )}
      <View style={styles.row}>
        {RATIOS.map((ratio) => (
          <TouchableOpacity
            key={ratio}
            style={styles.pill}
            onPress={() => handleRatioPress(ratio)}
            disabled={cropping !== null}
          >
            <Text variant="small" color={Colors.textPrimary}>
              {cropping === ratio ? '...' : ratio}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: Spacing.md },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
    marginRight: Spacing.sm,
  },
  errorBanner: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
});
