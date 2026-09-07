import { Group, ImageFormat, Skia, drawAsImage } from '@shopify/react-native-skia';
import type { SkImage } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';

import { getCardFrame, shouldRenderWatermark } from '@/components/compose/archetypes/shared';
import { Watermark } from '@/components/compose/archetypes/Watermark';
import { ARCHETYPES } from '@/data/archetypes';
import { useSettingsStore } from '@/lib/store/settingsStore';
import type { LayoutConfig, Palette } from '@/types/palette';

export type ExportResolution = '1x' | '2x' | '4x';

// Base design-unit canvas size — must match ArchetypeCanvas.tsx's CANVAS_W/CANVAS_H.
// All archetype components draw proportionally within these units; export just
// asks Skia to rasterize the same tree at a larger pixel size.
const CANVAS_W = 360;
const CANVAS_H = 450;

export const RESOLUTIONS: Record<ExportResolution, { width: number; height: number }> = {
  '1x': { width: 1080, height: 1350 },
  '2x': { width: 2160, height: 2700 },
  '4x': { width: 4320, height: 5400 },
};

export async function exportPalette(
  palette: Palette,
  config: LayoutConfig,
  resolution: ExportResolution
): Promise<string> {
  const { width, height } = RESOLUTIONS[resolution];
  const scale = width / CANVAS_W;
  const { clip, overlay } = getCardFrame(config, CANVAS_W, CANVAS_H);
  const subscriptionStatus = useSettingsStore.getState().subscriptionStatus;

  let image: SkImage | null = null;
  try {
    const imageData = await Skia.Data.fromURI(palette.imageUri);
    image = imageData ? Skia.Image.MakeImageFromEncoded(imageData) : null;
  } catch {
    image = null;
  }

  const { Component } = ARCHETYPES[config.archetypeId];
  const archetypeProps = { palette, config, width: CANVAS_W, height: CANVAS_H, image };

  const element = (
    <Group transform={[{ scale }]}>
      <Group clip={clip}>
        <Component {...archetypeProps} />
      </Group>
      {overlay}
      {shouldRenderWatermark(config.watermarkVisible, subscriptionStatus) && (
        <Watermark width={CANVAS_W} height={CANVAS_H} cornerRadius={config.cornerRadius} />
      )}
    </Group>
  );

  const rendered = await drawAsImage(element, { width, height });
  const base64 = rendered.encodeToBase64(ImageFormat.PNG, 100);

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error('FileSystem.cacheDirectory is null');
  const uri = `${cacheDir}hued-export-${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: 'base64' });

  return uri;
}
