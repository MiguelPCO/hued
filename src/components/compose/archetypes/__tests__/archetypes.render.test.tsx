import { render } from '@testing-library/react-native';
import { matchFont } from '@shopify/react-native-skia';

import { ARCHETYPES } from '@/data/archetypes';
import { Primitive } from '@/lib/tokens';
import type { ArchetypeId, FreeformSwatch, LayoutConfig } from '@/types/palette';
import { makeColor, makeColors, makeLayoutConfig, makePalette } from '@test/factories';
import { findAll, findTexts } from '@test/skiaTree';
import { generateScatterLayout } from '../freeformLayout';

const W = 360;
const H = 450;
const IDS: ArchetypeId[] = ['strip', 'editorial', 'grid', 'banner', 'side', 'libre'];
const GREY = '#E5E5E5';

interface Rect { x: number; y: number; width: number; height: number }

function draw(
  id: ArchetypeId,
  opts: { colors?: number; palette?: ReturnType<typeof makePalette>; config?: Partial<LayoutConfig>; image?: boolean } = {}
) {
  const palette = opts.palette ?? makePalette({ colors: makeColors(opts.colors ?? 5) });
  const config = makeLayoutConfig({ archetypeId: id, ...opts.config });
  const { Component } = ARCHETYPES[id];
  const view = render(
    <Component palette={palette} config={config} width={W} height={H} image={opts.image ? ({} as never) : null} />
  );
  return { json: view.toJSON(), palette, config };
}

/** Bloques de color de las muestras (Banner los pinta con sufijo alfa "CC"). */
function swatches(json: unknown, hexes: string[]) {
  const nodes = [...findAll(json, 'SkRect'), ...findAll(json, 'SkRoundedRect'), ...findAll(json, 'SkCircle')];
  return nodes.filter((n) => hexes.some((h) => n.props.color === h || n.props.color === `${h}CC`));
}

const rectOf = (node: { props: Record<string, unknown> }) => node.props as unknown as Rect;

describe.each(IDS)('%s archetype — shared behaviour', (id) => {
  it.each([3, 5, 8])('draws one color block per color with %i colors', (n) => {
    const { json, palette } = draw(id, { colors: n });

    const hexes = palette.colors.map((c) => c.hex);
    const drawn = swatches(json, hexes).map((node) => String(node.props.color).slice(0, 7));

    expect(drawn.sort()).toEqual([...hexes].sort());
  });

  it('draws the grey placeholder, and no photo, when the image is not loaded', () => {
    const { json } = draw(id);

    expect(findAll(json, 'SkRect').filter((r) => r.props.color === GREY)).toHaveLength(1);
    expect(findAll(json, 'SkImage')).toHaveLength(0);
  });

  it('draws the photo instead of the placeholder once it is loaded', () => {
    const { json } = draw(id, { image: true });

    expect(findAll(json, 'SkImage')).toHaveLength(1);
    expect(findAll(json, 'SkRect').filter((r) => r.props.color === GREY)).toHaveLength(0);
  });

  it('renders an empty palette (while colors are still extracting) without throwing', () => {
    const { json } = draw(id, { colors: 0, config: { showHex: true, showName: true, showRGB: true } });

    // the photo placeholder is still drawn...
    expect(findAll(json, 'SkRect').filter((r) => r.props.color === GREY)).toHaveLength(1);
    // ...but there are no color blocks, no labels (editorial must not read colors[0].name)
    expect(findAll(json, 'SkRoundedRect')).toHaveLength(0);
    expect(findAll(json, 'SkCircle')).toHaveLength(0);
    expect(findTexts(json)).toEqual([]);
    // only decoration remains: editorial's transparent gradient host, banner's translucent strip
    const otherRects = findAll(json, 'SkRect').filter((r) => r.props.color !== GREY).map((r) => r.props.color);
    otherRects.forEach((c) => expect(['transparent', 'rgba(0,0,0,0.35)']).toContain(c));
  });

  it('draws no labels when every label toggle is off', () => {
    const { json } = draw(id, { config: { showHex: false, showName: false, showRGB: false } });

    expect(findTexts(json)).toEqual([]);
  });

  it('shows every hex code when showHex is on', () => {
    const { json, palette } = draw(id, { config: { showHex: true, showName: false, showRGB: false } });

    expect(findTexts(json).sort()).toEqual(palette.colors.map((c) => c.hex).sort());
  });

  it('requests a font matching the chosen family', () => {
    // matchFont is a module-level mock shared by all tests: only count calls from this render
    (matchFont as jest.Mock).mockClear();
    draw(id, { config: { fontFamily: 'mono' } });

    expect(matchFont).toHaveBeenCalled();
    (matchFont as jest.Mock).mock.calls.forEach(([style]) => {
      expect(style.fontFamily).toMatch(/^(Courier|monospace)$/);
    });
  });

  it('wraps no label in a blur unless cardStyle is blur', () => {
    const { json } = draw(id, { config: { cardStyle: 'filled' } });

    expect(findAll(json, 'SkBackdropBlur')).toHaveLength(0);
  });
});

