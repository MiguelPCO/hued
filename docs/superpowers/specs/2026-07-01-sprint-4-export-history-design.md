# Sprint 4 — Export + History Design Spec

**Goal:** User can export the composed palette as a PNG at a chosen resolution, save it to the camera roll, share it via the native share sheet, and manage saved palettes (favorite, search, duplicate, delete) from the History grid.

**Date:** 2026-07-01
**Status:** Approved

---

## Overview

Five subsystems, in dependency order:

```
src/lib/export/exportPalette.ts   [new] — drawAsImage() offscreen render, no
                                    changes needed to ArchetypeCanvas.tsx

app/palette/[id].tsx
  └─ "Exportar" button            [new] — opens export Sheet (in-page, not a route)
  └─ exportPalette(palette, config, resolution)
  └─ expo-media-library.saveToLibraryAsync
  └─ expo-sharing.shareAsync

src/lib/db/palettes.ts
  └─ toggleFavorite(id)           [new]
  └─ duplicatePalette(id)         [new]
  └─ deletePalette(id)            [new]

app/(tabs)/index.tsx + PaletteGrid.tsx + PaletteCard.tsx
  └─ favorite heart icon          [new]
  └─ filter pills (Todas/Favoritas) [new]
  └─ search bar (client-side filter over colors[].name) [new]
  └─ long-press action sheet (Favorito/Duplicar/Compartir/Eliminar) [new]
```

No new native modules beyond `expo-media-library` and `expo-sharing` (both official Expo SDK packages already compatible with the installed SDK 54). No `react-native-view-shot` — Skia's own snapshot API is used instead (see below). No watermark logic (deferred to Sprint 5, when a real free/premium distinction exists).

---

## 1. Canvas capture (Skia offscreen render, no visible mount)

**Why not `react-native-view-shot`:** the compose screen already renders through `@shopify/react-native-skia`'s GPU-backed `<Canvas>`. Skia exposes its own offscreen rendering API, which draws directly to a Skia surface — no extra native dependency, no risk of view-shot missing GL-backed content, and exact pixel control over the output size (independent of on-screen scale).

**Revised during planning:** `@shopify/react-native-skia` ships `drawAsImage(element: ReactElement, size: SkSize): Promise<SkImage>` (`renderer/Offscreen`). It renders a tree of Skia primitives (`<Group>`, `<Rect>`, `<Text>`, etc — exactly what the archetype components are built from) directly to an `SkImage` with **no mounted `<Canvas>` at all**, on- or off-screen. This is simpler than the originally-planned "mount an invisible `ArchetypeCanvas` and snapshot it" approach: no ref forwarding, no offscreen positioning hacks, no mount/wait-a-frame/unmount lifecycle. `ArchetypeCanvas.tsx` needs **no changes** — export re-renders the same archetype components (`StripArchetype`, etc.) directly through `drawAsImage`, reusing 100% of the per-archetype drawing logic. The ~10-line `<Group transform>`/clip/outlined-border wrapper is duplicated between `ArchetypeCanvas.tsx` (on-screen) and `exportPalette.ts` (export) — an acceptable small duplication, since it's stable scaffolding, not the part that actually varies.

**New file `src/lib/export/exportPalette.ts`:**
```typescript
export type ExportResolution = '1x' | '2x' | '4x';

const RESOLUTIONS: Record<ExportResolution, { width: number; height: number }> = {
  '1x': { width: 1080, height: 1350 },
  '2x': { width: 2160, height: 2700 },
  '4x': { width: 4320, height: 5400 },
};

// Renders the archetype tree via Skia's drawAsImage() at the target
// resolution (base design units 360x450, scaled up — same ratio the
// on-screen ArchetypeCanvas uses), encodes to PNG, and writes the result
// to the cache directory (expo-file-system).
export async function exportPalette(
  palette: Palette,
  config: LayoutConfig,
  resolution: ExportResolution
): Promise<string> // returns file:// URI of the written PNG
```

