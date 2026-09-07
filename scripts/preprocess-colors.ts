/**
 * Generates src/data/named-colors.json — a curated, committed dataset used by
 * the color-naming lookup (src/lib/color/colorNames.ts, Task 3).
 *
 * This is NOT run at app runtime or app build time. Re-run intentionally via:
 *   pnpm preprocess-colors
 *
 * Source: color-name-list's `bestof` export (curated by the package's
 * maintainers from their ~32k full list down to ~5k quality names — this
 * replaces the "good name" quality flag hypothesized in the task brief; no
 * such per-entry flag exists in the installed version, but the `bestof`
 * export IS that curation, applied upstream).
 *
 * Further curation performed here:
 *   1. Drop any residual generic/numeric-only names (defensive; bestof
 *      shouldn't contain these, but we guard anyway per SPRINTS.md Day 4).
 *   2. Parse hex -> RGB, compute LAB via the existing rgbToLab helper.
 *   3. Greedy dedup in LAB space: process entries in a fixed (alphabetical,
 *      as provided by the package) order and keep an entry only if it is at
 *      least MIN_LAB_DISTANCE away (Euclidean deltaE, CIE76) from every
 *      already-kept entry. This preserves spread across color space and
 *      removes near-duplicate/near-identical shades, which is what the
 *      dataset needs for a useful nearest-name lookup (Task 3).
 *   4. Cap the result at MAX_ENTRIES as a safety net.
 *
 * Deterministic: no randomness, fixed input order, so re-running produces
 * byte-identical output for a given color-name-list version.
 */
import * as fs from 'fs';
import * as path from 'path';

import { rgbToLab } from '../src/lib/color/colorMath';

interface RawColor {
  name: string;
  hex: string;
}

// Tuned so ~4945 bestof entries reduce to roughly 1500 kept entries.
// MAX_ENTRIES is a safety net only — it must not bind at the chosen
// MIN_LAB_DISTANCE, otherwise the dedup loop stops partway through the
// (alphabetically-ordered) input and silently truncates the tail of the
// alphabet from the output. Set well above the expected ~1500 result.
const MIN_LAB_DISTANCE = 5.5;
const MAX_ENTRIES = 3000;

const GENERIC_NAME_PATTERNS = [
  /^color\s*\d+$/i,
  /^#?[0-9a-f]{6}$/i,
  /^#?[0-9a-f]{3}$/i,
  // Real paint/color names essentially never start with a digit ("100 Mph",
  // "24 Carrot", "3AM Breakup"). `bestof`'s curation still lets a handful of
  // these numeric-leading, non-evocative entries through. This subsumes the
  // previous fully-numeric-only check (`/^\d+$/`) as well.
  /^\d/,
];

function isGenericName(name: string): boolean {
  const trimmed = name.trim();
  return GENERIC_NAME_PATTERNS.some((re) => re.test(trimmed));
}

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function labDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

interface OutputEntry {
  name: string;
  rgb: [number, number, number];
  lab: [number, number, number];
}

async function main() {
  // Dynamic import (not a static `import`/`require`) is required here: this
  // package ships `"type": "module"` but its "require" export condition
  // points at a UMD build that isn't valid under that mode. A dynamic
  // import() resolves the "import" condition instead, which points at the
  // real ESM build and works correctly.
  const mod = (await import('color-name-list/bestof')) as { colornames: RawColor[] };
  const bestOf = mod.colornames;
  const rawCount = bestOf.length;

  const kept: OutputEntry[] = [];
  let droppedGeneric = 0;
  let droppedNearDuplicate = 0;
  let droppedInvalidHex = 0;

  for (const entry of bestOf) {
    if (isGenericName(entry.name)) {
      droppedGeneric++;
      continue;
    }

    const rgb = hexToRgb(entry.hex);
    if (!rgb) {
      droppedInvalidHex++;
      continue;
    }

    const lab: [number, number, number] = rgbToLab(rgb[0], rgb[1], rgb[2]);

    const tooClose = kept.some((k) => labDistance(k.lab, lab) < MIN_LAB_DISTANCE);
    if (tooClose) {
      droppedNearDuplicate++;
      continue;
    }

    kept.push({
      name: entry.name,
      rgb,
      lab: [round(lab[0], 3), round(lab[1], 3), round(lab[2], 3)],
    });

    if (kept.length >= MAX_ENTRIES) break;
  }

  const outDir = path.join(process.cwd(), 'src', 'data');
  const outPath = path.join(outDir, 'named-colors.json');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(kept, null, 2) + '\n', 'utf8');

  console.log(`Raw bestof entries:        ${rawCount}`);
  console.log(`Dropped (generic name):    ${droppedGeneric}`);
  console.log(`Dropped (invalid hex):     ${droppedInvalidHex}`);
  console.log(`Dropped (near-duplicate):  ${droppedNearDuplicate}`);
  console.log(`Kept (final entries):      ${kept.length}`);
  console.log(`Written to:                ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