describe.each(['strip', 'grid', 'banner', 'side', 'libre'] as ArchetypeId[])('%s archetype — labels', (id) => {
  it('shows every color name when showName is on', () => {
    const { json, palette } = draw(id, { config: { showHex: false, showName: true, showRGB: false } });

    expect(findTexts(json).sort()).toEqual(palette.colors.map((c) => c.name).sort());
  });

  it('shows "RGB r, g, b" per color when showRGB is on', () => {
    const { json, palette } = draw(id, { config: { showHex: false, showName: false, showRGB: true } });

    expect(findTexts(json).sort()).toEqual(palette.colors.map((c) => `RGB ${c.rgb[0]}, ${c.rgb[1]}, ${c.rgb[2]}`).sort());
  });

  it('wraps each swatch label in its own backdrop blur when cardStyle is blur', () => {
    const { json, palette } = draw(id, { config: { cardStyle: 'blur' } });

    expect(findAll(json, 'SkBackdropBlur')).toHaveLength(palette.colors.length);
  });

  it('uses dark text on light swatches and light text on dark ones', () => {
    const palette = makePalette({
      colors: [
        makeColor({ hex: '#FFFFFF', hslLightness: 0.9, name: 'Claro' }),
        makeColor({ hex: '#000000', hslLightness: 0.1, name: 'Oscuro' }),
      ],
    });

    const { json } = draw(id, { palette, config: { showHex: true, showName: false, showRGB: false } });
    const textColor = (hex: string) => findAll(json, 'SkText').find((t) => t.props.text === hex)?.props.color;

    expect(textColor('#FFFFFF')).toBe(Primitive.black);
    expect(textColor('#000000')).toBe(Primitive.white);
  });
});

describe('strip archetype', () => {
  it('puts the photo on the top 70% and five 72px bars below it', () => {
    const { json, palette } = draw('strip');

    const photo = findAll(json, 'SkRect').find((r) => r.props.color === GREY)!;
    const bars = swatches(json, palette.colors.map((c) => c.hex)).map(rectOf);

    expect(rectOf(photo)).toMatchObject({ x: 0, y: 0, width: 360, height: 315 });
    bars.forEach((bar, i) => expect(bar).toMatchObject({ x: i * 72, y: 315, width: 72, height: 135 }));
  });
});

describe('grid archetype', () => {
  it.each([3, 4, 5, 6, 7, 8])('keeps %i cells inside the bottom half and fills it exactly', (n) => {
    const { json, palette } = draw('grid', { colors: n });

    const cells = swatches(json, palette.colors.map((c) => c.hex)).map(rectOf);

    cells.forEach((c) => {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + c.width).toBeLessThanOrEqual(W + 0.001);
      expect(c.y).toBeGreaterThanOrEqual(H / 2 - 0.001);
      expect(c.y + c.height).toBeLessThanOrEqual(H + 0.001);
    });
    expect(cells.reduce((area, c) => area + c.width * c.height, 0)).toBeCloseTo(W * (H / 2), 3);
  });

  it('makes the last cell full-width when the count is odd', () => {
    const { json, palette } = draw('grid', { colors: 5 });

    const last = rectOf(swatches(json, palette.colors.map((c) => c.hex)).at(-1)!);

    expect(last.width).toBe(360);
  });
});

