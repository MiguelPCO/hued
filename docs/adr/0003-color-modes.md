---
status: accepted
---

# Colour modes: filter pixels before k-means, persist per palette, reset only Libre

The Colores tab lets the user choose *which* colours to pull from the photo: **Temperatura** (cálidos, fríos, neutros), **Propiedades** (más vivos, más claros, más oscuros, apagados), **Familias** (six hues plus pasteles, tierra, neutros) and, later, a **Cuentagotas** for picking a point by hand. "Auto" is the previous behaviour. Thresholds live in one file (`src/lib/color/colorModes.ts`) so they can be tuned against real photos.

Decisions that are easy to get wrong later:

1. **Filter pixels, then k-means.** Samples that don't fit the mode are dropped *before* clustering, so every swatch is a mean of pixels that really are, say, warm. Clustering first and picking afterwards would return "the warmest of five averages", which can be a colour that is not warm at all. Filtered pools never invent colours: fewer distinct colours than the requested size fills fewer swatches (never fewer than 3, the smallest layout); a pool under ~2 % of the photo (or smaller than the requested size) throws `NoMatchError`, the palette stays as it was and an inline notice appears under the chips.
2. **Extraction is deterministic.** k-means++ seeding used `Math.random()`, so the same photo gave a different palette each time — unacceptable once the same pixels are re-filtered on every size or mode change. The seed is now derived from the sample pool. Palettes already saved are untouched.
3. **Mode is persisted per palette in `layoutConfig`** (`colorMode`, `colorOption`; rows saved before read as `auto` through `DEFAULT_LAYOUT_CONFIG`) and re-applied whenever colours are re-extracted: size change and crop. If a crop leaves no pixels of the chosen kind, extraction falls back to auto and the mode is set back to auto with the same notice.
4. **Changing mode resets only `freeformSwatches`.** Libre swatches point into `palette.colors` by index (ADR-0001) and the new colours are a different set, so Libre goes back to its `libreSource` layout. Corners, card style, fonts, opacity and scales are the user's look, not a function of the colours, so they stay.
5. **Cuentagotas replaces one swatch in place** (keeps its index and `weight`, no re-sort, recomputes hex/rgb/lab/name), and the mode then reads "Manual". Hand-picked colours are discarded silently by the next re-extraction, consistent with ADR-0001's "indices don't survive re-extraction".

Everything is free: no Pro gate and no paywall trigger.
