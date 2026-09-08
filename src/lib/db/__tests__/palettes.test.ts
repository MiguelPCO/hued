import * as FileSystem from 'expo-file-system/legacy';

import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import { savePalette, getPalette, listPalettes } from '../palettes';
import { getDb } from '../client';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../client');

const mockDb = {
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
};
(getDb as jest.Mock).mockResolvedValue(mockDb);

const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;

const baseParams = {
  imageUri: 'file:///tmp/photo.jpg',
  thumbnailUri: 'file:///tmp/thumb.jpg',
  colors: [],
  layoutConfig: DEFAULT_LAYOUT_CONFIG,
  meta: { capturedAt: 1000, source: 'camera' as const, aspectRatio: 'original' },
};

describe('savePalette', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates directory and copies both files', async () => {
    await savePalette(baseParams);

    expect(mockFs.makeDirectoryAsync).toHaveBeenCalledWith(
      expect.stringContaining('palettes/'),
      { intermediates: true }
    );
    expect(mockFs.copyAsync).toHaveBeenCalledTimes(2);
    expect(mockFs.copyAsync).toHaveBeenCalledWith({
      from: 'file:///tmp/photo.jpg',
      to: expect.stringContaining('full.jpg'),
    });
    expect(mockFs.copyAsync).toHaveBeenCalledWith({
      from: 'file:///tmp/thumb.jpg',
      to: expect.stringContaining('thumb.jpg'),
    });
  });

  it('inserts row in SQLite with JSON-serialized fields', async () => {
    await savePalette(baseParams);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO palettes'),
      expect.any(String),            // id (ULID)
      expect.stringContaining('full.jpg'),
      expect.stringContaining('thumb.jpg'),
      '[]',                          // colors serialized
      expect.any(String),            // layoutConfig JSON
      null,                          // collectionId — unassigned on create
      expect.any(String),            // meta JSON
      expect.any(Number),            // createdAt
      expect.any(Number),            // updatedAt
      0,
      0
    );
  });

  it('returns palette with valid ULID id', async () => {
    const palette = await savePalette(baseParams);
    expect(palette.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(palette.isFavorite).toBe(false);
    expect(palette.exportCount).toBe(0);
  });

  it('generates unique IDs across concurrent saves', async () => {
    const [p1, p2] = await Promise.all([
      savePalette(baseParams),
      savePalette(baseParams),
    ]);
    expect(p1.id).not.toBe(p2.id);
  });
});

describe('getPalette', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when row not found', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    const result = await getPalette('nonexistent');
    expect(result).toBeNull();
  });

  it('deserializes JSON fields from row', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      id: '01HX1234567890ABCDEFGHIJKL',
      image_uri: 'file:///palettes/01HX/full.jpg',
      thumbnail_uri: 'file:///palettes/01HX/thumb.jpg',
      colors: '[]',
      layout_config: JSON.stringify(DEFAULT_LAYOUT_CONFIG),
      collection_id: null,
      meta: JSON.stringify({ capturedAt: 1000, source: 'camera', aspectRatio: 'original' }),
      created_at: 1000,
      updated_at: 1000,
      is_favorite: 0,
      export_count: 0,
    });

    const palette = await getPalette('01HX1234567890ABCDEFGHIJKL');
    expect(palette?.isFavorite).toBe(false);
    expect(palette?.colors).toEqual([]);
    expect(palette?.meta.source).toBe('camera');
    expect(palette?.collectionId).toBeNull();
  });
});

describe('listPalettes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty array when table is empty', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const palettes = await listPalettes();
    expect(palettes).toEqual([]);
  });
});
