import { FONT_MODULES } from '@/lib/fonts/fontModules';

import { FONT_GROUPS, FONT_OPTIONS, isSystemFont } from '../fonts';

describe('font catalog', () => {
  it('has unique keys and labels', () => {
    expect(new Set(FONT_OPTIONS.map((f) => f.key)).size).toBe(FONT_OPTIONS.length);
    expect(new Set(FONT_OPTIONS.map((f) => f.label)).size).toBe(FONT_OPTIONS.length);
  });

  it('offers the five system fonts and sixteen bundled ones', () => {
    expect(FONT_OPTIONS.filter((f) => isSystemFont(f.key))).toHaveLength(5);
    expect(FONT_OPTIONS.filter((f) => !isSystemFont(f.key))).toHaveLength(16);
  });

  it('ships a font file for every bundled font, and only for those', () => {
    const bundled = FONT_OPTIONS.filter((f) => !isSystemFont(f.key)).map((f) => f.key);

    expect(Object.keys(FONT_MODULES).sort()).toEqual([...bundled].sort());
  });

  it('puts every font in a listed group, in the order the picker shows them', () => {
    expect(FONT_OPTIONS.every((f) => FONT_GROUPS.includes(f.group))).toBe(true);
    const groupOrder = FONT_OPTIONS.map((f) => FONT_GROUPS.indexOf(f.group));
    expect(groupOrder).toEqual([...groupOrder].sort((a, b) => a - b));
  });

  it('isSystemFont tells the platform fonts apart', () => {
    expect(isSystemFont('condensed')).toBe(true);
    expect(isSystemFont('poppins')).toBe(false);
  });
});
