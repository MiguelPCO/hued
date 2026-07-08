import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { BackdropBlur, matchFont, rect, RoundedRect, rrect } from '@shopify/react-native-skia';
import type { SkRRect } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

import { Primitive } from '@/lib/tokens';
import type { LayoutConfig } from '@/types/palette';

const FONT_FAMILIES: Record<'sans' | 'serif' | 'mono', { ios: string; android: string }> = {
  sans: { ios: 'Helvetica Neue', android: 'Roboto' },
  serif: { ios: 'Georgia', android: 'serif' },
  mono: { ios: 'Courier', android: 'monospace' },
};

// Outline stroke width and blur radius are expressed in the same pre-scale
// design-unit space as `cornerRadius`, so both scale consistently between
// the small on-screen preview and the larger export raster.
const OUTLINE_STROKE_WIDTH = 2;
// Moderate frosted-glass strength: visible "blur" without erasing the
// underlying photo/swatch content entirely. Sits mid-range of the 8-16
// window suggested for a backdrop blur that reads as "frosted" rather than
// "barely soft" (near 8) or "opaque smear" (near 16).
const BLUR_RADIUS = 12;

export function getContrastTextColor(hslLightness: number): string {
  return hslLightness > 0.5 ? Primitive.black : Primitive.white;
}

export function useArchetypeFonts(fontKey: 'sans' | 'serif' | 'mono', hexSize: number, nameSize: number) {
  const fontFamily = Platform.OS === 'ios' ? FONT_FAMILIES[fontKey].ios : FONT_FAMILIES[fontKey].android;
  const hexFont = useMemo(() => matchFont({ fontFamily, fontSize: hexSize }), [fontFamily, hexSize]);
  const nameFont = useMemo(() => matchFont({ fontFamily, fontSize: nameSize }), [fontFamily, nameSize]);
  return { hexFont, nameFont };
}

export interface CardFrame {
  /** Corner-radius clip shared by the archetype content and the blur overlay. */
  clip: SkRRect;
  /** Renderable style overlay for the current `cardStyle` (null for 'filled'). */
  overlay: ReactElement | null;
}

/**
 * Derives the clip region and cardStyle overlay ('outlined' stroke or 'blur'
 * backdrop) shared by ArchetypeCanvas.tsx (live preview) and
 * exportPalette.tsx (offscreen raster). Not a hook — rrect/rect/JSX
 * construction here is cheap, and exportPalette calls this from a plain
 * async function rather than a component render, where hooks aren't valid.
 */
export function getCardFrame(config: LayoutConfig, width: number, height: number): CardFrame {
  const clip = rrect(rect(0, 0, width, height), config.cornerRadius, config.cornerRadius);

  let overlay: ReactElement | null = null;
  if (config.cardStyle === 'outlined') {
    overlay = (
      <RoundedRect
        x={1}
        y={1}
        width={width - 2}
        height={height - 2}
        r={config.cornerRadius}
        color="transparent"
        strokeWidth={OUTLINE_STROKE_WIDTH}
        style="stroke"
      />
    );
  } else if (config.cardStyle === 'blur') {
    overlay = <BackdropBlur blur={BLUR_RADIUS} clip={clip} />;
  }

  return { clip, overlay };
}
