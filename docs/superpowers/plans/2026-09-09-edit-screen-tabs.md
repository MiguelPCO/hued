# Edit Screen Tabs + No-Crop-Screen Capture Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After capture/gallery pick, land directly on the edit screen (no crop-screen gate) showing the full photo, and restructure the edit screen's options into a fixed tab bar + per-tab carousel instead of one long vertical scroll.

**Architecture:** A new `processCapture()` pipeline (optimize+thumbnail+save, no forced crop) replaces `app/crop.tsx` as the post-capture step. `app/palette/[id].tsx` is rewritten around a flex-column layout: header, a flex-grow canvas region (uses a new `maxHeight` prop on `ArchetypeCanvas`), a swatch strip, a new `EditTabs` component, and a fixed export bar. `EditTabs` composes a generic `OptionCarousel` (reused across archetype/font/corners/card-style tabs) and a dedicated `CropTab` (native cropper invoked on demand, replacing the old blocking crop screen). A pure `isOptionLocked()` predicate is the hook point for future per-option paywall gating — unused (always `false`) in this plan.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript, Zustand (`settingsStore`), `react-native-image-crop-picker`, `@shopify/react-native-skia`, `expo-image-manipulator`, `expo-sqlite`, Jest (`jest-expo` preset, no `@testing-library/react-native` — this codebase's convention is testing extracted pure functions, not rendering components; see Task testing notes below).

**Spec:** `docs/superpowers/specs/2026-09-09-edit-screen-tabs-design.md`

## Global Constraints

- No new npm dependencies. In particular, do not add `@testing-library/react-native` — follow the existing codebase convention of testing extracted pure functions/data, not rendering components (see e.g. `filterPalettes` in `PaletteGrid.tsx`, `shouldRenderWatermark` in `archetypes/shared.tsx`).
- All new/changed UI copy is Spanish, matching existing screen strings exactly in tone (e.g. "Recortar", "Reintentar", "Extrayendo...").
- The `premium?: boolean` field added to option types stays unset (`undefined`) on every real option in this plan — no option actually becomes locked. `isOptionLocked()` must still be fully correct and tested, since it's the hook a future change flips on.
- A locked option's tap must route to `/paywall` via the same `router.push({ pathname: '/paywall', params: { trigger: ... } })` shape already used for the watermark tap in `ArchetypeCanvas`/`app/palette/[id].tsx` — reuse the existing `'watermark_tap'` trigger value for now (no new trigger name is being introduced in this plan).
- `react-native-image-crop-picker` has no web implementation. Any code that touches it must use the same web-gating pattern already in `app/crop.tsx`: `process.env.EXPO_OS === 'web' ? null : require('react-native-image-crop-picker').default`.
- `app/crop.tsx` and its `Stack.Screen name="crop"` registration in `app/_layout.tsx:72` are deleted entirely — no dangling references anywhere.

---

## File Structure

**New files:**
- `src/lib/subscription/optionLock.ts` — pure `isOptionLocked()` predicate (paywall hook).
- `src/lib/capture/processCapture.ts` — optimize+thumbnail+save pipeline, replaces the inline logic in `app/crop.tsx`.
- `src/components/palette/OptionCarousel.tsx` — generic reusable pill carousel (used by archetype/font/corners/card-style tabs).
- `src/components/palette/CropTab.tsx` — Recorte tab: ratio pills that invoke the native cropper on demand.
- `src/components/palette/EditTabs.tsx` — tab bar + composes `OptionCarousel`/`CropTab`/label toggles per active tab.

**Modified files:**
- `src/lib/db/palettes.ts` — add `updatePaletteImage()`.
- `src/data/archetypes.ts` — add `premium?: boolean` to `ArchetypeDefinition`.
- `src/components/compose/ArchetypeCanvas.tsx` — add optional `maxHeight` prop.
- `app/(tabs)/capture.tsx`, `app/(tabs)/index.tsx` — call `processCapture()`, push straight to `/palette/[id]`.
- `app/palette/[id].tsx` — rewritten around the new fixed flex-column layout + `EditTabs`.
- `app/_layout.tsx` — remove the `crop` `Stack.Screen` entry.
- `src/lib/db/__tests__/palettes-update.test.ts` — add `updatePaletteImage` coverage.

**Deleted files:**
- `app/crop.tsx`

---

### Task 1: `isOptionLocked` — paywall extensibility hook

**Files:**
- Create: `src/lib/subscription/optionLock.ts`
- Test: `src/lib/subscription/__tests__/optionLock.test.ts`

**Interfaces:**
- Produces: `isOptionLocked(premium: boolean | undefined, status: SubscriptionStatus): boolean` — `SubscriptionStatus` imported from `@/lib/store/settingsStore` (`'free' | 'premium'`, already defined there).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/subscription/__tests__/optionLock.test.ts
import { isOptionLocked } from '../optionLock';

describe('isOptionLocked', () => {
  it('is unlocked when the option is not premium, regardless of subscription', () => {
    expect(isOptionLocked(undefined, 'free')).toBe(false);
    expect(isOptionLocked(false, 'free')).toBe(false);
    expect(isOptionLocked(undefined, 'premium')).toBe(false);
  });

  it('is locked for a premium option on a free subscription', () => {
    expect(isOptionLocked(true, 'free')).toBe(true);
  });

  it('is unlocked for a premium option on a premium subscription', () => {
    expect(isOptionLocked(true, 'premium')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/subscription/__tests__/optionLock.test.ts`
Expected: FAIL — `Cannot find module '../optionLock'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/subscription/optionLock.ts
import type { SubscriptionStatus } from '@/lib/store/settingsStore';

export function isOptionLocked(premium: boolean | undefined, status: SubscriptionStatus): boolean {
  return premium === true && status !== 'premium';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/subscription/__tests__/optionLock.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/subscription/optionLock.ts src/lib/subscription/__tests__/optionLock.test.ts
git commit -m "feat: add isOptionLocked paywall hook for edit-screen options"
```

---

### Task 2: `updatePaletteImage` — persist a re-cropped photo

**Files:**
- Modify: `src/lib/db/palettes.ts`
- Modify: `src/lib/db/__tests__/palettes-update.test.ts`

**Interfaces:**
- Consumes: `getDb()` from `./client` (already used by every function in this file); `getPalette()`, `paletteDir()` (both already defined in this file).
- Produces: `updatePaletteImage(id: string, newImageUri: string, newThumbnailUri: string): Promise<{ imageUri: string; thumbnailUri: string }>`. Throws `Error('Palette not found: ' + id)` if the palette doesn't exist. **Important:** the returned URIs are NEW paths (`${dir}full-<timestamp>.jpg`, not the original `full.jpg`) — overwriting the same path would leave stale bytes behind under `useImage()`'s (Skia) and RN's URI-keyed image caches, since the URI string wouldn't change to signal a cache miss.

- [ ] **Step 1: Write the failing tests**

Add to the top of `src/lib/db/__tests__/palettes-update.test.ts` (this file currently has no `FileSystem` import — add one, and a `mockFs` alias, alongside the existing `jest.mock('expo-file-system/legacy', ...)`):

```ts
// Add near the top, with the other imports:
import * as FileSystem from 'expo-file-system/legacy';
// ...
import { updatePaletteColors, updatePaletteLayout, setPaletteCollection, updatePaletteImage } from '../palettes';
// ...
// After the existing jest.mock('expo-file-system/legacy', ...) call and mockDb setup:
const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;
```

Append this new `describe` block at the end of the file:

```ts
describe('updatePaletteImage', () => {
  const existingRow = {
    id: 'palette-4',
    image_uri: 'file:///documents/palettes/palette-4/full.jpg',
    thumbnail_uri: 'file:///documents/palettes/palette-4/thumb.jpg',
    colors: '[]',
    layout_config: JSON.stringify(DEFAULT_LAYOUT_CONFIG),
    collection_id: null,
    meta: JSON.stringify({ capturedAt: 0, source: 'camera', aspectRatio: 'original' }),
    created_at: 0,
    updated_at: 0,
    is_favorite: 0,
    export_count: 0,
  };

  it('copies the new files into the palette dir under fresh names and deletes the old ones', async () => {
    mockDb.getFirstAsync.mockResolvedValue(existingRow);

    const result = await updatePaletteImage(
      'palette-4',
      'file:///tmp/new-full.jpg',
      'file:///tmp/new-thumb.jpg'
    );

    expect(mockFs.copyAsync).toHaveBeenCalledWith({ from: 'file:///tmp/new-full.jpg', to: result.imageUri });
    expect(mockFs.copyAsync).toHaveBeenCalledWith({ from: 'file:///tmp/new-thumb.jpg', to: result.thumbnailUri });
    expect(mockFs.deleteAsync).toHaveBeenCalledWith(
      'file:///documents/palettes/palette-4/full.jpg',
      { idempotent: true }
    );
    expect(mockFs.deleteAsync).toHaveBeenCalledWith(
      'file:///documents/palettes/palette-4/thumb.jpg',
      { idempotent: true }
    );
    expect(result.imageUri).toContain('palettes/palette-4/full-');
    expect(result.thumbnailUri).toContain('palettes/palette-4/thumb-');
    expect(result.imageUri).not.toBe(existingRow.image_uri);
  });

  it('updates image_uri, thumbnail_uri, and updated_at in the DB', async () => {
    mockDb.getFirstAsync.mockResolvedValue(existingRow);

    const result = await updatePaletteImage(
      'palette-4',
      'file:///tmp/new-full.jpg',
      'file:///tmp/new-thumb.jpg'
    );

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE palettes SET image_uri'),
      result.imageUri,
      result.thumbnailUri,
      expect.any(Number),
      'palette-4'
    );
  });

  it('throws when the palette does not exist', async () => {
    mockDb.getFirstAsync.mockResolvedValue(undefined);

    await expect(
      updatePaletteImage('missing', 'file:///a.jpg', 'file:///b.jpg')
    ).rejects.toThrow('Palette not found: missing');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/db/__tests__/palettes-update.test.ts`
Expected: FAIL — `updatePaletteImage is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `src/lib/db/palettes.ts`, after `updatePaletteLayout`:

```ts
export async function updatePaletteImage(
  id: string,
  newImageUri: string,
  newThumbnailUri: string
): Promise<{ imageUri: string; thumbnailUri: string }> {
  const palette = await getPalette(id);
  if (!palette) throw new Error(`Palette not found: ${id}`);

  const dir = paletteDir(palette.imageUri);
  const timestamp = Date.now();
  const imageUri = `${dir}full-${timestamp}.jpg`;
  const thumbnailUri = `${dir}thumb-${timestamp}.jpg`;

  await FileSystem.copyAsync({ from: newImageUri, to: imageUri });
  await FileSystem.copyAsync({ from: newThumbnailUri, to: thumbnailUri });
  await FileSystem.deleteAsync(palette.imageUri, { idempotent: true }).catch(() => {});
  await FileSystem.deleteAsync(palette.thumbnailUri, { idempotent: true }).catch(() => {});

  const db = await getDb();
  await db.runAsync(
    'UPDATE palettes SET image_uri = ?, thumbnail_uri = ?, updated_at = ? WHERE id = ?',
    imageUri,
    thumbnailUri,
    timestamp,
    id
  );

  return { imageUri, thumbnailUri };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/db/__tests__/palettes-update.test.ts`
Expected: PASS (all tests in the file, including the 3 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/palettes.ts src/lib/db/__tests__/palettes-update.test.ts
git commit -m "feat: add updatePaletteImage for in-place re-crop"
```

---

### Task 3: `processCapture` — optimize+thumbnail+save pipeline

**Files:**
- Create: `src/lib/capture/processCapture.ts`
- Test: `src/lib/capture/__tests__/processCapture.test.ts`

**Interfaces:**
- Consumes: `optimize()`, `thumbnail()` from `@/lib/utils/image`; `savePalette()` from `@/lib/db/palettes`; `trackEvent()` from `@/lib/analytics/events`; `DEFAULT_LAYOUT_CONFIG` from `@/types/palette`; `ARCHETYPES` from `@/data/archetypes` (only reads `.defaultConfig`, a plain object).
- Produces: `processCapture(uri: string, source: CaptureSource): Promise<Palette>`. Saves with `colors: []` — extraction is intentionally NOT run here; the edit screen triggers it on mount when it sees an empty `colors` array (Task 9), so the photo appears immediately and colors populate a moment later.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/capture/__tests__/processCapture.test.ts
import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

import { processCapture } from '../processCapture';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/db/client');
// Isolate this pipeline test from the real archetype component tree (which
// transitively imports @shopify/react-native-skia) — this test only needs
// the default layout config's defaultConfig merge, a plain data lookup.
jest.mock('@/data/archetypes', () => ({
  ARCHETYPES: { strip: { defaultConfig: { fontFamily: 'sans', cardStyle: 'filled' } } },
}));

import { getDb } from '@/lib/db/client';

const mockManipulate = ImageManipulator.manipulateAsync as jest.MockedFunction<
  typeof ImageManipulator.manipulateAsync
>;
const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;
const mockDb = {
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
};

describe('processCapture', () => {
  let getSizeSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    (getDb as jest.Mock).mockResolvedValue(mockDb);
    getSizeSpy = jest
      .spyOn(Image, 'getSize')
      .mockImplementation((_uri: string, success: (w: number, h: number) => void) => success(1200, 800));
    mockManipulate.mockResolvedValue({ uri: 'file:///thumb-tmp.jpg', width: 200, height: 200 });
  });

  afterEach(() => getSizeSpy.mockRestore());

  it('saves a palette with empty colors and the default layout config', async () => {
    const palette = await processCapture('file:///raw.jpg', 'camera');

    expect(palette.colors).toEqual([]);
    expect(palette.layoutConfig.archetypeId).toBe('strip');
    expect(palette.layoutConfig.fontFamily).toBe('sans');
  });

  it('records the given source and "original" aspect ratio on the returned palette meta', async () => {
    const palette = await processCapture('file:///raw.jpg', 'gallery');

    expect(palette.meta).toEqual({
      capturedAt: expect.any(Number),
      source: 'gallery',
      aspectRatio: 'original',
    });
  });

  it('copies the (unresized) source image and the generated thumbnail into the palette dir', async () => {
    await processCapture('file:///raw.jpg', 'camera');

    expect(mockFs.copyAsync).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'file:///raw.jpg' })
    );
    expect(mockFs.copyAsync).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'file:///thumb-tmp.jpg' })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/capture/__tests__/processCapture.test.ts`
Expected: FAIL — `Cannot find module '../processCapture'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/capture/processCapture.ts
import { ARCHETYPES } from '@/data/archetypes';
import { savePalette } from '@/lib/db/palettes';
import { trackEvent } from '@/lib/analytics/events';
import { optimize, thumbnail } from '@/lib/utils/image';
import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import type { CaptureSource, Palette } from '@/types/palette';

export async function processCapture(uri: string, source: CaptureSource): Promise<Palette> {
  const start = Date.now();
  const [optimizedUri, thumbUri] = await Promise.all([optimize(uri), thumbnail(uri)]);

  const palette = await savePalette({
    imageUri: optimizedUri,
    thumbnailUri: thumbUri,
    colors: [],
    layoutConfig: {
      ...DEFAULT_LAYOUT_CONFIG,
      ...ARCHETYPES[DEFAULT_LAYOUT_CONFIG.archetypeId].defaultConfig,
    },
    meta: {
      capturedAt: Date.now(),
      source,
      aspectRatio: 'original',
    },
  });

  trackEvent('capture_completed', { source, duration_ms: Date.now() - start });
  return palette;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/capture/__tests__/processCapture.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/capture/processCapture.ts src/lib/capture/__tests__/processCapture.test.ts
git commit -m "feat: add processCapture pipeline (optimize+thumbnail+save, no forced crop)"
```

---

### Task 4: Wire capture flow to `processCapture`, delete the crop screen

**Files:**
- Modify: `app/(tabs)/capture.tsx`
- Modify: `app/(tabs)/index.tsx` (`handleGallery`, around line 47-59)
- Modify: `app/_layout.tsx:72` (remove the `crop` `Stack.Screen`)
- Delete: `app/crop.tsx`

**Interfaces:**
- Consumes: `processCapture(uri: string, source: CaptureSource): Promise<Palette>` from Task 3.

No automated test for this task — it's routing/navigation wiring with no precedent test file in this codebase (the crop screen it replaces was never unit-tested either). Verify manually per Step 4 below.

- [ ] **Step 1: Rewrite `app/(tabs)/capture.tsx`**

```tsx
import * as Sentry from '@sentry/react-native';
import { router } from 'expo-router';

import { CameraView } from '@/components/capture/CameraView';
import { processCapture } from '@/lib/capture/processCapture';

export default function CaptureScreen() {
  async function handleCapture(uri: string) {
    try {
      const palette = await processCapture(uri, 'camera');
      router.replace({ pathname: '/palette/[id]', params: { id: palette.id } });
    } catch (err) {
      Sentry.captureException(err);
      router.replace('/(tabs)');
    }
  }

  function handleCancel() {
    router.replace('/(tabs)');
  }

  return <CameraView onCapture={handleCapture} onCancel={handleCancel} />;
}
```

- [ ] **Step 2: Update `handleGallery` in `app/(tabs)/index.tsx`**

Replace the current `handleGallery` function (around line 47-59):

```tsx
async function handleGallery() {
  if (picking) return;
  setPicking(true);
  setGalleryDenied(false);
  try {
    const result = await launchGalleryPicker();
    if (result.type === 'picked') {
      const palette = await processCapture(result.uri, 'gallery');
      router.push({ pathname: '/palette/[id]', params: { id: palette.id } });
    } else if (result.type === 'denied') {
      setGalleryDenied(true);
    }
  } catch (err) {
    Sentry.captureException(err);
  } finally {
    setPicking(false);
  }
}
```

Add the import near the other `@/lib` imports at the top of the file:

```tsx
import { processCapture } from '@/lib/capture/processCapture';
```

- [ ] **Step 3: Delete the crop screen and its route registration**

```bash
rm "app/crop.tsx"
```

In `app/_layout.tsx`, delete line 72:

```tsx
<Stack.Screen name="crop" options={{ presentation: 'fullScreenModal' }} />
```

- [ ] **Step 4: Manual verification**

Run: `npx tsc --noEmit` — expect no errors (confirms nothing else still imports `/crop` or references the deleted screen).

On a device/simulator (dev-client build, not Expo Go — this app requires third-party native modules): capture a photo via camera → confirm it lands directly on `/palette/[id]` with the full photo visible, no crop screen in between. Repeat via gallery pick. (The edit screen itself won't look right yet — `EditTabs` doesn't exist until Task 9 — this step is only confirming the *navigation* change.)

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/capture.tsx app/\(tabs\)/index.tsx app/_layout.tsx
git rm app/crop.tsx
git commit -m "feat: skip crop screen, land on edit screen straight after capture"
```

---

### Task 5: `ArchetypeCanvas` — optional `maxHeight` constraint

**Files:**
- Modify: `src/components/compose/ArchetypeCanvas.tsx`

**Interfaces:**
- Produces: `ArchetypeCanvas` gains an optional `maxHeight?: number` prop. When provided, the canvas scales to fit within `maxHeight` (in addition to fitting the screen width) instead of always scaling purely off screen width, and is centered horizontally. Existing callers that omit `maxHeight` are unaffected (identical behavior to today).

No automated test — this file has no existing test (it renders a Skia `Canvas`, which needs native GPU context; no precedent for testing it in this codebase). Verify manually per Step 2.

- [ ] **Step 1: Update the component**

Replace the body of `src/components/compose/ArchetypeCanvas.tsx`:

```tsx
import { Canvas, Group, useImage } from '@shopify/react-native-skia';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { getCardFrame, shouldRenderWatermark } from '@/components/compose/archetypes/shared';
import { getWatermarkTapRegion, Watermark } from '@/components/compose/archetypes/Watermark';
import { ARCHETYPES } from '@/data/archetypes';
import { useSettingsStore } from '@/lib/store/settingsStore';
import type { Palette, LayoutConfig } from '@/types/palette';

interface Props {
  palette: Palette;
  config: LayoutConfig;
  onWatermarkPress?: () => void;
  maxHeight?: number;
}

const CANVAS_W = 360;
const CANVAS_H = 450;

export function ArchetypeCanvas({ palette, config, onWatermarkPress, maxHeight }: Props) {
  const { width: screenW } = useWindowDimensions();
  const widthScale = screenW / CANVAS_W;
  const scale = maxHeight ? Math.min(widthScale, maxHeight / CANVAS_H) : widthScale;
  const displayW = CANVAS_W * scale;
  const displayH = CANVAS_H * scale;
  const image = useImage(palette.imageUri);
  const subscriptionStatus = useSettingsStore((s) => s.subscriptionStatus);

  const archetypeProps = { palette, config, width: CANVAS_W, height: CANVAS_H, image };
  const { clip, overlay } = getCardFrame(config, CANVAS_W, CANVAS_H);
  const { Component } = ARCHETYPES[config.archetypeId];

  const watermarkShown = shouldRenderWatermark(config.watermarkVisible, subscriptionStatus);
  const tapRegion = getWatermarkTapRegion(CANVAS_W, CANVAS_H);

  return (
    <View style={{ width: displayW, height: displayH, alignSelf: 'center' }}>
      <Canvas style={{ width: displayW, height: displayH }}>
        <Group transform={[{ scale }]}>
          <Group clip={clip}>
            <Component {...archetypeProps} />
          </Group>

          {overlay}
          {watermarkShown && (
            <Watermark width={CANVAS_W} height={CANVAS_H} cornerRadius={config.cornerRadius} />
          )}
        </Group>
      </Canvas>

      {watermarkShown && subscriptionStatus === 'free' && onWatermarkPress && (
        <Pressable
          onPress={onWatermarkPress}
          style={{
            position: 'absolute',
            left: tapRegion.x * scale,
            top: tapRegion.y * scale,
            width: tapRegion.width * scale,
            height: tapRegion.height * scale,
          }}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npx tsc --noEmit` — expect no errors.

No visual difference yet for existing callers (none pass `maxHeight` until Task 9). Confirm the app's existing palette screen still renders the canvas full-width as before (temporary regression check before Task 9 rewires the caller).

- [ ] **Step 3: Commit**

```bash
git add src/components/compose/ArchetypeCanvas.tsx
git commit -m "feat: let ArchetypeCanvas fit within an optional maxHeight"
```

---

### Task 6: `OptionCarousel` — generic pill carousel with paywall hook

**Files:**
- Create: `src/components/palette/OptionCarousel.tsx`

**Interfaces:**
- Consumes: `isOptionLocked()` from Task 1; `useSettingsStore` from `@/lib/store/settingsStore`.
- Produces:
  ```ts
  export interface CarouselOption<T extends string | number> {
    key: T;
    label: string;
    premium?: boolean;
  }
  export function OptionCarousel<T extends string | number>(props: {
    options: CarouselOption<T>[];
    activeKey: T;
    onSelect: (key: T) => void;
    onLockedPress?: (key: T) => void;
  }): JSX.Element
  ```
  Tapping a locked option (`isOptionLocked(option.premium, subscriptionStatus)` is `true`) calls `onLockedPress` instead of `onSelect`.

No automated test — purely presentational (matches the codebase's convention of leaving thin RN view components untested; the underlying lock predicate is tested in Task 1).

- [ ] **Step 1: Write the component**

```tsx
// src/components/palette/OptionCarousel.tsx
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { isOptionLocked } from '@/lib/subscription/optionLock';
import { Colors, Radius, Spacing } from '@/lib/tokens';

export interface CarouselOption<T extends string | number> {
  key: T;
  label: string;
  premium?: boolean;
}

interface Props<T extends string | number> {
  options: CarouselOption<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
  onLockedPress?: (key: T) => void;
}

export function OptionCarousel<T extends string | number>({
  options,
  activeKey,
  onSelect,
  onLockedPress,
}: Props<T>) {
  const subscriptionStatus = useSettingsStore((s) => s.subscriptionStatus);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      {options.map((option) => {
        const active = option.key === activeKey;
        const locked = isOptionLocked(option.premium, subscriptionStatus);
        return (
          <TouchableOpacity
            key={String(option.key)}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => (locked ? onLockedPress?.(option.key) : onSelect(option.key))}
          >
            <Text
              variant="small"
              weight={active ? 'semibold' : 'regular'}
              color={active ? Colors.accentForeground : Colors.textPrimary}
            >
              {option.label}
              {locked ? ' 🔒' : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -Spacing.md, paddingHorizontal: Spacing.md },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
    marginRight: Spacing.sm,
  },
  pillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
});
```

- [ ] **Step 2: Manual verification**

Run: `npx tsc --noEmit` — expect no errors. (Component isn't wired into any screen yet — Task 8 uses it.)

- [ ] **Step 3: Commit**

```bash
git add src/components/palette/OptionCarousel.tsx
git commit -m "feat: add generic OptionCarousel with paywall-lock support"
```

---

### Task 7: `CropTab` — on-demand native crop inside the edit screen

**Files:**
- Create: `src/components/palette/CropTab.tsx`

**Interfaces:**
- Consumes: `updatePaletteImage()` from Task 2; `updatePaletteColors()` (existing, from `@/lib/db/palettes`); `extractColors`, `ExtractError` from `@/lib/color/extract`; `optimize`, `thumbnail` from `@/lib/utils/image`.
- Produces:
  ```ts
  interface Props {
    paletteId: string;
    imageUri: string;
    onImageUpdated: (updates: { imageUri: string; thumbnailUri: string; colors: ExtractedColor[] }) => void;
  }
  export function CropTab(props: Props): JSX.Element
  ```
  On a successful crop, calls `onImageUpdated` with the new URIs and freshly-extracted colors (or `[]` if extraction fails — matches the existing failure handling already used elsewhere).

No automated test — depends entirely on the native `ImageCropPicker` module, which has no jest mock anywhere in this codebase and can't run headless. Verify manually on-device (needs the dev-client build).

- [ ] **Step 1: Write the component**

```tsx
// src/components/palette/CropTab.tsx
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
```

- [ ] **Step 2: Manual verification**

Run: `npx tsc --noEmit` — expect no errors. (Not wired into any screen yet — Task 8 uses it.)

- [ ] **Step 3: Commit**

```bash
git add src/components/palette/CropTab.tsx
git commit -m "feat: add CropTab for on-demand native re-crop"
```

---

### Task 8: `EditTabs` — tab bar composing all six option tabs

**Files:**
- Create: `src/components/palette/EditTabs.tsx`
- Modify: `src/data/archetypes.ts` (add `premium?: boolean` to `ArchetypeDefinition`)

**Interfaces:**
- Consumes: `OptionCarousel` (Task 6), `CropTab` (Task 7), `ARCHETYPES` from `@/data/archetypes`, `PILL_CORNER_RADIUS` from `@/components/compose/archetypes/shared`, `trackEvent` from `@/lib/analytics/events`.
- Produces:
  ```ts
  interface Props {
    paletteId: string;
    imageUri: string;
    config: LayoutConfig;
    updateConfig: (partial: Partial<LayoutConfig>) => void;
    onImageUpdated: (updates: { imageUri: string; thumbnailUri: string; colors: ExtractedColor[] }) => void;
    onLockedPress: () => void;
  }
  export function EditTabs(props: Props): JSX.Element
  ```
  This is the direct replacement for the five stacked `<View style={styles.section}>` blocks (Arquetipos/Tipografía/Esquinas/Estilo de tarjeta/Etiquetas) in the current `app/palette/[id].tsx`, plus a new Recorte tab.

No automated test — same reasoning as Tasks 5-7 (thin composition component, no render-test precedent in this codebase). Verify manually in Task 9's step, once wired into the real screen.

- [ ] **Step 1: Add the `premium` field to `ArchetypeDefinition`**

In `src/data/archetypes.ts`, add one field to the interface (leave every entry in `ARCHETYPES` unchanged — the field stays `undefined` on all five):

```ts
export interface ArchetypeDefinition {
  id: ArchetypeId;
  displayName: string;
  description: string;
  Component: ComponentType<ArchetypeProps>;
  defaultConfig: Partial<LayoutConfig>;
  supportsBlur: boolean;
  /** Paywall hook — unset everywhere today. See src/lib/subscription/optionLock.ts. */
  premium?: boolean;
}
```

- [ ] **Step 2: Write `EditTabs.tsx`**

```tsx
// src/components/palette/EditTabs.tsx
import { StyleSheet, Switch, TouchableOpacity, View } from 'react-native';

import { CropTab } from '@/components/palette/CropTab';
import { OptionCarousel } from '@/components/palette/OptionCarousel';
import { PILL_CORNER_RADIUS } from '@/components/compose/archetypes/shared';
import { Text } from '@/components/ui/Text';
import { ARCHETYPES } from '@/data/archetypes';
import { trackEvent } from '@/lib/analytics/events';
import { Colors, Spacing } from '@/lib/tokens';
import type { CardStyle, ExtractedColor, LayoutConfig } from '@/types/palette';
import { useState } from 'react';

type TabKey = 'crop' | 'archetype' | 'font' | 'corners' | 'cardStyle' | 'labels';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'crop', label: 'Recorte' },
  { key: 'archetype', label: 'Arquetipo' },
  { key: 'font', label: 'Tipografía' },
  { key: 'corners', label: 'Esquinas' },
  { key: 'cardStyle', label: 'Estilo' },
  { key: 'labels', label: 'Etiquetas' },
];

const FONT_OPTIONS: { key: LayoutConfig['fontFamily']; label: string; premium?: boolean }[] = [
  { key: 'sans', label: 'Moderna' },
  { key: 'serif', label: 'Clásica' },
  { key: 'mono', label: 'Técnica' },
];

const CORNER_OPTIONS: { key: number; label: string; premium?: boolean }[] = [
  { key: 0, label: 'Recta' },
  { key: 16, label: 'Redonda' },
  { key: PILL_CORNER_RADIUS, label: 'Píldora' },
];

// "Difuminado" (blur) is filtered out per-archetype below (see
// ArchetypeDefinition.supportsBlur in src/data/archetypes.ts) — it's a
// visual no-op on strip/grid/side, where the blurred backdrop is just the
// same flat swatch color already drawn underneath it.
const CARD_STYLE_OPTIONS: { key: CardStyle; label: string; premium?: boolean }[] = [
  { key: 'filled', label: 'Sólido' },
  { key: 'outlined', label: 'Contorno' },
  { key: 'blur', label: 'Difuminado' },
];

const LABEL_TOGGLES: { key: 'showHex' | 'showName' | 'showRGB'; label: string }[] = [
  { key: 'showHex', label: 'Mostrar hex' },
  { key: 'showName', label: 'Mostrar nombre' },
  { key: 'showRGB', label: 'Mostrar RGB' },
];

interface Props {
  paletteId: string;
  imageUri: string;
  config: LayoutConfig;
  updateConfig: (partial: Partial<LayoutConfig>) => void;
  onImageUpdated: (updates: { imageUri: string; thumbnailUri: string; colors: ExtractedColor[] }) => void;
  onLockedPress: () => void;
}

export function EditTabs({ paletteId, imageUri, config, updateConfig, onImageUpdated, onLockedPress }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('archetype');

  return (
    <View style={styles.container}>
      <View style={styles.tabBarRow}>
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={styles.tabItem}
              hitSlop={8}
            >
              <Text
                variant="small"
                weight={active ? 'semibold' : 'regular'}
                color={active ? Colors.accent : Colors.textSecondary}
              >
                {tab.label}
              </Text>
              {active && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.carouselRow}>
        {activeTab === 'crop' && (
          <CropTab paletteId={paletteId} imageUri={imageUri} onImageUpdated={onImageUpdated} />
        )}

        {activeTab === 'archetype' && (
          <OptionCarousel
            options={Object.values(ARCHETYPES).map((a) => ({
              key: a.id,
              label: a.displayName,
              premium: a.premium,
            }))}
            activeKey={config.archetypeId}
            onSelect={(archetypeId) => {
              updateConfig({ archetypeId });
              trackEvent('archetype_selected', { archetype_id: archetypeId });
            }}
            onLockedPress={onLockedPress}
          />
        )}

        {activeTab === 'font' && (
          <OptionCarousel
            options={FONT_OPTIONS}
            activeKey={config.fontFamily}
            onSelect={(fontFamily) => {
              updateConfig({ fontFamily });
              trackEvent('config_changed', { config_key: 'fontFamily' });
            }}
            onLockedPress={onLockedPress}
          />
        )}

        {activeTab === 'corners' && (
          <OptionCarousel
            options={CORNER_OPTIONS}
            activeKey={config.cornerRadius}
            onSelect={(cornerRadius) => {
              updateConfig({ cornerRadius });
              trackEvent('config_changed', { config_key: 'cornerRadius' });
            }}
            onLockedPress={onLockedPress}
          />
        )}

        {activeTab === 'cardStyle' && (
          <OptionCarousel
            options={CARD_STYLE_OPTIONS.filter(
              (opt) => opt.key !== 'blur' || ARCHETYPES[config.archetypeId].supportsBlur
            )}
            activeKey={config.cardStyle}
            onSelect={(cardStyle) => {
              updateConfig({ cardStyle });
              trackEvent('config_changed', { config_key: 'cardStyle' });
            }}
            onLockedPress={onLockedPress}
          />
        )}

        {activeTab === 'labels' && (
          <View style={styles.togglesCol}>
            {LABEL_TOGGLES.map(({ label, key }) => (
              <View key={key} style={styles.toggleRow}>
                <Text variant="body">{label}</Text>
                <Switch
                  value={config[key]}
                  onValueChange={(val) => {
                    updateConfig({ [key]: val });
                    trackEvent('config_changed', { config_key: key });
                  }}
                  trackColor={{ true: Colors.accent }}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, borderTopColor: Colors.borderDefault },
  tabBarRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.lg,
  },
  tabItem: { alignItems: 'center', paddingBottom: Spacing.xs },
  tabUnderline: { marginTop: Spacing.xs, height: 2, width: '100%', backgroundColor: Colors.accent },
  carouselRow: { paddingVertical: Spacing.sm, minHeight: 56 },
  togglesCol: { paddingHorizontal: Spacing.md },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
});
```

- [ ] **Step 3: Manual verification**

Run: `npx tsc --noEmit` — expect no errors. (Not wired into the real screen yet — Task 9 does that.)

- [ ] **Step 4: Commit**

```bash
git add src/components/palette/EditTabs.tsx src/data/archetypes.ts
git commit -m "feat: add EditTabs composing all six edit-screen option tabs"
```

---

### Task 9: Rewrite `app/palette/[id].tsx` around the fixed layout

**Files:**
- Modify: `app/palette/[id].tsx` (full rewrite of the JSX body and styles; state/handler logic for delete/export/sheets is preserved as-is)

**Interfaces:**
- Consumes: `EditTabs` (Task 8), `ArchetypeCanvas` with `maxHeight` (Task 5), `updatePaletteImage`-driven updates flow in via `EditTabs`'s `onImageUpdated`.

No automated test — this screen has never had one (no RTL in this codebase; the file's only "tests" today are the manual QA the crop/export flows already rely on). Verify manually per Step 2.

- [ ] **Step 1: Replace the file**

```tsx
// app/palette/[id].tsx
import * as Sentry from '@sentry/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArchetypeCanvas } from '@/components/compose/ArchetypeCanvas';
import { EditTabs } from '@/components/palette/EditTabs';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { StripeBar } from '@/components/ui/StripeBar';
import { Text } from '@/components/ui/Text';
import { extractColors, ExtractError } from '@/lib/color/extract';
import { exportPalette, RESOLUTIONS } from '@/lib/export/exportPalette';
import type { ExportResolution } from '@/lib/export/exportPalette';
import {
  deletePalette,
  getPalette,
  incrementExportCount,
  updatePaletteColors,
  updatePaletteLayout,
} from '@/lib/db/palettes';
import { trackEvent } from '@/lib/analytics/events';
import { canExportToday } from '@/lib/subscription/exportGate';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { Colors, Spacing, Radius } from '@/lib/tokens';
import type { LayoutConfig, Palette } from '@/types/palette';

const RESOLUTION_LABELS: { value: ExportResolution; label: string }[] = [
  { value: '1x', label: '1×' },
  { value: '2x', label: '2×' },
  { value: '4x', label: '4×' },
];

export default function PaletteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [config, setConfig] = useState<LayoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [canvasMaxHeight, setCanvasMaxHeight] = useState(0);
  const [exportSheetVisible, setExportSheetVisible] = useState(false);
  const [exportState, setExportState] = useState<'idle' | 'exporting'>('idle');
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFlushRef = useRef<(() => void) | null>(null);
  const incrementDailyExportCount = useSettingsStore((s) => s.incrementExportCount);

  const attemptExtraction = useCallback(async (target: Palette) => {
    setExtracting(true);
    try {
      const colors = await extractColors(target.thumbnailUri);
      await updatePaletteColors(target.id, colors);
      setPalette((p) => (p ? { ...p, colors } : p));
    } catch (err) {
      const reason = err instanceof ExtractError ? err.message : 'unknown';
      trackEvent('extract_failed', { reason });
      Sentry.captureException(err);
    } finally {
      setExtracting(false);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    getPalette(id).then((p) => {
      if (p) {
        setPalette(p);
        setConfig(p.layoutConfig);
        // processCapture() saves with colors: [] and doesn't wait on
        // extraction — the photo shows immediately, colors populate here a
        // moment later instead of gating navigation on it.
        if (p.colors.length === 0) attemptExtraction(p);
      }
      setLoading(false);
    });
  }, [id, attemptExtraction]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        pendingFlushRef.current?.();
      }
    };
  }, []);

  const updateConfig = useCallback((partial: Partial<LayoutConfig>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const flush = () => {
        pendingFlushRef.current = null;
        if (id) {
          updatePaletteLayout(id, next).catch(Sentry.captureException);
        }
      };
      pendingFlushRef.current = flush;
      debounceRef.current = setTimeout(flush, 500);
      return next;
    });
  }, [id]);

  async function handleDelete() {
    if (!palette) return;
    setDeleting(true);
    try {
      await deletePalette(palette.id);
      trackEvent('palette_deleted', { palette_id: palette.id, source: 'detail' });
      setDeleteSheetVisible(false);
      if (router.canDismiss()) {
        router.dismissAll();
      } else {
        router.replace('/(tabs)');
      }
    } catch (err) {
      Sentry.captureException(err);
      setDeleting(false);
    }
  }

  async function handleExport(resolution: ExportResolution) {
    if (!palette || !config) return;

    useSettingsStore.getState().resetExportCountIfNewDay();
    const { subscriptionStatus: currentSubscriptionStatus, exportDailyCount: currentExportDailyCount } =
      useSettingsStore.getState();

    if (!canExportToday(currentSubscriptionStatus, currentExportDailyCount)) {
      setExportSheetVisible(false);
      router.push({ pathname: '/paywall', params: { trigger: 'export_limit' } });
      return;
    }

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
      incrementDailyExportCount();
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingBox]}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  if (!palette || !config) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingBox]}>
        <Text variant="body" color={Colors.textSecondary}>Paleta no encontrada.</Text>
        <Button label="Volver" onPress={() => router.back()} variant="ghost" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StripeBar />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text variant="body" color={Colors.accent}>← Volver</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setDeleteSheetVisible(true)} hitSlop={8}>
            <Icon name="delete" size={22} color={Colors.error} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (router.canDismiss()) {
                router.dismissAll();
              } else {
                router.replace('/(tabs)');
              }
            }}
          >
            <Text variant="body" weight="semibold" color={Colors.accent}>Listo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={styles.canvasRegion}
        onLayout={(e) => setCanvasMaxHeight(e.nativeEvent.layout.height)}
      >
        {canvasMaxHeight > 0 && (
          <ArchetypeCanvas
            palette={palette}
            config={config}
            maxHeight={canvasMaxHeight}
            onWatermarkPress={() => {
              router.push({ pathname: '/paywall', params: { trigger: 'watermark_tap' } });
            }}
          />
        )}
      </View>

      <View style={styles.swatchStrip}>
        {palette.colors.length === 0 ? (
          <TouchableOpacity
            style={styles.retryPill}
            onPress={() => attemptExtraction(palette)}
            disabled={extracting}
          >
            <Text variant="small" color={Colors.error}>
              {extracting ? 'Extrayendo...' : 'Reintentar'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.swatchRow}>
            {palette.colors.map((c, i) => (
              <View key={i} style={[styles.swatch, { backgroundColor: c.hex }]} />
            ))}
          </View>
        )}
      </View>

      <EditTabs
        paletteId={palette.id}
        imageUri={palette.imageUri}
        config={config}
        updateConfig={updateConfig}
        onImageUpdated={(updates) => {
          setPalette((p) => (p ? { ...p, ...updates } : p));
        }}
        onLockedPress={() => {
          router.push({ pathname: '/paywall', params: { trigger: 'watermark_tap' } });
        }}
      />

      <View style={styles.exportBar}>
        <Button label="Exportar" onPress={() => setExportSheetVisible(true)} variant="primary" fullWidth />
      </View>

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

      <Sheet visible={deleteSheetVisible} onClose={() => setDeleteSheetVisible(false)}>
        <Text variant="body">¿Eliminar esta paleta? Esta acción no se puede deshacer.</Text>
        <View style={styles.confirmRow}>
          <TouchableOpacity
            style={styles.sheetAction}
            onPress={() => setDeleteSheetVisible(false)}
            disabled={deleting}
          >
            <Text variant="body">Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetAction} onPress={handleDelete} disabled={deleting}>
            <Text variant="body" color={Colors.error} weight="semibold">
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Text>
          </TouchableOpacity>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  loadingBox: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  backBtn: { alignSelf: 'flex-start' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  confirmRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg, marginTop: Spacing.md },
  sheetAction: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  canvasRegion: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  swatchStrip: {
    height: 52,
    marginHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  swatchRow: {
    flexDirection: 'row',
    height: 36,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  swatch: { flex: 1 },
  retryPill: { alignSelf: 'flex-start' },
  errorBanner: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.error,
    gap: Spacing.sm,
  },
  exportBar: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
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
});
```

- [ ] **Step 2: Manual verification**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npx jest` — expect the full existing suite (102+ tests, now +9 from Tasks 1-3) to pass.

On a device/simulator (dev-client build — Expo Go cannot run this app's native modules, see spec):
- Capture a photo (camera and gallery) → confirm you land on this screen immediately with the full photo, swatch strip shows "Extrayendo..." briefly then real color chips.
- Tap through all six tabs (Recorte, Arquetipo, Tipografía, Esquinas, Estilo, Etiquetas) → confirm the canvas updates live per selection, exactly as the old sections did.
- Recorte tab: pick a ratio → native cropper opens → confirm on save the photo, swatches, and canvas all update; cancel → confirm you land back on the Recorte tab with no error.
- Confirm Exportar (bottom bar), Eliminar (header), and Volver/Listo all still work as before.

- [ ] **Step 3: Commit**

```bash
git add app/palette/\[id\].tsx
git commit -m "feat: rewrite edit screen around fixed tab-bar + carousel layout"
```

---

## Self-Review Notes

- **Spec coverage:** flow change → Tasks 3-4; fixed layout (canvas/swatch/tabs/export) → Task 9; Recorte tab → Tasks 2, 7; paywall hook → Tasks 1, 6, 8; testing section → each task's own notes; extensibility field → Task 8 Step 1. No gaps found.
- **Deviation from spec, called out explicitly:** the spec's file list suggested one component per tab (`ArchetypeTab.tsx`, `FontTab.tsx`, etc.). This plan consolidates four of those (archetype/font/corners/card-style) into one generic `OptionCarousel` (Task 6) driven by data, since they were structurally identical — DRY per this codebase's own conventions. `CropTab` and the Etiquetas toggle block stay as the spec's two special cases (native-cropper flow and toggle switches respectively).
- **Deviation from spec, called out explicitly:** the spec described `extractColors` running "after navigation, non-blocking" as part of the capture pipeline. This plan implements that exact UX by having the edit screen's own mount effect auto-trigger extraction when it loads a palette with empty colors (Task 9), rather than firing a detached promise inside `processCapture` — this avoids a race between navigation and a promise nobody awaits, and reuses the screen's existing `extracting`/retry UI verbatim.
- **Placeholder scan:** no TBD/TODO/"add error handling" phrases; every step has real code.
- **Type consistency check:** `ExtractedColor` type used consistently across `CropTab`, `EditTabs`, `processCapture`, and the rewritten `palette/[id].tsx`. `updatePaletteImage`'s return shape `{ imageUri, thumbnailUri }` matches exactly what `CropTab` destructures and what `EditTabs`'s `onImageUpdated` merges into local state. `CarouselOption<T extends string | number>` covers both string keys (archetype id, font, card style) and the numeric `cornerRadius` key.
