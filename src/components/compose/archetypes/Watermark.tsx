import { useMemo } from 'react';
import { matchFont, RoundedRect, Text } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

import { FONT_FAMILIES } from '@/components/compose/archetypes/shared';

const WATERMARK_TEXT = 'hued';
const WATERMARK_FONT_SIZE = 17;
const WATERMARK_PAD_X = 10;
const WATERMARK_PAD_Y = 6;
// Gap between the pill and the right edge of the canvas.
const WATERMARK_MARGIN = 14;
// Nudges the mark a little below the exact vertical center. At cornerRadius =
// PILL_CORNER_RADIUS the safe placement is the ellipse vertex at (width, height/2)
// (see the doc comment below), but the exact center of a 5-row `SideArchetype`
// (rowH = height/5) lands squarely between that row's own hex/name text baselines.
// This offset is small enough that the pill stays inside the safe ellipse for every
// cornerRadius preset, while landing in the gap between SideArchetype's mid-row
// hex and name text instead of straddling them.
const WATERMARK_VERTICAL_OFFSET = 10;
// The mark can sit over an arbitrary photo or swatch color and is drawn last, so
// it covers any card placed under it. A dark translucent pill keeps the white
// wordmark readable on light cards too, which a bare 60% white never was.
const WATERMARK_PILL_COLOR = 'rgba(0,0,0,0.55)';
const WATERMARK_COLOR = 'rgba(255,255,255,0.95)';

// Same sans family used elsewhere for on-canvas text — imported from shared.tsx's
// FONT_FAMILIES rather than re-derived here (the watermark isn't tied to the
// palette's fontFamily config, it's a fixed app mark independent of the
// archetype's own typography choices).
const WATERMARK_FONT_FAMILY = Platform.OS === 'ios' ? FONT_FAMILIES.sans.ios : FONT_FAMILIES.sans.android;

interface Props {
  width: number;
  height: number;
  /**
   * config.cornerRadius, pre-clamp. Not read by the position math below — the
   * right-edge/vertically-centered placement is deliberately chosen so it lands
   * inside Skia's rrect clip for every cornerRadius preset, so no per-preset
   * branching is needed. Accepted anyway so callers stay honest about the
   * dependency this placement contract has on cornerRadius.
   */
  cornerRadius: number;
}

// The pill is sized from an approximate text width (Skia's Text has no built-in
// layout), so the draw code and the tap region below stay in sync without a font.
function getPillRect(width: number, height: number) {
  const approxTextWidth = WATERMARK_TEXT.length * WATERMARK_FONT_SIZE * 0.6;
  const pillW = approxTextWidth + WATERMARK_PAD_X * 2;
  const pillH = WATERMARK_FONT_SIZE + WATERMARK_PAD_Y * 2;
  return {
    x: width - WATERMARK_MARGIN - pillW,
    y: height / 2 + WATERMARK_VERTICAL_OFFSET - pillH / 2,
    width: pillW,
    height: pillH,
  };
}

/**
 * "hued" wordmark on a dark pill, rendered in design-unit space (same
 * CANVAS_W/CANVAS_H coordinates as the archetype content and getCardFrame's clip)
 * so it stays proportionally placed whether drawn at live-preview scale or export
 * raster resolution.
 *
 * Positioning: getCardFrame builds the clip as
 * `rrect(rect(0, 0, width, height), cornerRadius, cornerRadius)`. Skia's SkRRect
 * clamps rx to at most width/2 and ry to at most height/2 *independently*. At the
 * "Píldora" preset (`PILL_CORNER_RADIUS`) both hit their clamps at once, so on
 * this canvas (360 x 450) the rrect degenerates into a full ellipse inscribed in
 * the rect, touching the left/right edges only at (0, height/2) and
 * (width, height/2). The right-edge, vertically-centered placement is safe because
 * it sits next to that vertex, where the ellipse is nearly vertical: for the pill
 * (29 tall, nudged 10 below center) the ellipse still reaches x of about 359 of
 * 360, past the pill's right edge at 346. Corner placements would be cut off at
 * this preset, and the Instagram profile grid (3:4) trims about 3% per side of a
 * 4:5 export, which the 14-unit margin clears.
 */
export function Watermark({ width, height }: Props) {
  const font = useMemo(
    () => matchFont({ fontFamily: WATERMARK_FONT_FAMILY, fontSize: WATERMARK_FONT_SIZE, fontWeight: 'bold' }),
    []
  );

  const pill = getPillRect(width, height);
  const x = pill.x + WATERMARK_PAD_X;
  // Baseline that visually centers the lowercase wordmark (it has an ascender) in the pill.
  const y = pill.y + pill.height / 2 + WATERMARK_FONT_SIZE * 0.35;

  return (
    <>
      <RoundedRect
        x={pill.x}
        y={pill.y}
        width={pill.width}
        height={pill.height}
        r={pill.height / 2}
        color={WATERMARK_PILL_COLOR}
      />
      <Text x={x} y={y} text={WATERMARK_TEXT} font={font} color={WATERMARK_COLOR} />
    </>
  );
}

/**
 * The screen region (in the same design-unit space as `Watermark`'s own math above)
 * a tap target should cover to hit the rendered mark. Kept in this file, next to
 * the render math it mirrors, so the two never drift apart — `ArchetypeCanvas.tsx`
 * uses this to position an absolutely-positioned `Pressable` sibling of the Skia
 * `<Canvas>` (Skia text isn't natively tappable).
 */
export function getWatermarkTapRegion(width: number, height: number) {
  const pill = getPillRect(width, height);
  const tapWidth = 64;
  const tapHeight = 44;
  return {
    x: pill.x + pill.width / 2 - tapWidth / 2,
    y: pill.y + pill.height / 2 - tapHeight / 2,
    width: tapWidth,
    height: tapHeight,
  };
}
