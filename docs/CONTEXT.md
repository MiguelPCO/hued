# Hued

Palette-from-photo app: extract a color palette from a picture, compose it back over the photo in a fixed visual layout, export the result.

## Language

**Archetype**:
A named visual layout for compositing extracted colors over the full-bleed source photo (Pila, Mosaico, Escalonado, Columnas, Libre). Each archetype is a pure rendering function of `(palette, config)`; the four card archetypes take their swatch geometry from a **base layout**.
_Avoid_: Template, layout, style (style is a narrower concept — see Card style below).

**Base layout**:
The approved arrangement of one card archetype for one palette size (3-8): where each card goes (in reading order, which is also the color order) plus the look it comes with (corners, opacity, font, size, label placement). 24 of them live in `src/data/baseLayouts.ts`. Picking an archetype or changing the palette size applies the whole base look; the user's size / spacing / opacity / text settings then adjust it.
_Avoid_: Preset, template (a base layout is data for an archetype, not a separate thing the user picks).

**Libre archetype**:
The archetype where swatch geometry is user-placed: the user drags each swatch to any position on the photo and picks its size. It starts from the base layout of the archetype it was chosen from (`libreSource`) and returns to it on reset or when the palette size changes. Distinct from the other archetypes, which have no per-swatch position data at all.
_Avoid_: Freeform mode, custom layout (this repo's canonical name for the feature is "Libre", matching the Spanish-language UI).

**Swatch**:
A single rendered color block for one extracted color, with its metadata label (hex/name/RGB, per the global label toggles). In the four card archetypes, swatch position and size come from the base layout. In the Libre archetype, swatch position and size are per-swatch, user-controlled data.

**Card style**:
The fill treatment of a swatch's background — `filled`, `outlined`, or `blur` — orthogonal to the archetype's swatch geometry.

**Palette size**:
The number of colors a palette is extracted into (3–8, user-selectable). Distinct from a specific palette's `colors.length`, which is the palette size at the time of extraction.
_Avoid_: Color count (fine in conversation, but `paletteSize` is the field name).

**Guías de alineación** (alignment guides):
Ephemeral visual snapping in the Libre archetype: while dragging a swatch, its position snaps per-axis to the canvas center, the group's bounding-box center, or another swatch's edges/centers; while resizing, its width/height independently snap to another swatch's width/height. Never persisted — exists only for the duration of the gesture. See docs/adr/0002-libre-alignment-guides.md.
_Avoid_: Snapping, smart guides (those are the generic/industry terms; this repo's canonical name is the Spanish one, matching the rest of the Libre UI).
