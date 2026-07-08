# Sprint 1 — Capture Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User can take a photo (camera) or pick from gallery, crop it, confirm, and have it saved to app sandbox with a generated thumbnail and database row.

**Architecture:** `CameraView` (capture tab) and `launchGalleryPicker` (home screen) each produce an image URI → router pushes to `/crop` full-screen modal → `react-native-image-crop-picker` handles crop native UI → `optimize()` + `thumbnail()` resize → `savePalette()` writes filesystem + SQLite row. The Capture tab is the camera; gallery is an alternate entry from the Home empty state and "+" FAB.

**Tech Stack:** expo-camera · expo-image-picker · react-native-image-crop-picker · expo-image-manipulator · expo-file-system (already installed) · expo-sqlite via `getDb()` (already installed) · ulidx (ULID IDs) · jest-expo (tests)

---

## File map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/types/palette.ts` | Domain types: Palette, ExtractedColor, LayoutConfig, defaults |
| Create | `src/lib/utils/image.ts` | `optimize()` resize to max 2048px + `thumbnail()` 200×200 square |
| Create | `src/lib/utils/__tests__/image.test.ts` | Unit tests for both helpers |
| Create | `src/lib/db/palettes.ts` | `savePalette()`, `getPalette()`, `listPalettes()` |
| Create | `src/lib/db/__tests__/palettes.test.ts` | Unit tests for DB ops + ULID uniqueness |
| Create | `src/components/capture/CameraView.tsx` | Full-screen camera: permission flow, capture, grid, flash, front/back |
| Create | `src/components/capture/GalleryPicker.tsx` | Headless async fn: permission + ImagePicker + analytics |
| Create | `app/crop.tsx` | Crop screen: aspect ratio presets, react-native-image-crop-picker, save flow |
| Modify | `app/(tabs)/capture.tsx` | Replace stub with CameraView → navigate to /crop |
| Modify | `app/(tabs)/index.tsx` | Empty state + "+" FAB → camera tab or gallery picker |
| Modify | `app.json` | Camera + media library plugin config + Android permissions |
| Modify | `package.json` | jest-expo preset + test script |

---

### Task 1: Packages + permissions

**Files:**
- Modify: `app.json`
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install native packages**

Run in `D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued`:

```powershell
pnpm add react-native-image-crop-picker ulidx
npx expo install expo-camera expo-image-picker expo-image-manipulator
```

Expected: all packages appear in `package.json` dependencies with no resolution errors.

- [ ] **Step 2: Install jest devDependencies**

```powershell
pnpm add -D jest-expo @types/jest
```

- [ ] **Step 3: Add jest config + test script to package.json**

Open `package.json`. Add under `"scripts"`:
```json
"test": "jest"
```

Add at top level (alongside `"name"`, `"version"`, etc.):
```json
"jest": {
  "preset": "jest-expo",
  "testMatch": ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|sentry-expo|native-base|react-native-svg|ulidx)"
  ]
}
```

- [ ] **Step 4: Add plugin config + permissions to app.json**

In `app.json`, under `"expo"`, add a `"plugins"` array (or merge if it already exists):

```json
"plugins": [
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
  ]
]
```

Also under `"expo" > "android"`, ensure `"permissions"` includes:
```json
"permissions": [
  "android.permission.CAMERA",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_EXTERNAL_STORAGE"
]
```

- [ ] **Step 5: Rebuild Android dev client**

Native modules require a full Gradle build. This takes 3–5 minutes.

```powershell
npx expo run:android
```

Expected: Build succeeds, app launches on emulator with updated native modules. If it fails with "Unable to resolve module", check that all `pnpm add` commands completed without error.

- [ ] **Step 6: Commit**

```
git add app.json package.json pnpm-lock.yaml
git commit -m "build(s1): add expo-camera, image-picker, image-crop-picker, image-manipulator, ulidx, jest-expo"
```

---

### Task 2: Domain types

**Files:**
- Create: `src/types/palette.ts`

- [ ] **Step 1: Create palette types**

Create `src/types/palette.ts`:

