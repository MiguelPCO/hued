import type { ReactElement, ReactNode } from 'react';
import { useMemo } from 'react';
import { BackdropBlur, matchFont, rect, RoundedRect, rrect } from '@shopify/react-native-skia';
import type { SkRRect } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

import { Primitive } from '@/lib/tokens';
import type { SubscriptionStatus } from '@/lib/store/settingsStore';
import type { LayoutConfig } from '@/types/palette';

// Sentinel `cornerRadius` value for the config panel's "Píldora" (Pill)
// preset (app/palette/[id].tsx). Deliberately far larger than any real
// half-dimension of the canvas so it always clamps to the maximum the Skia
// rrect will allow, regardless of which canvas size (preview vs. any export
// resolution) is active — see the correctness note on that clamping
// behavior in `Watermark.tsx`'s doc comment.
export const PILL_CORNER_RADIUS = 9999;

export const FONT_FAMILIES: Record<'sans' | 'serif' | 'mono', { ios: string; android: string }> = {
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

/**
 * Free-tier users always see the watermark, regardless of their per-palette
 * `watermarkVisible` config — Sprint 6's gating rule. Premium users' own
 * preference is respected as-is.
 */
export function shouldRenderWatermark(watermarkVisible: boolean, status: SubscriptionStatus): boolean {
  return watermarkVisible || status === 'free';
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
 * Derives the clip region and cardStyle overlay shared by ArchetypeCanvas.tsx
 * (live preview) and exportPalette.tsx (offscreen raster). Not a hook —
 * rrect/rect/JSX construction here is cheap, and exportPalette calls this
 * from a plain async function rather than a component render, where hooks
 * aren't valid.
 *
 * `'blur'` has no whole-card overlay: blurring the entire painted card
 * (photo + swatches + hex/name/RGB text) would blur the metadata text into
 * illegibility, since `BackdropBlur` has no children here to render sharp on
 * top. Instead each archetype applies `wrapMetadataInBlur` locally, per
 * swatch, so only the frosted color patch sits behind its own crisp text.
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
  }

  return { clip, overlay };
}

/**
 * Wraps an archetype's metadata text (hex/name labels) in a local
 * `BackdropBlur` scoped to that swatch's own region, when `cardStyle` is
 * `'blur'`. The swatch's color `Rect`/`Circle` itself is drawn separately,
 * full-color and unblurred (color accuracy matters) — only the text's own
 * backdrop is frosted, with the text rendered sharp on top via
 * `BackdropBlur`'s children. For any other `cardStyle`, returns `node`
 * unchanged so behavior is identical to before this helper existed.
 */
export function wrapMetadataInBlur(
  config: LayoutConfig,
  node: ReactNode,
  region: { x: number; y: number; width: number; height: number }
): ReactNode {
  if (config.cardStyle !== 'blur') return node;
  const regionClip = rrect(rect(region.x, region.y, region.width, region.height), 0, 0);
  return (
    <BackdropBlur blur={BLUR_RADIUS} clip={regionClip}>
      {node}
    </BackdropBlur>
  );
}
