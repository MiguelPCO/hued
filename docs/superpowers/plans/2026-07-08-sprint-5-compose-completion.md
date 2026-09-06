# Sprint 5 — Compose Completion + Color Naming

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Context

Sprints 1, 2, and 4 (capture, extract+compose, export+history) are implemented and merged. A gap audit against `PRD.md`/`SCHEMA.md`/`SPRINTS.md` found that Sprint 2's compose work shipped a reduced subset of its own spec: the `LayoutConfig` type carries `fontFamily`, `cornerRadius`, `cardStyle`, and `watermarkVisible` fields, but only `cornerRadius` and `cardStyle` are actually read anywhere, and even those have no UI to change them — the on-screen config panel only exposes an archetype picker and three metadata toggles (hex/name/RGB). `fontFamily` and `watermarkVisible` are dead: defined, defaulted, never rendered. Separately, `extract.ts` sorts colors by cluster weight instead of the spec'd light→dark by L-channel, and the color-naming dataset is a 54-entry placeholder instead of the ~1500-entry `color-name-list` dataset SCHEMA/SPRINTS describe. The two archetype-dispatch sites (`ArchetypeCanvas.tsx`, `exportPalette.tsx`) each hardcode their own conditional chain over the 5 archetype components instead of using the data-driven `Record<ArchetypeId, Archetype>` registry SCHEMA.md designs — blocking any future template growth beyond 5.

This sprint finishes what Sprint 2 started: complete the config panel, build the archetype registry, fix extraction correctness, and replace the naming placeholder. Monetization/paywall/onboarding (referenced as "Sprint 5" in a `settings.tsx` code comment — that placeholder gets renamed to "Sprint 6" in this sprint to avoid confusion) is explicitly out of scope; RevenueCat account and pricing aren't decided yet.