```typescript
export interface ExtractedColor {
  hex: string;
  rgb: [number, number, number];
  lab: [number, number, number];
  name: string;
  hslLightness: number;
  weight: number;
}

export type ArchetypeId = 'strip' | 'editorial' | 'grid' | 'banner' | 'side';

export type CardStyle = 'filled' | 'outlined';

export interface LayoutConfig {
  archetypeId: ArchetypeId;
  position: number;
  showHex: boolean;
  showName: boolean;
  showRGB: boolean;
  fontFamily: string;
  cornerRadius: number;
  cardStyle: CardStyle;
  watermarkVisible: boolean;
}

export type CaptureSource = 'camera' | 'gallery';

export interface PaletteMeta {
  capturedAt: number;
  source: CaptureSource;
  aspectRatio: string;
}

export interface Palette {
  id: string;
  imageUri: string;
  thumbnailUri: string;
  colors: ExtractedColor[];
  layoutConfig: LayoutConfig;
  meta: PaletteMeta;
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  exportCount: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  archetypeId: 'strip',
  position: 0,
  showHex: true,
  showName: true,
  showRGB: false,
  fontFamily: 'sans',
  cornerRadius: 8,
  cardStyle: 'filled',
  watermarkVisible: true,
};
```

- [ ] **Step 2: Verify TypeScript**

```powershell
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```
git add src/types/palette.ts
git commit -m "feat(types): add Palette, ExtractedColor, LayoutConfig domain types"
```

---

### Task 3: Image utilities + tests

**Files:**
- Create: `src/lib/utils/image.ts`
- Create: `src/lib/utils/__tests__/image.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/utils/__tests__/image.test.ts`:

```typescript
import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

import { optimize, thumbnail } from '../image';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

const mockManipulate = ImageManipulator.manipulateAsync as jest.MockedFunction<
  typeof ImageManipulator.manipulateAsync
>;

describe('optimize', () => {
  let getSizeSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    getSizeSpy = jest.spyOn(Image, 'getSize');
  });

  afterEach(() => {
    getSizeSpy.mockRestore();
  });

  it('returns original URI when longest edge ≤ 2048', async () => {
    getSizeSpy.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(1200, 800)
    );

    const result = await optimize('file:///test.jpg');

    expect(result).toBe('file:///test.jpg');
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('resizes when longest edge > 2048', async () => {
    getSizeSpy.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(4096, 3072)
    );
    mockManipulate.mockResolvedValue({ uri: 'file:///optimized.jpg', width: 2048, height: 1536 });

    const result = await optimize('file:///large.jpg');

    expect(mockManipulate).toHaveBeenCalledWith(
      'file:///large.jpg',
      [{ resize: { width: 2048, height: 1536 } }],
      { compress: 0.85, format: 'jpeg' }
    );
    expect(result).toBe('file:///optimized.jpg');
  });
});

