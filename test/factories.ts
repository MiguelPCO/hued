import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import type { ExtractedColor, LayoutConfig, Palette } from '@/types/palette';

const HEXES = ['#FFF6E8', '#FDDCA9', '#E76219', '#C21717', '#562717', '#3A1A0F', '#16A34A', '#2563EB'];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function makeColor(overrides: Partial<ExtractedColor> = {}): ExtractedColor {
  return {
    hex: '#C21717',
    rgb: [194, 23, 23],
    lab: [40, 60, 45],
    name: 'Rojo',
    hslLightness: 0.43,
    weight: 0.2,
    ...overrides,
  };
}

/** `count` colores distintos, ordenados de claro a oscuro como los deja `extractColors`. */
export function makeColors(count: number): ExtractedColor[] {
  return Array.from({ length: count }, (_, i) => {
    const hex = HEXES[i % HEXES.length];
    return makeColor({
      hex,
      rgb: hexToRgb(hex),
      lab: [100 - (i * 80) / Math.max(count, 1), 0, 0],
      name: `Color ${i + 1}`,
      hslLightness: 1 - i / Math.max(count, 1),
      weight: 1 / count,
    });
  });
}

export function makeLayoutConfig(overrides: Partial<LayoutConfig> = {}): LayoutConfig {
  return { ...DEFAULT_LAYOUT_CONFIG, ...overrides };
}

export function makePalette(overrides: Partial<Palette> = {}): Palette {
  return {
    id: 'p1',
    imageUri: 'file:///documents/palettes/p1/full.jpg',
    thumbnailUri: 'file:///documents/palettes/p1/thumb.jpg',
    colors: makeColors(5),
    layoutConfig: makeLayoutConfig(),
    collectionId: null,
    meta: { capturedAt: 1000, source: 'gallery', aspectRatio: 'original' },
    createdAt: 1000,
    updatedAt: 1000,
    isFavorite: false,
    exportCount: 0,
    ...overrides,
  };
}
