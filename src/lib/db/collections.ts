import { monotonicFactory } from 'ulidx';

import type { Collection } from '@/types/palette';
import { getDb } from './client';

const ulid = monotonicFactory(() => Math.random());

interface CollectionRow {
  id: string;
  name: string;
  created_at: number;
  position: number;
}

function rowToCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    position: row.position,
  };
}

export async function createCollection(name: string): Promise<Collection> {
  const db = await getDb();
  const id = ulid();
  const now = Date.now();

  await db.runAsync(
    'INSERT INTO collections (id, name, created_at, position) VALUES (?, ?, ?, ?)',
    id,
    name,
    now,
    now
  );

  return { id, name, createdAt: now, position: now };
}

export async function listCollections(): Promise<Collection[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CollectionRow>(
    'SELECT * FROM collections ORDER BY position ASC, created_at ASC'
  );
  return rows.map(rowToCollection);
}

export async function renameCollection(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE collections SET name = ? WHERE id = ?', name, id);
}

export async function deleteCollection(id: string): Promise<void> {
  const db = await getDb();
  // Orphan first — a crash between these two statements must never leave a
  // palette pointing at a deleted collection_id.
  await db.runAsync('UPDATE palettes SET collection_id = NULL WHERE collection_id = ?', id);
  await db.runAsync('DELETE FROM collections WHERE id = ?', id);
}
