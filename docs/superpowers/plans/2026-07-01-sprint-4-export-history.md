# Sprint 4 (Export + History) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User can export the composed palette as a PNG (1x/2x/4x), save it to the camera roll, share it via the native share sheet, and manage saved palettes (favorite, search, duplicate, delete) from the History grid.

**Architecture:** Skia's `drawAsImage()` offscreen renderer produces the export PNG directly from the same archetype components used for the on-screen preview — no new mounted canvas, no `react-native-view-shot`. History management (favorite/duplicate/delete) is three new functions in the existing `src/lib/db/palettes.ts`, wired into `PaletteCard`'s long-press action sheet (reusing the existing `Sheet` primitive, unused until now). Search and the favorites filter are pure client-side filters over the already-fetched palette list — no schema or query changes.

**Tech Stack:** `@shopify/react-native-skia` (`drawAsImage`, `ImageFormat`), `expo-media-library` (~18.2.1, newly installed), `expo-sharing` (~14.0.8, newly installed), `expo-file-system/legacy`, existing `expo-sqlite` + Zustand-free local state.

## Global Constraints

- No watermark logic — deferred to Sprint 5 (no free/premium distinction exists yet). Do not add any tier-gating.
- No `react-native-view-shot` dependency — use Skia's `drawAsImage()`.
- No new Expo Router routes for export or the action sheet — both are in-page `Sheet` overlays (`src/components/ui/Sheet.tsx`).
- Search is client-side (filter the already-loaded `Palette[]` array), not SQL `LIKE`.
- No native `Alert.alert`/confirm dialogs — every confirm/error UI is inline, matching the rest of the codebase (see `app/crop.tsx`, `CameraView.tsx` permission-denial patterns).
- Every new async DB/FS function follows the existing `savePalette` pattern: wrap side effects in try/catch, clean up partial state on failure.
- Don't invent analytics events beyond what's already typed in `src/lib/analytics/events.ts`'s `EventMap` (`palette_exported`, `palette_shared` — no new event for "duplicate").
- All new/modified files must pass `npx tsc --noEmit` with zero errors before each commit.

---

## Task 1: Install export dependencies and configure permissions

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (already updated in the working tree by `npx expo install`, not yet committed)
- Modify: `app.json`

**Interfaces:**
- Produces: `expo-media-library` and `expo-sharing` importable from any file; Android/iOS permission strings configured so `MediaLibrary.requestPermissionsAsync()` shows the correct prompt.

- [ ] **Step 1: Verify the dependencies are already installed**

Run: `cat package.json | grep -E "expo-media-library|expo-sharing"`
Expected output:
```
    "expo-media-library": "~18.2.1",
    "expo-sharing": "~14.0.8",
```
If missing, run: `npx expo install expo-media-library expo-sharing`

- [ ] **Step 2: Add the `expo-media-library` config plugin to `app.json`**

Open `app.json`. Find the `"plugins"` array (currently ends with the `expo-image-picker` entry). Add a new entry after it:

```json
      [
        "expo-image-picker",
        {
          "photosPermission": "Hued necesita acceso a tu galería para crear paletas desde tus fotos."
        }
      ],
      [
        "expo-media-library",
        {
          "photosPermission": "Hued necesita acceso a tus fotos para guardar las paletas exportadas.",
          "savePhotosPermission": "Hued necesita acceso a tus fotos para guardar las paletas exportadas.",
          "isAccessMediaLocationEnabled": false
        }
      ]
```

The full `"plugins"` array must read:

```json
    "plugins": [
      "expo-router",
      "@sentry/react-native",
      "expo-localization",
      "expo-sqlite",
      [
        "expo-camera",
        {
          "cameraPermission": "Hued necesita la cámara para capturar fotos y crear paletas de colores."
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Hued necesita acceso a tu galería para crear paletas desde tus fotos."
        }
      ],
      [
        "expo-media-library",
        {
          "photosPermission": "Hued necesita acceso a tus fotos para guardar las paletas exportadas.",
          "savePhotosPermission": "Hued necesita acceso a tus fotos para guardar las paletas exportadas.",
          "isAccessMediaLocationEnabled": false
        }
      ]
    ]
```

`expo-sharing` needs no plugin entry (no config plugin ships with it).

- [ ] **Step 3: Verify JSON is valid and typecheck passes**

Run: `node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('valid json')"`
Expected: `valid json`

