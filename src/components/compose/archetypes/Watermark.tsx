import { useMemo } from 'react';
import { matchFont, Text } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

import { FONT_FAMILIES } from '@/components/compose/archetypes/shared';

const WATERMARK_TEXT = 'hued';
const WATERMARK_FONT_SIZE = 11;
const WATERMARK_MARGIN = 20;
// Nudges the watermark a little below the exact vertical center. At
// cornerRadius = PILL_CORNER_RADIUS the safe placement is the ellipse
// vertex at (width, height/2) (see the doc comment below), but the exact
// center of a 5-row `SideArchetype` (rowH = height/5) lands squarely
// between that row's own hex/name text baselines with very little
// clearance. This offset is small enough that the position stays deep
// inside the safe ellipse for every cornerRadius preset (see the ellipse
// math in the doc comment below), while landing in the gap between
// SideArchetype's mid-row hex and name text instead of straddling them.
const WATERMARK_VERTICAL_OFFSET = 10;
const WATERMARK_COLOR = 'rgba(255,255,255,0.6)';
// The watermark can sit over an arbitrary photo or swatch color (this
// component has no knowledge of what's behind it — unlike the archetype
// text, which picks its color via shared.tsx's getContrastTextColor from a
// known swatch lightness). Rather than sample pixels under the mark (real
// scope creep for a discreet corner/edge wordmark), draw a soft dark
// duplicate offset a hair behind the white glyph — a standard cheap
// watermark technique — so there's always some contrast against light
// backgrounds without the mark reading as a black smudge on dark ones.
const WATERMARK_SHADOW_COLOR = 'rgba(0,0,0,0.35)';
const WATERMARK_SHADOW_OFFSET = 0.75;

// Same sans family used elsewhere for on-canvas text — imported from
// shared.tsx's FONT_FAMILIES rather than re-derived here (the watermark
// isn't tied to the palette's fontFamily config, it's a fixed, discreet app
// mark independent of the archetype's own typography choices, but it should
// still resolve iOS/Android the same way the rest of the app does).
const WATERMARK_FONT_FAMILY = Platform.OS === 'ios' ? FONT_FAMILIES.sans.ios : FONT_FAMILIES.sans.android;

interface Props {
  width: number;
  height: number;
  /**
   * config.cornerRadius, pre-clamp. Not read by this component's own
   * position math below — the right-edge/vertically-centered placement is
   * deliberately chosen so it lands inside Skia's rrect clip for every
   * cornerRadius preset, from Sharp (0) up through Pill (see the doc
   * comment on `Watermark` for why), so no per-preset branching on this
   * value is needed. Accepted anyway (rather than dropped) so callers stay
   * honest about the dependency this component's *placement contract* has
   * on cornerRadius, and so a future change to the placement strategy (e.g.
   * reverting to a corner anchor for Sharp/Rounded) has the value already
   * threaded through both call sites without another prop-plumbing pass.
   */
  cornerRadius: number;
}

/**
 * Small "hued" wordmark rendered in design-unit space (same CANVAS_W/CANVAS_H
 * coordinates as the archetype content and getCardFrame's clip) so it stays
 * proportionally correctly placed whether drawn at live-preview scale or
 * export raster resolution.
 *
 * Positioning: getCardFrame builds the clip as
 * `rrect(rect(0, 0, width, height), cornerRadius, cornerRadius)`. Skia's
 * SkRRect clamps rx to at most width/2 and ry to at most height/2
 * *independently* — it does not clamp them proportionally to preserve a
 * shared max. At the config panel's "Píldora" preset
 * (`PILL_CORNER_RADIUS`, shared.tsx — deliberately far larger than either
 * half-dimension), BOTH rx and ry hit their respective clamps at once. On
 * this canvas (width=360 ≠ height=450) that means the corner arcs consume
 * the *entire* straight run on every edge simultaneously: 2×rx = width and
 * 2×ry = height, so no flat segment survives on the top/bottom or the
 * left/right edges. The rrect degenerates into a full ellipse inscribed in
 * the rect — not a "stadium" with a surviving flat run. That ellipse
 * touches the left/right edges at exactly one point each: its vertices at
 * (0, height/2) and (width, height/2).
 *
 * So the right-edge, vertically-centered placement isn't safe because a
 * flat run "never disappears" (it does, completely, at this preset) — it's
 * safe because it sits at the ellipse's own vertex, a point of zero
 * curvature along the vertical tangent, which is inside the clip by
 * construction for every cornerRadius from 0 up to this max (smaller
 * presets like Sharp/Rounded intrude far less at the corners, leaving a
 * wide literal flat run that comfortably contains the same position too).
 * `WATERMARK_VERTICAL_OFFSET` nudges a few pixels off that exact vertex to
 * dodge `SideArchetype`'s mid-canvas row text (see its constant's doc
 * comment) — the offset is small enough that the position stays well
 * inside the ellipse at every preset (verified: at height/2 + 10, the
 * ellipse still permits x up to ~359.8 out of width 360).
 */
export function Watermark({ width, height, cornerRadius }: Props) {
  const font = useMemo(
    () => matchFont({ fontFamily: WATERMARK_FONT_FAMILY, fontSize: WATERMARK_FONT_SIZE }),
    []
  );

  // Approximate text width so the mark is inset from the right edge rather
  // than merely starting near it (Skia's Text has no built-in text-align).
  const approxTextWidth = WATERMARK_TEXT.length * WATERMARK_FONT_SIZE * 0.6;
  const x = width - WATERMARK_MARGIN - approxTextWidth;
  const y = height / 2 + WATERMARK_VERTICAL_OFFSET;

  return (
    <>
      <Text
        x={x + WATERMARK_SHADOW_OFFSET}
        y={y + WATERMARK_SHADOW_OFFSET}
        text={WATERMARK_TEXT}
        font={font}
        color={WATERMARK_SHADOW_COLOR}
      />
      <Text x={x} y={y} text={WATERMARK_TEXT} font={font} color={WATERMARK_COLOR} />
    </>
  );
}

/**
 * The screen region (in the same design-unit space as `Watermark`'s own
 * `x`/`y` math above) a tap target should cover to hit the rendered mark.
 * Kept in this file, next to the render math it mirrors, so the two never
 * drift apart — `ArchetypeCanvas.tsx` uses this to position an absolutely-
 * positioned `Pressable` sibling of the Skia `<Canvas>` (Skia text isn't
 * natively tappable).
 */
export function getWatermarkTapRegion(width: number, height: number) {
  const approxTextWidth = WATERMARK_TEXT.length * WATERMARK_FONT_SIZE * 0.6;
  const centerX = width - WATERMARK_MARGIN - approxTextWidth / 2;
  const centerY = height / 2 + WATERMARK_VERTICAL_OFFSET;
  const tapWidth = 64;
  const tapHeight = 44;
  return {
    x: centerX - tapWidth / 2,
    y: centerY - tapHeight / 2,
    width: tapWidth,
    height: tapHeight,
  };
}
