# Sprint 2 — Extract + Compose Design Spec

**Goal:** User can take a photo → see extracted colors → pick a layout archetype → see a styled palette card preview.

**Date:** 2026-05-18  
**Status:** Approved

---

## Overview

Seven subsystems built in dependency order:

```
crop.tsx
  └─ savePalette()          [existing]
  └─ extractColors()        [new] — Skia pixel sampling on thumbnail
  └─ updatePaletteColors()  [new] — writes colors[] to SQLite
  └─ router → /palette/[id]

app/(tabs)/index.tsx
  └─ PaletteGrid            [new] — FlatList 2-col, loads listPalettes()
  └─ PaletteCard            [new] — thumbnail + color strip preview

app/palette/[id].tsx        [new — stub registered in _layout.tsx]
  └─ ComposeView            [new] — image + swatches + archetype selector
  └─ ArchetypeCanvas        [new] — Skia Canvas wrapper
      └─ StripArchetype
      └─ EditorialArchetype
      └─ GridArchetype
      └─ BannerArchetype
      └─ SideArchetype
```

---

## Color Extraction

**Approach:** Skia-only, no new native deps.

**Pipeline:**
1. `makeImageFromEncoded(thumbnailBytes)` — decode 200×200 thumbnail
2. `readPixels()` → `Uint8Array` (RGBA, ~160 KB)
3. Sample every 4th pixel → 2,500 RGB samples
4. k-means++ init (k=5, max 20 iterations, RGB distance)
5. Per cluster: compute hex, rgb, lab (RGB→XYZ→LAB), hslLightness, weight (% assigned pixels)
6. Color name: closest LAB distance against `src/lib/color/colorNames.ts` (~150 CSS named colors)
7. Sort by weight DESC → `colors[0]` is always dominant

**API:**
```typescript
// src/lib/color/extract.ts
export async function extractColors(thumbnailUri: string): Promise<ExtractedColor[]>
// always returns exactly 5 colors
// throws ExtractError on Skia decode failure
```

**Performance target:** < 200ms on mid-range Android (Skia decode + 2500-sample k-means).

**Tests:** `src/lib/color/__tests__/extract.test.ts` — mock Skia, inject synthetic pixel array, verify 5 clusters returned, verify sort by weight.

---

## DB Updates

Add to `src/lib/db/palettes.ts`:

```typescript
export async function updatePaletteColors(id: string, colors: ExtractedColor[]): Promise<void>
// UPDATE palettes SET colors = ?, updated_at = ? WHERE id = ?

export async function updatePaletteLayout(id: string, config: LayoutConfig): Promise<void>
// UPDATE palettes SET layout_config = ?, updated_at = ? WHERE id = ?
```

No schema migration needed — `colors` and `layout_config` columns already exist as TEXT (JSON).

---

## Navigation Flow

### After save (crop.tsx)
```
savePalette() 
  → show "Extrayendo colores…" spinner
  → extractColors(thumbnailUri)
  → updatePaletteColors(id, colors)
  → router.replace('/palette/' + id)   ← replaces crop in back stack
```

On `extractColors` failure: show error toast, navigate to home (`/(tabs)`). Palette is saved with `colors: []`.

### From grid (home)
```
listPalettes() on mount + useFocusEffect refetch
  → PaletteGrid renders
  → tap PaletteCard → router.push('/palette/' + id)
```

### Compose exit
- Back button → pops to previous screen
- `LayoutConfig` changes → auto-saved via `updatePaletteLayout()` with 500ms debounce
- No explicit "Guardar" button needed

---

## Palette Grid

**Home screen state machine:**
- `palettes.length === 0` → existing empty state (Cámara + Galería buttons)
- `palettes.length > 0` → `PaletteGrid` + FAB (FAB always visible for quick capture)
- Loading → 3 skeleton placeholder cards

**`PaletteGrid`** (`src/components/palette/PaletteGrid.tsx`):
- `FlatList` with `numColumns={2}`
- Fetches via `listPalettes()`, refreshes on focus via `useFocusEffect`
- No pagination in Sprint 2

**`PaletteCard`** (`src/components/palette/PaletteCard.tsx`):
```
┌─────────────────┐
│   <Image>       │  thumbnailUri, square aspect ratio
│   (thumbnail)   │
├─▓─▓─▓─▓─▓──────┤  5 color swatches (flex row, equal width)
│  12 may 2026    │  formatDateEs(createdAt)
└─────────────────┘
```
- Tap → `onPress(palette.id)`
- No swipe / long-press in Sprint 2

