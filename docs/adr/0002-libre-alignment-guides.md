---
status: accepted
---

# Libre archetype: alignment guides are always-on, ephemeral, and priority-ordered

The Libre archetype's free drag/resize (ADR-0001) gives users full positional freedom but no help lining swatches up with each other or with the canvas. We added **guías de alineación**: while dragging, the swatch's X and Y snap independently to the canvas center, the group's bounding-box center (computed from the other swatches, excluding the one being dragged), or another swatch's edges/centers, within a 6px threshold (design-space units, 360×450 canvas). While resizing, width and height independently snap to another swatch's width/height within a 6px difference — resize never snaps position, only size, since the two rarely apply at once and mixing them would need an arbitrary tie-break rule for no clear benefit.

Three decisions here are easy to get wrong later, so recording them:

1. **Always-on, no toggle.** A small, easily-overridden threshold (drag 10px further and you're past it) makes an opt-out control redundant complexity. If real users report the snap fighting their intent, the fix is likely a threshold change, not a settings toggle.
2. **Fixed candidate priority: canvas center → group center → other swatches.** When multiple candidates fall within the threshold on the same axis, the two "stable" references (canvas center, group center — neither moves mid-drag) win over other swatches, so the result is deterministic rather than depending on gesture history or z-order.
3. **No guide at the canvas edges.** The existing hard clamp (ADR-0001) already stops the drag physically at the boundary; a guide line there would repeat feedback the user already has.

Rendering lives entirely in the RN View overlay layer (`LibreEditOverlay.tsx`), never inside the Skia `<Canvas>` — consistent with ADR-0001's overlay/scene-graph split, since guide state is UI-gesture-only and has no reason to reach the pure `Component({palette, config, ...})` archetype renderer. Guides are never persisted: they're computed fresh each frame from the current `freeformSwatches` and discarded on release.
