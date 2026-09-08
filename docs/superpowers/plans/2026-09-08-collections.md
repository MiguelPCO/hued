# Collections (Carpetas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users group palettes into named collections ("carpetas"), filterable as chips on Home, with safe (non-destructive) deletion.

**Architecture:** New `collections` SQLite table + nullable `collection_id` FK on `palettes` (1 collection per palette, no join table). A new `src/lib/db/collections.ts` module owns collection CRUD, mirroring the existing `src/lib/db/palettes.ts` conventions exactly (same mock-based test style, same `monotonicFactory` ULID pattern, same error-handling shape). UI surfaces collections as filter chips on Home (`app/(tabs)/index.tsx`) and lets you assign a palette to one from `PaletteCard`'s existing long-press Sheet — no new screens, no new navigation entries.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript strict, expo-sqlite, Zustand (unrelated to this feature — collections use SQLite directly like palettes, not the settings store), Jest.

**Spec:** `docs/superpowers/specs/2026-09-08-collections-design.md`

## Global Constraints

- 1 collection per palette (`palettes.collection_id` nullable FK) — never a join table.
- Deleting a collection NEVER deletes palettes — it orphans them (`collection_id = NULL`), always in that order relative to the collection row's own delete (orphan first, delete second).
- No icon/color per collection in v1. No nested collections. No many-to-many. No "save into collection" step in the capture→crop→extract→compose flow — new palettes are always created with `collection_id = NULL`.
- All new async DB/file calls that can throw wrap in `try/catch` → `Sentry.captureException`, matching every existing handler in `PaletteCard.tsx` and `app/palette/[id].tsx` — this plan introduces no new error-handling pattern.
- Migrations are additive-only in `src/lib/db/schema.ts`'s `MIGRATIONS` array — never edit a past migration's SQL.

---

### Task 1: Schema, types, and `collections.ts` CRUD

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/types/palette.ts`
- Create: `src/lib/db/collections.ts`
- Test: `src/lib/db/__tests__/collections.test.ts`

**Interfaces:**
- Consumes: `getDb()` from `./client` (already exists, returns `Promise<SQLite.SQLiteDatabase>`).
- Produces: `Collection` type (`{ id: string; name: string; createdAt: number; position: number }`), and from `collections.ts`: `createCollection(name: string): Promise<Collection>`, `listCollections(): Promise<Collection[]>`, `renameCollection(id: string, name: string): Promise<void>`, `deleteCollection(id: string): Promise<void>`. Task 2 depends on all four of these existing.

- [ ] **Step 1: Add migration 002 to schema.ts**

Open `src/lib/db/schema.ts`. Append a new entry to the `MIGRATIONS` array (after the existing `001_create_palettes` entry, still inside the array, so the file's closing `];` moves down):

```ts
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
```

- [ ] **Step 2: Add the `Collection` type and widen `Palette`**

Open `src/types/palette.ts`. Add a new interface near the top (after `ExtractedColor`, before `ArchetypeId` — order doesn't matter functionally, keep it readable):

```ts
export interface Collection {
  id: string;
  name: string;
  createdAt: number;
  position: number;
}
```

In the existing `Palette` interface, add one field (after `layoutConfig`, before `meta` — again, readability only):

```ts
  collectionId: string | null;
```

The full `Palette` interface after this change:

```ts
export interface Palette {
  id: string;
  imageUri: string;
  thumbnailUri: string;
  colors: ExtractedColor[];
  layoutConfig: LayoutConfig;
  collectionId: string | null;
  meta: PaletteMeta;
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  exportCount: number;
}
```

Do not touch `DEFAULT_LAYOUT_CONFIG` — `collectionId` lives on `Palette`, not `LayoutConfig`.

- [ ] **Step 3: Write the failing test for `collections.ts`**

Create `src/lib/db/__tests__/collections.test.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued" && npx jest collections.test.ts`
Expected: FAIL — `Cannot find module '../collections'`.

