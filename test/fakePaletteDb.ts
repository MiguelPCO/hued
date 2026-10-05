import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import type { ExtractedColor, LayoutConfig, Palette, PaletteMeta } from '@/types/palette';

// Filas como JSON, igual que SQLite: un `Palette` que entra y sale pierde referencias
// y funciones, así que los tests detectan estado que "solo vive en memoria".
const rows = new Map<string, string>();
let counter = 0;

export function resetFakePaletteDb(): void {
  rows.clear();
  counter = 0;
}

export function peekPalette(id: string): Palette | undefined {
  const raw = rows.get(id);
  return raw ? (JSON.parse(raw) as Palette) : undefined;
}

export function seedPalette(palette: Palette): void {
  rows.set(palette.id, JSON.stringify(palette));
}

// Como los UPDATE reales (`updated_at = Date.now()`).
function update(id: string, change: (p: Palette) => void): void {
  const palette = peekPalette(id);
  if (!palette) return;
  change(palette);
  palette.updatedAt = Date.now();
  seedPalette(palette);
}

// Como `rowToPalette`: los campos de layout que no existían al guardar se rellenan con los defaults.
function withDefaults(palette: Palette): Palette {
  return { ...palette, layoutConfig: { ...DEFAULT_LAYOUT_CONFIG, ...palette.layoutConfig } };
}

interface SaveParams {
  imageUri: string;
  thumbnailUri: string;
  colors: ExtractedColor[];
  layoutConfig: LayoutConfig;
  meta: PaletteMeta;
}

export const savePalette = jest.fn(async (params: SaveParams): Promise<Palette> => {
  counter += 1;
  const id = `P${String(counter).padStart(3, '0')}`;
  const now = Date.now();
  const palette: Palette = {
    id,
    imageUri: `file:///documents/palettes/${id}/full.jpg`,
    thumbnailUri: `file:///documents/palettes/${id}/thumb.jpg`,
    colors: params.colors,
    layoutConfig: params.layoutConfig,
    collectionId: null,
    meta: params.meta,
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    exportCount: 0,
  };
  seedPalette(palette);
  return JSON.parse(JSON.stringify(palette)) as Palette;
});

export const getPalette = jest.fn(async (id: string): Promise<Palette | null> => {
  const palette = peekPalette(id);
  if (!palette) return null;
  return withDefaults(palette);
});

// `ORDER BY created_at DESC`.
export const listPalettes = jest.fn(async (): Promise<Palette[]> =>
  [...rows.values()]
    .map((raw) => withDefaults(JSON.parse(raw) as Palette))
    .sort((a, b) => b.createdAt - a.createdAt)
);

export const updatePaletteColors = jest.fn(async (id: string, colors: ExtractedColor[]) => {
  update(id, (p) => { p.colors = colors; });
});

export const updatePaletteLayout = jest.fn(async (id: string, config: LayoutConfig) => {
  update(id, (p) => { p.layoutConfig = config; });
});

export const incrementExportCount = jest.fn(async (id: string) => {
  update(id, (p) => { p.exportCount += 1; });
});

export const deletePalette = jest.fn(async (id: string) => {
  rows.delete(id);
});
