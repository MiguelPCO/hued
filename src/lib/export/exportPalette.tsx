import { Group, ImageFormat, RoundedRect, Skia, drawAsImage, rect, rrect } from '@shopify/react-native-skia';
import type { SkImage } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';

import { BannerArchetype } from '@/components/compose/archetypes/BannerArchetype';
import { EditorialArchetype } from '@/components/compose/archetypes/EditorialArchetype';
import { GridArchetype } from '@/components/compose/archetypes/GridArchetype';
import { SideArchetype } from '@/components/compose/archetypes/SideArchetype';
import { StripArchetype } from '@/components/compose/archetypes/StripArchetype';
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

function renderArchetype(palette: Palette, config: LayoutConfig, image: SkImage | null) {
  const archetypeProps = { palette, config, width: CANVAS_W, height: CANVAS_H, image };
  switch (config.archetypeId) {
    case 'strip':
      return <StripArchetype {...archetypeProps} />;
    case 'editorial':
      return <EditorialArchetype {...archetypeProps} />;
    case 'grid':
      return <GridArchetype {...archetypeProps} />;
    case 'banner':
      return <BannerArchetype {...archetypeProps} />;
    case 'side':
      return <SideArchetype {...archetypeProps} />;
  }
}

export async function exportPalette(
  palette: Palette,
  config: LayoutConfig,
  resolution: ExportResolution
): Promise<string> {
  const { width, height } = RESOLUTIONS[resolution];
  const scale = width / CANVAS_W;
  const clip = rrect(rect(0, 0, CANVAS_W, CANVAS_H), config.cornerRadius, config.cornerRadius);

  let image: SkImage | null = null;
  try {
    const imageData = await Skia.Data.fromURI(palette.imageUri);
    image = imageData ? Skia.Image.MakeImageFromEncoded(imageData) : null;
  } catch {
    image = null;
  }

  const element = (
    <Group transform={[{ scale }]}>
      <Group clip={clip}>{renderArchetype(palette, config, image)}</Group>
      {config.cardStyle === 'outlined' && (
        <RoundedRect
          x={1}
          y={1}
          width={CANVAS_W - 2}
          height={CANVAS_H - 2}
          r={config.cornerRadius}
          color="transparent"
          strokeWidth={2}
          style="stroke"
        />
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
