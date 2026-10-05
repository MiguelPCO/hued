import { rgbToHex, rgbToHsl, rgbToLab } from '../colorMath';

describe('rgbToHex — edge cases', () => {
  it('rounds fractional channels to the nearest integer', () => {
    expect(rgbToHex(127.5, 0.4, 254.6)).toBe('#8000FF');
  });

  it('always produces an uppercase 7-character hex', () => {
    for (const [r, g, b] of [[0, 0, 0], [1, 2, 3], [171, 205, 239], [255, 255, 255]]) {
      expect(rgbToHex(r, g, b)).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('round-trips through its own parse', () => {
    const hex = rgbToHex(18, 52, 86);

    expect(hex).toBe('#123456');
    expect([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]).toEqual([18, 52, 86]);
  });
});

describe('rgbToHsl — hues', () => {
  it.each([
    ['red', [255, 0, 0], 0],
    ['yellow', [255, 255, 0], 60],
    ['green', [0, 255, 0], 120],
    ['cyan', [0, 255, 255], 180],
    ['blue', [0, 0, 255], 240],
    ['magenta', [255, 0, 255], 300],
    ['rose (red with some blue)', [255, 0, 128], 330],
  ] as [string, [number, number, number], number][])('%s has hue %i°', (_name, [r, g, b], hue) => {
    expect(rgbToHsl(r, g, b)[0]).toBeCloseTo(hue, 0);
  });

  it('greys have zero saturation and hue', () => {
    expect(rgbToHsl(128, 128, 128)).toEqual([0, 0, 128 / 255]);
  });

  it('keeps the hue inside [0, 360) and saturation/lightness inside [0, 1]', () => {
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          const [h, s, l] = rgbToHsl(r, g, b);
          expect(h).toBeGreaterThanOrEqual(0);
          expect(h).toBeLessThan(360);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(1);
          expect(l).toBeGreaterThanOrEqual(0);
          expect(l).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('rgbToLab — reference colors (sRGB, D65)', () => {
  it.each([
    ['red', [255, 0, 0], [53.24, 80.09, 67.2]],
    ['green', [0, 255, 0], [87.74, -86.18, 83.18]],
    ['blue', [0, 0, 255], [32.3, 79.19, -107.86]],
  ] as [string, [number, number, number], [number, number, number]][])('%s', (_name, [r, g, b], expected) => {
    const lab = rgbToLab(r, g, b);

    expected.forEach((value, i) => expect(lab[i]).toBeCloseTo(value, 0));
  });

  it('greys are neutral (a ≈ b ≈ 0)', () => {
    const [, a, b] = rgbToLab(128, 128, 128);

    expect(a).toBeCloseTo(0, 1);
    expect(b).toBeCloseTo(0, 1);
  });

  it('lightness grows with the grey level', () => {
    const levels = [0, 64, 128, 192, 255].map((v) => rgbToLab(v, v, v)[0]);

    levels.slice(1).forEach((L, i) => expect(L).toBeGreaterThan(levels[i]));
  });
});
