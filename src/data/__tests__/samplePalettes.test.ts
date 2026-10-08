import * as fs from 'fs';
import * as path from 'path';

import { SAMPLE_PALETTES, sampleWeights } from '../samplePalettes';

describe('SAMPLE_PALETTES', () => {
  it('has 10 palettes with 3-8 valid hex colours each', () => {
    expect(SAMPLE_PALETTES).toHaveLength(10);
    for (const { hexes } of SAMPLE_PALETTES) {
      expect(hexes.length).toBeGreaterThanOrEqual(3);
      expect(hexes.length).toBeLessThanOrEqual(8);
      hexes.forEach((h) => expect(h).toMatch(/^#[0-9A-F]{6}$/));
    }
  });

  it('spreads the palettes over the four card archetypes', () => {
    const counts: Record<string, number> = {};
    SAMPLE_PALETTES.forEach((s) => (counts[s.archetypeId] = (counts[s.archetypeId] ?? 0) + 1));
    expect(counts).toEqual({ pila: 3, mosaico: 3, columnas: 2, escalonado: 2 });
  });

  it('has a generated image per palette in assets/samples', () => {
    const dir = path.join(__dirname, '..', '..', '..', 'assets', 'samples');
    SAMPLE_PALETTES.forEach((_, i) => expect(fs.existsSync(path.join(dir, `sample-${i + 1}.jpg`))).toBe(true));
  });
});

describe('sampleWeights', () => {
  it.each([3, 5, 8])('sums to 1 and descends for %i colours', (n) => {
    const w = sampleWeights(n);
    expect(w).toHaveLength(n);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    w.slice(1).forEach((v, i) => expect(v).toBeLessThan(w[i]));
  });
});
