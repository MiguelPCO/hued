// Pure geometry for the archetypes that float color cards over a full-bleed photo (pila, mosaico,
// escalonado, columnas). The positions come from the base layout tables (src/data/baseLayouts.ts); this
// file looks them up and applies the user's size / spacing scales. Design-space units, same as
// freeformLayout.ts.
import { BASE_LAYOUTS } from '@/data/baseLayouts';
import type { BaseStyle, LabelPad } from '@/data/baseLayouts';
import type { CardArchetypeId, FreeformSwatch, LayoutConfig } from '@/types/palette';

import { clampSwatch } from './freeformLayout';
import type { GeneratedSwatch } from './freeformLayout';

export const MIN_BASE_COUNT = 3;
export const MAX_BASE_COUNT = 8;

export interface CardScales {
  cardWidthScale: number;
  cardHeightScale: number;
  gapScale: number;
}

export interface BaseLayout {
  rects: GeneratedSwatch[];
  style: BaseStyle;
  pad: LabelPad;
}

/** The base layout of `archetypeId` for `count` colors (clamped to the 3-8 the app extracts). */
export function getBaseLayout(archetypeId: CardArchetypeId, count: number): BaseLayout {
  const base = BASE_LAYOUTS[archetypeId][Math.min(MAX_BASE_COUNT, Math.max(MIN_BASE_COUNT, count))];
  return {
    rects:
      count <= 0
        ? []
        : base.rects.map(([x, y, width, height], i) => ({ x, y, width, height, colorIndex: i })),
    style: base.style,
    pad: base.pad,
  };
}

/**
 * Applies the size and spacing scales: each card grows or shrinks around its own center, and the
 * centers move away from (or toward) the center of the whole group. The group therefore stays put.
 */
export function resolveRects(rects: GeneratedSwatch[], scales: CardScales): GeneratedSwatch[] {
  const { cardWidthScale, cardHeightScale, gapScale } = scales;
  if (rects.length === 0 || (cardWidthScale === 100 && cardHeightScale === 100 && gapScale === 100))
    return rects;

  const left = Math.min(...rects.map((r) => r.x));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const top = Math.min(...rects.map((r) => r.y));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  const groupX = (left + right) / 2;
  const groupY = (top + bottom) / 2;

  return rects.map((r) => {
    const width = (r.width * cardWidthScale) / 100;
    const height = (r.height * cardHeightScale) / 100;
    const centerX = groupX + ((r.x + r.width / 2 - groupX) * gapScale) / 100;
    const centerY = groupY + ((r.y + r.height / 2 - groupY) * gapScale) / 100;
    return { ...r, x: centerX - width / 2, y: centerY - height / 2, width, height };
  });
}

/** The look a base layout comes with, as a config patch. Resets the user's size / spacing scales too. */
export function baseStyleConfig(
  archetypeId: CardArchetypeId,
  count: number,
): Partial<LayoutConfig> {
  return {
    ...getBaseLayout(archetypeId, count).style,
    cardWidthScale: 100,
    cardHeightScale: 100,
    gapScale: 100,
  };
}

export const NEUTRAL_SCALES: CardScales = {
  cardWidthScale: 100,
  cardHeightScale: 100,
  gapScale: 100,
};

/** Libre's starting geometry: the base layout it came from, with the current scales applied. */
export function libreSeed(
  source: CardArchetypeId,
  count: number,
  scales: CardScales,
): FreeformSwatch[] {
  return resolveRects(getBaseLayout(source, count).rects, scales);
}

/** Resizes hand-placed swatches around their own centers (libre has no group spacing to scale). */
export function scaleSwatches(
  swatches: FreeformSwatch[],
  widthRatio: number,
  heightRatio: number,
  canvasW: number,
  canvasH: number,
): FreeformSwatch[] {
  return swatches.map((s) => {
    const width = s.width * widthRatio;
    const height = s.height * heightRatio;
    return clampSwatch(
      { ...s, x: s.x + (s.width - width) / 2, y: s.y + (s.height - height) / 2, width, height },
      canvasW,
      canvasH,
    );
  });
}
