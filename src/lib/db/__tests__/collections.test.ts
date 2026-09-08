import { createCollection, listCollections, renameCollection, deleteCollection } from '../collections';
import { getDb } from '../client';

jest.mock('../client');

const mockDb = {
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
  getAllAsync: jest.fn(),
};
(getDb as jest.Mock).mockResolvedValue(mockDb);

beforeEach(() => jest.clearAllMocks());

describe('createCollection', () => {
  it('inserts a row and returns the created collection', async () => {
    const collection = await createCollection('Café');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO collections'),
      expect.any(String),
      'Café',
      expect.any(Number),
      expect.any(Number)
    );
    expect(collection.name).toBe('Café');
    expect(collection.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});

describe('listCollections', () => {
  it('returns empty array when table is empty', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    expect(await listCollections()).toEqual([]);
  });

  it('orders by position then created_at', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    await listCollections();
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY position ASC, created_at ASC')
    );
  });
});

describe('renameCollection', () => {
  it('runs UPDATE with the new name', async () => {
    await renameCollection('col-1', 'Nuevo nombre');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE collections SET name'),
      'Nuevo nombre',
      'col-1'
    );
  });
});

describe('deleteCollection', () => {
  it('orphans palettes before deleting the collection, in that order', async () => {
    await deleteCollection('col-1');

    expect(mockDb.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE palettes SET collection_id = NULL'),
      'col-1'
    );
    expect(mockDb.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('DELETE FROM collections'),
      'col-1'
    );
  });
});
