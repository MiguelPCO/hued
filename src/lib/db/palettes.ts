// expo-file-system v19 (SDK 54) moved the imperative API (documentDirectory, copyAsync, etc.) to /legacy
import * as FileSystem from 'expo-file-system/legacy';
import { monotonicFactory } from 'ulidx';

import type { ExtractedColor, LayoutConfig, Palette, PaletteMeta } from '@/types/palette';
import { getDb } from './client';

const ulid = monotonicFactory();

interface SavePaletteParams {
  imageUri: string;
  thumbnailUri: string;
  colors: ExtractedColor[];
  layoutConfig: LayoutConfig;
  meta: PaletteMeta;
}

interface PaletteRow {
  id: string;
  image_uri: string;
  thumbnail_uri: string;
  colors: string;
  layout_config: string;
  meta: string;
  created_at: number;
  updated_at: number;
  is_favorite: number;
  export_count: number;
}

function rowToPalette(row: PaletteRow): Palette {
  return {
    id: row.id,
    imageUri: row.image_uri,
    thumbnailUri: row.thumbnail_uri,
    colors: JSON.parse(row.colors) as ExtractedColor[],
    layoutConfig: JSON.parse(row.layout_config) as LayoutConfig,
    meta: JSON.parse(row.meta) as PaletteMeta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isFavorite: row.is_favorite === 1,
    exportCount: row.export_count,
  };
}

export async function savePalette(params: SavePaletteParams): Promise<Palette> {
  const id = ulid();
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) throw new Error('FileSystem.documentDirectory is null');
  const dir = `${baseDir}palettes/${id}/`;

  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  await FileSystem.copyAsync({ from: params.imageUri, to: `${dir}full.jpg` });
  await FileSystem.copyAsync({ from: params.thumbnailUri, to: `${dir}thumb.jpg` });

  const now = Date.now();
  const palette: Palette = {
    id,
    imageUri: `${dir}full.jpg`,
    thumbnailUri: `${dir}thumb.jpg`,
    colors: params.colors,
    layoutConfig: params.layoutConfig,
    meta: params.meta,
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    exportCount: 0,
  };

  const db = await getDb();
  await db.runAsync(
    `INSERT INTO palettes
       (id, image_uri, thumbnail_uri, colors, layout_config, meta,
        created_at, updated_at, is_favorite, export_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    palette.imageUri,
    palette.thumbnailUri,
    JSON.stringify(palette.colors),
    JSON.stringify(palette.layoutConfig),
    JSON.stringify(palette.meta),
    now,
    now,
    0,
    0
  );

  return palette;
}

export async function getPalette(id: string): Promise<Palette | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PaletteRow>('SELECT * FROM palettes WHERE id = ?', id);
  return row ? rowToPalette(row) : null;
}

export async function listPalettes(): Promise<Palette[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PaletteRow>(
    'SELECT * FROM palettes ORDER BY created_at DESC'
  );
  return rows.map(rowToPalette);
}
