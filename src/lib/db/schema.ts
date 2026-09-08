export interface Migration {
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    name: '001_create_palettes',
    sql: `
      CREATE TABLE IF NOT EXISTS palettes (
        id TEXT PRIMARY KEY,
        image_uri TEXT NOT NULL,
        thumbnail_uri TEXT NOT NULL,
        colors TEXT NOT NULL,
        layout_config TEXT NOT NULL,
        meta TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        export_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_palettes_created_at ON palettes(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_palettes_favorite ON palettes(is_favorite)
        WHERE is_favorite = 1;

      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL
      );
    `,
  },
  {
    name: '002_create_collections',
    sql: `
      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        position INTEGER NOT NULL DEFAULT 0
      );

      ALTER TABLE palettes ADD COLUMN collection_id TEXT NULL
        REFERENCES collections(id);

      CREATE INDEX IF NOT EXISTS idx_palettes_collection
        ON palettes(collection_id);
    `,
  },
];
