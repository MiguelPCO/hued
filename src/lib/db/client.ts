import * as SQLite from 'expo-sqlite';

import { MIGRATIONS } from './schema';

let _db: SQLite.SQLiteDatabase | null = null;

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = await db.getAllAsync<{ name: string }>('SELECT name FROM migrations');
  const appliedSet = new Set(applied.map((r) => r.name));

  for (const migration of MIGRATIONS) {
    if (appliedSet.has(migration.name)) continue;

    await db.execAsync(migration.sql);
    await db.runAsync(
      'INSERT INTO migrations (name, applied_at) VALUES (?, ?)',
      migration.name,
      Date.now()
    );
  }
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  _db = await SQLite.openDatabaseAsync('hued.db');
  await runMigrations(_db);
  return _db;
}