describe('thumbnail', () => {
  let getSizeSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    getSizeSpy = jest.spyOn(Image, 'getSize');
  });

  afterEach(() => {
    getSizeSpy.mockRestore();
  });

  it('center-crops to square then resizes to 200×200 (landscape)', async () => {
    getSizeSpy.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(400, 300)
    );
    mockManipulate.mockResolvedValue({ uri: 'file:///thumb.jpg', width: 200, height: 200 });

    const result = await thumbnail('file:///source.jpg');

    expect(mockManipulate).toHaveBeenCalledWith(
      'file:///source.jpg',
      [
        { crop: { originX: 50, originY: 0, width: 300, height: 300 } },
        { resize: { width: 200, height: 200 } },
      ],
      { compress: 0.7, format: 'jpeg' }
    );
    expect(result).toBe('file:///thumb.jpg');
  });

  it('center-crops to square then resizes to 200×200 (portrait)', async () => {
    getSizeSpy.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(300, 400)
    );
    mockManipulate.mockResolvedValue({ uri: 'file:///thumb.jpg', width: 200, height: 200 });

    await thumbnail('file:///portrait.jpg');

    expect(mockManipulate).toHaveBeenCalledWith(
      'file:///portrait.jpg',
      [
        { crop: { originX: 0, originY: 50, width: 300, height: 300 } },
        { resize: { width: 200, height: 200 } },
      ],
      { compress: 0.7, format: 'jpeg' }
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
pnpm test -- --testPathPattern="image.test"
```

Expected: FAIL with `Cannot find module '../image'`

- [ ] **Step 3: Implement image utilities**

Create `src/lib/utils/image.ts`:

```typescript
import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_FULL_SIZE = 2048;
const THUMB_SIZE = 200;

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export async function optimize(uri: string): Promise<string> {
  const { width, height } = await getImageSize(uri);
  const longest = Math.max(width, height);
  if (longest <= MAX_FULL_SIZE) return uri;

  const ratio = MAX_FULL_SIZE / longest;
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: Math.round(width * ratio), height: Math.round(height * ratio) } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function thumbnail(uri: string): Promise<string> {
  const { width, height } = await getImageSize(uri);
  const side = Math.min(width, height);
  const originX = (width - side) / 2;
  const originY = (height - side) / 2;

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [
      { crop: { originX, originY, width: side, height: side } },
      { resize: { width: THUMB_SIZE, height: THUMB_SIZE } },
    ],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
pnpm test -- --testPathPattern="image.test"
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Typecheck**

```powershell
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```
git add src/lib/utils/image.ts "src/lib/utils/__tests__/image.test.ts"
git commit -m "feat(utils): add optimize() and thumbnail() image helpers with tests"
```

---

### Task 4: Palette DB repository + tests

**Files:**
- Create: `src/lib/db/palettes.ts`
- Create: `src/lib/db/__tests__/palettes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/db/__tests__/palettes.test.ts`:

```typescript
import * as FileSystem from 'expo-file-system';

import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import { savePalette, getPalette, listPalettes } from '../palettes';
import { getDb } from '../client';

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../client');

const mockDb = {
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
};
(getDb as jest.Mock).mockResolvedValue(mockDb);

const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;

const baseParams = {
  imageUri: 'file:///tmp/photo.jpg',
  thumbnailUri: 'file:///tmp/thumb.jpg',
  colors: [],
  layoutConfig: DEFAULT_LAYOUT_CONFIG,
  meta: { capturedAt: 1000, source: 'camera' as const, aspectRatio: 'original' },
};

describe('savePalette', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates directory and copies both files', async () => {
    await savePalette(baseParams);

    expect(mockFs.makeDirectoryAsync).toHaveBeenCalledWith(
      expect.stringContaining('palettes/'),
      { intermediates: true }
    );
    expect(mockFs.copyAsync).toHaveBeenCalledTimes(2);
    expect(mockFs.copyAsync).toHaveBeenCalledWith({
      from: 'file:///tmp/photo.jpg',
      to: expect.stringContaining('full.jpg'),
    });
    expect(mockFs.copyAsync).toHaveBeenCalledWith({
      from: 'file:///tmp/thumb.jpg',
      to: expect.stringContaining('thumb.jpg'),
    });
  });

  it('inserts row in SQLite with JSON-serialized fields', async () => {
    await savePalette(baseParams);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO palettes'),
      expect.any(String),            // id (ULID)
      expect.stringContaining('full.jpg'),
      expect.stringContaining('thumb.jpg'),
      '[]',                          // colors serialized
      expect.any(String),            // layoutConfig JSON
      expect.any(String),            // meta JSON
      expect.any(Number),            // createdAt
      expect.any(Number),            // updatedAt
      0,
      0
    );
  });

  it('returns palette with valid ULID id', async () => {
    const palette = await savePalette(baseParams);
    expect(palette.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(palette.isFavorite).toBe(false);
    expect(palette.exportCount).toBe(0);
  });

  it('generates unique IDs across concurrent saves', async () => {
    const [p1, p2] = await Promise.all([
      savePalette(baseParams),
      savePalette(baseParams),
    ]);
    expect(p1.id).not.toBe(p2.id);
  });
});

describe('getPalette', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when row not found', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    const result = await getPalette('nonexistent');
    expect(result).toBeNull();
  });

  it('deserializes JSON fields from row', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      id: '01HX1234567890ABCDEFGHIJKL',
      image_uri: 'file:///palettes/01HX/full.jpg',
      thumbnail_uri: 'file:///palettes/01HX/thumb.jpg',
      colors: '[]',
      layout_config: JSON.stringify(DEFAULT_LAYOUT_CONFIG),
      meta: JSON.stringify({ capturedAt: 1000, source: 'camera', aspectRatio: 'original' }),
      created_at: 1000,
      updated_at: 1000,
      is_favorite: 0,
      export_count: 0,
    });

    const palette = await getPalette('01HX1234567890ABCDEFGHIJKL');
    expect(palette?.isFavorite).toBe(false);
    expect(palette?.colors).toEqual([]);
    expect(palette?.meta.source).toBe('camera');
  });
});

