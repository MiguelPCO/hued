/**
 * Generates assets/samples/sample-<n>.jpg — one flat-colour composition per
 * entry in src/data/samplePalettes.ts. Flat blocks with the exact hex keep
 * `extractColors` faithful when the user changes paletteSize on a sample.
 *
 * Not run at app runtime/build time; the output is committed. Re-run via:
 *   pnpm generate-samples
 */
import * as fs from 'fs';
import * as path from 'path';

import { SAMPLE_PALETTES, sampleWeights } from '../src/data/samplePalettes';

// jimp-compact ships no types.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Jimp = require('jimp-compact');

const SIZE = 1024;
const GRID = 8; // block edges snap to 8px (JPEG block size) to avoid ringing

interface Rect { x: number; y: number; w: number; h: number }

const snap = (v: number) => Math.round((v * SIZE) / GRID) * GRID;

/** Splits [0,SIZE] into `weights.length` consecutive spans proportional to weights. */
function spans(weights: number[], start = 0, length = SIZE): [number, number][] {
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return weights.map((w, i) => {
    const from = start + Math.round((acc / total) * length / GRID) * GRID;
    acc += w;
    const to = i === weights.length - 1 ? start + length : start + Math.round((acc / total) * length / GRID) * GRID;
    return [from, to];
  });
}

function layout(template: number, weights: number[]): Rect[] {
  if (template === 0) {
    return spans(weights).map(([x0, x1]) => ({ x: x0, y: 0, w: x1 - x0, h: SIZE }));
  }
  if (template === 1) {
    return spans(weights).map(([y0, y1]) => ({ x: 0, y: y0, w: SIZE, h: y1 - y0 }));
  }
  // split: dominant colour on the left, the rest stacked on the right
  const left = snap(weights[0]);
  const rest = spans(weights.slice(1));
  return [
    { x: 0, y: 0, w: left, h: SIZE },
    ...rest.map(([y0, y1]) => ({ x: left, y: y0, w: SIZE - left, h: y1 - y0 })),
  ];
}

async function main() {
  const outDir = path.join(__dirname, '..', 'assets', 'samples');
  fs.mkdirSync(outDir, { recursive: true });

  for (const [i, sample] of SAMPLE_PALETTES.entries()) {
    const image = new Jimp(SIZE, SIZE, 0xffffffff);
    // Split needs >=3 colours to look intentional; 3-colour samples alternate templates.
    const rects = layout(i % 3, sampleWeights(sample.hexes.length));
    rects.forEach((r, idx) => {
      const color = Jimp.cssColorToHex(sample.hexes[idx]);
      image.scan(r.x, r.y, r.w, r.h, (_x: number, _y: number, pos: number) => image.bitmap.data.writeUInt32BE(color, pos));
    });
    const file = path.join(outDir, `sample-${i + 1}.jpg`);
    await image.quality(95).writeAsync(file);
    console.log(`wrote ${path.relative(process.cwd(), file)}`);
  }
}

main();
