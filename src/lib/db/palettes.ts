// expo-file-system v19 (SDK 54) moved the imperative API (documentDirectory, copyAsync, etc.) to /legacy
import * as FileSystem from 'expo-file-system/legacy';
import { monotonicFactory } from 'ulidx';

import type { ExtractedColor, LayoutConfig, Palette, PaletteMeta } from '@/types/palette';
import { getDb } from './client';

const ulid = monotonicFactory(() => Math.random());

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
  collection_id: string | null;
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
    collectionId: row.collection_id,
    meta: JSON.parse(row.meta) as PaletteMeta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isFavorite: row.is_favorite === 1,
    exportCount: row.export_count,
  };
}

async function insertPaletteRow(palette: Palette): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO palettes
       (id, image_uri, thumbnail_uri, colors, layout_config, collection_id, meta,
        created_at, updated_at, is_favorite, export_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    palette.id,
    palette.imageUri,
    palette.thumbnailUri,
    JSON.stringify(palette.colors),
    JSON.stringify(palette.layoutConfig),
    palette.collectionId,
    JSON.stringify(palette.meta),
    palette.createdAt,
    palette.updatedAt,
    palette.isFavorite ? 1 : 0,
    palette.exportCount
  );
}

/** Directory a palette's files live in, derived from its imageUri (`${dir}full.jpg`). */
function paletteDir(imageUri: string): string {
  return imageUri.slice(0, imageUri.lastIndexOf('/') + 1);
}

export async function savePalette(params: SavePaletteParams): Promise<Palette> {
  const id = ulid();
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) throw new Error('FileSystem.documentDirectory is null');
  const dir = `${baseDir}palettes/${id}/`;

  try {
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
      collectionId: null,
      meta: params.meta,
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
      exportCount: 0,
    };

    await insertPaletteRow(palette);
    return palette;
  } catch (err) {
    await FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => {});
    throw err;
  }
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

export async function updatePaletteColors(id: string, colors: ExtractedColor[]): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE palettes SET colors = ?, updated_at = ? WHERE id = ?',
    JSON.stringify(colors),
    Date.now(),
    id
  );
}

export async function updatePaletteLayout(id: string, config: LayoutConfig): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE palettes SET layout_config = ?, updated_at = ? WHERE id = ?',
    JSON.stringify(config),
    Date.now(),
    id
  );
}

export async function setPaletteCollection(id: string, collectionId: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE palettes SET collection_id = ?, updated_at = ? WHERE id = ?',
    collectionId,
    Date.now(),
    id
  );
}

export async function toggleFavorite(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE palettes SET is_favorite = NOT is_favorite, updated_at = ? WHERE id = ?',
    Date.now(),
    id
  );
}

export async function incrementExportCount(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE palettes SET export_count = export_count + 1, updated_at = ? WHERE id = ?',
    Date.now(),
    id
  );
}

export async function deletePalette(id: string): Promise<void> {
  const palette = await getPalette(id);
  const db = await getDb();
  await db.runAsync('DELETE FROM palettes WHERE id = ?', id);
  if (palette) {
    await FileSystem.deleteAsync(paletteDir(palette.imageUri), { idempotent: true }).catch(() => {});
  }
}

export async function duplicatePalette(id: string): Promise<Palette> {
  const source = await getPalette(id);
  if (!source) throw new Error(`Palette not found: ${id}`);

  const newId = ulid();
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) throw new Error('FileSystem.documentDirectory is null');
  const dir = `${baseDir}palettes/${newId}/`;

  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    await FileSystem.copyAsync({ from: source.imageUri, to: `${dir}full.jpg` });
    await FileSystem.copyAsync({ from: source.thumbnailUri, to: `${dir}thumb.jpg` });

    const now = Date.now();
    const duplicate: Palette = {
      id: newId,
      imageUri: `${dir}full.jpg`,
      thumbnailUri: `${dir}thumb.jpg`,
      colors: source.colors,
      layoutConfig: source.layoutConfig,
      collectionId: source.collectionId,
      meta: source.meta,
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
      exportCount: 0,
    };

    await insertPaletteRow(duplicate);
    return duplicate;
  } catch (err) {
    await FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => {});
    throw err;
  }
}
