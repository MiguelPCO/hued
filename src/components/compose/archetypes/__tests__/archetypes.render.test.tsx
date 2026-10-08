import { render } from '@testing-library/react-native';
import { matchFont } from '@shopify/react-native-skia';

import { ARCHETYPES } from '@/data/archetypes';
import { Primitive } from '@/lib/tokens';
import type { ArchetypeId, FreeformSwatch, LayoutConfig } from '@/types/palette';
import { makeColor, makeColors, makeLayoutConfig, makePalette } from '@test/factories';
import { findAll, findTexts } from '@test/skiaTree';
import { getBaseLayout, resolveRects } from '../cardLayouts';

const W = 360;
const H = 450;
const IDS: ArchetypeId[] = ['pila', 'mosaico', 'escalonado', 'columnas', 'libre'];
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

/** Bloques de color de las muestras. */
function swatches(json: unknown, hexes: string[]) {
  const nodes = [...findAll(json, 'SkRect'), ...findAll(json, 'SkRoundedRect'), ...findAll(json, 'SkCircle')];
  return nodes.filter((n) => hexes.includes(String(n.props.color)));
}

const rectOf = (node: { props: Record<string, unknown> }) => node.props as unknown as Rect;

describe.each(IDS)('%s archetype — shared behaviour', (id) => {
  it.each([3, 5, 8])('draws one color block per color with %i colors', (n) => {
    const { json, palette } = draw(id, { colors: n });

    const hexes = palette.colors.map((c) => c.hex);
    const drawn = swatches(json, hexes).map((node) => String(node.props.color));

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
    // ...but there are no color blocks and no labels
    expect(findAll(json, 'SkRoundedRect')).toHaveLength(0);
    expect(findAll(json, 'SkCircle')).toHaveLength(0);
    expect(findTexts(json)).toEqual([]);
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

describe.each(IDS)('%s archetype — labels', (id) => {
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

describe('card archetypes (pila, mosaico, escalonado, columnas)', () => {
  const CARDS = ['pila', 'mosaico', 'escalonado', 'columnas'] as const;

  it.each(CARDS)('%s never crops the photo into a panel: it fills the whole canvas', (id) => {
    const { json } = draw(id, { image: true });

    expect(rectOf(findAll(json, 'SkImage')[0])).toMatchObject({ x: 0, y: 0, width: W, height: H });
  });

  it.each(CARDS)('%s draws each card where its base layout puts it, with the configured look', (id) => {
    const { json, palette } = draw(id, { config: { cornerRadius: 12, cardOpacity: 60 } });

    const expected = getBaseLayout(id, 5).rects;
    const drawn = findAll(json, 'SkRoundedRect');

    expect(drawn).toHaveLength(5);
    drawn.forEach((node, i) => {
      const { x, y, width, height } = expected[i];
      expect(node.props).toMatchObject({ x, y, width, height, r: 12, opacity: 0.6, color: palette.colors[i].hex });
    });
  });

  it.each(CARDS)('%s applies the size and spacing scales to its base layout', (id) => {
    const config = { cardWidthScale: 80, cardHeightScale: 120, gapScale: 130 };
    const { json } = draw(id, { config });

    const expected = resolveRects(getBaseLayout(id, 5).rects, config);
    findAll(json, 'SkRoundedRect').forEach((node, i) => {
      const { x, y, width, height } = expected[i];
      expect(node.props).toMatchObject({ x, y, width, height });
    });
  });

  it.each(CARDS)('%s places the label lines with the configured position, order and size', (id) => {
    const { json, palette } = draw(id, {
      config: { showHex: true, showName: true, labelOrder: 'hex-first', labelPosition: 'top', labelAlign: 'left', fontSize: 12 },
    });

    const texts = findAll(json, 'SkText');
    expect(texts).toHaveLength(10);
    expect(texts[0].props.text).toBe(palette.colors[0].hex);
    expect(texts[1].props.text).toBe(palette.colors[0].name);
    expect((texts[1].props.y as number) - (texts[0].props.y as number)).toBeCloseTo(12 + getBaseLayout(id, 5).pad.lineGap);
  });

  it.each(CARDS)('%s keeps 3 and 8 cards inside the canvas (H-04)', (id) => {
    [3, 8].forEach((n) => {
      const { json, palette } = draw(id, { colors: n });
      const cards = swatches(json, palette.colors.map((c) => c.hex)).map(rectOf);

      expect(cards).toHaveLength(n);
      cards.forEach((c) => {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.x + c.width).toBeLessThanOrEqual(W + 0.001);
        expect(c.y + c.height).toBeLessThanOrEqual(H + 0.001);
      });
    });
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

  it('falls back to the base layout it came from when the stored swatches do not match the colors', () => {
    const { json } = draw('libre', { config: { freeformSwatches: custom(3), libreSource: 'columnas' } }); // 3 guardadas, 5 colores

    const expected = getBaseLayout('columnas', 5).rects;
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

  it('offsets labels by the padding of the base layout it came from', () => {
    const { json } = draw('libre', {
      config: { freeformSwatches: custom(5), showHex: true, showName: false, showRGB: false },
    });

    const firstLabel = findAll(json, 'SkText')[0];

    expect(firstLabel.props.x).toBe(10 + getBaseLayout('pila', 5).pad.x);
  });
});
