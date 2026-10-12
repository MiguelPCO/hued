import type { ExtractedColor } from '@/types/palette';
import { averageAround, containRect, describeRgb, replaceColor, touchToPixel } from '../eyedropper';

/** w×h RGBA image where pixel (x, y) is produced by `fn`. */
function image(w: number, h: number, fn: (x: number, y: number) => [number, number, number, number]) {
  const buf = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) buf.set(fn(x, y), (y * w + x) * 4);
  return buf;
}

describe('averageAround', () => {
  it('averages the 5x5 block around the point', () => {
    // Left half black, right half white: a block straddling the edge averages to the middle.
    const px = image(10, 10, (x) => (x < 5 ? [0, 0, 0, 255] : [250, 250, 250, 255]));
    expect(averageAround(px, { width: 10, height: 10 }, 4, 5)).toEqual([100, 100, 100]); // 2 of 5 columns are white
  });

  it('returns the colour itself on a flat area', () => {
    const px = image(8, 8, () => [10, 20, 30, 255]);
    expect(averageAround(px, { width: 8, height: 8 }, 4, 4)).toEqual([10, 20, 30]);
  });

  it('clamps at the edges instead of reading outside the image', () => {
    const px = image(6, 6, () => [200, 100, 50, 255]);
    expect(averageAround(px, { width: 6, height: 6 }, 0, 0)).toEqual([200, 100, 50]);
    expect(averageAround(px, { width: 6, height: 6 }, 5, 5)).toEqual([200, 100, 50]);
  });

  it('ignores transparent pixels, and gives null when all are', () => {
    const half = image(4, 4, (x) => (x < 2 ? [0, 0, 0, 0] : [100, 100, 100, 255]));
    expect(averageAround(half, { width: 4, height: 4 }, 2, 2)).toEqual([100, 100, 100]);
    expect(averageAround(image(4, 4, () => [9, 9, 9, 0]), { width: 4, height: 4 }, 2, 2)).toBeNull();
  });
});

describe('touchToPixel', () => {
  // 100x200 image in a 200x200 box → letterboxed: 100 wide, centred at left 50.
  const box = { width: 200, height: 200 };
  const img = { width: 100, height: 200 };

  it('maps through the contain-fit offset', () => {
    expect(containRect(box, img)).toEqual({ left: 50, top: 0, width: 100, height: 200 });
    expect(touchToPixel(box, img, 100, 100)).toEqual({ x: 50, y: 100 });
    expect(touchToPixel(box, img, 50, 0)).toEqual({ x: 0, y: 0 });
  });

  it('returns null on the letterbox bars', () => {
    expect(touchToPixel(box, img, 10, 100)).toBeNull();
    expect(touchToPixel(box, img, 190, 100)).toBeNull();
  });

  it('never returns a pixel past the last one', () => {
    expect(touchToPixel(box, img, 150, 200)).toEqual({ x: 99, y: 199 });
  });
});

describe('replaceColor', () => {
  const mk = (hex: string, weight: number): ExtractedColor => ({
    hex, rgb: [0, 0, 0], lab: [0, 0, 0], name: 'x', hslLightness: 0, weight,
  });
  const colors = [mk('#111111', 0.5), mk('#222222', 0.3), mk('#333333', 0.2)];

  it('swaps one slot in place, recomputing the derived fields and keeping its weight', () => {
    const out = replaceColor(colors, 1, [255, 0, 0]);
    expect(out).toHaveLength(3);
    expect(out[1]).toMatchObject({ hex: '#FF0000', rgb: [255, 0, 0], weight: 0.3 });
    expect(out[1].name).toBe(describeRgb([255, 0, 0]).name);
    expect(out[0]).toBe(colors[0]);
    expect(out[2]).toBe(colors[2]);
  });
});