- [ ] **Step 5: Implement `src/lib/db/collections.ts`**

```ts
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
```

`position` uses the creation timestamp (`now`) rather than a `COUNT(*)` query — simpler, and ties are broken by `created_at ASC` in the `ORDER BY` anyway. No UI ships in v1 that reorders this column; it exists so a future manual-reorder feature doesn't need its own migration.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued" && npx jest collections.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 7: Typecheck**

Run: `cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued" && npx tsc --noEmit`
Expected: no errors. (`Palette.collectionId` is now required by the type but not yet produced anywhere — Task 2 fixes that; this task alone will show errors at `rowToPalette`/palette-literal call sites in `palettes.ts`, which is expected and resolved next task. If you want this task to typecheck in isolation, that's fine — Task 2 immediately follows and fixes it; do not add a default or optional-modifier to `collectionId` to paper over it.)

- [ ] **Step 8: Commit**

```bash
cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued"
git add src/lib/db/schema.ts src/types/palette.ts src/lib/db/collections.ts src/lib/db/__tests__/collections.test.ts
git commit -m "$(cat <<'EOF'
feat(db): add collections table + CRUD

Migration 002 adds collections + nullable palettes.collection_id.
New src/lib/db/collections.ts mirrors palettes.ts's conventions
(monotonicFactory ULIDs, same mock-based test style). deleteCollection
orphans palettes (collection_id = NULL) before deleting the row — never
a cascade delete of real photos.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HE4BuYB1pJFomYkicGHGUv
EOF
)"
```

---

### Task 2: Wire `collection_id` through `palettes.ts`

**Files:**
- Modify: `src/lib/db/palettes.ts`
- Modify: `src/lib/db/__tests__/palettes.test.ts`
- Modify: `src/lib/db/__tests__/palettes-update.test.ts`
- Modify: `src/lib/db/__tests__/palettes-history.test.ts`

**Interfaces:**
- Consumes: `Palette.collectionId: string | null` (Task 1).
- Produces: `setPaletteCollection(id: string, collectionId: string | null): Promise<void>`. Task 5 (PaletteCard) calls this directly.

- [ ] **Step 1: Update `PaletteRow` and `rowToPalette`**

In `src/lib/db/palettes.ts`, add the new column to `PaletteRow` (after `layout_config`):

```ts
interface PaletteRow {
  id: string;
  image_uri: string;
  thumbnail_uri: string;
  colors: string;
  layout_config: string;
  collection_id: string | null;
  meta: string;
  created_at: number;
  updated_at: number;
  is_favorite: number;
  export_count: number;
}
```

And in `rowToPalette`, add the field (after `layoutConfig`):

```ts
function rowToPalette(row: PaletteRow): Palette {
  return {
    id: row.id,
    imageUri: row.image_uri,
    thumbnailUri: row.thumbnail_uri,
    colors: JSON.parse(row.colors) as ExtractedColor[],
    layoutConfig: JSON.parse(row.layout_config) as LayoutConfig,
    collectionId: row.collection_id,
    meta: JSON.parse(row.meta) as PaletteMeta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isFavorite: row.is_favorite === 1,
    exportCount: row.export_count,
  };
}
```

- [ ] **Step 2: Update `insertPaletteRow`**

```ts
async function insertPaletteRow(palette: Palette): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO palettes
       (id, image_uri, thumbnail_uri, colors, layout_config, collection_id, meta,
        created_at, updated_at, is_favorite, export_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    palette.id,
    palette.imageUri,
    palette.thumbnailUri,
    JSON.stringify(palette.colors),
    JSON.stringify(palette.layoutConfig),
    palette.collectionId,
    JSON.stringify(palette.meta),
    palette.createdAt,
    palette.updatedAt,
    palette.isFavorite ? 1 : 0,
    palette.exportCount
  );
}
```

- [ ] **Step 3: Set `collectionId` at both call sites**

In `savePalette`, the constructed `palette` object literal gets `collectionId: null` (new palettes are always unassigned — no "save into collection" step in v1):

```ts
    const palette: Palette = {
      id,
      imageUri: `${dir}full.jpg`,
      thumbnailUri: `${dir}thumb.jpg`,
      colors: params.colors,
      layoutConfig: params.layoutConfig,
      collectionId: null,
      meta: params.meta,
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
      exportCount: 0,
    };
```

In `duplicatePalette`, the constructed `duplicate` object literal inherits the source's collection — a duplicate of a palette that's in "Café" should also land in "Café", not silently fall out of it:

```ts
    const duplicate: Palette = {
      id: newId,
      imageUri: `${dir}full.jpg`,
      thumbnailUri: `${dir}thumb.jpg`,
      colors: source.colors,
      layoutConfig: source.layoutConfig,
      collectionId: source.collectionId,
      meta: source.meta,
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
      exportCount: 0,
    };
```

- [ ] **Step 4: Update existing tests for the new column**

`src/lib/db/__tests__/palettes.test.ts` — the `'inserts row in SQLite with JSON-serialized fields'` test asserts the exact positional args to `runAsync`. Update it to account for the new `collection_id` param (inserted after `layoutConfig` JSON, before `meta` JSON):

```ts
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
```

Also update the `'deserializes JSON fields from row'` test's mocked row (in the same file) to include `collection_id: null` alongside the other row fields, and add one assertion:

```ts
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
```

- [ ] **Step 5: Write the failing test for `setPaletteCollection`**

In `src/lib/db/__tests__/palettes-update.test.ts`, add the import and a new `describe` block:

```ts
import { updatePaletteColors, updatePaletteLayout, setPaletteCollection } from '../palettes';
```

```ts
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
```

- [ ] **Step 6: Write the failing test for duplicate inheriting collection**

In `src/lib/db/__tests__/palettes-history.test.ts`, find the existing `duplicatePalette` describe block and check what `sourceRow` (defined near the top of that file) currently sets for the fields `rowToPalette` reads. Add `collection_id: 'col-1'` to that shared `sourceRow` fixture, then add a new test in the `duplicatePalette` describe block:

```ts
  it('inherits the source palette collection', async () => {
    mockDb.getFirstAsync.mockResolvedValue(sourceRow);
    const duplicate = await duplicatePalette(sourceRow.id);
    expect(duplicate.collectionId).toBe('col-1');
  });
```

(If `sourceRow` is redefined per-test rather than shared, add `collection_id: 'col-1'` directly to the row object this new test mocks instead of editing a shared fixture — check the file's actual structure before editing; either way `mockDb.getFirstAsync` must resolve a row with `collection_id: 'col-1'` for this test.)

- [ ] **Step 7: Run tests to verify they fail**

Run: `cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued" && npx jest palettes.test.ts palettes-update.test.ts palettes-history.test.ts`
Expected: FAIL — `setPaletteCollection` not exported, and the updated assertions don't match current `insertPaletteRow` arg order.

- [ ] **Step 8: Add `setPaletteCollection` to `palettes.ts`**

Add near the other single-field `UPDATE` functions (after `updatePaletteLayout`):

```ts
export async function setPaletteCollection(id: string, collectionId: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE palettes SET collection_id = ?, updated_at = ? WHERE id = ?',
    collectionId,
    Date.now(),
    id
  );
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued" && npx jest palettes.test.ts palettes-update.test.ts palettes-history.test.ts`
Expected: PASS, all tests.

- [ ] **Step 10: Full verification**

Run: `cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued" && npx tsc --noEmit && npx jest --silent`
Expected: tsc clean, all suites pass (should be back to the full count, no longer failing on the Task-1-introduced `collectionId` type gap).

- [ ] **Step 11: Commit**

```bash
cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued"
git add src/lib/db/palettes.ts src/lib/db/__tests__/palettes.test.ts src/lib/db/__tests__/palettes-update.test.ts src/lib/db/__tests__/palettes-history.test.ts
git commit -m "$(cat <<'EOF'
feat(db): wire collection_id through palettes.ts

New palettes are created unassigned (collectionId: null — no
save-into-collection step in v1). Duplicates inherit the source's
collection. Adds setPaletteCollection for PaletteCard's upcoming
"Mover a carpeta" action.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HE4BuYB1pJFomYkicGHGUv
EOF
)"
```

---

### Task 3: `PaletteGrid.tsx` filters by collection

**Files:**
- Modify: `src/components/palette/PaletteGrid.tsx`
- Test: `src/components/palette/__tests__/PaletteGrid.test.tsx` (new — no test file exists for this component yet)

**Interfaces:**
- Consumes: `Palette.collectionId` (Task 2).
- Produces: widened `Filter = 'all' | 'favorites' | string` prop type. Task 6 (Home) passes this type through.

- [ ] **Step 1: Write the failing test**

Create `src/components/palette/__tests__/PaletteGrid.test.tsx`. This tests the filtering logic directly rather than mounting the full component (avoids pulling in `expo-router`'s `useFocusEffect` and `listPalettes`'s SQLite dependency chain) — extract the filter predicate into an exported pure function first, then test that function. Add this export to `PaletteGrid.tsx` in Step 3 below; write the test against it now:

```tsx
import { filterPalettes } from '../PaletteGrid';
import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import type { Palette } from '@/types/palette';

function makePalette(overrides: Partial<Palette>): Palette {
  return {
    id: 'p1',
    imageUri: 'file:///a.jpg',
    thumbnailUri: 'file:///a-thumb.jpg',
    colors: [],
    layoutConfig: DEFAULT_LAYOUT_CONFIG,
    collectionId: null,
    meta: { capturedAt: 0, source: 'camera', aspectRatio: 'original' },
    createdAt: 0,
    updatedAt: 0,
    isFavorite: false,
    exportCount: 0,
    ...overrides,
  };
}

describe('filterPalettes', () => {
  const all = [
    makePalette({ id: 'p1', isFavorite: true, collectionId: null }),
    makePalette({ id: 'p2', isFavorite: false, collectionId: 'col-1' }),
    makePalette({ id: 'p3', isFavorite: false, collectionId: null }),
  ];

  it('"all" returns every palette regardless of favorite/collection', () => {
    expect(filterPalettes(all, 'all', '').map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('"favorites" returns only isFavorite palettes', () => {
    expect(filterPalettes(all, 'favorites', '').map((p) => p.id)).toEqual(['p1']);
  });

  it('a collection id returns only palettes with that collectionId', () => {
    expect(filterPalettes(all, 'col-1', '').map((p) => p.id)).toEqual(['p2']);
  });

  it('an unknown collection id returns no palettes', () => {
    expect(filterPalettes(all, 'col-does-not-exist', '').map((p) => p.id)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued" && npx jest PaletteGrid.test.tsx`
Expected: FAIL — `filterPalettes` is not exported from `../PaletteGrid`.

- [ ] **Step 3: Extract and export `filterPalettes`, widen `Filter`**

In `src/components/palette/PaletteGrid.tsx`, change the `Props` interface's `filter` field and add an exported function above the component:

```tsx
interface Props {
  onPressPalette: (id: string) => void;
  filter: 'all' | 'favorites' | string;
  query: string;
  onPalettesChange?: (count: number) => void;
}

export function filterPalettes(
  palettes: Palette[],
  filter: 'all' | 'favorites' | string,
  query: string
): Palette[] {
  return palettes
    .filter((p) => {
      if (filter === 'all') return true;
      if (filter === 'favorites') return p.isFavorite;
      return p.collectionId === filter;
    })
    .filter((p) => paletteMatchesQuery(p.colors.map((c) => c.name), query));
}
```

Replace the component's existing `visible` memo body to call this function instead of duplicating the filter logic:

```tsx
  const visible = useMemo(
    () => filterPalettes(palettes, filter, query),
    [palettes, filter, query]
  );
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued" && npx jest PaletteGrid.test.tsx`
Expected: PASS, all 4 tests.

- [ ] **Step 5: Full verification**

Run: `cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued" && npx tsc --noEmit && npx jest --silent`
Expected: tsc clean, all suites pass.

- [ ] **Step 6: Commit**

```bash
cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued"
git add src/components/palette/PaletteGrid.tsx src/components/palette/__tests__/PaletteGrid.test.tsx
git commit -m "$(cat <<'EOF'
feat(grid): filter palettes by collection id

Filter widens from 'all' | 'favorites' to include any collection id
(a ULID string, never colliding with the two literals). Extracted the
filter predicate into an exported filterPalettes() so it's testable
without mounting the component (avoids pulling in expo-router's
useFocusEffect / SQLite through listPalettes).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HE4BuYB1pJFomYkicGHGUv
EOF
)"
```

---

### Task 4: "Mover a carpeta" in `PaletteCard.tsx`

**Files:**
- Modify: `src/components/ui/Icon.tsx`
- Modify: `src/components/palette/PaletteCard.tsx`

**Interfaces:**
- Consumes: `setPaletteCollection` (Task 2), `listCollections` (Task 1).
- Produces: nothing new consumed by other tasks — this is a leaf UI task.

**Note on testing:** `PaletteCard.tsx` has no existing test file in this codebase (its current delete/duplicate/share logic is untested at the component level — the DB functions it calls are tested in `palettes.test.ts` et al. instead). This task follows that existing convention: no new test file, verified via `tsc` + manual run per the project's `run` skill. If this project later adds component tests for `PaletteCard`, add coverage for the new Sheet then — don't introduce the first component test file for this file as an incidental part of this task.

- [ ] **Step 1: Add a folder icon name**

In `src/components/ui/Icon.tsx`, add `'folder'` to the `IconName` union (after `'image'`):

```ts
export type IconName =
  | 'home'
  | 'camera-alt'
  | 'settings'
  | 'add'
  | 'favorite'
  | 'favorite-border'
  | 'share'
  | 'delete'
  | 'close'
  | 'check'
  | 'chevron-right'
  | 'chevron-left'
  | 'arrow-back'
  | 'image'
  | 'folder'
  | 'palette'
  | 'star'
  | 'star-border'
  | 'more-vert'
  | 'download'
  | 'content-copy'
  | 'lock';
```

`'folder'` is a valid `@expo/vector-icons/MaterialIcons` glyph name (Material Icons' standard folder icon) — no other change needed, `Icon`'s implementation already passes `name` straight through to `MaterialIcons`.

- [ ] **Step 2: Add state and handlers to `PaletteCard.tsx`**

In `src/components/palette/PaletteCard.tsx`, add a new import and extend the existing one:

```tsx
import { listCollections } from '@/lib/db/collections';
```

Replace the existing `import { deletePalette, duplicatePalette, toggleFavorite } from '@/lib/db/palettes';` line with:

```tsx
import { deletePalette, duplicatePalette, setPaletteCollection, toggleFavorite } from '@/lib/db/palettes';
```

Add `Collection` to the type import at the top:

```tsx
import type { Collection, Palette } from '@/types/palette';
```

Add new state (alongside the existing `sheetVisible`/`confirmingDelete`/`busy` state):

```tsx
  const [collectionSheetVisible, setCollectionSheetVisible] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
```

Add a new handler (near `handleDuplicate`):

```tsx
  async function openCollectionSheet() {
    try {
      const list = await listCollections();
      setCollections(list);
      setCollectionSheetVisible(true);
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  async function handleAssignCollection(collectionId: string | null) {
    setBusy(true);
    try {
      await setPaletteCollection(palette.id, collectionId);
      setCollectionSheetVisible(false);
      closeSheet();
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setBusy(false);
    }
  }
```

`closeSheet()` (existing function) resets both `sheetVisible` and `confirmingDelete` — calling it after assigning also closes the original action Sheet underneath, so the user ends up back on the grid, matching how `handleDelete`/`handleDuplicate` already close out.

- [ ] **Step 3: Add the "Mover a carpeta" row and second Sheet**

In the JSX, add a new row to the existing action Sheet (between "Compartir" and "Eliminar"):

```tsx
            <TouchableOpacity style={styles.sheetRow} onPress={openCollectionSheet} disabled={busy}>
              <Icon name="folder" size={20} />
              <Text variant="body">Mover a carpeta</Text>
            </TouchableOpacity>
```

Add a second `Sheet`, as a sibling of the existing one (after its closing `</Sheet>`, still inside the outer `<>...</>` fragment):

```tsx
      <Sheet visible={collectionSheetVisible} onClose={() => setCollectionSheetVisible(false)}>
        <TouchableOpacity
          style={styles.sheetRow}
          onPress={() => handleAssignCollection(null)}
          disabled={busy}
        >
          <Text variant="body">Sin carpeta</Text>
        </TouchableOpacity>
        {collections.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={styles.sheetRow}
            onPress={() => handleAssignCollection(c.id)}
            disabled={busy}
          >
            <Text variant="body" weight={palette.collectionId === c.id ? 'semibold' : 'regular'}>
              {c.name}
            </Text>
          </TouchableOpacity>
        ))}
      </Sheet>
```

- [ ] **Step 4: Typecheck**

Run: `cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the full test suite (regression check)**

Run: `cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued" && npx jest --silent`
Expected: all suites still pass (this task adds no new test file, per the note above — this step just confirms nothing broke).

- [ ] **Step 6: Commit**

```bash
cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued"
git add src/components/ui/Icon.tsx src/components/palette/PaletteCard.tsx
git commit -m "$(cat <<'EOF'
feat(palette-card): add "Mover a carpeta" to the long-press Sheet

New second-level Sheet lists "Sin carpeta" + every collection (bold on
the currently-assigned one), calling setPaletteCollection on tap. No
new component test file — PaletteCard has none today; the DB layer
this depends on (collections.ts, palettes.ts) is covered separately.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HE4BuYB1pJFomYkicGHGUv
EOF
)"
```

---

### Task 5: Home screen — collection chips, create/rename/delete

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `listCollections`, `createCollection`, `renameCollection`, `deleteCollection` (Task 1); `filterPalettes`'s widened `Filter` type via `PaletteGrid`'s `filter` prop (Task 3).
- Produces: nothing consumed elsewhere — this is the final leaf task.

**Note on testing:** Same as Task 4 — `app/(tabs)/index.tsx` has no existing test file (it's a screen composing already-tested pieces: `PaletteGrid`, `Button`, DB calls). Verified via `tsc` + manual run, matching how the file's existing gallery/camera FAB logic (added earlier, also untested at this layer) was handled.

- [ ] **Step 1: Add imports and widen `Filter`**

In `app/(tabs)/index.tsx`, add:

```tsx
import { createCollection, deleteCollection, listCollections, renameCollection } from '@/lib/db/collections';
```

and add `Collection` to the existing type-only import:

```tsx
import type { Collection } from '@/types/palette';
```

Change the local `Filter` type:

```tsx
type Filter = 'all' | 'favorites' | string;
```

- [ ] **Step 2: Add state and load collections**

Add new state (alongside the existing `hasPalettes`/`picking`/`galleryDenied`/`filter`/`query`):

```tsx
  const [collections, setCollections] = useState<Collection[]>([]);
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [manageSheetCollection, setManageSheetCollection] = useState<Collection | null>(null);
  const [renaming, setRenaming] = useState(false);
```

Extend the existing `useFocusEffect` to also load collections (it currently only calls `listPalettes().then(...)` — add a second call in the same effect, same refresh timing as palettes):

```tsx
  useFocusEffect(
    useCallback(() => {
      listPalettes().then((p) => setHasPalettes(p.length > 0));
      listCollections().then(setCollections);
    }, [])
  );
```

- [ ] **Step 3: Add create/rename/delete handlers**

All three wrap their DB call in `try/catch` → `Sentry.captureException`, per the Global Constraints:

```tsx
  function openCreateSheet() {
    setNameDraft('');
    setCreateSheetVisible(true);
  }

  async function handleCreateCollection() {
    const trimmed = nameDraft.trim();
    if (trimmed.length === 0) return;
    try {
      const created = await createCollection(trimmed);
      setCollections((prev) => [...prev, created]);
      setCreateSheetVisible(false);
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  function openManageSheet(collection: Collection) {
    setNameDraft(collection.name);
    setManageSheetCollection(collection);
  }

  async function handleRenameCollection() {
    if (!manageSheetCollection) return;
    const trimmed = nameDraft.trim();
    if (trimmed.length === 0) return;
    try {
      await renameCollection(manageSheetCollection.id, trimmed);
      setCollections((prev) =>
        prev.map((c) => (c.id === manageSheetCollection.id ? { ...c, name: trimmed } : c))
      );
      setManageSheetCollection(null);
      setRenaming(false);
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  async function handleDeleteCollection() {
    if (!manageSheetCollection) return;
    const id = manageSheetCollection.id;
    try {
      await deleteCollection(id);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (filter === id) setFilter('all');
      setManageSheetCollection(null);
    } catch (err) {
      Sentry.captureException(err);
    }
  }
```

Add the `Sentry` import at the top of the file (it isn't currently imported here):

```tsx
import * as Sentry from '@sentry/react-native';
```

- [ ] **Step 4: Add chips to the toolbar's `pillRow`**

Find the existing `pillRow` block (inside the `{hasPalettes ? (...)}` branch):

```tsx
            <View style={styles.pillRow}>
              {(['all', 'favorites'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.pill, filter === f && styles.pillActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text
                    variant="small"
                    weight={filter === f ? 'semibold' : 'regular'}
                    color={filter === f ? Colors.accentForeground : Colors.textPrimary}
                  >
                    {f === 'all' ? 'Todas' : 'Favoritas'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
```

Replace it, wrapping the row in a horizontal `ScrollView` (the fixed 2-item row was never scrollable — with an unbounded number of collection chips it needs to be) and adding the collection chips + trailing "+" chip:

```tsx
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
              <View style={styles.pillRow}>
                {(['all', 'favorites'] as const).map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.pill, filter === f && styles.pillActive]}
                    onPress={() => setFilter(f)}
                  >
                    <Text
                      variant="small"
                      weight={filter === f ? 'semibold' : 'regular'}
                      color={filter === f ? Colors.accentForeground : Colors.textPrimary}
                    >
                      {f === 'all' ? 'Todas' : 'Favoritas'}
                    </Text>
                  </TouchableOpacity>
                ))}
                {collections.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.pill, filter === c.id && styles.pillActive]}
                    onPress={() => setFilter(c.id)}
                    onLongPress={() => openManageSheet(c)}
                  >
                    <Text
                      variant="small"
                      weight={filter === c.id ? 'semibold' : 'regular'}
                      color={filter === c.id ? Colors.accentForeground : Colors.textPrimary}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.pill} onPress={openCreateSheet}>
                  <Text variant="small" color={Colors.textPrimary}>+ Nueva</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
```

Add `ScrollView` to the existing `react-native` import at the top of the file:

```tsx
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
```

Add a `pillScroll` style (near the existing `pillRow` style):

```tsx
  pillScroll: { flexGrow: 0 },
```

- [ ] **Step 5: Add the create-collection Sheet**

Add `Sheet` and `Icon` (if not already imported — `Icon` was added by an earlier commit for the gallery FAB; check before duplicating the import) to the imports, then add near the end of the component's JSX, as a sibling of the existing FAB `TouchableOpacity`s (before the closing `</SafeAreaView>`):

```tsx
      <Sheet visible={createSheetVisible} onClose={() => setCreateSheetVisible(false)}>
        <Text variant="label" color={Colors.textSecondary} style={styles.sheetLabel}>NUEVA CARPETA</Text>
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="Nombre de la carpeta"
          placeholderTextColor={Colors.textPlaceholder}
          style={styles.sheetInput}
          autoFocus
          maxLength={40}
        />
        <Button
          label="Crear"
          onPress={handleCreateCollection}
          variant="primary"
          fullWidth
          disabled={nameDraft.trim().length === 0}
        />
      </Sheet>
```

- [ ] **Step 6: Add the manage (rename/delete) Sheet**

```tsx
      <Sheet visible={manageSheetCollection !== null} onClose={() => setManageSheetCollection(null)}>
        {renaming ? (
          <>
            <Text variant="label" color={Colors.textSecondary} style={styles.sheetLabel}>
              RENOMBRAR CARPETA
            </Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholderTextColor={Colors.textPlaceholder}
              style={styles.sheetInput}
              autoFocus
              maxLength={40}
            />
            <Button
              label="Guardar"
              onPress={handleRenameCollection}
              variant="primary"
              fullWidth
              disabled={nameDraft.trim().length === 0}
            />
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.sheetRow} onPress={() => setRenaming(true)}>
              <Text variant="body">Renombrar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetRow} onPress={handleDeleteCollection}>
              <Text variant="body" color={Colors.error}>Eliminar</Text>
            </TouchableOpacity>
          </>
        )}
      </Sheet>
```

`renaming` must reset to `false` whenever a fresh manage-sheet opens — `openManageSheet` (Step 3) doesn't currently set it, so add that:

```tsx
  function openManageSheet(collection: Collection) {
    setNameDraft(collection.name);
    setManageSheetCollection(collection);
    setRenaming(false);
  }
```

Add the `sheetLabel`/`sheetInput`/`sheetRow` styles (same shape as the ones already added to `app/(tabs)/settings.tsx` for its name editor earlier this session — reuse those exact values, don't invent new spacing):

```tsx
  sheetLabel: { marginBottom: Spacing.sm },
  sheetInput: {
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  sheetRow: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
```

- [ ] **Step 7: Typecheck**

Run: `cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued" && npx tsc --noEmit`
Expected: no errors. Fix any import ordering/duplicate-import issues (e.g. if `Icon` or `Sheet` were already imported by a prior commit this session, don't add a second import line — extend the existing one).

- [ ] **Step 8: Full verification**

Run: `cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued" && npx tsc --noEmit && npx jest --silent`
Expected: tsc clean, all suites pass.

- [ ] **Step 9: Manual verification**

Use the project's `run` skill (or `npx expo start`, reload on the emulator/device already running per this session's earlier setup) to confirm: "+ Nueva" chip creates a folder and it appears immediately; tapping a folder chip filters the grid to only its palettes (assign one via `PaletteCard`'s "Mover a carpeta" first, from Task 4); long-pressing a chip opens Renombrar/Eliminar; deleting the currently-active-filter collection resets the view to "Todas" and the previously-filtered palette is still visible there (not deleted).

- [ ] **Step 10: Commit**

```bash
cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued"
git add "app/(tabs)/index.tsx"
git commit -m "$(cat <<'EOF'
feat(home): collection chips — create, filter, rename, delete

Chips extend the existing Todas/Favoritas filter row (now horizontally
scrollable — an unbounded chip count no longer fits a fixed row).
Long-press a chip for Renombrar/Eliminar. Deleting the collection
currently filtering the grid resets to "Todas" rather than leaving the
grid showing a stale/dead filter — the palettes themselves are never
touched (deleteCollection only orphans collection_id, per Task 1).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HE4BuYB1pJFomYkicGHGUv
EOF
)"
```

---

## Post-implementation

After Task 5's commit, run `superpowers:finishing-a-development-branch` to decide how this integrates (this work lands on the existing `design/modern-nostalgia-kodak-stripe` branch, still unmerged from earlier in this session — same branch, no new worktree needed unless the executor decides otherwise).