describe('banner archetype', () => {
  it('overlays a translucent 48px strip at the bottom with five bars', () => {
    const { json, palette } = draw('banner');

    const overlay = findAll(json, 'SkRect').find((r) => r.props.color === 'rgba(0,0,0,0.35)')!;
    const bars = swatches(json, palette.colors.map((c) => c.hex)).map(rectOf);

    expect(rectOf(overlay)).toMatchObject({ x: 0, y: 402, width: 360, height: 48 });
    bars.forEach((bar, i) => expect(bar).toMatchObject({ x: i * 72, y: 402, width: 72, height: 48 }));
  });

  it('paints each bar with 80% opacity so the photo shows through', () => {
    const { json, palette } = draw('banner');

    palette.colors.forEach((c) => {
      expect(findAll(json, 'SkRect').some((r) => r.props.color === `${c.hex}CC`)).toBe(true);
    });
  });
});

describe('side archetype', () => {
  it('puts the photo on the left 60% and five 90px rows on the right', () => {
    const { json, palette } = draw('side');

    const photo = findAll(json, 'SkRect').find((r) => r.props.color === GREY)!;
    const rows = swatches(json, palette.colors.map((c) => c.hex)).map(rectOf);

    expect(rectOf(photo)).toMatchObject({ x: 0, y: 0, width: 216, height: 450 });
    rows.forEach((row, i) => expect(row).toMatchObject({ x: 216, y: i * 90, width: 144, height: 90 }));
  });
});

describe('H-04 — fixed five-slot layouts with other palette sizes', () => {
  // Franja y Banner reparten `width / 5`; Lateral reparte `height / 5`.
  const STRIPS: [ArchetypeId, 'width' | 'height'][] = [
    ['strip', 'width'],
    ['banner', 'width'],
    ['side', 'height'],
  ];

  function fillsStrip(id: ArchetypeId, axis: 'width' | 'height', n: number) {
    const { json, palette } = draw(id, { colors: n });
    const rects = swatches(json, palette.colors.map((c) => c.hex)).map(rectOf);

    rects.forEach((r) => {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(W + 0.001);
      expect(r.y + r.height).toBeLessThanOrEqual(H + 0.001);
    });
    const covered = rects.reduce((sum, r) => sum + r[axis], 0);
    expect(covered).toBeCloseTo(axis === 'width' ? W : H, 3);
  }

  it.each(STRIPS)('%s fills its strip with the default 5 colors', (id, axis) => {
    fillsStrip(id, axis, 5);
  });

  for (const [id, axis] of STRIPS) {
    for (const size of [3, 8]) {
      it.failing(`${id} keeps ${size} swatches inside the canvas and filling the strip (H-04)`, () => {
        fillsStrip(id, axis, size);
      });
    }
  }
});