Run: `npx tsc --noEmit`
Expected: no output, exit code 0

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml app.json
git commit -m "Add expo-media-library and expo-sharing for palette export"
```

---

## Task 2: History DB functions (favorite, duplicate, delete, export count)

**Files:**
- Modify: `src/lib/db/palettes.ts`
- Create: `src/lib/db/__tests__/palettes-history.test.ts`

**Interfaces:**
- Consumes: `getDb()` from `./client` (mocked in tests), `Palette`/`PaletteMeta` types from `@/types/palette`.
- Produces:
  - `toggleFavorite(id: string): Promise<void>`
  - `incrementExportCount(id: string): Promise<void>`
  - `deletePalette(id: string): Promise<void>`
  - `duplicatePalette(id: string): Promise<Palette>`
  - (internal refactor) `insertPaletteRow(palette: Palette): Promise<void>` — private, not exported, used by both `savePalette` and `duplicatePalette`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/db/__tests__/palettes-history.test.ts`:

```typescript
import * as FileSystem from 'expo-file-system/legacy';

import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import {
  toggleFavorite,
  incrementExportCount,
  deletePalette,
  duplicatePalette,
} from '../palettes';
import { getDb } from '../client';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../client');

const mockDb = {
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
};
(getDb as jest.Mock).mockResolvedValue(mockDb);

const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;

const sourceRow = {
  id: '01HX1234567890ABCDEFGHIJKL',
  image_uri: 'file:///documents/palettes/01HX1234567890ABCDEFGHIJKL/full.jpg',
  thumbnail_uri: 'file:///documents/palettes/01HX1234567890ABCDEFGHIJKL/thumb.jpg',
  colors: '[]',
  layout_config: JSON.stringify(DEFAULT_LAYOUT_CONFIG),
  meta: JSON.stringify({ capturedAt: 1000, source: 'camera', aspectRatio: 'original' }),
  created_at: 1000,
  updated_at: 1000,
  is_favorite: 0,
  export_count: 2,
};

beforeEach(() => jest.clearAllMocks());

describe('toggleFavorite', () => {
  it('runs an UPDATE flipping is_favorite', async () => {
    await toggleFavorite('palette-1');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('is_favorite = NOT is_favorite'),
      expect.any(Number),
      'palette-1'
    );
  });
});

describe('incrementExportCount', () => {
  it('runs an UPDATE incrementing export_count', async () => {
    await incrementExportCount('palette-1');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('export_count = export_count + 1'),
      expect.any(Number),
      'palette-1'
    );
  });
});

describe('deletePalette', () => {
  it('deletes the row and the palette directory', async () => {
    mockDb.getFirstAsync.mockResolvedValue(sourceRow);

    await deletePalette('01HX1234567890ABCDEFGHIJKL');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM palettes'),
      '01HX1234567890ABCDEFGHIJKL'
    );
    expect(mockFs.deleteAsync).toHaveBeenCalledWith(
      'file:///documents/palettes/01HX1234567890ABCDEFGHIJKL/',
      { idempotent: true }
    );
  });

  it('does not throw if the palette row is already gone', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    await expect(deletePalette('missing-id')).resolves.toBeUndefined();
    expect(mockFs.deleteAsync).not.toHaveBeenCalled();
  });
});

describe('duplicatePalette', () => {
  it('copies both files into a new directory and inserts a new row', async () => {
    mockDb.getFirstAsync.mockResolvedValue(sourceRow);

    const duplicate = await duplicatePalette('01HX1234567890ABCDEFGHIJKL');

    expect(mockFs.makeDirectoryAsync).toHaveBeenCalledWith(
      expect.stringContaining('palettes/'),
      { intermediates: true }
    );
    expect(mockFs.copyAsync).toHaveBeenCalledWith({
      from: sourceRow.image_uri,
      to: expect.stringContaining('full.jpg'),
    });
    expect(mockFs.copyAsync).toHaveBeenCalledWith({
      from: sourceRow.thumbnail_uri,
      to: expect.stringContaining('thumb.jpg'),
    });
    expect(duplicate.id).not.toBe('01HX1234567890ABCDEFGHIJKL');
    expect(duplicate.isFavorite).toBe(false);
    expect(duplicate.exportCount).toBe(0);
  });

  it('inserts a row with the same colors and layoutConfig as the source', async () => {
    mockDb.getFirstAsync.mockResolvedValue(sourceRow);

    await duplicatePalette('01HX1234567890ABCDEFGHIJKL');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO palettes'),
      expect.any(String),
      expect.stringContaining('full.jpg'),
      expect.stringContaining('thumb.jpg'),
      '[]',
      JSON.stringify(DEFAULT_LAYOUT_CONFIG),
      sourceRow.meta,
      expect.any(Number),
      expect.any(Number),
      0,
      0
    );
  });

  it('throws if the source palette does not exist', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    await expect(duplicatePalette('missing-id')).rejects.toThrow('Palette not found');
  });

  it('cleans up the new directory if the DB insert fails', async () => {
    mockDb.getFirstAsync.mockResolvedValue(sourceRow);
    mockDb.runAsync.mockRejectedValueOnce(new Error('db down'));

    await expect(duplicatePalette('01HX1234567890ABCDEFGHIJKL')).rejects.toThrow('db down');
    expect(mockFs.deleteAsync).toHaveBeenCalledWith(
      expect.stringContaining('palettes/'),
      { idempotent: true }
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/lib/db/__tests__/palettes-history.test.ts`
Expected: FAIL — `toggleFavorite`, `incrementExportCount`, `deletePalette`, `duplicatePalette` are not exported from `../palettes`.

