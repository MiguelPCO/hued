import type { CardArchetypeId } from '@/types/palette';

import {
  NEUTRAL_SCALES,
  baseStyleConfig,
  getBaseLayout,
  libreSeed,
  resolveRects,
  scaleSwatches,
} from '../cardLayouts';

const W = 360;
const H = 450;
const ARCHETYPES: CardArchetypeId[] = ['pila', 'mosaico', 'escalonado', 'columnas'];
const COUNTS = [3, 4, 5, 6, 7, 8];
const CASES = ARCHETYPES.flatMap((id) => COUNTS.map((n) => [id, n] as const));

function bounds(rects: { x: number; y: number; width: number; height: number }[]) {
  return {
    left: Math.min(...rects.map((r) => r.x)),
    right: Math.max(...rects.map((r) => r.x + r.width)),
    top: Math.min(...rects.map((r) => r.y)),
    bottom: Math.max(...rects.map((r) => r.y + r.height)),
  };
}

describe('base layouts (24 tables)', () => {
  it.each(CASES)('%s with %i colors has one card per color, in reading order', (id, n) => {
    const { rects } = getBaseLayout(id, n);

    expect(rects).toHaveLength(n);
    expect(rects.map((r) => r.colorIndex)).toEqual(Array.from({ length: n }, (_, i) => i));
    const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
    expect(rects).toEqual(sorted);
  });

  it.each(CASES)('%s with %i colors stays inside the canvas and centered', (id, n) => {
    const { left, right, top, bottom } = bounds(getBaseLayout(id, n).rects);

    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(W);
    expect(bottom).toBeLessThanOrEqual(H);
    expect(Math.abs(left - (W - right))).toBeLessThanOrEqual(1);
    expect(Math.abs(top - (H - bottom))).toBeLessThanOrEqual(1);
  });

  it.each(CASES)('%s with %i colors has no overlapping cards', (id, n) => {
    const { rects } = getBaseLayout(id, n);

    rects.forEach((a, i) =>
      rects.slice(i + 1).forEach((b) => {
        const overlapX = a.x < b.x + b.width && b.x < a.x + a.width;
        const overlapY = a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlapX && overlapY).toBe(false);
      }),
    );
  });

  it.each(CASES)('%s with %i colors comes with a valid look', (id, n) => {
    const { style, pad } = getBaseLayout(id, n);

    expect(style.cornerRadius).toBeGreaterThanOrEqual(0);
    expect(style.cardOpacity).toBeGreaterThanOrEqual(30);
    expect(style.cardOpacity).toBeLessThanOrEqual(100);
    expect(style.fontSize).toBeGreaterThanOrEqual(6);
    expect(style.fontSize).toBeLessThanOrEqual(24);
    expect(style.showHex || style.showName).toBe(true);
    if (style.labelAlign === 'diagonal') expect(style.labelPosition).toBe('split');
    expect(pad.x).toBeGreaterThan(0);
    expect(pad.y).toBeGreaterThan(0);
  });

  it('keeps the shapes that were designed', () => {
    expect(getBaseLayout('pila', 5).rects.map((r) => [r.x, r.width, r.height])).toEqual(
      Array.from({ length: 5 }, () => [60, 240, 63]),
    );
    expect(getBaseLayout('mosaico', 6).rects.every((r) => r.width === 80 && r.height === 100)).toBe(
      true,
    );
    expect(new Set(getBaseLayout('mosaico', 6).rects.map((r) => r.x)).size).toBe(3);
    expect(getBaseLayout('escalonado', 5).rects.map((r) => [r.x, r.y])).toEqual([
      [12, 14],
      [258, 14],
      [135, 170],
      [12, 326],
      [258, 326],
    ]);
    const circles = getBaseLayout('columnas', 8);
    expect(circles.rects.every((r) => r.width === 60 && r.height === 60)).toBe(true);
    expect(circles.style).toMatchObject({ cornerRadius: 40, showHex: false, showName: true });
    expect(getBaseLayout('mosaico', 8).style).toMatchObject({
      fontFamily: 'poppins',
      showName: false,
    });
  });

  it('clamps the count to the 3-8 the app extracts, and draws nothing for no colors', () => {
    expect(getBaseLayout('pila', 2).rects).toHaveLength(3);
    expect(getBaseLayout('pila', 12).rects).toHaveLength(8);
    expect(getBaseLayout('pila', 0).rects).toEqual([]);
  });
});