**Test:** `src/lib/export/__tests__/exportPalette.test.ts` — mock `drawAsImage` (verify it's called with the correct `{width, height}` per resolution) and mock the returned `SkImage`'s `encodeToBase64`, verify the returned URI is written via `FileSystem.writeAsStringAsync` (base64).

---

## 2. Export flow (in-page `Sheet`, not a routed modal)

Triggered from a new "Exportar" button added to `app/palette/[id].tsx` (below the swatch row / archetype picker, above bottom padding). Implemented as local component state + the existing `Sheet` primitive (`src/components/ui/Sheet.tsx`) — no new Expo Router route/file. This matches how `Sheet` was designed to be used, and avoids adding another `Stack.Screen` entry (the project already has two unused ones — `paywall`, `onboarding` — that log console warnings every load; not adding a third for something that's inherently a transient overlay, not a navigable screen).

**Flow:**
1. Button opens `Sheet` (reusing `src/components/ui/Sheet.tsx`) with 3 pill options: 1× / 2× / 4×, each showing pixel dimensions as a subtitle ("1080 × 1350", etc).
2. On selection: `screenState = 'exporting'` (reuse existing `ActivityIndicator` pattern from `crop.tsx`).
3. `exportPalette(palette, config, resolution)` → local PNG URI.
4. `MediaLibrary.requestPermissionsAsync()` if not already granted → if denied, show inline error banner ("Activa el permiso de fotos en Ajustes del dispositivo") — same non-dead-end pattern as `CameraView`/gallery permission denial. Do not attempt share/save if denied; let user retry after fixing permission.
5. `MediaLibrary.saveToLibraryAsync(uri)`.
6. `Sharing.isAvailableAsync()` → `Sharing.shareAsync(uri, { mimeType: 'image/png' })`.
7. `updateExportCount(palette.id)` (new, increments existing `export_count` column).
8. `trackEvent('palette_exported', { palette_id, resolution, archetype_id: config.archetypeId })`.
9. Close sheet, return to compose screen.

**Errors:** any step (permission denial aside) wrapped in try/catch → `Sentry.captureException`, inline error message, `screenState` back to idle so user can retry.

**Long-press "Compartir" from History (see §4):** skips the resolution sheet, calls `exportPalette(palette, config, '2x')` directly (2× chosen as sane default — matches the "quick share" UX already decided), then steps 4-6 only (no export count bump duplication — reuse the same helper).

---

## 3. Favorites + search (Home tab)

**`src/lib/db/palettes.ts` — new function:**
```typescript
export async function toggleFavorite(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE palettes SET is_favorite = NOT is_favorite, updated_at = ? WHERE id = ?',
    Date.now(), id
  );
}
```

**`PaletteCard.tsx`:** heart icon (filled/outline based on `palette.isFavorite`) in a corner of the thumbnail. Tap toggles optimistically in local state (via a callback prop `onToggleFavorite`) before the DB write resolves — matches the "localStorage-first, fire-and-forget" pattern already used elsewhere in this codebase for offline-first UX. On DB failure: revert local state, `Sentry.captureException`.

**`PaletteGrid.tsx`:** add `filter: 'all' | 'favorites'` and `query: string` props (lifted state from `app/(tabs)/index.tsx`, since the search bar and filter pills live above the grid). Filtering happens client-side over the already-fetched `palettes` array:
```typescript
const filtered = palettes
  .filter(p => filter === 'all' || p.isFavorite)
  .filter(p => !query || p.colors.some(c =>
    normalize(c.name).includes(normalize(query))
  ));
```
`normalize()` = lowercase + strip diacritics (`.normalize('NFD').replace(/[̀-ͯ]/g, '')`) so "indigo" matches "Índigo".

**`app/(tabs)/index.tsx`:** search `TextInput` + two filter pills ("Todas" / "Favoritas", same pill visual style as the archetype picker in compose) added above `PaletteGrid`, only shown when `hasPalettes` is true (empty state unaffected). Empty-filtered-result state: reuse the same empty-state visual pattern but with different copy ("No hay paletas favoritas" / "Sin resultados para '{query}'").

---

## 4. History actions (long-press action sheet)

**`src/lib/db/palettes.ts` — two new functions:**
```typescript
export async function deletePalette(id: string): Promise<void> {
  const palette = await getPalette(id);
  const db = await getDb();
  await db.runAsync('DELETE FROM palettes WHERE id = ?', id);
  if (palette) {
    const dir = palette.imageUri.replace(/full\.jpg$/, '');
    await FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => {});
  }
}

export async function duplicatePalette(id: string): Promise<Palette> {
  const source = await getPalette(id);
  if (!source) throw new Error('Palette not found');
  const newId = ulid();
  const baseDir = FileSystem.documentDirectory!;
  const newDir = `${baseDir}palettes/${newId}/`;
  await FileSystem.makeDirectoryAsync(newDir, { intermediates: true });
  await FileSystem.copyAsync({ from: source.imageUri, to: `${newDir}full.jpg` });
  await FileSystem.copyAsync({ from: source.thumbnailUri, to: `${newDir}thumb.jpg` });
  // insert new row, same colors/layoutConfig, createdAt = now
  // (mirrors savePalette's insert, factored into a shared private helper
  //  to avoid duplicating the 10-column INSERT twice in this file)
}
```
Both wrapped in try/catch matching the `savePalette` cleanup pattern (delete partial dir on failure for `duplicatePalette`).

**`PaletteCard.tsx`:** `onLongPress` opens a `Sheet` with 4 rows: Favorito (toggle, label switches "Marcar/Quitar de favoritos"), Duplicar, Compartir, Eliminar (styled in `Colors.error`).
- **Eliminar**: does NOT use a native `Alert.alert` confirm dialog (per this session's earlier finding that native dialogs block the automation/event loop in some contexts, and to stay consistent with the rest of the app's in-app confirmation patterns e.g. account deletion in Settings uses double-confirm in-UI, per project memory). Instead: tapping "Eliminar" swaps the sheet content to an inline confirm state ("¿Eliminar esta paleta? Esta acción no se puede deshacer." + Cancelar/Eliminar buttons) before calling `deletePalette`.
- **Duplicar**: calls `duplicatePalette(id)`, closes sheet, prepends result to local `palettes` state (no full refetch needed), `trackEvent` not required by SCHEMA.md's EventMap (no event defined for duplicate — skip tracking, don't invent an event type not in the spec).
- **Compartir**: calls the 2× direct-share path from §2.

---

## Error handling summary

Every new async path follows the existing codebase convention: try/catch, `Sentry.captureException(err)` on unexpected failure, inline error UI (never a native `Alert`/dialog), and a way to retry without losing app state. Permission denials (media library) are never dead-ends — same "explain + let user fix in system settings + retry" pattern as `CameraView.tsx`.

## Testing

- `src/lib/db/__tests__/palettes.test.ts` (existing file) — add cases for `toggleFavorite`, `duplicatePalette` (verifies file copy + new row), `deletePalette` (verifies row + files gone).
- `src/lib/export/__tests__/exportPalette.test.ts` — new, mocked Skia surface, verifies resolution → pixel dimension mapping.
- New pure function for search normalization/filtering gets its own small unit test (no mocks needed).

## Explicitly out of scope (per user decisions this session)

- Watermarks / free-tier gating (Sprint 5, needs RevenueCat first).
- `react-native-view-shot` (Skia native snapshot used instead).
- SQL-level search (client-side filter chosen instead, dataset size doesn't warrant it).
- Any onboarding/paywall route wiring (separate Sprint 5 spec).