- [ ] **Step 3: Refactor `savePalette` to extract a shared insert helper, then add the four new functions**

Open `src/lib/db/palettes.ts`. Replace the whole file with:

```typescript
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

async function insertPaletteRow(palette: Palette): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO palettes
       (id, image_uri, thumbnail_uri, colors, layout_config, meta,
        created_at, updated_at, is_favorite, export_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    palette.id,
    palette.imageUri,
    palette.thumbnailUri,
    JSON.stringify(palette.colors),
    JSON.stringify(palette.layoutConfig),
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
```

- [ ] **Step 4: Run the new tests and the existing suite to verify nothing broke**

Run: `npx jest src/lib/db/__tests__/`
Expected: all test files PASS, including the pre-existing `palettes.test.ts` and `palettes-update.test.ts` (the `insertPaletteRow` refactor must produce byte-identical SQL/args to what those tests already assert).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/palettes.ts src/lib/db/__tests__/palettes-history.test.ts
git commit -m "Add favorite, duplicate, delete, and export-count DB functions"
```

---

## Task 3: Client-side search filter

**Files:**
- Create: `src/lib/search/normalize.ts`
- Create: `src/lib/search/__tests__/normalize.test.ts`

**Interfaces:**
- Produces:
  - `normalize(text: string): string`
  - `paletteMatchesQuery(colorNames: string[], query: string): boolean`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/search/__tests__/normalize.test.ts`:

```typescript
import { normalize, paletteMatchesQuery } from '../normalize';

describe('normalize', () => {
  it('lowercases text', () => {
    expect(normalize('ROJO')).toBe('rojo');
  });

  it('strips diacritics', () => {
    expect(normalize('Índigo')).toBe('indigo');
    expect(normalize('Añil')).toBe('anil');
  });
});

describe('paletteMatchesQuery', () => {
  const colorNames = ['Índigo Profundo', 'Coral Suave', 'Azul Marino'];

  it('matches when a color name contains the query, case/accent-insensitive', () => {
    expect(paletteMatchesQuery(colorNames, 'indigo')).toBe(true);
    expect(paletteMatchesQuery(colorNames, 'INDIGO')).toBe(true);
    expect(paletteMatchesQuery(colorNames, 'profundo')).toBe(true);
  });

  it('returns false when no color name contains the query', () => {
    expect(paletteMatchesQuery(colorNames, 'verde')).toBe(false);
  });

  it('returns true for an empty or whitespace-only query', () => {
    expect(paletteMatchesQuery(colorNames, '')).toBe(true);
    expect(paletteMatchesQuery(colorNames, '   ')).toBe(true);
  });

  it('returns false for an empty color list with a non-empty query', () => {
    expect(paletteMatchesQuery([], 'rojo')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/lib/search/__tests__/normalize.test.ts`
Expected: FAIL — `Cannot find module '../normalize'`

- [ ] **Step 3: Implement**

Create `src/lib/search/normalize.ts`:

```typescript
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function paletteMatchesQuery(colorNames: string[], query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  const normalizedQuery = normalize(trimmed);
  return colorNames.some((name) => normalize(name).includes(normalizedQuery));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/lib/search/__tests__/normalize.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0

- [ ] **Step 6: Commit**

```bash
git add src/lib/search/normalize.ts src/lib/search/__tests__/normalize.test.ts
git commit -m "Add client-side palette search normalization"
```

---

## Task 4: Export pipeline (`exportPalette`)

**Files:**
- Create: `src/lib/export/exportPalette.ts`
- Create: `src/lib/export/__tests__/exportPalette.test.ts`

**Interfaces:**
- Consumes: `Palette`, `LayoutConfig` from `@/types/palette`; the 5 archetype components from `@/components/compose/archetypes/*`.
- Produces:
  - `type ExportResolution = '1x' | '2x' | '4x'`
  - `RESOLUTIONS: Record<ExportResolution, { width: number; height: number }>` (exported — Task 5's resolution picker UI needs the pixel dimensions to display as subtitles)
  - `exportPalette(palette: Palette, config: LayoutConfig, resolution: ExportResolution): Promise<string>` — returns a `file://` URI

- [ ] **Step 1: Write the failing test**

Create `src/lib/export/__tests__/exportPalette.test.ts`:

```typescript
import * as FileSystem from 'expo-file-system/legacy';
import { drawAsImage } from '@shopify/react-native-skia';

import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import type { Palette } from '@/types/palette';
import { exportPalette, RESOLUTIONS } from '../exportPalette';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@shopify/react-native-skia', () => ({
  drawAsImage: jest.fn().mockResolvedValue({ encodeToBase64: jest.fn().mockReturnValue('base64-png-data') }),
  ImageFormat: { PNG: 4 },
  Group: 'Group',
  RoundedRect: 'RoundedRect',
  rrect: jest.fn(),
  rect: jest.fn(),
}));

const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;
const mockDrawAsImage = drawAsImage as jest.Mock;

const palette: Palette = {
  id: 'p1',
  imageUri: 'file:///documents/palettes/p1/full.jpg',
  thumbnailUri: 'file:///documents/palettes/p1/thumb.jpg',
  colors: [],
  layoutConfig: DEFAULT_LAYOUT_CONFIG,
  meta: { capturedAt: 1000, source: 'camera', aspectRatio: 'original' },
  createdAt: 1000,
  updatedAt: 1000,
  isFavorite: false,
  exportCount: 0,
};

beforeEach(() => jest.clearAllMocks());

describe('RESOLUTIONS', () => {
  it('defines the three export sizes at 4:5 aspect ratio', () => {
    expect(RESOLUTIONS['1x']).toEqual({ width: 1080, height: 1350 });
    expect(RESOLUTIONS['2x']).toEqual({ width: 2160, height: 2700 });
    expect(RESOLUTIONS['4x']).toEqual({ width: 4320, height: 5400 });
  });
});

describe('exportPalette', () => {
  it('calls drawAsImage with the resolution matching the requested size', async () => {
    await exportPalette(palette, DEFAULT_LAYOUT_CONFIG, '2x');
    expect(mockDrawAsImage).toHaveBeenCalledWith(
      expect.anything(),
      { width: 2160, height: 2700 }
    );
  });

  it('writes the encoded base64 PNG to a cache file and returns its URI', async () => {
    const uri = await exportPalette(palette, DEFAULT_LAYOUT_CONFIG, '1x');

    expect(mockFs.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('file:///cache/'),
      'base64-png-data',
      { encoding: 'base64' }
    );
    expect(uri).toEqual(expect.stringContaining('file:///cache/'));
    expect(uri).toMatch(/\.png$/);
  });

  it('throws if cacheDirectory is unavailable', async () => {
    mockFs.cacheDirectory = null as unknown as string;
    await expect(exportPalette(palette, DEFAULT_LAYOUT_CONFIG, '1x')).rejects.toThrow(
      'FileSystem.cacheDirectory is null'
    );
    mockFs.cacheDirectory = 'file:///cache/';
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/lib/export/__tests__/exportPalette.test.ts`
Expected: FAIL — `Cannot find module '../exportPalette'`

- [ ] **Step 3: Implement**

Create `src/lib/export/exportPalette.ts`:

```typescript
import { Group, ImageFormat, RoundedRect, drawAsImage, rect, rrect } from '@shopify/react-native-skia';
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

function renderArchetype(palette: Palette, config: LayoutConfig) {
  const archetypeProps = { palette, config, width: CANVAS_W, height: CANVAS_H };
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

  const element = (
    <Group transform={[{ scale }]}>
      <Group clip={clip}>{renderArchetype(palette, config)}</Group>
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

  const image = await drawAsImage(element, { width, height });
  const base64 = image.encodeToBase64(ImageFormat.PNG, 100);

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error('FileSystem.cacheDirectory is null');
  const uri = `${cacheDir}hued-export-${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: 'base64' });

  return uri;
}
```

Note: this file has a `.ts` extension but contains JSX — rename it to `exportPalette.tsx` (both the test file's import path `'../exportPalette'` and this implementation file's actual name). Create the file as `src/lib/export/exportPalette.tsx`, not `.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/lib/export/__tests__/exportPalette.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0

- [ ] **Step 6: Commit**

```bash
git add src/lib/export/exportPalette.tsx src/lib/export/__tests__/exportPalette.test.ts
git commit -m "Add Skia-based palette export to PNG"
```

---

## Task 5: Export UI in the compose screen

**Files:**
- Modify: `app/palette/[id].tsx`

**Interfaces:**
- Consumes: `exportPalette`, `RESOLUTIONS`, `ExportResolution` from `@/lib/export/exportPalette`; `incrementExportCount` from `@/lib/db/palettes`; `Sheet` from `@/components/ui/Sheet`; `MediaLibrary` from `expo-media-library`; `Sharing` from `expo-sharing`; `trackEvent` (existing).

- [ ] **Step 1: Add imports and export state**

In `app/palette/[id].tsx`, replace the import block (lines 1-21) with:

```typescript
import * as Sentry from '@sentry/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArchetypeCanvas } from '@/components/compose/ArchetypeCanvas';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { extractColors, ExtractError } from '@/lib/color/extract';
import { exportPalette, RESOLUTIONS } from '@/lib/export/exportPalette';
import type { ExportResolution } from '@/lib/export/exportPalette';
import { getPalette, incrementExportCount, updatePaletteColors, updatePaletteLayout } from '@/lib/db/palettes';
import { trackEvent } from '@/lib/analytics/events';
import { Colors, Spacing, Radius } from '@/lib/tokens';
import type { ArchetypeId, LayoutConfig, Palette } from '@/types/palette';

const ARCHETYPES: { id: ArchetypeId; label: string }[] = [
  { id: 'strip', label: 'Franja' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'grid', label: 'Cuadrícula' },
  { id: 'banner', label: 'Banner' },
  { id: 'side', label: 'Lateral' },
];

const RESOLUTION_LABELS: { value: ExportResolution; label: string }[] = [
  { value: '1x', label: '1×' },
  { value: '2x', label: '2×' },
  { value: '4x', label: '4×' },
];
```

- [ ] **Step 2: Add export state and the export handler inside `PaletteScreen`**

Find this block in `PaletteScreen` (currently right after the `handleRetry` function, before `if (loading) {`):

```typescript
  async function handleRetry() {
    if (!palette) return;
    setExtracting(true);
    try {
      const colors = await extractColors(palette.thumbnailUri);
      await updatePaletteColors(palette.id, colors);
      setPalette((p) => p ? { ...p, colors } : p);
    } catch (err) {
      const reason = err instanceof ExtractError ? err.message : 'unknown';
      trackEvent('extract_failed', { reason });
      Sentry.captureException(err);
    } finally {
      setExtracting(false);
    }
  }
```

Add this new state (near the top of `PaletteScreen`, alongside the existing `useState` calls) and the export handler right after `handleRetry`:

```typescript
  const [exportSheetVisible, setExportSheetVisible] = useState(false);
  const [exportState, setExportState] = useState<'idle' | 'exporting'>('idle');
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport(resolution: ExportResolution) {
    if (!palette || !config) return;
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
```

- [ ] **Step 3: Add the "Exportar" button and the resolution `Sheet`**

Find the closing of the ETIQUETAS section and the `bottomPad` view:

```typescript
        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}
```

Replace with (adds the button before `bottomPad`, and the `Sheet` after `</ScrollView>`):

```typescript
        <View style={styles.exportSection}>
          <Button
            label="Exportar"
            onPress={() => setExportSheetVisible(true)}
            variant="primary"
            fullWidth
          />
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

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
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Add the two new styles**

In the `styles = StyleSheet.create({...})` block, find `bottomPad: { height: Spacing.xl },` and add these entries right after it:

```typescript
  bottomPad: { height: Spacing.xl },
  exportSection: { marginTop: Spacing.lg, paddingHorizontal: Spacing.md },
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
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0

- [ ] **Step 6: Manual verification (no automated UI tests in this codebase)**

Run: `npx expo start`, open the app on a device/simulator, navigate to a saved palette, tap "Exportar", pick a resolution, confirm:
- permission prompt appears on first export
- PNG saves to camera roll
- native share sheet opens
- `exportCount` increments (check via a second export — no visible UI for the count yet, but no crash)

- [ ] **Step 7: Commit**

```bash
git add "app/palette/[id].tsx"
git commit -m "Add export button and resolution picker to compose screen"
```

---

## Task 6: PaletteCard favorite icon and long-press action sheet

**Files:**
- Modify: `src/components/ui/Icon.tsx`
- Modify: `src/components/palette/PaletteCard.tsx`

**Interfaces:**
- Consumes: `toggleFavorite`, `duplicatePalette`, `deletePalette` from `@/lib/db/palettes`; `exportPalette` from `@/lib/export/exportPalette`; `Icon` from `@/components/ui/Icon`; `Sheet` from `@/components/ui/Sheet`.
- Produces: new props `onToggleFavorite: (id: string) => void`, `onDuplicated: (palette: Palette) => void`, `onDeleted: (id: string) => void` — parent (`PaletteGrid`, Task 7) owns the source-of-truth list and reacts to these callbacks instead of `PaletteCard` refetching.

- [ ] **Step 1: Add a "duplicate" icon to the `IconName` whitelist**

`Icon.tsx` restricts `name` to a curated subset of MaterialIcons glyphs — none of the existing entries (`image`, `palette`, etc.) mean "duplicate". Add the correct one.

In `src/components/ui/Icon.tsx`, find the `IconName` union:

```typescript
export type IconName =
  | 'home'
  | 'camera-alt'
  | 'settings'
  | 'add'
  | 'favorite'
  | 'favorite-border'
  | 'share'
  | 'delete'
  | 'close'
  | 'check'
  | 'chevron-right'
  | 'chevron-left'
  | 'arrow-back'
  | 'image'
  | 'palette'
  | 'star'
  | 'star-border'
  | 'more-vert'
  | 'download'
  | 'lock';
```

Add `| 'content-copy'` after `'download'`:

```typescript
export type IconName =
  | 'home'
  | 'camera-alt'
  | 'settings'
  | 'add'
  | 'favorite'
  | 'favorite-border'
  | 'share'
  | 'delete'
  | 'close'
  | 'check'
  | 'chevron-right'
  | 'chevron-left'
  | 'arrow-back'
  | 'image'
  | 'palette'
  | 'star'
  | 'star-border'
  | 'more-vert'
  | 'download'
  | 'content-copy'
  | 'lock';
```

- [ ] **Step 2: Replace `PaletteCard.tsx` with the favorite icon and long-press sheet**

Replace the whole file:

```typescript
import { useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as Sharing from 'expo-sharing';

import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { exportPalette } from '@/lib/export/exportPalette';
import { deletePalette, duplicatePalette, toggleFavorite } from '@/lib/db/palettes';
import { Colors, Radius, Shadow, Spacing } from '@/lib/tokens';
import { formatDateEs } from '@/lib/utils/dateUtils';
import type { Palette } from '@/types/palette';

interface Props {
  palette: Palette;
  onPress: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onDuplicated: (palette: Palette) => void;
  onDeleted: (id: string) => void;
}

export function PaletteCard({ palette, onPress, onToggleFavorite, onDuplicated, onDeleted }: Props) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  function closeSheet() {
    setSheetVisible(false);
    setConfirmingDelete(false);
  }

  async function handleFavoriteTap() {
    onToggleFavorite(palette.id);
    try {
      await toggleFavorite(palette.id);
    } catch (err) {
      onToggleFavorite(palette.id); // revert optimistic update
      Sentry.captureException(err);
    }
  }

  async function handleDuplicate() {
    setBusy(true);
    try {
      const duplicate = await duplicatePalette(palette.id);
      onDuplicated(duplicate);
      closeSheet();
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    setBusy(true);
    try {
      const uri = await exportPalette(palette, palette.layoutConfig, '2x');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      }
      closeSheet();
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deletePalette(palette.id);
      onDeleted(palette.id);
      closeSheet();
    } catch (err) {
      Sentry.captureException(err);
      setBusy(false);
    }
  }

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={() => onPress(palette.id)}
        onLongPress={() => setSheetVisible(true)}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: palette.thumbnailUri }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        <TouchableOpacity style={styles.favoriteButton} onPress={handleFavoriteTap} hitSlop={8}>
          <Icon
            name={palette.isFavorite ? 'favorite' : 'favorite-border'}
            size={18}
            color={palette.isFavorite ? Colors.error : Colors.textInverse}
          />
        </TouchableOpacity>
        <View style={styles.colorStrip}>
          {palette.colors.slice(0, 5).map((color, i) => (
            <View key={i} style={[styles.swatch, { backgroundColor: color.hex }]} />
          ))}
          {palette.colors.length === 0 && (
            <View style={[styles.swatch, styles.swatchEmpty]} />
          )}
        </View>
        <View style={styles.footer}>
          <Text variant="small" color={Colors.textSecondary} numberOfLines={1}>
            {formatDateEs(palette.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>

      <Sheet visible={sheetVisible} onClose={closeSheet}>
        {confirmingDelete ? (
          <View>
            <Text variant="body" style={styles.sheetText}>
              ¿Eliminar esta paleta? Esta acción no se puede deshacer.
            </Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity style={styles.sheetAction} onPress={closeSheet} disabled={busy}>
                <Text variant="body">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetAction} onPress={handleDelete} disabled={busy}>
                <Text variant="body" color={Colors.error} weight="semibold">Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            <TouchableOpacity style={styles.sheetRow} onPress={handleFavoriteTap} disabled={busy}>
              <Icon name={palette.isFavorite ? 'favorite' : 'favorite-border'} size={20} />
              <Text variant="body">
                {palette.isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetRow} onPress={handleDuplicate} disabled={busy}>
              <Icon name="content-copy" size={20} />
              <Text variant="body">Duplicar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetRow} onPress={handleShare} disabled={busy}>
              <Icon name="share" size={20} />
              <Text variant="body">Compartir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => setConfirmingDelete(true)}
              disabled={busy}
            >
              <Icon name="delete" size={20} color={Colors.error} />
              <Text variant="body" color={Colors.error}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: Spacing.xs,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 1,
  },
  favoriteButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorStrip: {
    flexDirection: 'row',
    height: 20,
  },
  swatch: {
    flex: 1,
  },
  swatchEmpty: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  footer: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  sheetText: {
    marginBottom: Spacing.md,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.lg,
  },
  sheetAction: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `PaletteGrid.tsx` (Task 7 fixes these — `PaletteCard` now requires 3 new props it doesn't yet pass). This is expected at this point in the plan; do not fix `PaletteGrid.tsx` here.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Icon.tsx src/components/palette/PaletteCard.tsx
git commit -m "Add favorite toggle and long-press action sheet to PaletteCard"
```

(Committing with a known downstream typecheck error is acceptable here because Task 7 is the very next task in this plan and fixes it — if executing via subagent-driven-development, tell the reviewer this is expected and resolved by the next task.)

---

## Task 7: PaletteGrid filtering and card callbacks

**Files:**
- Modify: `src/components/palette/PaletteGrid.tsx`

**Interfaces:**
- Consumes: `paletteMatchesQuery` from `@/lib/search/normalize`; `PaletteCard`'s new props (Task 6).
- Produces: new props `filter: 'all' | 'favorites'`, `query: string` — consumed by `app/(tabs)/index.tsx` (Task 8).

- [ ] **Step 1: Replace `PaletteGrid.tsx`**

```typescript
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { PaletteCard } from './PaletteCard';
import { Colors, Radius, Spacing } from '@/lib/tokens';
import { listPalettes } from '@/lib/db/palettes';
import { paletteMatchesQuery } from '@/lib/search/normalize';
import type { Palette } from '@/types/palette';

interface Props {
  onPressPalette: (id: string) => void;
  filter: 'all' | 'favorites';
  query: string;
}

function SkeletonCard() {
  return <View style={styles.skeleton} />;
}

export function PaletteGrid({ onPressPalette, filter, query }: Props) {
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await listPalettes();
    setPalettes(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggleFavorite = useCallback((id: string) => {
    setPalettes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isFavorite: !p.isFavorite } : p))
    );
  }, []);

  const handleDuplicated = useCallback((duplicate: Palette) => {
    setPalettes((prev) => [duplicate, ...prev]);
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setPalettes((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const visible = useMemo(() => {
    return palettes
      .filter((p) => filter === 'all' || p.isFavorite)
      .filter((p) => paletteMatchesQuery(p.colors.map((c) => c.name), query));
  }, [palettes, filter, query]);

  if (loading) {
    return (
      <View style={styles.grid}>
        {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
      </View>
    );
  }

  return (
    <FlatList
      data={visible}
      keyExtractor={(p) => p.id}
      numColumns={2}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <PaletteCard
          palette={item}
          onPress={onPressPalette}
          onToggleFavorite={handleToggleFavorite}
          onDuplicated={handleDuplicated}
          onDeleted={handleDeleted}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.xs },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.xs,
  },
  skeleton: {
    flex: 1,
    margin: Spacing.xs,
    aspectRatio: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgSecondary,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `app/(tabs)/index.tsx` (`<PaletteGrid onPressPalette={...} />` is now missing required `filter`/`query` props — Task 8 fixes this). Expected at this point.

- [ ] **Step 3: Commit**

```bash
git add src/components/palette/PaletteGrid.tsx
git commit -m "Add client-side favorites filter and search to PaletteGrid"
```

---

## Task 8: Home tab search bar and filter pills

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `paletteMatchesQuery` indirectly via `PaletteGrid`'s new `filter`/`query` props (Task 7).

- [ ] **Step 1: Replace `app/(tabs)/index.tsx`**

```typescript
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { launchGalleryPicker } from '@/components/capture/GalleryPicker';
import { PaletteGrid } from '@/components/palette/PaletteGrid';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { listPalettes } from '@/lib/db/palettes';
import { Colors, Radius, Spacing } from '@/lib/tokens';

type Filter = 'all' | 'favorites';

export default function HomeScreen() {
  const [hasPalettes, setHasPalettes] = useState<boolean | null>(null);
  const [picking, setPicking] = useState(false);
  const [galleryDenied, setGalleryDenied] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      listPalettes().then((p) => setHasPalettes(p.length > 0));
    }, [])
  );

  const handlePressPalette = useCallback((id: string) => {
    router.push({ pathname: '/palette/[id]', params: { id } });
  }, []);

  async function handleGallery() {
    if (picking) return;
    setPicking(true);
    setGalleryDenied(false);
    try {
      const result = await launchGalleryPicker();
      if (result.type === 'picked') {
        router.push({ pathname: '/crop', params: { uri: result.uri, source: 'gallery' } });
      } else if (result.type === 'denied') {
        setGalleryDenied(true);
      }
    } finally {
      setPicking(false);
    }
  }

  function handleCamera() {
    router.push('/(tabs)/capture');
  }

  if (hasPalettes === null) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingBox]}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text variant="h1">Hued</Text>
        <Text variant="small" color={Colors.textSecondary}>Tus paletas</Text>
      </View>

      {hasPalettes ? (
        <>
          <View style={styles.toolbar}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por color..."
              placeholderTextColor={Colors.textPlaceholder}
              style={styles.searchInput}
            />
            <View style={styles.pillRow}>
              {(['all', 'favorites'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.pill, filter === f && styles.pillActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text
                    variant="small"
                    weight={filter === f ? 'semibold' : 'regular'}
                    color={filter === f ? Colors.accentForeground : Colors.textPrimary}
                  >
                    {f === 'all' ? 'Todas' : 'Favoritas'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <PaletteGrid onPressPalette={handlePressPalette} filter={filter} query={query} />
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text variant="h3" style={styles.centered}>Sin paletas todavía</Text>
          <Text variant="body" color={Colors.textSecondary} style={styles.centered}>
            Captura una foto o elige de tu galería para crear tu primera paleta.
          </Text>
          <View style={styles.emptyActions}>
            <View style={styles.actionItem}>
              <Button label="Cámara" onPress={handleCamera} variant="primary" fullWidth />
            </View>
            <View style={styles.actionItem}>
              {picking ? (
                <View style={styles.loadingBtn}>
                  <ActivityIndicator size="small" color={Colors.accent} />
                  <Text variant="small" color={Colors.textSecondary}>Abriendo...</Text>
                </View>
              ) : (
                <Button label="Galería" onPress={handleGallery} variant="secondary" fullWidth />
              )}
            </View>
          </View>
          {galleryDenied && (
            <Text variant="small" color={Colors.textSecondary} style={styles.centered}>
              Activa el permiso de galería en Ajustes del dispositivo.
            </Text>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.fab} onPress={handleCamera} activeOpacity={0.85}>
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  loadingBox: { alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  toolbar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    height: 40,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
  },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
  },
  pillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  centered: { textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  actionItem: { flex: 1 },
  loadingBtn: {
    height: 48,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabPlus: {
    color: Colors.accentForeground,
    fontSize: 28,
    lineHeight: 32,
  },
});
```

Note: the empty-filtered-result state (e.g. "Sin resultados para 'x'") is deliberately **not** built here — `PaletteGrid`'s `FlatList` with an empty `visible` array today just renders nothing (blank space below the toolbar). This is a real but minor gap; if it bothers you in manual testing, it's a small follow-up (a `ListEmptyComponent` on the `FlatList` in `PaletteGrid.tsx`), not re-opening this task.

- [ ] **Step 2: Typecheck (this resolves the errors left by Tasks 6 and 7)**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0

- [ ] **Step 3: Run the full test suite**

Run: `npx jest`
Expected: all test suites PASS (existing + the 3 new ones from Tasks 2-4)

- [ ] **Step 4: Manual verification**

Run: `npx expo start`, open on device/simulator:
- Home tab shows search bar + "Todas"/"Favoritas" pills once you have ≥1 palette
- Typing a color name filters the grid
- Tapping "Favoritas" with none favorited shows an empty grid (see note above — no empty-state copy yet)
- Long-press a card → sheet shows Favorito/Duplicar/Compartir/Eliminar
- Tap Eliminar → inline confirm → Eliminar again → card disappears, file directory removed
- Tap Duplicar → new card appears at the top of the grid
- Heart icon on the card toggles instantly and survives a screen re-focus

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "Add search bar and favorites filter to home tab"
```

---

## Self-Review Summary

**Spec coverage:**
- §1 Canvas capture → Task 4 (revised to `drawAsImage`, spec updated to match)
- §2 Export modal → Task 5
- §3 Favorites + search → Tasks 2, 3, 6, 7, 8
- §4 History actions (favorite/duplicate/share/delete) → Tasks 2, 6
- §5 Error handling summary → applied throughout (try/catch + Sentry + inline UI in every new async path)
- Testing section → Tasks 2, 3, 4 cover the three pure/mockable subsystems; UI tasks (5-8) use manual verification, matching this codebase's existing convention of no component-level automated tests.

**Explicitly out of scope (carried from spec):** watermarks, `react-native-view-shot`, SQL-level search, paywall/onboarding routes.

**One deliberate scope trim found during planning, flagged above rather than silently dropped:** the "no results" empty state for a filtered/searched grid (mentioned in the spec's §3) is not built — `PaletteGrid` just renders an empty list. Noted as a small follow-up in Task 8, not blocking.
