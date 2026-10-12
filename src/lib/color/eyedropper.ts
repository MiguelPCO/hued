import type { ExtractedColor } from '@/types/palette';
import type { RGB } from './colorModes';
import { rgbToHex, rgbToHsl, rgbToLab } from './colorMath';
import { findColorName } from './colorNames';

export interface Size {
  width: number;
  height: number;
}

/** Everything an ExtractedColor derives from its RGB, except `weight`. */
export function describeRgb([r, g, b]: RGB): Omit<ExtractedColor, 'weight'> {
  const lab = rgbToLab(r, g, b);
  return {
    hex: rgbToHex(r, g, b),
    rgb: [r, g, b],
    lab,
    name: findColorName(lab),
    hslLightness: rgbToHsl(r, g, b)[2],
  };
}

/** Average of the (2·radius+1)² block around (x, y) on an RGBA image; edges are clamped, transparent pixels ignored. */
export function averageAround(pixels: Uint8Array, { width, height }: Size, x: number, y: number, radius = 2): RGB | null {
  const cx = Math.round(x), cy = Math.round(y);
  let r = 0, g = 0, b = 0, n = 0;
  for (let py = Math.max(0, cy - radius); py <= Math.min(height - 1, cy + radius); py++) {
    for (let px = Math.max(0, cx - radius); px <= Math.min(width - 1, cx + radius); px++) {
      const i = (py * width + px) * 4;
      if (pixels[i + 3] < 128) continue;
      r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2];
      n++;
    }
  }
  return n === 0 ? null : [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

/** Where an image shown "contain"-fitted in a box sits inside it. */
export function containRect(box: Size, image: Size) {
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { left: (box.width - width) / 2, top: (box.height - height) / 2, width, height };
}

/** Touch position in the box → pixel in the image, or null when the finger is on the letterbox bars. */
export function touchToPixel(box: Size, image: Size, touchX: number, touchY: number): { x: number; y: number } | null {
  const rect = containRect(box, image);
  const u = (touchX - rect.left) / rect.width;
  const v = (touchY - rect.top) / rect.height;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return {
    x: Math.min(image.width - 1, Math.floor(u * image.width)),
    y: Math.min(image.height - 1, Math.floor(v * image.height)),
  };
}

/** Puts a picked colour into one slot: same position and weight, no re-sort (the layout keeps pointing at the same slot). */
export function replaceColor(colors: ExtractedColor[], index: number, rgb: RGB): ExtractedColor[] {
  return colors.map((c, i) => (i === index ? { ...describeRgb(rgb), weight: c.weight } : c));
}
