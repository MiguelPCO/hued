# Edit Screen Redesign: Tabbed Carousels + No-Crop-Screen Capture Flow

## Problem

Current post-capture flow forces a blocking crop screen (`app/crop.tsx`) before
the user ever sees the edit screen. The edit screen itself (`app/palette/[id].tsx`,
542 lines) stacks six option sections vertically in one long `ScrollView`
(Arquetipos, Tipografía, Esquinas, Estilo de tarjeta, Etiquetas, plus the
canvas preview and export button). This makes editing feel sequential and
scroll-heavy rather than a free-form single surface, and forces a ratio
decision before the user has seen their photo full-size.

## Goals

- After capture/gallery pick, land directly on the edit screen showing the
  full, uncropped photo — no intermediate crop screen.
- Restructure the edit screen into fixed regions: photo/canvas on top, a tab
  bar below it, and a single active carousel of options per tab — instead of
  one long vertical scroll of stacked sections.
- Cropping becomes one tab among the others (applied on demand), not a
  gate before editing.
- Leave a hook for future per-option paywall gating (which options get
  locked behind which plan is a later decision, out of scope here).

## Non-goals

- Deciding which specific options are premium-gated. Only add the
  `premium?: boolean` field, unused (`false`/absent) everywhere.
- Changing the export flow, paywall screen, or subscription model.
- Reordering/renaming color swatches (chip tap-to-edit stays out of scope).

## Flow Change

**Before:** capture/gallery → `/crop` (pick ratio → native `ImageCropPicker`
→ optimize/thumbnail → `savePalette` → `extractColors`, all blocking on one
screen) → `/palette/[id]`.

**After:** capture/gallery → optimize/thumbnail → `savePalette` (default
layout config) → push `/palette/[id]` immediately. `extractColors` runs
after navigation, non-blocking — the edit screen already shows the full
photo while swatches populate a moment later (same empty/error/retry UI
already used today when extraction fails).

`app/crop.tsx` is deleted as a route. Its native-cropper invocation moves
into the new Recorte tab (see below), triggered on demand instead of as a
mandatory step.

New shared pipeline: `src/lib/capture/processCapture.ts` extracts the
optimize→thumbnail→save→extract sequence that currently lives inline in
`crop.tsx` (lines ~86-127), so both camera and gallery entry points
(`app/(tabs)/capture.tsx`, `app/(tabs)/index.tsx`) call the same function
instead of duplicating it.

## Edit Screen Layout

Fixed regions, top to bottom, no outer `ScrollView`:

1. **Header** (unchanged): Volver / Eliminar / Listo.
2. **Photo/canvas region** (~55-60% of screen height): `ArchetypeCanvas`,
   re-rendering live on every option change exactly as it does today.
3. **Swatch strip**: thin horizontal row of color chips. Empty-colors state
   shows an inline "Reintentar" pill instead of today's full banner.
4. **Tab bar**: six tabs — Recorte, Arquetipo, Tipografía, Esquinas,
   Estilo, Etiquetas. Horizontally scrollable if it overflows; active tab
   gets the existing pill-active styling (accent background).
5. **Active carousel row**: single horizontal scroll of pills for whichever
   tab is selected, reusing the existing `archPill`/`archPillActive` style
   from today's sections. **Exception:** the Etiquetas tab renders three
   stacked `Switch` toggles (Mostrar hex/nombre/RGB) instead of pills,
   since toggles aren't carousel-able content.
6. **Export bar**: fixed at the very bottom, always visible — replaces
   today's button at the bottom of the scroll.

### Recorte tab

Pills: `1:1`, `4:5`, `9:16`, `Original` — same four ratios as today's crop
screen. Tapping one opens `ImageCropPicker` with that aspect (or
`freeStyleCropEnabled` for Original), identical to the existing
`handleCrop` logic in `crop.tsx`. On confirm: re-run optimize/thumbnail,
update the palette's `imageUri`/`thumbnailUri`, re-run `extractColors`,
canvas refreshes with the new image. Cancelling the native cropper is a
no-op — stays on the Recorte tab, no error shown (matches today's
user-cancel handling).

## Paywall Extensibility Hook

Each tab's option definitions (archetypes, font choices, corner radii,
card styles) gain an optional `premium?: boolean` field. It is not set to
`true` anywhere in this change — purely a hook point. When a future change
does set it, tapping a `premium: true` pill should route to `/paywall`
the same way today's watermark tap does
(`router.push({ pathname: '/paywall', params: { trigger: '...' } })`).
Which options become premium, and under what trigger name, is a separate
decision.

## Files Touched

- `app/(tabs)/capture.tsx`, `app/(tabs)/index.tsx` — call
  `processCapture()` and push straight to `/palette/[id]` instead of
  routing to `/crop`.
- New `src/lib/capture/processCapture.ts` — shared optimize + thumbnail +
  `savePalette` + background `extractColors` pipeline.
- `app/crop.tsx` — deleted.
- New `src/components/palette/tabs/`: `ArchetypeTab.tsx`, `FontTab.tsx`,
  `CornersTab.tsx`, `CardStyleTab.tsx`, `LabelsTab.tsx`, `CropTab.tsx` —
  each wraps one existing section's option list as a carousel/toggle
  component, receiving `config`/`updateConfig` as props (same pattern
  `palette/[id].tsx` already uses internally).
- New `src/components/palette/EditTabs.tsx` — tab bar + renders the active
  tab's component.
- `app/palette/[id].tsx` — rewritten to compose the fixed layout
  (header, canvas, swatch strip, `EditTabs`, export bar) instead of the
  current flat `ScrollView` of sections. Existing state/handlers
  (`updateConfig`, `handleExport`, `handleDelete`, `handleRetry`, export
  sheet, delete sheet) are retained as-is.
- `src/data/archetypes.ts` and the inline option arrays in
  `palette/[id].tsx` (font/corner/card-style lists) — add optional
  `premium?: boolean` field to each entry's type, unused for now.

## Error Handling

- Background `extractColors` failure after the new flow: same as today —
  `palette.colors` stays `[]`, swatch strip shows the retry pill, tracked
  via `trackEvent('extract_failed', ...)` and `Sentry.captureException`.
- Recorte tab native-cropper failure (non-cancel): show existing error
  banner pattern inline under the tab bar, reusing `errorBanner` style;
  tracked via `Sentry.captureException`, same as today's `crop.tsx`.
- User-cancels native cropper: no error, silent return to Recorte tab.

## Testing

No existing RTL/component tests cover `palette/[id].tsx` today — only
`exportGate`, `settingsStore`, `archetypes/shared`, and `PaletteGrid` have
test coverage. Plan:

- Unit tests for each extracted tab component (`ArchetypeTab`, `FontTab`,
  `CornersTab`, `CardStyleTab`, `LabelsTab`) covering pill-selection →
  `updateConfig` call shape, and premium-flag pass-through (even though
  unused, verify it doesn't break rendering).
- Unit test for `processCapture.ts` pipeline with mocked `FileSystem`,
  `db/palettes`, and `extractColors`.
- Manual on-device QA for: camera → edit screen full-photo flow, gallery →
  edit screen flow, Recorte tab → native cropper round-trip → canvas
  refresh. The native cropper (`react-native-image-crop-picker`) cannot be
  exercised in Expo Go — requires the dev-client APK build already in
  progress from the SDK57 upgrade work.
