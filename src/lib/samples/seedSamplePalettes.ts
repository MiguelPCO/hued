import { Asset } from 'expo-asset';

import { baseStyleConfig } from '@/components/compose/archetypes/cardLayouts';
import { SAMPLE_COLLECTION_NAME, SAMPLE_PALETTES, sampleWeights } from '@/data/samplePalettes';
import { rgbToHsl, rgbToLab } from '@/lib/color/colorMath';
import { findColorName } from '@/lib/color/colorNames';
import { createCollection } from '@/lib/db/collections';
import { listPalettes, savePalette, setPaletteCollection } from '@/lib/db/palettes';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { thumbnail } from '@/lib/utils/image';
import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import type { ExtractedColor } from '@/types/palette';

// Metro needs static require() paths; order matches SAMPLE_PALETTES.
const SAMPLE_IMAGES = [
  require('../../../assets/samples/sample-1.jpg'),
  require('../../../assets/samples/sample-2.jpg'),
  require('../../../assets/samples/sample-3.jpg'),
  require('../../../assets/samples/sample-4.jpg'),
  require('../../../assets/samples/sample-5.jpg'),
  require('../../../assets/samples/sample-6.jpg'),
  require('../../../assets/samples/sample-7.jpg'),
  require('../../../assets/samples/sample-8.jpg'),
  require('../../../assets/samples/sample-9.jpg'),
  require('../../../assets/samples/sample-10.jpg'),
] as number[];

function toExtractedColors(hexes: string[]): ExtractedColor[] {
  const weights = sampleWeights(hexes.length);
  return hexes
    .map((hex, i): ExtractedColor => {
      const rgb: [number, number, number] = [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
      const lab = rgbToLab(...rgb);
      return {
        hex: hex.toUpperCase(),
        rgb,
        lab,
        name: findColorName(lab),
        hslLightness: rgbToHsl(...rgb)[2],
        weight: weights[i],
      };
    })
    .sort((a, b) => b.lab[0] - a.lab[0]); // same ordering as extractColors
}

let inFlight: Promise<void> | null = null;

/**
 * Seeds the starter palettes once, on first launch. A non-empty library
 * (existing user) is left untouched. The flag is persisted only after a
 * full seed or an empty-check skip, so a failed attempt retries next time.
 */
export function seedSamplePalettesOnce(): Promise<void> {
  if (useSettingsStore.getState().samplesSeeded) return Promise.resolve();
  inFlight ??= seed().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function seed(): Promise<void> {
  const { markSamplesSeeded } = useSettingsStore.getState();
  if ((await listPalettes()).length > 0) {
    markSamplesSeeded();
    return;
  }

  const collection = await createCollection(SAMPLE_COLLECTION_NAME);
  // Reverse: listPalettes orders by created_at DESC, so the first sample is saved last and shows first.
  for (const i of [...SAMPLE_PALETTES.keys()].reverse()) {
    const sample = SAMPLE_PALETTES[i];
    const asset = Asset.fromModule(SAMPLE_IMAGES[i]);
    await asset.downloadAsync();
    const imageUri = asset.localUri ?? asset.uri;

    const palette = await savePalette({
      imageUri,
      thumbnailUri: await thumbnail(imageUri),
      colors: toExtractedColors(sample.hexes),
      layoutConfig: {
        ...DEFAULT_LAYOUT_CONFIG,
        ...baseStyleConfig(sample.archetypeId, sample.hexes.length),
        archetypeId: sample.archetypeId,
        paletteSize: sample.hexes.length,
      },
      meta: { capturedAt: Date.now(), source: 'sample', aspectRatio: 'original' },
    });
    await setPaletteCollection(palette.id, collection.id);
  }
  markSamplesSeeded();
}
