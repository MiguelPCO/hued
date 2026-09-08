# Collections (Carpetas) — Design

**Status:** Approved by Miguel 2026-09-08, ready for implementation plan.

## Context

hued is local-first (MMKV + SQLite + filesystem, no accounts, no backend —
see project architecture non-negotiables). Palettes currently have no way
to be grouped beyond the flat "Todas"/"Favoritas" split on Home. This spec
adds user-defined collections ("carpetas") to group palettes by theme.

Brainstormed and scoped 2026-09-08 (superpowers:brainstorming,
architectural path — new entity, schema migration, cross-cutting UI).

## Decisions locked in brainstorming

- **1 collection per palette**, not many-to-many. `collection_id` nullable
  FK on `palettes`, no join table. Simpler queries, simpler UI (a palette
  is "in" at most one folder, like a photo album — not tags).
- **Home surfaces collections as chips** in the existing filter row
  (Todas/Favoritas), not a separate "Carpetas" screen/nav entry.
- **Assign a palette to a collection from `PaletteCard`'s existing
  long-press Sheet** (Favorito/Duplicar/Compartir/Eliminar today), not from
  the palette detail screen.
- **Deleting a collection never deletes its palettes.** They fall back to
  unassigned (`collection_id = NULL`, i.e. they still show under "Todas").
  A destructive cascade here would mean a mis-tapped folder delete
  destroys real photos — unacceptable.

## Data model

New migration, additive (follows `src/lib/db/schema.ts`'s existing
`MIGRATIONS` array pattern — appended, never edits a past migration):

```sql
-- 002_create_collections
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
```

`position` exists from day one (INTEGER, default 0, chips render ordered
by it ascending then `created_at`) so a future manual-reorder feature
doesn't need its own migration — v1 UI has no reorder control, new
collections just append (`position = COUNT(*)` at creation time, or
simpler: `position = created_at` truncated — creation order).

No `icon`/`color` column in v1 — YAGNI, chips render with the same neutral
pill style as Todas/Favoritas.

### Types (`src/types/palette.ts`)

```ts
export interface Collection {
  id: string;
  name: string;
  createdAt: number;
  position: number;
}
```

`Palette` interface gains `collectionId: string | null`.

## DB layer

### New file `src/lib/db/collections.ts` (mirrors `palettes.ts` conventions
— ulid via `monotonicFactory`, `getDb()` from `./client`)

- `createCollection(name: string): Promise<Collection>` — trims `name`;
  empty/whitespace-only name is a caller-side validation concern (UI
  disables the save action), not re-validated here, matching how
  `settingsStore`'s `setProfileName` pushes trimming to the caller.
  Duplicate names are allowed (no UNIQUE constraint) — real folders can
  share a name in real filesystems too, not worth blocking on.
- `listCollections(): Promise<Collection[]>` — `ORDER BY position ASC,
  created_at ASC`.
