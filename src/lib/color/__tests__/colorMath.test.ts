import { rgbToHex, rgbToHsl, rgbToLab } from '../colorMath';

describe('rgbToHex', () => {
  it('converts red', () => expect(rgbToHex(255, 0, 0)).toBe('#FF0000'));
  it('converts black', () => expect(rgbToHex(0, 0, 0)).toBe('#000000'));
  it('converts white', () => expect(rgbToHex(255, 255, 255)).toBe('#FFFFFF'));
  it('pads single-digit values', () => expect(rgbToHex(0, 16, 255)).toBe('#0010FF'));
});

describe('rgbToHsl', () => {
  it('red has hue ~0, max saturation, lightness 0.5', () => {
    const [h, s, l] = rgbToHsl(255, 0, 0);
    expect(h).toBeCloseTo(0, 0);
    expect(s).toBeCloseTo(1, 1);
    expect(l).toBeCloseTo(0.5, 1);
  });
  it('white has lightness 1', () => {
    const [, , l] = rgbToHsl(255, 255, 255);
    expect(l).toBeCloseTo(1, 2);
  });
  it('black has lightness 0', () => {
    const [, , l] = rgbToHsl(0, 0, 0);
    expect(l).toBeCloseTo(0, 2);
  });
});

describe('rgbToLab', () => {
  it('black has L≈0', () => {
    const [L] = rgbToLab(0, 0, 0);
    expect(L).toBeCloseTo(0, 0);
  });
  it('white has L≈100', () => {
    const [L] = rgbToLab(255, 255, 255);
    expect(L).toBeCloseTo(100, 0);
  });
  it('returns 3-element tuple', () => {
    expect(rgbToLab(128, 64, 32)).toHaveLength(3);
  });
});
