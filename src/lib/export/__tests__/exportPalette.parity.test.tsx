import { render } from '@testing-library/react-native';
import { drawAsImage, Skia } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';

import { PILL_CORNER_RADIUS } from '@/components/compose/archetypes/shared';
import { ArchetypeCanvas, CANVAS_H, CANVAS_W } from '@/components/compose/ArchetypeCanvas';
import { ARCHETYPES } from '@/data/archetypes';
import { useSettingsStore } from '@/lib/store/settingsStore';
import type { ArchetypeId, LayoutConfig } from '@/types/palette';
import { makeColors, makeLayoutConfig, makePalette } from '@test/factories';
import { findAll, findTexts, treeSignature } from '@test/skiaTree';
import { exportPalette, RESOLUTIONS } from '../exportPalette';

const draw = drawAsImage as jest.Mock;
const fromURI = Skia.Data.fromURI as jest.Mock;
const fs = FileSystem as jest.Mocked<typeof FileSystem>;

const palette = makePalette({ colors: makeColors(5) });
const IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

const CONFIGS: [string, Partial<LayoutConfig>][] = [
  ['defaults', {}],
  ['outlined with RGB labels', { cardStyle: 'outlined', showRGB: true }],
  ['blur, pill corners, serif', { cardStyle: 'blur', cornerRadius: PILL_CORNER_RADIUS, fontFamily: 'serif' }],
  [
    'adjusted cards and text',
    {
      cardOpacity: 60, cardWidthScale: 80, cardHeightScale: 120, gapScale: 130, fontSize: 14,
      labelPosition: 'center', labelAlign: 'center', labelOrder: 'hex-first', fontFamily: 'poppins',
    },
  ],
  ['labels off, watermark on', { showHex: false, showName: false, showRGB: false, watermarkVisible: true }],
  [
    'libre with custom swatches',
    {
      freeformSwatches: palette.colors.map((_, i) => ({
        x: 20 + i * 10, y: 30 + i * 60, width: 90 + i * 5, height: 50, colorIndex: i,
      })),
    },
  ],
];

function previewTree(config: LayoutConfig): string {
  const view = render(<ArchetypeCanvas palette={palette} config={config} />);
  const canvas = findAll(view.toJSON(), 'SkCanvas')[0];
  view.unmount();
  return treeSignature(canvas.children?.[0]);
}

async function exportedElement(config: LayoutConfig, resolution: keyof typeof RESOLUTIONS = '1x') {
  await exportPalette(palette, config, resolution);
  return draw.mock.calls.at(-1)![0];
}

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ subscriptionStatus: 'free' });
});

afterEach(() => jest.restoreAllMocks());

describe.each(['free', 'premium'] as const)('preview/export parity — %s user', (status) => {
  beforeEach(() => useSettingsStore.setState({ subscriptionStatus: status }));

  describe.each(IDS)('%s archetype', (archetypeId) => {
    it.each(CONFIGS)('draws the same Skia tree in preview and export: %s', async (_name, overrides) => {
      const config = makeLayoutConfig({ archetypeId, ...overrides });

      const element = await exportedElement(config);
      const view = render(element);
      const exported = treeSignature(view.toJSON());
      view.unmount();

      expect(exported).toBe(previewTree(config));
    });
  });
});

describe('exportPalette', () => {
  it.each(Object.entries(RESOLUTIONS))('%s keeps the 360x450 canvas aspect ratio', (_key, { width, height }) => {
    expect(width / height).toBeCloseTo(CANVAS_W / CANVAS_H, 5);
  });

  it.each(Object.entries(RESOLUTIONS))('%s rasterizes the design canvas at width / 360', async (key, { width }) => {
    const element = await exportedElement(makeLayoutConfig(), key as keyof typeof RESOLUTIONS);

    expect(element.props.transform).toEqual([{ scale: width / CANVAS_W }]);
  });

  it('throws when Skia returns no image', async () => {
    draw.mockResolvedValueOnce(null);

    await expect(exportPalette(palette, makeLayoutConfig(), '1x')).rejects.toThrow('Skia drawAsImage returned null');
  });

  it('falls back to the grey placeholder when the photo cannot be loaded', async () => {
    fromURI.mockRejectedValueOnce(new Error('missing file'));

    const element = await exportedElement(makeLayoutConfig({ archetypeId: 'pila' }));
    const view = render(element);

    expect(findAll(view.toJSON(), 'SkRect').some((r) => r.props.color === '#E5E5E5')).toBe(true);
  });

  it('writes a timestamped PNG into the cache directory and returns its uri', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    const uri = await exportPalette(palette, makeLayoutConfig(), '1x');

    expect(uri).toBe('file:///cache/hued-export-1700000000000.png');
    expect(fs.writeAsStringAsync).toHaveBeenCalledWith(uri, 'base64-png', { encoding: 'base64' });
  });

  it('is non-interactive: exports never contain React Native views (no edit overlay)', async () => {
    const element = await exportedElement(makeLayoutConfig({ archetypeId: 'libre' }));
    const view = render(element);

    expect(findAll(view.toJSON(), 'View')).toHaveLength(0);
  });

  it('free users always get the watermark', async () => {
    useSettingsStore.setState({ subscriptionStatus: 'free' });

    const view = render(await exportedElement(makeLayoutConfig({ watermarkVisible: false })));

    expect(findTexts(view.toJSON()).filter((t) => t === 'hued')).toHaveLength(2); // texto + sombra
  });

  it('premium users get no watermark unless they asked for it', async () => {
    useSettingsStore.setState({ subscriptionStatus: 'premium' });

    const off = render(await exportedElement(makeLayoutConfig({ watermarkVisible: false })));
    expect(findTexts(off.toJSON())).not.toContain('hued');
    off.unmount();

    const on = render(await exportedElement(makeLayoutConfig({ watermarkVisible: true })));
    expect(findTexts(on.toJSON())).toContain('hued');
  });
});