- `renameCollection(id: string, name: string): Promise<void>`.
- `deleteCollection(id: string): Promise<void>` — two statements in one
  `db.execAsync` transaction (or sequential `runAsync` calls if the
  `expo-sqlite` wrapper here doesn't expose explicit transactions — check
  `client.ts`'s `getDb()` return type during implementation): first
  `UPDATE palettes SET collection_id = NULL WHERE collection_id = ?`,
  then `DELETE FROM collections WHERE id = ?`. Order matters — orphaning
  must commit before (or atomically with) the delete, never the reverse,
  or a crash between the two steps could leave palettes pointing at a
  dangling `collection_id`.

### `src/lib/db/palettes.ts` additions

- `setPaletteCollection(id: string, collectionId: string | null):
  Promise<void>` — `UPDATE palettes SET collection_id = ?, updated_at = ?
  WHERE id = ?`, same shape as the existing `updatePaletteColors`/
  `updatePaletteLayout`.
- `rowToPalette` gains `collectionId: row.collection_id` and
  `insertPaletteRow`'s INSERT column list gains `collection_id` (defaults
  to `NULL` — new palettes are created unassigned; there is no "create
  directly into a collection" flow in v1, matching the "assign from
  PaletteCard" decision above).

## UI

### Home (`app/(tabs)/index.tsx`)

- `Filter` type widens from `'all' | 'favorites'` to `'all' | 'favorites'
  | string` (a `string` value is a `collectionId` — ULIDs never collide
  with the two literals).
- `pillRow` renders, in order: "Todas", "Favoritas", one pill per loaded
  collection (label = `collection.name`), then a trailing "+" pill.
- Collections load via a new `listCollections()` call alongside the
  existing `listPalettes()` — same `useFocusEffect` refresh timing PaletteGrid
  already uses, so a newly created/renamed/deleted collection reflects on
  return to Home without a manual refresh.
- Tapping "+" opens a `Sheet` with a `TextInput` + "Crear" button (same
  shape as Settings' name-editor Sheet added earlier this session) →
  `createCollection(name)` → append to local collections state → sheet
  closes.
- Long-pressing a collection chip opens a small `Sheet`: "Renombrar"
  (opens the same TextInput-Sheet pre-filled) / "Eliminar" (confirm Sheet,
  same Cancelar/Eliminar pattern as `PaletteCard`'s delete confirm). If the
  deleted collection was the active filter, filter resets to `'all'`.

### `PaletteGrid.tsx`

- `filter` prop type widens to match Home's. `visible` memo's filter
  predicate becomes a 3-way branch: `'all'` → everything, `'favorites'` →
  `p.isFavorite`, else → `p.collectionId === filter`. Still pure
  client-side filtering over the already-loaded `palettes` array — no new
  DB query shape, consistent with how favorites filtering already works
  here.

### `PaletteCard.tsx`

- Its existing Sheet gains a "Mover a carpeta" row (new `Icon` — check
  `Icon.tsx`'s `IconName` union for a folder-shaped one, e.g. `'image'` is
  already used elsewhere in this codebase as a generic media icon; pick
  whatever `MaterialIcons` name reads clearly, added to the union if
  missing) between "Compartir" and "Eliminar". Tapping it opens a second
  Sheet: "Sin carpeta" + one row per collection (checkmark or bold on the
  currently-assigned one) → `setPaletteCollection(palette.id,
  collectionId | null)` → closes both sheets.

## Error handling

- All new DB calls wrap in `try/catch` → `Sentry.captureException`,
  matching every existing handler in `PaletteCard.tsx` and
  `app/palette/[id].tsx` — no new error-handling pattern introduced.
- Creating a collection with an empty/whitespace name: the "Crear" button
  is disabled while the trimmed draft is empty (mirrors the profile name
  editor's trim-on-save, but here trims *before* allowing the save
  action, not after, since an unnamed collection has no useful display
  fallback the way `null` profileName does with "Añadir nombre").

## Testing

- `src/lib/db/__tests__/collections.test.ts` — mirrors
  `palettes.test.ts`'s harness (same in-memory/native SQLite test setup
  already wired for that file). Covers: create → listCollections ordering,
  rename, delete-orphans-palettes (create a palette assigned to a
  collection, delete the collection, assert the palette's
  `collection_id` is now `null` and the palette row itself still exists).
- `PaletteGrid`'s filter branch: existing test coverage for the
  favorites-filter case (if any) extends with one more case for a
  collection-id filter — check `PaletteGrid`'s current test file (if one
  exists) during planning; add one if it doesn't, don't skip coverage on
  the new branch.

## Out of scope (explicit)

- Reordering collections via drag (the `position` column exists for this,
  but no UI ships in v1).
- Icons/colors per collection.
- Many-to-many (a palette in multiple folders).
- Nested collections (folders within folders).
- Assigning a collection at creation time (capture → crop → extract →
  compose flow does not gain a "save into..." step in v1).