describe('resolveRects', () => {
  const rects = getBaseLayout('mosaico', 6).rects;

  it('returns the base layout untouched at 100 %', () => {
    expect(resolveRects(rects, NEUTRAL_SCALES)).toBe(rects);
  });

  it('scales each card around its own center without moving the others', () => {
    const [first] = resolveRects(rects, {
      ...NEUTRAL_SCALES,
      cardWidthScale: 150,
      cardHeightScale: 50,
    });

    expect(first.width).toBe(120);
    expect(first.height).toBe(50);
    expect(first.x + first.width / 2).toBeCloseTo(rects[0].x + rects[0].width / 2);
    expect(first.y + first.height / 2).toBeCloseTo(rects[0].y + rects[0].height / 2);
  });

  it('moves the cards away from the group center when spacing grows, keeping their size', () => {
    const wide = resolveRects(rects, { ...NEUTRAL_SCALES, gapScale: 150 });
    const before = bounds(rects);
    const after = bounds(wide);

    expect(wide.every((r, i) => r.width === rects[i].width && r.height === rects[i].height)).toBe(
      true,
    );
    expect(after.right - after.left).toBeGreaterThan(before.right - before.left);
    expect((after.left + after.right) / 2).toBeCloseTo((before.left + before.right) / 2);
    expect((after.top + after.bottom) / 2).toBeCloseTo((before.top + before.bottom) / 2);
  });

  it('brings the cards closer when spacing shrinks', () => {
    const tight = bounds(resolveRects(rects, { ...NEUTRAL_SCALES, gapScale: 50 }));
    const before = bounds(rects);

    expect(tight.right - tight.left).toBeLessThan(before.right - before.left);
  });

  it('handles an empty layout', () => {
    expect(resolveRects([], { ...NEUTRAL_SCALES, gapScale: 150 })).toEqual([]);
  });
});

describe('baseStyleConfig', () => {
  it('returns the look of the base layout and resets the size and spacing scales', () => {
    expect(baseStyleConfig('columnas', 5)).toMatchObject({
      cornerRadius: 16,
      cardOpacity: 65,
      labelPosition: 'split',
      labelOrder: 'hex-first',
      labelAlign: 'diagonal',
      cardWidthScale: 100,
      cardHeightScale: 100,
      gapScale: 100,
    });
  });

  it('differs between counts of the same archetype (each base carries its own look)', () => {
    expect(baseStyleConfig('pila', 5).cornerRadius).toBe(16);
    expect(baseStyleConfig('pila', 8).cornerRadius).toBe(0);
  });
});

describe('libreSeed', () => {
  it('starts from the base layout it came from, with the current scales applied', () => {
    const scales = { cardWidthScale: 80, cardHeightScale: 100, gapScale: 120 };

    expect(libreSeed('escalonado', 5, scales)).toEqual(
      resolveRects(getBaseLayout('escalonado', 5).rects, scales),
    );
  });
});

describe('scaleSwatches', () => {
  const swatches = [{ x: 100, y: 100, width: 80, height: 60, colorIndex: 0 }];

  it('resizes around the swatch center', () => {
    const [scaled] = scaleSwatches(swatches, 0.5, 2, W, H);

    expect(scaled).toMatchObject({ width: 40, height: 120, colorIndex: 0 });
    expect(scaled.x + scaled.width / 2).toBe(140);
    expect(scaled.y + scaled.height / 2).toBe(130);
  });

  it('keeps the swatch inside the canvas', () => {
    const [scaled] = scaleSwatches(
      [{ x: 330, y: 400, width: 30, height: 50, colorIndex: 1 }],
      3,
      3,
      W,
      H,
    );

    expect(scaled.x + scaled.width).toBeLessThanOrEqual(W);
    expect(scaled.y + scaled.height).toBeLessThanOrEqual(H);
  });
});