---

## Compose Screen (`app/palette/[id].tsx`)

### Layout
```
┌──────────────────────────────┐
│  ← back                      │  header
├──────────────────────────────┤
│                              │
│    [Skia ArchetypeCanvas]    │  4:5 aspect ratio, full screen width
│                              │
├──────────────────────────────┤
│  ▓ ▓ ▓ ▓ ▓                  │  5 color swatches (display only in S2)
├──────────────────────────────┤
│  ARQUETIPOS                  │
│  [strip][editorial][grid]..  │  horizontal ScrollView, pill buttons
├──────────────────────────────┤
│  Mostrar hex        ○        │
│  Mostrar nombre     ●        │  toggle row per LayoutConfig bool field
│  Mostrar RGB        ○        │
└──────────────────────────────┘
```

### Data loading
- `getPalette(id)` on mount
- If `colors.length === 0`: show error banner "No se pudieron extraer los colores" + "Reintentar" button (re-runs extraction)
- `layoutConfig` stored in local state, auto-saved with 500ms debounce on change

---

## Archetype Renderer

**`ArchetypeCanvas`** (`src/components/compose/ArchetypeCanvas.tsx`):
- `<Canvas>` fixed internal size 360×450 (4:5), `style` scales to screen width
- Selects child by `layoutConfig.archetypeId`
- Applies global `cornerRadius` via `<RoundedRect>` clip path
- Applies `cardStyle: 'outlined'` via border stroke

**Shared props for all archetype components:**
```typescript
interface ArchetypeProps {
  palette: Palette;
  config: LayoutConfig;
  width: number;   // 360
  height: number;  // 450
}
```

**5 archetype layouts:**

| Archetype | Description |
|-----------|-------------|
| `strip` | Image top 70%, 5 equal-width color bars bottom 30%, hex/name labels in bars |
| `editorial` | Full-bleed image, dark gradient overlay bottom third, 5 color dots + palette name on gradient |
| `grid` | 2×3 grid: cell[0] spans 2 cols (image), cells[1–5] are solid color blocks with hex labels |
| `banner` | Image fills frame, 5-color strip pinned to bottom edge, semi-transparent bar |
| `side` | Image left 60%, vertical 5-color stack right 40% with hex labels |

**Skia primitives used:** `<Group>`, `<Rect>`, `<RoundedRect>`, `<Image>`, `<Text>`, `<Paint>`, `<LinearGradient>`, `<Circle>` (editorial dots).

No unit tests for archetype components — visual output verified on device.

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/lib/utils/dateUtils.ts` (formatDateEs helper) |
| Create | `src/lib/color/extract.ts` |
| Create | `src/lib/color/colorNames.ts` |
| Create | `src/lib/color/__tests__/extract.test.ts` |
| Modify | `src/lib/db/palettes.ts` (add updatePaletteColors, updatePaletteLayout) |
| Create | `src/lib/db/__tests__/palettes-update.test.ts` |
| Modify | `app/crop.tsx` (extraction + navigate to palette/[id]) |
| Create | `src/components/palette/PaletteGrid.tsx` |
| Create | `src/components/palette/PaletteCard.tsx` |
| Modify | `app/(tabs)/index.tsx` (swap empty state for PaletteGrid) |
| Create | `app/palette/[id].tsx` |
| Create | `src/components/compose/ArchetypeCanvas.tsx` |
| Create | `src/components/compose/archetypes/StripArchetype.tsx` |
| Create | `src/components/compose/archetypes/EditorialArchetype.tsx` |
| Create | `src/components/compose/archetypes/GridArchetype.tsx` |
| Create | `src/components/compose/archetypes/BannerArchetype.tsx` |
| Create | `src/components/compose/archetypes/SideArchetype.tsx` |

---

## Analytics Events (already defined in events.ts)

- `extract_completed: { duration_ms, image_size_kb }` — after successful extraction
- `extract_failed: { reason }` — on ExtractError
- `archetype_selected: { archetype_id }` — when user taps archetype pill
- `config_changed: { config_key }` — when user toggles showHex/showName/showRGB

---

## Out of Scope (Sprint 2)

- Export / share palette as image
- Paywall / watermark removal
- Color swatch tap → edit color
- Favorites / delete from grid
- fontFamily / cornerRadius / cardStyle controls in compose UI (data model exists, UI deferred)
- Pagination of palette grid