describe('editorial archetype', () => {
  it('centers one 14px dot per color on a horizontal line at 82% of the height', () => {
    const { json, palette } = draw('editorial');

    const dots = findAll(json, 'SkCircle').filter((c) => palette.colors.some((col) => col.hex === c.props.color));

    expect(dots).toHaveLength(5);
    dots.forEach((dot) => expect(dot.props).toMatchObject({ r: 14, cy: 369 }));
    const xs = dots.map((d) => d.props.cx as number);
    expect((xs[0] + xs[4]) / 2).toBeCloseTo(180, 5);
  });

  it('always writes labels in white over the dark gradient', () => {
    const { json } = draw('editorial');

    findAll(json, 'SkText').forEach((t) => expect(t.props.color).toBe('#FFFFFF'));
  });

  it('captions the dominant (first) color name only', () => {
    const { json, palette } = draw('editorial', { config: { showHex: false, showName: true } });

    expect(findTexts(json)).toEqual([palette.colors[0].name]);
  });

  it('omits the caption when showName is off', () => {
    const { json, palette } = draw('editorial', { config: { showHex: true, showName: false } });

    expect(findTexts(json)).toEqual(palette.colors.map((c) => c.hex));
  });

  it('never draws RGB labels (not part of this layout)', () => {
    const { json } = draw('editorial', { config: { showRGB: true } });

    expect(findTexts(json).some((t) => t.startsWith('RGB'))).toBe(false);
  });

  it('wraps each hex label and the caption in a blur when cardStyle is blur', () => {
    const { json } = draw('editorial', { config: { cardStyle: 'blur', showHex: true, showName: true } });

    expect(findAll(json, 'SkBackdropBlur')).toHaveLength(5 + 1);
  });

  it('draws the dark gradient over the lower part of the photo', () => {
    const { json } = draw('editorial');

    expect(findAll(json, 'SkLinearGradient')).toHaveLength(1);
  });
});

describe('libre archetype', () => {
  const custom = (n: number): FreeformSwatch[] =>
    Array.from({ length: n }, (_, i) => ({ x: 10 + i * 20, y: 20 + i * 70, width: 120, height: 60, colorIndex: i }));

  it('places each swatch where the user left it, with the configured corner radius', () => {
    const swatchesCfg = custom(5);
    const { json, palette } = draw('libre', { config: { freeformSwatches: swatchesCfg, cornerRadius: 12 } });

    const drawn = findAll(json, 'SkRoundedRect');

    expect(drawn).toHaveLength(5);
    drawn.forEach((node, i) => {
      const { x, y, width, height } = swatchesCfg[i];
      expect(node.props).toMatchObject({ x, y, width, height, r: 12, color: palette.colors[i].hex });
    });
  });

  it('falls back to a scatter layout when the stored swatches do not match the colors', () => {
    const { json } = draw('libre', { config: { freeformSwatches: custom(3) } }); // 3 guardadas, 5 colores

    const expected = generateScatterLayout(5, W, H);
    const drawn = findAll(json, 'SkRoundedRect');

    expect(drawn).toHaveLength(5);
    drawn.forEach((node, i) => {
      expect(node.props).toMatchObject({
        x: expected[i].x, y: expected[i].y, width: expected[i].width, height: expected[i].height,
      });
    });
  });

  it('draws swatches in array order so the last one is on top', () => {
    const reordered = custom(5).reverse();
    const { json } = draw('libre', { config: { freeformSwatches: reordered } });

    expect(findAll(json, 'SkRoundedRect').map((n) => n.props.x)).toEqual(reordered.map((s) => s.x));
  });

  it('skips a swatch whose color no longer exists', () => {
    const withGhost = [...custom(5).slice(0, 4), { x: 0, y: 0, width: 50, height: 50, colorIndex: 9 }];
    const { json } = draw('libre', { colors: 5, config: { freeformSwatches: withGhost } });

    expect(findAll(json, 'SkRoundedRect')).toHaveLength(4);
  });

  it('hides the label on swatches shorter than 32px but still draws them', () => {
    const tiny = custom(5).map((s, i) => (i === 0 ? { ...s, height: 20 } : s));
    const { json, palette } = draw('libre', {
      config: { freeformSwatches: tiny, showHex: true, showName: false, showRGB: false },
    });

    expect(findAll(json, 'SkRoundedRect')).toHaveLength(5);
    expect(findTexts(json)).not.toContain(palette.colors[0].hex);
    expect(findTexts(json)).toHaveLength(4);
  });

  it('offsets labels 6px inside the swatch', () => {
    const { json } = draw('libre', {
      config: { freeformSwatches: custom(5), showHex: true, showName: false, showRGB: false },
    });

    const firstLabel = findAll(json, 'SkText')[0];

    expect(firstLabel.props.x).toBe(10 + 6);
  });
});