describe('listPalettes', () => {
  it('returns empty array when table is empty', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const palettes = await listPalettes();
    expect(palettes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
pnpm test -- --testPathPattern="palettes.test"
```

Expected: FAIL with `Cannot find module '../palettes'`

- [ ] **Step 3: Implement palette repository**

Create `src/lib/db/palettes.ts`:

```typescript
import * as FileSystem from 'expo-file-system';
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
  const dir = `${FileSystem.documentDirectory}palettes/${id}/`;

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
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
pnpm test -- --testPathPattern="palettes.test"
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Typecheck**

```powershell
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```
git add src/lib/db/palettes.ts "src/lib/db/__tests__/palettes.test.ts"
git commit -m "feat(db): add palette repository savePalette/getPalette/listPalettes with tests"
```

---

### Task 5: CameraView component

**Files:**
- Create: `src/components/capture/CameraView.tsx`

No unit tests — wraps native hardware. EOD check requires physical device.

- [ ] **Step 1: Create CameraView.tsx**

Create `src/components/capture/CameraView.tsx`:

```typescript
import * as Sentry from '@sentry/react-native';
import {
  CameraView as ExpoCameraView,
  CameraType,
  FlashMode,
  useCameraPermissions,
} from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { trackEvent } from '@/lib/analytics/events';
import { Colors, Radius, Spacing } from '@/lib/tokens';

interface Props {
  onCapture: (uri: string) => void;
  onCancel: () => void;
}

export function CameraView({ onCapture, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('auto');
  const [showGrid, setShowGrid] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<ExpoCameraView>(null);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <Text variant="h2" style={styles.centered}>Acceso a la cámara</Text>
          <Text variant="body" color={Colors.textSecondary} style={styles.centered}>
            Hued necesita la cámara para capturar fotos y crear paletas de colores.
          </Text>
          {permission.canAskAgain ? (
            <Button label="Permitir acceso" onPress={requestPermission} fullWidth />
          ) : (
            <Text variant="small" color={Colors.textSecondary} style={styles.centered}>
              Activa el permiso en Ajustes del dispositivo.
            </Text>
          )}
          <Button label="Cancelar" variant="ghost" onPress={onCancel} fullWidth />
        </View>
      </SafeAreaView>
    );
  }

  async function handleCapture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    trackEvent('capture_started', { source: 'camera' });
    const start = Date.now();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, exif: false });
      trackEvent('capture_completed', { source: 'camera', duration_ms: Date.now() - start });
      onCapture(photo.uri);
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setCapturing(false);
    }
  }

  const FLASH_CYCLE: Record<FlashMode, FlashMode> = { auto: 'on', on: 'off', off: 'auto' };
  const FLASH_LABEL: Record<FlashMode, string> = { auto: 'A', on: 'On', off: 'Off' };

  return (
    <View style={styles.container}>
      <ExpoCameraView ref={cameraRef} style={styles.camera} facing={facing} flash={flash}>
        {showGrid && <GridOverlay />}

        <SafeAreaView style={styles.topBar} edges={['top']}>
          <TouchableOpacity style={styles.iconBtn} onPress={onCancel}>
            <Text style={styles.iconTxt}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setFlash(FLASH_CYCLE[flash])}>
            <Text style={styles.iconTxt}>⚡{FLASH_LABEL[flash]}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowGrid((g) => !g)}>
            <Text style={styles.iconTxt}>{showGrid ? '⊞' : '⊟'}</Text>
          </TouchableOpacity>
        </SafeAreaView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          >
            <Text style={styles.iconTxt}>🔄</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shutterRing, capturing && styles.shutterDisabled]}
            onPress={handleCapture}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator color={Colors.bgPrimary} />
            ) : (
              <View style={styles.shutterDot} />
            )}
          </TouchableOpacity>

          <View style={styles.iconBtn} />
        </View>
      </ExpoCameraView>
    </View>
  );
}

function GridOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.gridLine, styles.gridH, { top: '33%' as unknown as number }]} />
      <View style={[styles.gridLine, styles.gridH, { top: '66%' as unknown as number }]} />
      <View style={[styles.gridLine, styles.gridV, { left: '33%' as unknown as number }]} />
      <View style={[styles.gridLine, styles.gridV, { left: '66%' as unknown as number }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgInverse },
  camera: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { color: Colors.textInverse, fontSize: 18 },
  shutterRing: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    borderWidth: 4,
    borderColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: { opacity: 0.6 },
  shutterDot: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bgElevated,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  centered: { textAlign: 'center' },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.3)' },
  gridH: { left: 0, right: 0, height: 1 },
  gridV: { top: 0, bottom: 0, width: 1 },
});
```

- [ ] **Step 2: Typecheck**

```powershell
pnpm typecheck
```

Expected: 0 errors. If `top: '33%'` casting raises an error, replace with a static `Animated` value or use `flex`-based layout (three `View` children each with `flex: 1`).

- [ ] **Step 3: Commit**

```
git add src/components/capture/CameraView.tsx
git commit -m "feat(capture): add CameraView with permission flow, grid toggle, flash cycle, front/back"
```

---

### Task 6: GalleryPicker

**Files:**
- Create: `src/components/capture/GalleryPicker.tsx`

This is a headless async function, not a React component.

- [ ] **Step 1: Create GalleryPicker.tsx**

Create `src/components/capture/GalleryPicker.tsx`:

```typescript
import * as ImagePicker from 'expo-image-picker';

