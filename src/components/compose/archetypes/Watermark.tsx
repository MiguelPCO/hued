import { useMemo } from 'react';
import { matchFont, Text } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

import { FONT_FAMILIES } from '@/components/compose/archetypes/shared';

const WATERMARK_TEXT = 'hued';
const WATERMARK_FONT_SIZE = 11;
const WATERMARK_MARGIN = 20;
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
   * effective radius from 0 up to width/2 (see the doc comment on
   * `Watermark` for why), so no per-preset branching on this value is
   * needed. Accepted anyway (rather than dropped) so callers stay honest
   * about the dependency this component's *placement contract* has on
   * cornerRadius, and so a future change to the placement strategy (e.g.
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
 * Positioning: this canvas is always portrait (height > width — see
 * CANVAS_W/CANVAS_H in ArchetypeCanvas.tsx/exportPalette.tsx), so Skia's
 * rrect clip (SkRRect::setRectXY) can never clamp the corner radius past
 * width/2. At that maximum the card becomes a "stadium" shape — semicircular
 * caps on the short top/bottom axis, but a flat vertical run down the middle
 * of the left/right edges that exists (and shrinks, but never disappears)
 * for every radius from 0 up to that max. Anchoring the watermark against
 * the right edge, vertically centered on the canvas, keeps it inside that
 * guaranteed-flat run for every cornerRadius preset (Sharp/Rounded/Pill)
 * without per-preset special-casing. This trades the old "bottom-right
 * corner" resting spot (fine for Sharp/Rounded, but which floats outside the
 * clip entirely under Pill) for a placement that's provably always inside
 * the visible card, regardless of cornerRadius.
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
  const y = height / 2;

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
