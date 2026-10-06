import { SAMPLE_COLLECTION_NAME, SAMPLE_PALETTES } from '@/data/samplePalettes';
import { createCollection } from '@/lib/db/collections';
import { listPalettes, savePalette, setPaletteCollection } from '@/lib/db/palettes';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { thumbnail } from '@/lib/utils/image';
import { makePalette } from '@test/factories';

import { seedSamplePalettesOnce } from '../seedSamplePalettes';

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn((mod: number) => ({
      downloadAsync: jest.fn().mockResolvedValue(undefined),
      localUri: `file:///cache/sample-${mod}.jpg`,
      uri: `http://dev/sample-${mod}.jpg`,
    })),
  },
}));
jest.mock('@/lib/db/palettes', () => ({ listPalettes: jest.fn(), savePalette: jest.fn(), setPaletteCollection: jest.fn() }));
jest.mock('@/lib/db/collections', () => ({ createCollection: jest.fn() }));
jest.mock('@/lib/utils/image', () => ({ thumbnail: jest.fn() }));

type SavedColor = { hex: string; rgb: number[]; lab: number[]; name: string; weight: number };

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ samplesSeeded: false });
  (listPalettes as jest.Mock).mockResolvedValue([]);
  (createCollection as jest.Mock).mockResolvedValue({ id: 'col1', name: SAMPLE_COLLECTION_NAME });
  (savePalette as jest.Mock).mockImplementation(async () => makePalette({ id: `p${(savePalette as jest.Mock).mock.calls.length}` }));
  (thumbnail as jest.Mock).mockResolvedValue('file:///cache/thumb.jpg');
});

describe('seedSamplePalettesOnce', () => {
  it('seeds every sample into the "Ejemplos" collection and sets the flag', async () => {
    await seedSamplePalettesOnce();

    expect(createCollection).toHaveBeenCalledTimes(1);
    expect(createCollection).toHaveBeenCalledWith('Ejemplos');
    expect(savePalette).toHaveBeenCalledTimes(SAMPLE_PALETTES.length);
    expect(setPaletteCollection).toHaveBeenCalledTimes(SAMPLE_PALETTES.length);
    (setPaletteCollection as jest.Mock).mock.calls.forEach(([, colId]) => expect(colId).toBe('col1'));
    expect(useSettingsStore.getState().samplesSeeded).toBe(true);
  });

  it('marks each palette as a sample, sized and styled from its definition', async () => {
    await seedSamplePalettesOnce();

    // saved in reverse so the first sample is the newest (listPalettes is created_at DESC)
    const saved = (savePalette as jest.Mock).mock.calls.map(([p]) => p).reverse();
    saved.forEach((p, i) => {
      const def = SAMPLE_PALETTES[i];
      expect(p.meta.source).toBe('sample');
      expect(p.layoutConfig.archetypeId).toBe(def.archetypeId);
      expect(p.layoutConfig.paletteSize).toBe(def.hexes.length);
      expect(p.colors.map((c: SavedColor) => c.hex).sort()).toEqual([...def.hexes].sort());
      expect(p.thumbnailUri).toBe('file:///cache/thumb.jpg');
      expect(p.imageUri).toMatch(/^file:\/\/\/cache\/sample-/);
    });
  });

  it('stores colours like extractColors: named, lightest first, weights summing to 1', async () => {
    await seedSamplePalettesOnce();

    for (const [p] of (savePalette as jest.Mock).mock.calls) {
      const labs = p.colors.map((c: SavedColor) => c.lab[0]);
      expect(labs).toEqual([...labs].sort((a, b) => b - a));
      expect(p.colors.reduce((s: number, c: SavedColor) => s + c.weight, 0)).toBeCloseTo(1);
      p.colors.forEach((c: SavedColor) => {
        expect(c.name).toBeTruthy();
        expect(c.hex).toBe(`#${c.rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`);
      });
    }
  });

  it('falls back to asset.uri when the asset has no local copy', async () => {
    const { Asset } = jest.requireMock('expo-asset');
    Asset.fromModule.mockImplementationOnce(() => ({ downloadAsync: jest.fn(), localUri: null, uri: 'http://dev/x.jpg' }));

    await seedSamplePalettesOnce();

    expect((thumbnail as jest.Mock).mock.calls[0][0]).toBe('http://dev/x.jpg');
  });

  it('leaves an existing library untouched and just sets the flag', async () => {
    (listPalettes as jest.Mock).mockResolvedValue([makePalette()]);

    await seedSamplePalettesOnce();

    expect(createCollection).not.toHaveBeenCalled();
    expect(savePalette).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().samplesSeeded).toBe(true);
  });

  it('does nothing once seeded, so deleted samples never return', async () => {
    useSettingsStore.setState({ samplesSeeded: true });

    await seedSamplePalettesOnce();

    expect(listPalettes).not.toHaveBeenCalled();
    expect(savePalette).not.toHaveBeenCalled();
  });

  it('shares one run between concurrent callers', async () => {
    await Promise.all([seedSamplePalettesOnce(), seedSamplePalettesOnce()]);

    expect(createCollection).toHaveBeenCalledTimes(1);
    expect(savePalette).toHaveBeenCalledTimes(SAMPLE_PALETTES.length);
  });

  it('rejects without setting the flag when a save fails, and a later call can run again', async () => {
    (savePalette as jest.Mock).mockRejectedValueOnce(new Error('disk'));

    await expect(seedSamplePalettesOnce()).rejects.toThrow('disk');
    expect(useSettingsStore.getState().samplesSeeded).toBe(false);

    await seedSamplePalettesOnce();
    expect(useSettingsStore.getState().samplesSeeded).toBe(true);
  });
});