import { trackEvent } from '@/lib/analytics/events';

interface PickResult {
  uri: string;
}

export async function launchGalleryPicker(): Promise<PickResult | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status !== 'granted') {
    return null;
  }

  trackEvent('capture_started', { source: 'gallery' });

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled) {
    trackEvent('capture_cancelled', { source: 'gallery', stage: 'pick' });
    return null;
  }

  trackEvent('capture_completed', { source: 'gallery', duration_ms: 0 });
  return { uri: result.assets[0].uri };
}
```

- [ ] **Step 2: Typecheck**

```powershell
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```
git add src/components/capture/GalleryPicker.tsx
git commit -m "feat(capture): add launchGalleryPicker with permission request and analytics"
```

---

### Task 7: Crop screen

**Files:**
- Create: `app/crop.tsx`

`app/crop.tsx` is already registered in the root `_layout.tsx` as `presentation: 'fullScreenModal'`. This task just creates the file.

Receives `uri` + `source` via router params. Shows aspect ratio preset buttons. Tapping "Recortar foto" opens `react-native-image-crop-picker`'s native crop UI. On confirm: `optimize()` + `thumbnail()` → `savePalette()` → `router.replace('/(tabs)')`.

- [ ] **Step 1: Create app/crop.tsx**

Create `app/crop.tsx`:

```typescript
import * as Sentry from '@sentry/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import ImageCropPicker from 'react-native-image-crop-picker';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { trackEvent } from '@/lib/analytics/events';
import { savePalette } from '@/lib/db/palettes';
import { optimize, thumbnail } from '@/lib/utils/image';
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

type ScreenState = 'idle' | 'cropping' | 'saving' | 'error';

export default function CropScreen() {
  const params = useLocalSearchParams<{ uri: string; source: string }>();
  const imageUri = params.uri as string | undefined;
  const captureSource = (params.source ?? 'camera') as CaptureSource;

  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('original');
  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleCancel() {
    trackEvent('capture_cancelled', { source: captureSource, stage: 'crop' });
    router.replace('/(tabs)');
  }

  async function handleCrop() {
    if (!imageUri) return;
    setScreenState('cropping');
    setErrorMessage(null);

    try {
      const sizes = ASPECT_SIZES[selectedRatio];
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

      setScreenState('saving');

      const [optimizedUri, thumbUri] = await Promise.all([
        optimize(cropResult.path),
        thumbnail(cropResult.path),
      ]);

      await savePalette({
        imageUri: optimizedUri,
        thumbnailUri: thumbUri,
        colors: [],
        layoutConfig: DEFAULT_LAYOUT_CONFIG,
        meta: {
          capturedAt: Date.now(),
          source: captureSource,
          aspectRatio: selectedRatio,
        },
      });

      router.replace('/(tabs)');
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
        setErrorMessage('No se pudo recortar la foto. Inténtalo de nuevo.');
        setScreenState('error');
      }
    }
  }

  if (screenState === 'saving') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text variant="small" color={Colors.textSecondary} style={styles.savingLabel}>
          Guardando paleta...
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
          PROPORCIÓN
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
    backgroundColor: '#FEF2F2',
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
```

- [ ] **Step 2: Typecheck**

```powershell
pnpm typecheck
```

Expected: 0 errors. If `react-native-image-crop-picker` is missing types, run:
```powershell
pnpm add -D @types/react-native-image-crop-picker
```
Then recheck.

- [ ] **Step 3: Commit**

```
git add app/crop.tsx
git commit -m "feat(crop): add crop screen with aspect ratio presets, native crop UI, and save flow"
```

---

### Task 8: Wire capture tab + home screen

**Files:**
- Modify: `app/(tabs)/capture.tsx`
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Replace capture.tsx stub with CameraView**

Replace all content of `app/(tabs)/capture.tsx`:

