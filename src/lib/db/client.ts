import * as SQLite from 'expo-sqlite';

import { MIGRATIONS } from './schema';

let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

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

    // Run the migration's SQL and its bookkeeping insert in a single
    // transaction so a crash mid-migration leaves it fully unapplied
    // (safe to retry) instead of partially applied (e.g. an ALTER TABLE
    // that succeeded but was never recorded, which would throw
    // "duplicate column name" and brick getDb() on every future launch).
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(migration.sql);
      await txn.runAsync(
        'INSERT INTO migrations (name, applied_at) VALUES (?, ?)',
        migration.name,
        Date.now()
      );
    });
  }
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('hued.db');
      await runMigrations(db);
      return db;
    })().catch((err) => {
      _dbPromise = null;
      throw err;
    });
  }
  return _dbPromise;
}
