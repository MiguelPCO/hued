import { useMemo } from 'react';
import { matchFont, Text } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

const WATERMARK_TEXT = 'hued';
const WATERMARK_FONT_SIZE = 11;
const WATERMARK_MARGIN = 20;
const WATERMARK_COLOR = 'rgba(255,255,255,0.6)';

// Same sans family used elsewhere for on-canvas text (see shared.tsx's
// FONT_FAMILIES) — the watermark isn't tied to the palette's fontFamily
// config, it's a fixed, discreet app mark independent of the archetype's
// own typography choices.
const WATERMARK_FONT_FAMILY = Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto';

interface Props {
  width: number;
  height: number;
}

/**
 * Small "hued" wordmark inset from the bottom-right corner, rendered in
 * design-unit space (same CANVAS_W/CANVAS_H coordinates as the archetype
 * content and getCardFrame's clip) so it stays proportionally correctly
 * placed whether drawn at live-preview scale or export raster resolution.
 */
export function Watermark({ width, height }: Props) {
  const font = useMemo(
    () => matchFont({ fontFamily: WATERMARK_FONT_FAMILY, fontSize: WATERMARK_FONT_SIZE }),
    []
  );

  // Approximate text width so the mark is inset from the right edge rather
  // than merely starting near it (Skia's Text has no built-in text-align).
  const approxTextWidth = WATERMARK_TEXT.length * WATERMARK_FONT_SIZE * 0.6;
  const x = width - WATERMARK_MARGIN - approxTextWidth;
  const y = height - WATERMARK_MARGIN;

  return <Text x={x} y={y} text={WATERMARK_TEXT} font={font} color={WATERMARK_COLOR} />;
}
