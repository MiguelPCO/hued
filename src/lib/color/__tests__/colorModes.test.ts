import { distinctCount, filterSamples, matchesFilter, T, type ColorOption, type RGB } from '../colorModes';

const m = (rgb: RGB, option: ColorOption, mode: 'temperature' | 'properties' | 'families') =>
  matchesFilter(rgb, { mode, option });

const wrap = (cs: RGB[]) => cs.map((c) => [c]);

const RED: RGB = [220, 30, 30];
const ORANGE: RGB = [240, 140, 20];
const YELLOW: RGB = [240, 220, 30];
const GREEN: RGB = [40, 180, 60];
const BLUE: RGB = [30, 80, 220];
const VIOLET: RGB = [140, 50, 200];
const GREY: RGB = [128, 128, 128];
const WHITE: RGB = [250, 250, 250];
const BLACK: RGB = [10, 10, 10];
const PASTEL_PINK: RGB = [255, 179, 186];
const BROWN: RGB = [120, 75, 40];
const OLIVE: RGB = [110, 115, 50];
const PALE_GREY_BLUE: RGB = [120, 135, 160]; // low saturation, mid lightness

describe('matchesFilter', () => {
  it('auto and missing option match everything', () => {
    expect(matchesFilter(GREY, { mode: 'auto', option: null })).toBe(true);
    expect(matchesFilter(GREY, { mode: 'families', option: null })).toBe(true);
  });

  describe('temperature', () => {
    it.each(wrap([RED, ORANGE, YELLOW]))('%j is warm', (c: RGB) => expect(m(c, 'warm', 'temperature')).toBe(true));
    it.each(wrap([BLUE, GREEN]))('%j is not warm', (c: RGB) => expect(m(c, 'warm', 'temperature')).toBe(false));
    it('blue is cold, red is not', () => {
      expect(m(BLUE, 'cold', 'temperature')).toBe(true);
      expect(m(RED, 'cold', 'temperature')).toBe(false);
    });
    it.each(wrap([GREY, WHITE, BLACK]))('%j is neutral, never warm or cold', (c: RGB) => {
      expect(m(c, 'neutral', 'temperature')).toBe(true);
      expect(m(c, 'warm', 'temperature')).toBe(false);
      expect(m(c, 'cold', 'temperature')).toBe(false);
    });
  });

  describe('properties', () => {
    it('vivid = saturated mid-lightness', () => {
      expect(m(RED, 'vivid', 'properties')).toBe(true);
      expect(m(GREY, 'vivid', 'properties')).toBe(false);
      expect(m(PASTEL_PINK, 'vivid', 'properties')).toBe(false);
    });
    it('light / dark are lightness extremes', () => {
      expect(m(WHITE, 'light', 'properties')).toBe(true);
      expect(m(BLACK, 'dark', 'properties')).toBe(true);
      expect(m(GREY, 'light', 'properties')).toBe(false);
      expect(m(GREY, 'dark', 'properties')).toBe(false);
    });
    it('muted = low saturation but not grey', () => {
      expect(m(PALE_GREY_BLUE, 'muted', 'properties')).toBe(true);
      expect(m(GREY, 'muted', 'properties')).toBe(false);
      expect(m(RED, 'muted', 'properties')).toBe(false);
    });
  });

  describe('families', () => {
    it.each([
      ['red', RED], ['orange', ORANGE], ['yellow', YELLOW],
      ['green', GREEN], ['blue', BLUE], ['violet', VIOLET],
    ] as [ColorOption, RGB][])('%s matches only its own hue', (option, color) => {
      expect(m(color, option, 'families')).toBe(true);
      for (const other of ['red', 'orange', 'yellow', 'green', 'blue', 'violet'] as ColorOption[]) {
        if (other !== option) expect(m(color, other, 'families')).toBe(false);
      }
    });
    it('pastel = light but coloured', () => {
      expect(m(PASTEL_PINK, 'pastel', 'families')).toBe(true);
      expect(m(WHITE, 'pastel', 'families')).toBe(false);
      expect(m(RED, 'pastel', 'families')).toBe(false);
    });
    it('earth covers browns and olives', () => {
      expect(m(BROWN, 'earth', 'families')).toBe(true);
      expect(m(OLIVE, 'earth', 'families')).toBe(true);
      expect(m(BLUE, 'earth', 'families')).toBe(false);
    });
    it('neutral is the same in Temperatura and Familias', () => {
      for (const c of [GREY, WHITE, BLACK, RED, BLUE, PASTEL_PINK]) {
        expect(m(c, 'neutral', 'families')).toBe(m(c, 'neutral', 'temperature'));
      }
    });
    it('greys belong to no hue family', () => {
      for (const o of ['red', 'orange', 'yellow', 'green', 'blue', 'violet'] as ColorOption[]) {
        expect(m(GREY, o, 'families')).toBe(false);
      }
    });
  });
});

describe('filterSamples', () => {
  const many = (c: RGB, n: number): RGB[] => Array.from({ length: n }, () => c);

  it('auto returns the same samples untouched', () => {
    const s = many(RED, 10);
    expect(filterSamples(s, { mode: 'auto', option: null }, 5)).toBe(s);
  });

  it('keeps only matching samples', () => {
    const s = [...many(RED, 50), ...many(BLUE, 50)];
    const out = filterSamples(s, { mode: 'temperature', option: 'warm' }, 3);
    expect(out).toHaveLength(50);
    expect(out!.every((c: RGB) => c === RED)).toBe(true);
  });

  it('returns null when nothing matches', () => {
    expect(filterSamples(many(BLUE, 100), { mode: 'families', option: 'red' }, 3)).toBeNull();
  });

  it('returns null when matches are under the minimum share of the photo', () => {
    const matching = Math.floor(1000 * T.minMatchFraction) - 1;
    const s = [...many(RED, matching), ...many(BLUE, 1000 - matching)];
    expect(filterSamples(s, { mode: 'families', option: 'red' }, 3)).toBeNull();
  });

  it('returns null when fewer matches than swatches asked', () => {
    const s = [...many(RED, 4), ...many(BLUE, 40)];
    expect(filterSamples(s, { mode: 'families', option: 'red' }, 5)).toBeNull();
  });
});

describe('distinctCount', () => {
  it('counts distinct colours up to the cap', () => {
    expect(distinctCount([RED, RED, BLUE], 5)).toBe(2);
    expect(distinctCount([RED, BLUE, GREEN, YELLOW], 3)).toBe(3);
  });
});