**Deliberate scope reduction vs. SCHEMA.md** (call these out, don't silently reinterpret):
- SCHEMA's `SlotPosition` (`position` field: top/bottom/left/right/center per-archetype slot anchor) is **not built this sprint**. The 5 archetypes have fixed internal layouts today; making position configurable means redesigning each archetype's internal geometry around a slot system — a bigger architectural project than "finish the config panel." `position: number` stays dead/unused in the type; do not remove the field (would need a DB shape decision) — just leave it alone.
- SCHEMA's `CornerRadius` enum (`'sharp'|'rounded'|'pill'`) and `FontKey` enum are **not adopted as stored types**. `cornerRadius` stays `number` (existing render/export code already consumes it correctly; changing the stored type would need a migration for zero user benefit). The config panel instead offers 3 preset buttons that write specific numbers into the existing numeric field. Same idea for fonts: `fontFamily` stays `string`, panel offers 3 preset values (`'sans' | 'serif' | 'mono'`).
- `CardStyle` grows from 2 values to 3 (`'filled' | 'outlined' | 'blur'`) — additive, no migration needed for existing `'filled'`/`'outlined'` rows.

## Global Constraints

- TypeScript strict, no `any`.
- Every DB-persisted config change goes through the existing `updateConfig`/500ms-debounce/`pendingFlushRef` pattern already in `app/palette/[id].tsx` — do not build a second persistence path.
- Skia is the only rendering system for archetype output. The export path (`exportPalette.tsx`) uses `drawAsImage()` — a single-pass offscreen render with **no native views** in the tree (this is why `expo-blur` cannot be used for the "blur" card style; it's a native view, not a Skia primitive, and would render as blank/missing in `drawAsImage()` output). Any blur must be a Skia effect (`BackdropBlur` or equivalent `ImageFilter` blur in the installed `@shopify/react-native-skia` version) so preview and export stay visually identical.
- `ArchetypeCanvas.tsx` (preview) and `exportPalette.tsx` (export) must keep producing pixel-identical layouts at their respective scales — every new render feature (font, corner radius, card style, watermark) goes into both call sites via the same shared code, not duplicated by hand a second time.
- Match existing code style: Spanish UI strings, existing `Colors`/`tokens` design system, existing `trackEvent()` analytics calls alongside new config controls (follow the pattern already at `app/palette/[id].tsx:203,234`).

## File Map

| Action | Path | Responsibility |
|--------|------|-----------------|
| Modify | `src/lib/color/extract.ts` | Sort final colors light→dark by L channel instead of by weight |
| Modify | `src/lib/color/__tests__/extract.test.ts` | Rewrite order assertions for L-based sort |
| Create | `scripts/preprocess-colors.ts` | Build-time script: read `color-name-list` npm package, curate + compute LAB, write `src/data/named-colors.json` |
| Modify | `package.json` | Add `color-name-list` dependency; add `preprocess-colors` script |
| Create | `src/data/named-colors.json` | ~1500-entry generated dataset (name + rgb + lab) |
| Modify | `src/lib/color/colorNames.ts` | Load `named-colors.json` instead of the 54-entry hardcoded array; keep `findColorName(lab)` signature |
| Create | `src/lib/color/__tests__/colorNames.test.ts` | Snapshot test: 20 known RGB values → expected names |
| Create | `src/data/archetypes.ts` | `Record<ArchetypeId, ArchetypeDefinition>` registry: `displayName`, `description`, `Component`, `defaultConfig` |
| Modify | `src/components/compose/ArchetypeCanvas.tsx` | Replace conditional-chain dispatch with registry lookup |
| Modify | `src/lib/export/exportPalette.tsx` | Replace `renderArchetype()` switch with the same registry lookup |
| Modify | `app/palette/[id].tsx` | Archetype picker sources labels from registry instead of local `ARCHETYPES` const |
| Modify | `app/crop.tsx` | New-palette seed config uses `ARCHETYPES.strip.defaultConfig` merged over `DEFAULT_LAYOUT_CONFIG` instead of the flat constant alone |
| Modify | `src/components/compose/archetypes/shared.ts` | `useArchetypeFonts` takes a `fontKey: 'sans'\|'serif'\|'mono'` param, maps to per-platform system font family names; add shared `useCardFrame(config, width, height)` returning `{ clip, overlay }` for clip + outlined-stroke + blur-backdrop, used by both `ArchetypeCanvas.tsx` and `exportPalette.tsx` to delete their duplicated inline clip/`RoundedRect` logic |
| Modify | `src/types/palette.ts` | `fontFamily: string` → `fontFamily: 'sans' \| 'serif' \| 'mono'`; `CardStyle` gains `'blur'` |
| Create | `src/components/compose/archetypes/Watermark.tsx` | Small Skia text/mark component, bottom-right inset |
| Modify | `src/components/compose/ArchetypeCanvas.tsx`, `src/lib/export/exportPalette.tsx` | Render `<Watermark>` when `config.watermarkVisible` (both call sites, via the same shared wrapper) |
| Modify | `app/palette/[id].tsx` | Add font-preset row (3 buttons: Sans/Serif/Mono) and corner-radius-preset row (3 buttons: Sharp/Rounded/Pill → numeric values) to the config panel; extend the card-style control from a toggle to a 3-way picker (Filled/Outlined/Blur) |
| Modify | `src/components/palette/PaletteGrid.tsx` | Add `ListEmptyComponent` distinguishing "no palettes yet" vs. "no matches for filter/search" |
| Modify | `app/(tabs)/settings.tsx:13` | Rename placeholder comment/text from "Sprint 5" to "Sprint 6" (monetization sprint, not yet planned) |

## Tasks

### Task 1 — Fix extraction sort order
`src/lib/color/extract.ts` currently does `colors.sort((a, b) => b.weight - a.weight)` (dominant cluster first). PRD §5.2 and SPRINTS Sprint 2 acceptance criteria require light→dark by L channel. Change the final sort to `colors.sort((a, b) => b.l - a.l)` (or whatever the per-color lightness field is named after `rgbToLab`/`rgbToHsl` conversion already present in the file — inspect the `ExtractedColor` shape before writing the comparator; use the L component, descending = light-to-dark). Rewrite `src/lib/color/__tests__/extract.test.ts`'s order assertions (currently asserting weight-descending, lines ~45-52) to assert L-descending instead. Keep every other behavior (k-means, dedup, claimed-set reseed logic) untouched.

### Task 2 — Generate the color-naming dataset
Add `color-name-list` (npm package referenced by name in `SPRINTS.md` Day 4 tasks) as a dependency. Write `scripts/preprocess-colors.ts`: load the package's color list, curate it per SPRINTS.md guidance (drop generic/numeric names like "color1234", prefer evocative/paint-style names), compute LAB for each surviving entry via the existing `rgbToLab` in `src/lib/color/colorMath.ts`, and write the result to `src/data/named-colors.json` as an array of `{ name: string; rgb: [number, number, number]; lab: [number, number, number] }`. Add an npm script (`"preprocess-colors": "ts-node scripts/preprocess-colors.ts"` or the project's existing script-running convention — check `package.json` for how other one-off scripts run) and run it once to commit the generated JSON (~1500 entries, not regenerated at app runtime or app build time — it's a committed static asset like the existing exercise/data JSON files elsewhere in the codebase).

### Task 3 — Rewrite the color-naming lookup to use the generated dataset
`src/lib/color/colorNames.ts` currently hardcodes 54 `NamedColor` entries and lazily computes LAB via a module-level cache. Replace the hardcoded array with `import namedColors from '@/data/named-colors.json'` (LAB already precomputed by Task 2 — no runtime LAB conversion needed). Keep `findColorName(lab): string` and its O(n) nearest-neighbor Euclidean-distance-in-LAB-space signature and fallback (`'Desconocido'`) unchanged — only the data source changes. Add `src/lib/color/__tests__/colorNames.test.ts`: a snapshot test asserting 20 known RGB values resolve to their expected names (pick colors spread across the LAB space — pure red/green/blue/black/white plus ~15 mid-tones — to catch dataset-loading regressions).

### Task 4 — Build the archetype registry
Create `src/data/archetypes.ts` exporting `ARCHETYPES: Record<ArchetypeId, ArchetypeDefinition>` where `ArchetypeDefinition = { id: ArchetypeId; displayName: string; description: string; Component: React.ComponentType<ArchetypeProps>; defaultConfig: Partial<LayoutConfig> }`. Populate all 5 entries (strip/editorial/grid/banner/side), importing each archetype component from `src/components/compose/archetypes/*.tsx`. Pick sensible `defaultConfig` per archetype (e.g. editorial → `{ fontFamily: 'serif', cardStyle: 'filled' }`, others → `{ fontFamily: 'sans', cardStyle: 'filled' }` — match the tone of each archetype's visual style). `displayName`/`description` come from the existing local `ARCHETYPES` label array in `app/palette/[id].tsx:28` (Franja/Editorial/Cuadrícula/Banner/Lateral) — reuse those Spanish labels, don't invent new copy.

Then: (a) `ArchetypeCanvas.tsx` replaces its 5-line JSX conditional chain (lines 32-36) with `const { Component } = ARCHETYPES[config.archetypeId]; <Component {...archetypeProps} />`. (b) `exportPalette.tsx` deletes its `renderArchetype()` switch function (lines 26-40) and does the same registry lookup inline. (c) `app/palette/[id].tsx` deletes its local `ARCHETYPES` label array (line 28) and maps over `Object.values(ARCHETYPES)` from the new registry for the archetype-picker pills (lines 195-215), using `.displayName` instead of `.label`. (d) `app/crop.tsx`'s new-palette save flow seeds `LayoutConfig` from `{ ...DEFAULT_LAYOUT_CONFIG, ...ARCHETYPES[DEFAULT_LAYOUT_CONFIG.archetypeId].defaultConfig }` instead of the flat `DEFAULT_LAYOUT_CONFIG` alone.

### Task 5 — Font presets wired into config
`src/types/palette.ts`: narrow `fontFamily: string` to `fontFamily: 'sans' | 'serif' | 'mono'`. `src/components/compose/archetypes/shared.ts`: replace the hardcoded `FONT_FAMILY` constant with a lookup map, e.g.:
```ts
const FONT_FAMILIES: Record<'sans' | 'serif' | 'mono', { ios: string; android: string }> = {
  sans: { ios: 'Helvetica Neue', android: 'Roboto' },
  serif: { ios: 'Georgia', android: 'serif' },
  mono: { ios: 'Courier', android: 'monospace' },
};
```
`useArchetypeFonts(fontKey, hexSize, nameSize)` picks `Platform.OS === 'ios' ? FONT_FAMILIES[fontKey].ios : FONT_FAMILIES[fontKey].android` and passes it to `matchFont` exactly as today — this is system-font matching via Skia's font manager, no bundled font assets needed (`serif`/`monospace` are valid Android generic-family aliases; `Georgia`/`Courier` are valid iOS system font names). Update every archetype component's `useArchetypeFonts(...)` call to pass `config.fontFamily` as the new first argument. In `app/palette/[id].tsx`, add a 3-button row (Sans/Serif/Mono, Spanish labels e.g. "Moderna"/"Clásica"/"Técnica" — pick short labels consistent with existing pill style at lines 198-213) that calls `updateConfig({ fontFamily: key })` + `trackEvent('config_changed', { config_key: 'fontFamily' })`, matching the existing pattern.

### Task 6 — Corner radius presets
Add a 3-button row to the config panel (Sharp/Rounded/Pill) writing specific numeric values into the existing `cornerRadius: number` field — no type change needed (render code in `ArchetypeCanvas.tsx`/`exportPalette.tsx` already consumes `config.cornerRadius` as a number correctly). Suggested values: Sharp = `0`, Rounded = `16` (current default is `8` — bump the "Rounded" preset intentionally higher so it's visually distinct from Sharp; keep `DEFAULT_LAYOUT_CONFIG.cornerRadius` at its existing `8` for backward compatibility with already-saved palettes, or align it to one of the 3 presets — implementer's call, note which was chosen), Pill = `Math.min(CANVAS_W, CANVAS_H) / 2` computed at render time relative to whichever canvas size is active (360×450 preview vs. the scaled export size) rather than a fixed number, so "pill" always fully rounds the shorter edge regardless of resolution.

### Task 7 — Card style: add "blur", dedupe clip/outline logic
`src/types/palette.ts`: `CardStyle` becomes `'filled' | 'outlined' | 'blur'`. Investigate `@shopify/react-native-skia`'s installed version for its backdrop-blur primitive (`BackdropBlur` or the equivalent `ImageFilter`-based blur composited over a clipped region — check the package's TypeScript exports/docs; it must be a pure-Skia effect, not `expo-blur`, per the Global Constraints note on `drawAsImage()`). Extract the currently-duplicated clip/outline logic (present near-identically in `ArchetypeCanvas.tsx:26-50` and `exportPalette.tsx:49,62-73`) into a shared `useCardFrame(config: LayoutConfig, width: number, height: number)` helper in `src/components/compose/archetypes/shared.ts`, returning whatever the two call sites need (e.g. `{ clip, outlineElement, blurElement }`) so both files render identically without hand-duplicating the new blur branch a second time. Wire the config panel's existing card-style `Switch` (lines 219-238 area is the toggles section; card-style control doesn't exist yet in the panel today — confirm by reading the full toggles block before assuming) into a 3-way picker matching the archetype-pill visual style, not a binary `Switch`.

### Task 8 — Watermark component
Create `src/components/compose/archetypes/Watermark.tsx`: a small Skia `<Group>` with a text mark (e.g. "hued" wordmark or similar minimal branding — check if `src/lib/tokens.ts` or existing assets define an app wordmark/logo constant to reuse; if not, plain Skia `<Text>` with the app name in a small, low-opacity treatment is sufficient) positioned bottom-right with a small inset (SCHEMA.md's example uses `x={width - 120} y={height - 24}` as a rough anchor — adapt to the actual canvas dimensions). Render `<Watermark>` from both `ArchetypeCanvas.tsx` and `exportPalette.tsx` when `config.watermarkVisible` is true, as a sibling to the archetype `Component` inside the same clipped group (not per-archetype — one shared render, gated once, at the canvas level in both files, per the Global Constraints note that preview and export must stay identical).

### Task 9 — PaletteGrid empty-state + settings.tsx comment rename
`src/components/palette/PaletteGrid.tsx`: the `visible` list (computed via `useMemo`, filtering by favorite + search) has no `ListEmptyComponent`. Add one that distinguishes `palettes.length === 0` ("no palettes yet" — check if this state already has copy elsewhere, e.g. in `app/(tabs)/index.tsx`'s empty-state handling, and don't duplicate it if `PaletteGrid` is only ever mounted when palettes already exist) from `visible.length === 0 && palettes.length > 0` ("no matches for current filter/search" — this is the actual gap, Spanish copy e.g. "Sin resultados para tu búsqueda"). Also, in the same task, rename the placeholder comment/text at `app/(tabs)/settings.tsx:13` from "Sprint 5" to "Sprint 6" (this plan claims the Sprint 5 name for compose completion; monetization is deferred and unplanned, so its placeholder reference should say Sprint 6 to avoid confusion with this plan).

## Verification

- `npx tsc --noEmit` clean.
- `npx jest` — all existing + new tests green (extract.test.ts rewritten, colorNames.test.ts new).
- Manual pass in Expo Go or dev client (per current reanimated-v4/Expo-Go incompatibility, use whichever the user has working): open an existing palette, confirm archetype switching still works via the registry-driven picker, toggle each new control (3 fonts, 3 corner radii, 3 card styles including blur) and confirm the preview updates live and persists after navigating away and back (debounced save round-trip). Trigger an export at 1x and confirm the exported PNG visually matches the on-screen preview pixel-for-pixel in layout (font, corner radius, card style, watermark all present).
- Confirm `PaletteGrid`'s new empty state appears when searching/filtering to zero results on a library with ≥1 palette, and does not appear on first load with palettes present.
