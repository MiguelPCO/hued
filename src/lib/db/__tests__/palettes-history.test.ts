import * as FileSystem from 'expo-file-system/legacy';

import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import {
  toggleFavorite,
  incrementExportCount,
  deletePalette,
  duplicatePalette,
} from '../palettes';
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

const sourceRow = {
  id: '01HX1234567890ABCDEFGHIJKL',
  image_uri: 'file:///documents/palettes/01HX1234567890ABCDEFGHIJKL/full.jpg',
  thumbnail_uri: 'file:///documents/palettes/01HX1234567890ABCDEFGHIJKL/thumb.jpg',
  colors: '[]',
  layout_config: JSON.stringify(DEFAULT_LAYOUT_CONFIG),
  meta: JSON.stringify({ capturedAt: 1000, source: 'camera', aspectRatio: 'original' }),
  created_at: 1000,
  updated_at: 1000,
  is_favorite: 0,
  export_count: 2,
};

beforeEach(() => jest.clearAllMocks());

describe('toggleFavorite', () => {
  it('runs an UPDATE flipping is_favorite', async () => {
    await toggleFavorite('palette-1');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('is_favorite = NOT is_favorite'),
      expect.any(Number),
      'palette-1'
    );
  });
});

describe('incrementExportCount', () => {
  it('runs an UPDATE incrementing export_count', async () => {
    await incrementExportCount('palette-1');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('export_count = export_count + 1'),
      expect.any(Number),
      'palette-1'
    );
  });
});

describe('deletePalette', () => {
  it('deletes the row and the palette directory', async () => {
    mockDb.getFirstAsync.mockResolvedValue(sourceRow);

    await deletePalette('01HX1234567890ABCDEFGHIJKL');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM palettes'),
      '01HX1234567890ABCDEFGHIJKL'
    );
    expect(mockFs.deleteAsync).toHaveBeenCalledWith(
      'file:///documents/palettes/01HX1234567890ABCDEFGHIJKL/',
      { idempotent: true }
    );
  });

  it('does not throw if the palette row is already gone', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    await expect(deletePalette('missing-id')).resolves.toBeUndefined();
    expect(mockFs.deleteAsync).not.toHaveBeenCalled();
  });
});

describe('duplicatePalette', () => {
  it('copies both files into a new directory and inserts a new row', async () => {
    mockDb.getFirstAsync.mockResolvedValue(sourceRow);

    const duplicate = await duplicatePalette('01HX1234567890ABCDEFGHIJKL');

    expect(mockFs.makeDirectoryAsync).toHaveBeenCalledWith(
      expect.stringContaining('palettes/'),
      { intermediates: true }
    );
    expect(mockFs.copyAsync).toHaveBeenCalledWith({
      from: sourceRow.image_uri,
      to: expect.stringContaining('full.jpg'),
    });
    expect(mockFs.copyAsync).toHaveBeenCalledWith({
      from: sourceRow.thumbnail_uri,
      to: expect.stringContaining('thumb.jpg'),
    });
    expect(duplicate.id).not.toBe('01HX1234567890ABCDEFGHIJKL');
    expect(duplicate.isFavorite).toBe(false);
    expect(duplicate.exportCount).toBe(0);
  });

  it('inserts a row with the same colors and layoutConfig as the source', async () => {
    mockDb.getFirstAsync.mockResolvedValue(sourceRow);

    await duplicatePalette('01HX1234567890ABCDEFGHIJKL');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO palettes'),
      expect.any(String),
      expect.stringContaining('full.jpg'),
      expect.stringContaining('thumb.jpg'),
      '[]',
      JSON.stringify(DEFAULT_LAYOUT_CONFIG),
      sourceRow.meta,
      expect.any(Number),
      expect.any(Number),
      0,
      0
    );
  });

  it('throws if the source palette does not exist', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    await expect(duplicatePalette('missing-id')).rejects.toThrow('Palette not found');
  });

  it('cleans up the new directory if the DB insert fails', async () => {
    mockDb.getFirstAsync.mockResolvedValue(sourceRow);
    mockDb.runAsync.mockRejectedValueOnce(new Error('db down'));

    await expect(duplicatePalette('01HX1234567890ABCDEFGHIJKL')).rejects.toThrow('db down');
    expect(mockFs.deleteAsync).toHaveBeenCalledWith(
      expect.stringContaining('palettes/'),
      { idempotent: true }
    );
  });
});