```typescript
import { router } from 'expo-router';

import { CameraView } from '@/components/capture/CameraView';

export default function CaptureScreen() {
  function handleCapture(uri: string) {
    router.push({ pathname: '/crop', params: { uri, source: 'camera' } });
  }

  function handleCancel() {
    router.replace('/(tabs)');
  }

  return <CameraView onCapture={handleCapture} onCancel={handleCancel} />;
}
```

- [ ] **Step 2: Update index.tsx — empty state + FAB + gallery entry**

Replace all content of `app/(tabs)/index.tsx`:

```typescript
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkiaSmokeTest } from '@/components/test/SkiaSmokeTest';
import { launchGalleryPicker } from '@/components/capture/GalleryPicker';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Colors, Radius, Spacing } from '@/lib/tokens';

export default function HomeScreen() {
  const [picking, setPicking] = useState(false);

  async function handleGallery() {
    if (picking) return;
    setPicking(true);
    try {
      const result = await launchGalleryPicker();
      if (result) {
        router.push({ pathname: '/crop', params: { uri: result.uri, source: 'gallery' } });
      }
    } finally {
      setPicking(false);
    }
  }

  function handleCamera() {
    router.push('/(tabs)/capture');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text variant="h1">Hued</Text>
        <Text variant="small" color={Colors.textSecondary}>
          Tus paletas
        </Text>
      </View>

      {/* Sprint 0 Day 3: Skia smoke test — remove when Sprint 4 PaletteGrid lands */}
      <SkiaSmokeTest />

      {/* Empty state — replace with PaletteGrid in Sprint 4 */}
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
      </View>

      <TouchableOpacity style={styles.fab} onPress={handleCamera} activeOpacity={0.85}>
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
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

- [ ] **Step 3: Typecheck + run all tests**

```powershell
pnpm typecheck
pnpm test
```

Expected: 0 TS errors, all tests PASS.

- [ ] **Step 4: Commit**

```
git add "app/(tabs)/capture.tsx" "app/(tabs)/index.tsx"
git commit -m "feat(capture): wire CameraView into capture tab and add gallery + FAB to home empty state"
```

---

## EOD manual verification checklist (physical device required)

After all tasks complete, test the full Sprint 1 flow on a physical Android device:

**Camera flow:**
- [ ] Tap "Capturar" tab → live camera feed opens
- [ ] Flash button cycles: A → On → Off → A
- [ ] Grid overlay toggles on/off (thirds lines visible)
- [ ] Front/back toggle flips camera
- [ ] Tap shutter → brief loading spinner → navigates to crop screen
- [ ] Deny camera permission → friendly message shown, "Cancelar" returns home

**Gallery flow:**
- [ ] Tap "Galería" on home empty state → device image picker opens
- [ ] Select photo → navigates to crop screen
- [ ] Deny gallery permission → no crash, returns to home silently

**Crop screen:**
- [ ] Four aspect ratio pills visible: 1:1 · 4:5 · 9:16 · original
- [ ] Tapping a pill highlights it
- [ ] "Recortar foto" → native react-native-image-crop-picker UI opens
- [ ] Crop and confirm → brief "Guardando paleta..." spinner → returns to home
- [ ] Cancel in crop picker → stays on crop screen (idle state, no error)
- [ ] "Cancelar" button → returns to home

**Cancel from any stage:**
- [ ] Camera ✕ → home
- [ ] Gallery cancel → home (no navigation)
- [ ] Crop screen Cancelar → home

**Smoke test (5 photos):**
- [ ] Run 5 different photos through full Camera→Crop→Save flow
- [ ] Run 2 photos through Gallery→Crop→Save flow

**Verify SQLite rows (optional, confirms Task 4 runtime behavior):**
```powershell
# After adb shell into device:
# run-as <your-package-name> sqlite3 databases/hued.db "SELECT id, json_extract(meta,'$.source'), json_extract(meta,'$.aspectRatio') FROM palettes;"
```

---

## Known risks

| Risk | Mitigation |
|------|-----------|
| `react-native-image-crop-picker` + New Architecture conflict | If build fails, check version; try `pnpm add react-native-image-crop-picker@latest` |
| Grid overlay `top: '33%'` TypeScript error | Replace with three equal-flex View children |
| `expo-image-manipulator` API changes in SDK 54 | Run `pnpm typecheck` after install; if `SaveFormat` missing use string `'jpeg'` |
| ULID monotonic factory not thread-safe in tests | `monotonicFactory()` is per-module; concurrent test calls use separate factories |
