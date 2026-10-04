import { MIGRATIONS } from '../schema';

describe('MIGRATIONS', () => {
  it('has unique names numbered consecutively from 001', () => {
    const names = MIGRATIONS.map((m) => m.name);

    expect(new Set(names).size).toBe(names.length);
    names.forEach((name, i) => {
      expect(name).toMatch(new RegExp(`^${String(i + 1).padStart(3, '0')}_[a-z_]+$`));
    });
  });

  it('every migration carries non-empty SQL', () => {
    MIGRATIONS.forEach((m) => expect(m.sql.trim().length).toBeGreaterThan(0));
  });

  it('001 creates the palettes table, its indexes and the migrations ledger', () => {
    const sql = MIGRATIONS[0].sql;

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS palettes');
    expect(sql).toContain('idx_palettes_created_at');
    expect(sql).toContain('idx_palettes_favorite');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS migrations');
  });

  it('002 creates collections and links palettes to them', () => {
    const sql = MIGRATIONS[1].sql;

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS collections');
    expect(sql).toContain('ALTER TABLE palettes ADD COLUMN collection_id');
    expect(sql).toContain('idx_palettes_collection');
  });

  it('palettes keep every column the data layer reads', () => {
    const sql = MIGRATIONS[0].sql + MIGRATIONS[1].sql;
    [
      'id', 'image_uri', 'thumbnail_uri', 'colors', 'layout_config', 'meta',
      'created_at', 'updated_at', 'is_favorite', 'export_count', 'collection_id',
    ].forEach((column) => expect(sql).toContain(column));
  });
});
