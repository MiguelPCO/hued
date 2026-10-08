---
status: accepted
---

# Libre archetype: swatch geometry is ephemeral per-session state, not preserved across palette-size changes

The Libre archetype stores per-swatch position/size, keyed by color index in `palette.colors`. When the user changes palette size (3–8), `extractColors` re-runs and colors are re-sorted by luminosity, so an index no longer refers to "the same" color. We decided **not** to attempt migrating old positions onto the new color set: on any palette-size change, all swatch geometry resets to the base layout of the archetype Libre was chosen from, for the new count. The alternative (best-effort remapping by nearest color, or preserving by index) trades a small UX convenience for a real class of silent-bug risk (positions that look intentional but map to the wrong color), for a cost the user pays by re-dragging in seconds. The same reset applies to the free-drag/resize interaction model itself: swatches may overlap freely (z-order = last-touched-to-front, no collision avoidance) but are clamped within canvas bounds (never partially exported off-frame), since "what you see is what you export" is a harder constraint to violate than "swatches shouldn't touch."
