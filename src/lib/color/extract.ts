import { Skia, ColorType, AlphaType } from '@shopify/react-native-skia';
import type { ExtractedColor } from '@/types/palette';
import { rgbToHex, rgbToHsl, rgbToLab } from './colorMath';
import { findColorName } from './colorNames';

export class ExtractError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ExtractError';
  }
}

const K = 5;
const MAX_ITER = 20;
const SAMPLE_STEP = 4;

type RGB = [number, number, number];

function dist2(a: RGB, b: RGB): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function initCentroids(samples: RGB[]): RGB[] {
  const centroids: RGB[] = [];
  centroids.push(samples[Math.floor(Math.random() * samples.length)]);
  while (centroids.length < K) {
    const dists = samples.map((s) => Math.min(...centroids.map((c) => dist2(s, c))));
    const sum = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    let chosen = samples[samples.length - 1];
    for (let j = 0; j < samples.length; j++) {
      r -= dists[j];
      if (r <= 0) { chosen = samples[j]; break; }
    }
    centroids.push([...chosen] as RGB);
  }
  return centroids;
}

function assign(samples: RGB[], centroids: RGB[]): number[] {
  return samples.map((s) => {
    let minD = Infinity, idx = 0;
    centroids.forEach((c, i) => { const d = dist2(s, c); if (d < minD) { minD = d; idx = i; } });
    return idx;
  });
}

function assignWithDist(samples: RGB[], centroids: RGB[]): { idx: number[]; dist: number[] } {
  const idx = new Array<number>(samples.length);
  const dist = new Array<number>(samples.length);
  samples.forEach((s, i) => {
    let minD = Infinity, bestIdx = 0;
    centroids.forEach((c, ci) => { const d = dist2(s, c); if (d < minD) { minD = d; bestIdx = ci; } });
    idx[i] = bestIdx;
    dist[i] = minD;
  });
  return { idx, dist };
}

function kmeans(samples: RGB[], centroids: RGB[]): RGB[] {
  let centers = centroids.map((c) => [...c] as RGB);
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const { idx: asgn, dist } = assignWithDist(samples, centers);
    const sums: RGB[] = Array.from({ length: K }, () => [0, 0, 0] as RGB);
    const counts = new Array<number>(K).fill(0);
    samples.forEach((s, i) => {
      const c = asgn[i];
      sums[c][0] += s[0]; sums[c][1] += s[1]; sums[c][2] += s[2];
      counts[c]++;
    });
    let moved = false;
    // Samples already claimed by a dead centroid this pass, so two centroids
    // dying in the same iteration can't reseed to the same point.
    const claimed = new Set<number>();
    centers = sums.map((sum, i) => {
      if (counts[i] === 0) {
        // Reseed dead centroid to the sample farthest from all live centroids,
        // otherwise it stays stuck forever and duplicates another color.
        // Reuses this iteration's assign() distances instead of recomputing.
        let farthestIdx = -1, farthestDist = -1;
        for (let s = 0; s < samples.length; s++) {
          if (claimed.has(s)) continue;
          if (dist[s] > farthestDist) { farthestDist = dist[s]; farthestIdx = s; }
        }
        claimed.add(farthestIdx);
        moved = true;
        return [...samples[farthestIdx]] as RGB;
      }
      const next: RGB = [
        Math.round(sum[0] / counts[i]),
        Math.round(sum[1] / counts[i]),
        Math.round(sum[2] / counts[i]),
      ];
      if (dist2(next, centers[i]) > 0) moved = true;
      return next;
    });
    if (!moved) break;
  }
  return centers;
}

export async function extractColors(thumbnailUri: string): Promise<ExtractedColor[]> {
  const response = await fetch(thumbnailUri);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const skData = Skia.Data.fromBytes(bytes);
  const skImage = Skia.Image.MakeImageFromEncoded(skData);
  if (!skImage) throw new ExtractError('Skia could not decode image');

  const w = skImage.width(), h = skImage.height();
  const pixels = skImage.readPixels(0, 0, {
    width: w,
    height: h,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  }) as Uint8Array | null;
  if (!pixels) throw new ExtractError('readPixels returned null');

  const samples: RGB[] = [];
  for (let i = 0; i < pixels.length; i += 4 * SAMPLE_STEP) {
    if (pixels[i + 3] < 128) continue;
    samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  }
  if (samples.length < K) throw new ExtractError(`Too few opaque pixels: ${samples.length}`);

  const centroids = kmeans(samples, initCentroids(samples));
  const assignments = assign(samples, centroids);
  const counts = new Array<number>(K).fill(0);
  assignments.forEach((c) => counts[c]++);
  const total = samples.length;

  const colors: ExtractedColor[] = centroids.map(([r, g, b], i) => {
    const lab = rgbToLab(r, g, b);
    const [, , hslL] = rgbToHsl(r, g, b);
    return {
      hex: rgbToHex(r, g, b),
      rgb: [r, g, b],
      lab,
      name: findColorName(lab),
      hslLightness: hslL,
      weight: counts[i] / total,
    };
  });

  return colors.sort((a, b) => b.weight - a.weight);
}
