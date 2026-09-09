import * as FileSystem from 'expo-file-system/legacy';
import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import type { ExtractedColor, LayoutConfig } from '@/types/palette';
import { updatePaletteColors, updatePaletteLayout, setPaletteCollection, updatePaletteImage } from '../palettes';
import { getDb } from '../client';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../client');

const mockDb = {
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
};
(getDb as jest.Mock).mockResolvedValue(mockDb);
const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;

beforeEach(() => jest.clearAllMocks());

const sampleColors: ExtractedColor[] = [
  { hex: '#FF0000', rgb: [255, 0, 0], lab: [53, 80, 67], name: 'Rojo', hslLightness: 0.5, weight: 0.4 },
  { hex: '#00FF00', rgb: [0, 255, 0], lab: [88, -86, 83], name: 'Lima', hslLightness: 0.5, weight: 0.3 },
  { hex: '#0000FF', rgb: [0, 0, 255], lab: [32, 79, -108], name: 'Azul', hslLightness: 0.5, weight: 0.15 },
  { hex: '#FFFF00', rgb: [255, 255, 0], lab: [97, -22, 94], name: 'Amarillo', hslLightness: 0.5, weight: 0.1 },
  { hex: '#FF00FF', rgb: [255, 0, 255], lab: [60, 98, -61], name: 'Magenta', hslLightness: 0.5, weight: 0.05 },
];

describe('updatePaletteColors', () => {
  it('runs UPDATE with JSON-serialized colors', async () => {
    await updatePaletteColors('palette-1', sampleColors);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE palettes SET colors'),
      JSON.stringify(sampleColors),
      expect.any(Number),
      'palette-1'
    );
  });

  it('sets updated_at to current timestamp', async () => {
    const before = Date.now();
    await updatePaletteColors('palette-1', sampleColors);
    const [, , updatedAt] = mockDb.runAsync.mock.calls[0];
    expect(updatedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('updatePaletteLayout', () => {
  it('runs UPDATE with JSON-serialized layout_config', async () => {
    const config: LayoutConfig = { ...DEFAULT_LAYOUT_CONFIG, archetypeId: 'editorial', showHex: false };
    await updatePaletteLayout('palette-2', config);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE palettes SET layout_config'),
      JSON.stringify(config),
      expect.any(Number),
      'palette-2'
    );
  });
});

describe('setPaletteCollection', () => {
  it('runs UPDATE with the given collection id', async () => {
    await setPaletteCollection('palette-3', 'col-1');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE palettes SET collection_id'),
      'col-1',
      expect.any(Number),
      'palette-3'
    );
  });

  it('runs UPDATE with null to unassign', async () => {
    await setPaletteCollection('palette-3', null);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE palettes SET collection_id'),
      null,
      expect.any(Number),
      'palette-3'
    );
  });
});

describe('updatePaletteImage', () => {
  const existingRow = {
    id: 'palette-4',
    image_uri: 'file:///documents/palettes/palette-4/full.jpg',
    thumbnail_uri: 'file:///documents/palettes/palette-4/thumb.jpg',
    colors: '[]',
    layout_config: JSON.stringify(DEFAULT_LAYOUT_CONFIG),
    collection_id: null,
    meta: JSON.stringify({ capturedAt: 0, source: 'camera', aspectRatio: 'original' }),
    created_at: 0,
    updated_at: 0,
    is_favorite: 0,
    export_count: 0,
  };

  it('copies the new files into the palette dir under fresh names and deletes the old ones', async () => {
    mockDb.getFirstAsync.mockResolvedValue(existingRow);

    const result = await updatePaletteImage(
      'palette-4',
      'file:///tmp/new-full.jpg',
      'file:///tmp/new-thumb.jpg'
    );

    expect(mockFs.copyAsync).toHaveBeenCalledWith({ from: 'file:///tmp/new-full.jpg', to: result.imageUri });
    expect(mockFs.copyAsync).toHaveBeenCalledWith({ from: 'file:///tmp/new-thumb.jpg', to: result.thumbnailUri });
    expect(mockFs.deleteAsync).toHaveBeenCalledWith(
      'file:///documents/palettes/palette-4/full.jpg',
      { idempotent: true }
    );
    expect(mockFs.deleteAsync).toHaveBeenCalledWith(
      'file:///documents/palettes/palette-4/thumb.jpg',
      { idempotent: true }
    );
    expect(result.imageUri).toContain('palettes/palette-4/full-');
    expect(result.thumbnailUri).toContain('palettes/palette-4/thumb-');
    expect(result.imageUri).not.toBe(existingRow.image_uri);
  });

  it('updates image_uri, thumbnail_uri, and updated_at in the DB', async () => {
    mockDb.getFirstAsync.mockResolvedValue(existingRow);

    const result = await updatePaletteImage(
      'palette-4',
      'file:///tmp/new-full.jpg',
      'file:///tmp/new-thumb.jpg'
    );

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE palettes SET image_uri'),
      result.imageUri,
      result.thumbnailUri,
      expect.any(Number),
      'palette-4'
    );
  });

  it('throws when the palette does not exist', async () => {
    mockDb.getFirstAsync.mockResolvedValue(undefined);

    await expect(
      updatePaletteImage('missing', 'file:///a.jpg', 'file:///b.jpg')
    ).rejects.toThrow('Palette not found: missing');
  });
});
