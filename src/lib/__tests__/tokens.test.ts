import { Colors, Duration, FontSize, Primitive, Radius, Spacing } from '../tokens';

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type ColorKey = keyof typeof Colors;

describe('Primitive palette', () => {
  it.each(Object.entries(Primitive))('%s is a 6-digit hex color', (_name, value) => {
    expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe('Semantic colors', () => {
  it('map onto primitives (no ad-hoc hex for brand colors)', () => {
    expect(Colors.bgPrimary).toBe(Primitive.cream200);
    expect(Colors.textPrimary).toBe(Primitive.brown800);
    expect(Colors.accent).toBe(Primitive.red500);
    expect(Colors.accentSubtle).toBe(Primitive.amber400);
  });

  it('keeps the export canvas background pure white so photos pop', () => {
    expect(Colors.canvasBg).toBe('#FFFFFF');
  });
});

describe('WCAG contrast', () => {
  const AA_PAIRS: [string, ColorKey, ColorKey][] = [
    ['textPrimary on bgPrimary', 'textPrimary', 'bgPrimary'],
    ['textSecondary on bgPrimary', 'textSecondary', 'bgPrimary'],
    ['textPrimary on bgElevated', 'textPrimary', 'bgElevated'],
    ['textSecondary on bgElevated', 'textSecondary', 'bgElevated'],
    ['textTertiary on bgElevated (tab bar)', 'textTertiary', 'bgElevated'],
    ['accentForeground on accent (CTA)', 'accentForeground', 'accent'],
    ['textPrimary on accentSubtle (chips)', 'textPrimary', 'accentSubtle'],
    ['textInverse on bgInverse', 'textInverse', 'bgInverse'],
    ['accent on bgPrimary (links)', 'accent', 'bgPrimary'],
  ];

  it.each(AA_PAIRS)('%s reaches AA (4.5:1)', (_label, fg, bg) => {
    expect(contrast(Colors[fg], Colors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('primary text on the base background reaches AAA (7:1)', () => {
    expect(contrast(Colors.textPrimary, Colors.bgPrimary)).toBeGreaterThanOrEqual(7);
  });

  it('keeps orange as a decorative-only accent (documented to fail AA for text)', () => {
    expect(contrast(Primitive.white, Primitive.orange500)).toBeLessThan(4.5);
  });

  // H-05: estos dos pares se usan como texto sobre `bgPrimary` (Ajustes: "Añadir
  // nombre"; mensajes de error en paywall, pantalla de paleta y recorte) y no llegan a AA.
  it.failing('textTertiary on bgPrimary reaches AA (H-05: 3.55:1)', () => {
    expect(contrast(Colors.textTertiary, Colors.bgPrimary)).toBeGreaterThanOrEqual(4.5);
  });

  it.failing('error on bgPrimary reaches AA (H-05: 3.68:1)', () => {
    expect(contrast(Colors.error, Colors.bgPrimary)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Scales', () => {
  it('Spacing follows the 4pt grid (except the 1px hairline)', () => {
    Object.entries(Spacing)
      .filter(([key]) => key !== 'px')
      .forEach(([, value]) => expect(value % 4).toBe(0));
  });

  it('FontSize is strictly increasing', () => {
    const sizes = Object.values(FontSize);
    sizes.slice(1).forEach((size, i) => expect(size).toBeGreaterThan(sizes[i]));
  });

  it('Radius is strictly increasing from sharp to pill', () => {
    const radii = Object.values(Radius);
    radii.slice(1).forEach((radius, i) => expect(radius).toBeGreaterThan(radii[i]));
  });

  it('Duration is increasing from fast to slow', () => {
    expect(Duration.fast).toBeLessThan(Duration.normal);
    expect(Duration.normal).toBeLessThan(Duration.slow);
  });
});
