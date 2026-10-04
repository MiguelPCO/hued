import { MIGRATIONS } from '../schema';

interface FakeTxn {
  execAsync: jest.Mock;
  runAsync: jest.Mock;
}

function makeDb(applied: string[] = []) {
  const txn: FakeTxn = {
    execAsync: jest.fn((_sql: string) => Promise.resolve()),
    runAsync: jest.fn(() => Promise.resolve()),
  };
  return {
    txn,
    execAsync: jest.fn((_sql: string) => Promise.resolve()),
    getAllAsync: jest.fn(() => Promise.resolve(applied.map((name) => ({ name })))),
    withExclusiveTransactionAsync: jest.fn((fn: (t: FakeTxn) => Promise<void>) => fn(txn)),
  };
}

// `client.ts` guarda la conexión en una variable de módulo: un registro nuevo por test.
function load() {
  let client!: typeof import('../client');
  let sqlite!: { openDatabaseAsync: jest.Mock };
  jest.isolateModules(() => {
    sqlite = require('expo-sqlite');
    client = require('../client');
  });
  return { client, sqlite };
}

describe('getDb', () => {
  it('opens hued.db and applies every migration in order, each in its own transaction', async () => {
    const db = makeDb();
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    const result = await client.getDb();

    expect(result).toBe(db);
    expect(sqlite.openDatabaseAsync).toHaveBeenCalledWith('hued.db');
    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(MIGRATIONS.length);
    expect(db.txn.execAsync.mock.calls.map((c) => c[0])).toEqual(MIGRATIONS.map((m) => m.sql));
    expect(db.txn.runAsync.mock.calls.map((c) => c[1])).toEqual(MIGRATIONS.map((m) => m.name));
  });

  it('creates the migrations ledger before reading which migrations ran', async () => {
    const db = makeDb();
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    await client.getDb();

    expect(db.execAsync.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS migrations');
    expect(db.execAsync.mock.invocationCallOrder[0]).toBeLessThan(db.getAllAsync.mock.invocationCallOrder[0]);
  });

  it('skips migrations that were already applied', async () => {
    const db = makeDb([MIGRATIONS[0].name]);
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    await client.getDb();

    expect(db.txn.execAsync.mock.calls.map((c) => c[0])).toEqual(MIGRATIONS.slice(1).map((m) => m.sql));
  });

  it('opens no transaction when the schema is already up to date', async () => {
    const db = makeDb(MIGRATIONS.map((m) => m.name));
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    await client.getDb();

    expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it('shares one connection between concurrent callers', async () => {
    const db = makeDb();
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    const [a, b] = await Promise.all([client.getDb(), client.getDb()]);

    expect(a).toBe(b);
    expect(sqlite.openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached connection on later calls', async () => {
    const db = makeDb();
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    await client.getDb();
    await client.getDb();

    expect(sqlite.openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('forgets a failed open so the next call retries', async () => {
    const db = makeDb();
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(db);

    await expect(client.getDb()).rejects.toThrow('disk full');
    await expect(client.getDb()).resolves.toBe(db);

    expect(sqlite.openDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  it('does not record a migration whose SQL failed (safe to retry)', async () => {
    const db = makeDb();
    db.txn.execAsync.mockRejectedValueOnce(new Error('syntax error'));
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    await expect(client.getDb()).rejects.toThrow('syntax error');

    expect(db.txn.runAsync).not.toHaveBeenCalled();
  });

  it('retries pending migrations after a failure instead of caching the broken connection', async () => {
    const db = makeDb();
    db.withExclusiveTransactionAsync.mockRejectedValueOnce(new Error('locked'));
    const { client, sqlite } = load();
    sqlite.openDatabaseAsync.mockResolvedValue(db);

    await expect(client.getDb()).rejects.toThrow('locked');
    await expect(client.getDb()).resolves.toBe(db);

    expect(sqlite.openDatabaseAsync).toHaveBeenCalledTimes(2);
  });
});
