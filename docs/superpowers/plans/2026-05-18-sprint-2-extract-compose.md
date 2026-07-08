# Sprint 2 — Extract + Compose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User can take a photo → extracted colors fill the palette → tap a palette in the grid → pick a layout archetype → see a live Skia card preview.

**Architecture:** Color extraction runs via Skia pixel sampling on the 200×200 thumbnail (k-means++, k=5). Archetypes are Skia Canvas components rendered in `app/palette/[id].tsx`. `LayoutConfig` changes auto-save with 500ms debounce. Home screen switches from empty-state to `PaletteGrid` when palettes exist.

**Tech Stack:** `@shopify/react-native-skia` · `expo-sqlite` via `getDb()` · `expo-router` · TypeScript strict · jest-expo · Design tokens from `src/lib/tokens.ts` · UI atoms: `Button`, `Text` from `src/components/ui/`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/utils/dateUtils.ts` | `formatDateEs(ts)` → "18 may 2026" |
| Create | `src/lib/color/colorMath.ts` | `rgbToHex`, `rgbToHsl`, `rgbToLab` |
| Create | `src/lib/color/colorNames.ts` | 50 named colors (Spanish) + `findColorName(lab)` |
| Create | `src/lib/color/__tests__/colorMath.test.ts` | Unit tests for color math |
| Create | `src/lib/color/extract.ts` | `extractColors(uri)` — fetch → Skia decode → k-means++ → 5 colors |
| Create | `src/lib/color/__tests__/extract.test.ts` | Unit tests with mocked Skia |
| Modify | `src/lib/db/palettes.ts` | Add `updatePaletteColors`, `updatePaletteLayout` |
| Create | `src/lib/db/__tests__/palettes-update.test.ts` | Tests for new DB functions |
| Modify | `app/crop.tsx` | After save: extractColors → updatePaletteColors → router to /palette/[id] |
| Create | `src/components/palette/PaletteCard.tsx` | Thumbnail + color strip + date label |
| Create | `src/components/palette/PaletteGrid.tsx` | FlatList 2-col, skeleton loader, useFocusEffect |
| Modify | `app/(tabs)/index.tsx` | Swap empty-state for PaletteGrid when palettes.length > 0 |
| Create | `src/components/compose/archetypes/types.ts` | Shared `ArchetypeProps` interface |
| Create | `src/components/compose/archetypes/StripArchetype.tsx` | Image 70% + 5 color bars 30% |
| Create | `src/components/compose/archetypes/EditorialArchetype.tsx` | Full-bleed image + gradient overlay + color dots |
| Create | `src/components/compose/archetypes/GridArchetype.tsx` | 2×3 grid: image spans 2 cols + 5 color cells |
| Create | `src/components/compose/archetypes/BannerArchetype.tsx` | Full-bleed image + color strip pinned bottom |
| Create | `src/components/compose/archetypes/SideArchetype.tsx` | Image left 60% + vertical color stack right 40% |
| Create | `src/components/compose/ArchetypeCanvas.tsx` | `<Canvas>` wrapper, switches by archetypeId, applies cornerRadius + cardStyle |
| Create | `app/palette/[id].tsx` | Compose screen: load palette, archetype selector, toggle controls, auto-save |

---

### Task 1: Date utils + color math + color names

**Files:**
- Create: `src/lib/utils/dateUtils.ts`
- Create: `src/lib/color/colorMath.ts`
- Create: `src/lib/color/colorNames.ts`
- Create: `src/lib/color/__tests__/colorMath.test.ts`

- [ ] **Step 1: Create dateUtils.ts**

Create `src/lib/utils/dateUtils.ts`:

```typescript
export function formatDateEs(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
```

- [ ] **Step 2: Write failing color math tests**

Create `src/lib/color/__tests__/colorMath.test.ts`:

```typescript
import { rgbToHex, rgbToHsl, rgbToLab } from '../colorMath';

describe('rgbToHex', () => {
  it('converts red', () => expect(rgbToHex(255, 0, 0)).toBe('#FF0000'));
  it('converts black', () => expect(rgbToHex(0, 0, 0)).toBe('#000000'));
  it('converts white', () => expect(rgbToHex(255, 255, 255)).toBe('#FFFFFF'));
  it('pads single-digit values', () => expect(rgbToHex(0, 16, 255)).toBe('#0010FF'));
});

describe('rgbToHsl', () => {
  it('red has hue ~0, max saturation, lightness 0.5', () => {
    const [h, s, l] = rgbToHsl(255, 0, 0);
    expect(h).toBeCloseTo(0, 0);
    expect(s).toBeCloseTo(1, 1);
    expect(l).toBeCloseTo(0.5, 1);
  });
  it('white has lightness 1', () => {
    const [, , l] = rgbToHsl(255, 255, 255);
    expect(l).toBeCloseTo(1, 2);
  });
  it('black has lightness 0', () => {
    const [, , l] = rgbToHsl(0, 0, 0);
    expect(l).toBeCloseTo(0, 2);
  });
});

describe('rgbToLab', () => {
  it('black has L≈0', () => {
    const [L] = rgbToLab(0, 0, 0);
    expect(L).toBeCloseTo(0, 0);
  });
  it('white has L≈100', () => {
    const [L] = rgbToLab(255, 255, 255);
    expect(L).toBeCloseTo(100, 0);
  });
  it('returns 3-element tuple', () => {
    expect(rgbToLab(128, 64, 32)).toHaveLength(3);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```powershell
pnpm test -- --testPathPattern="colorMath.test"
```

Expected: FAIL — `Cannot find module '../colorMath'`

- [ ] **Step 4: Create colorMath.ts**

Create `src/lib/color/colorMath.ts`:

```typescript
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(v).toString(16).padStart(2, '0').toUpperCase())
      .join('')
  );
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
    case gn: h = ((bn - rn) / d + 2) / 6; break;
    default:  h = ((rn - gn) / d + 4) / 6;
  }
  return [h * 360, s, l];
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const rl = lin(r), gl = lin(g), bl = lin(b);
  const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  const y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / 1.00000;
  const z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
```

- [ ] **Step 5: Run tests — expect PASS**

```powershell
pnpm test -- --testPathPattern="colorMath.test"
```

Expected: PASS — 7 tests.

- [ ] **Step 6: Create colorNames.ts**

Create `src/lib/color/colorNames.ts`:

```typescript
import { rgbToLab } from './colorMath';

interface NamedColor {
  name: string;
  rgb: [number, number, number];
}

const NAMED_COLORS: NamedColor[] = [
  { name: 'Rojo', rgb: [255, 0, 0] },
  { name: 'Rojo oscuro', rgb: [139, 0, 0] },
  { name: 'Carmesí', rgb: [220, 20, 60] },
  { name: 'Granate', rgb: [128, 0, 0] },
  { name: 'Burdeos', rgb: [128, 0, 32] },
  { name: 'Coral', rgb: [255, 127, 80] },
  { name: 'Salmón', rgb: [250, 128, 114] },
  { name: 'Rosa', rgb: [255, 192, 203] },
  { name: 'Magenta', rgb: [255, 0, 255] },
  { name: 'Naranja', rgb: [255, 165, 0] },
  { name: 'Naranja rojizo', rgb: [255, 69, 0] },
  { name: 'Terracota', rgb: [226, 114, 91] },
  { name: 'Durazno', rgb: [255, 218, 185] },
  { name: 'Melocotón', rgb: [255, 204, 153] },
  { name: 'Amarillo', rgb: [255, 255, 0] },
  { name: 'Dorado', rgb: [255, 215, 0] },
  { name: 'Mostaza', rgb: [255, 219, 88] },
  { name: 'Ocre', rgb: [204, 119, 34] },
  { name: 'Canela', rgb: [210, 105, 30] },
  { name: 'Siena', rgb: [160, 82, 45] },
  { name: 'Marrón', rgb: [165, 42, 42] },
  { name: 'Lima', rgb: [0, 255, 0] },
  { name: 'Verde', rgb: [0, 128, 0] },
  { name: 'Verde oliva', rgb: [107, 142, 35] },
  { name: 'Oliva', rgb: [128, 128, 0] },
  { name: 'Verde menta', rgb: [144, 238, 144] },
  { name: 'Menta', rgb: [152, 255, 152] },
  { name: 'Esmeralda', rgb: [80, 200, 120] },
  { name: 'Verde bosque', rgb: [34, 139, 34] },
  { name: 'Verde azulado', rgb: [0, 128, 128] },
  { name: 'Turquesa', rgb: [64, 224, 208] },
  { name: 'Cian', rgb: [0, 255, 255] },
  { name: 'Celeste', rgb: [178, 255, 255] },
  { name: 'Azul cielo', rgb: [135, 206, 235] },
  { name: 'Azul claro', rgb: [173, 216, 230] },
  { name: 'Azul acero', rgb: [70, 130, 180] },
  { name: 'Azul', rgb: [0, 0, 255] },
  { name: 'Marino', rgb: [0, 0, 128] },
  { name: 'Índigo', rgb: [75, 0, 130] },
  { name: 'Zafiro', rgb: [15, 82, 186] },
  { name: 'Añil', rgb: [75, 0, 130] },
  { name: 'Morado', rgb: [128, 0, 128] },
  { name: 'Violeta', rgb: [238, 130, 238] },
  { name: 'Lavanda', rgb: [230, 230, 250] },
  { name: 'Lila', rgb: [200, 162, 200] },
  { name: 'Vino', rgb: [114, 47, 55] },
  { name: 'Blanco', rgb: [255, 255, 255] },
  { name: 'Crema', rgb: [255, 253, 208] },
  { name: 'Beige', rgb: [245, 245, 220] },
  { name: 'Gris claro', rgb: [211, 211, 211] },
  { name: 'Plateado', rgb: [192, 192, 192] },
  { name: 'Gris', rgb: [128, 128, 128] },
  { name: 'Pizarra', rgb: [112, 128, 144] },
  { name: 'Gris oscuro', rgb: [64, 64, 64] },
  { name: 'Negro', rgb: [0, 0, 0] },
];

let _cache: Array<{ name: string; lab: [number, number, number] }> | null = null;

function getCache() {
  if (!_cache) {
    _cache = NAMED_COLORS.map(({ name, rgb }) => ({
      name,
      lab: rgbToLab(rgb[0], rgb[1], rgb[2]),
    }));
  }
  return _cache;
}

export function findColorName(lab: [number, number, number]): string {
  const cache = getCache();
  let minDist = Infinity;
  let result = 'Desconocido';
  for (const entry of cache) {
    const dist = Math.sqrt(
      (lab[0] - entry.lab[0]) ** 2 +
      (lab[1] - entry.lab[1]) ** 2 +
      (lab[2] - entry.lab[2]) ** 2
    );
    if (dist < minDist) {
      minDist = dist;
      result = entry.name;
    }
  }
  return result;
}
```

- [ ] **Step 7: Typecheck**

```powershell
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```
git add src/lib/utils/dateUtils.ts src/lib/color/colorMath.ts src/lib/color/colorNames.ts "src/lib/color/__tests__/colorMath.test.ts"
git commit -m "feat(color): add color math utils, named color lookup table, and date formatter"
```

---

### Task 2: Color extraction + tests

**Files:**
- Create: `src/lib/color/extract.ts`
- Create: `src/lib/color/__tests__/extract.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/color/__tests__/extract.test.ts`:

```typescript
import { Skia, ColorType, AlphaType } from '@shopify/react-native-skia';
import { extractColors, ExtractError } from '../extract';

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: { fromBytes: jest.fn((b: Uint8Array) => ({ _bytes: b })) },
    Image: { MakeImageFromEncoded: jest.fn() },
  },
  ColorType: { RGBA_8888: 4 },
  AlphaType: { Unpremul: 2 },
}));

function makeMockImage(pixels: Uint8Array, w = 10, h = 10) {
  return {
    width: () => w,
    height: () => h,
    readPixels: jest.fn().mockReturnValue(pixels),
  };
}

function solidPixels(r: number, g: number, b: number, count: number): Uint8Array {
  const buf = new Uint8Array(count * 4);
  for (let i = 0; i < count * 4; i += 4) {
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
  }
  return buf;
}

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)) });
});

describe('extractColors', () => {
  it('returns exactly 5 colors', async () => {
    const pixels = solidPixels(200, 50, 50, 100);
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(pixels));
    const colors = await extractColors('file:///thumb.jpg');
    expect(colors).toHaveLength(5);
  });

  it('colors are sorted by weight descending', async () => {
    const pixels = solidPixels(200, 50, 50, 100);
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(pixels));
    const colors = await extractColors('file:///thumb.jpg');
    for (let i = 0; i < colors.length - 1; i++) {
      expect(colors[i].weight).toBeGreaterThanOrEqual(colors[i + 1].weight);
    }
  });

  it('all colors have valid hex format', async () => {
    const pixels = solidPixels(100, 150, 200, 100);
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(pixels));
    const colors = await extractColors('file:///thumb.jpg');
    for (const c of colors) {
      expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('weights sum to approximately 1', async () => {
    const pixels = solidPixels(80, 120, 200, 100);
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(pixels));
    const colors = await extractColors('file:///thumb.jpg');
    const total = colors.reduce((s, c) => s + c.weight, 0);
    expect(total).toBeCloseTo(1, 1);
  });

  it('throws ExtractError when Skia cannot decode image', async () => {
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(null);
    await expect(extractColors('file:///bad.jpg')).rejects.toThrow(ExtractError);
  });

  it('throws ExtractError when readPixels returns null', async () => {
    const mockImage = { width: () => 10, height: () => 10, readPixels: jest.fn().mockReturnValue(null) };
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(mockImage);
    await expect(extractColors('file:///bad.jpg')).rejects.toThrow(ExtractError);
  });

  it('each color has rgb, lab, name, hslLightness fields', async () => {
    const pixels = solidPixels(200, 100, 50, 100);
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(pixels));
    const colors = await extractColors('file:///thumb.jpg');
    for (const c of colors) {
      expect(c.rgb).toHaveLength(3);
      expect(c.lab).toHaveLength(3);
      expect(typeof c.name).toBe('string');
      expect(c.hslLightness).toBeGreaterThanOrEqual(0);
      expect(c.hslLightness).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
pnpm test -- --testPathPattern="extract.test"
```

Expected: FAIL — `Cannot find module '../extract'`

- [ ] **Step 3: Implement extract.ts**

Create `src/lib/color/extract.ts`:

```typescript
import { Skia, ColorType, AlphaType } from '@shopify/react-native-skia';
import type { ExtractedColor } from '@/types/palette';
import { rgbToHex, rgbToHsl, rgbToLab } from './colorMath';
import { findColorName } from './colorNames';

export class ExtractError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ExtractError';
  }
}

const K = 5;
const MAX_ITER = 20;
const SAMPLE_STEP = 4;

type RGB = [number, number, number];

function dist2(a: RGB, b: RGB): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function initCentroids(samples: RGB[]): RGB[] {
  const centroids: RGB[] = [];
  centroids.push(samples[Math.floor(Math.random() * samples.length)]);
  while (centroids.length < K) {
    const dists = samples.map((s) => Math.min(...centroids.map((c) => dist2(s, c))));
    const sum = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    let chosen = samples[samples.length - 1];
    for (let j = 0; j < samples.length; j++) {
      r -= dists[j];
      if (r <= 0) { chosen = samples[j]; break; }
    }
    centroids.push([...chosen] as RGB);
  }
  return centroids;
}

function assign(samples: RGB[], centroids: RGB[]): number[] {
  return samples.map((s) => {
    let minD = Infinity, idx = 0;
    centroids.forEach((c, i) => { const d = dist2(s, c); if (d < minD) { minD = d; idx = i; } });
    return idx;
  });
}

function kmeans(samples: RGB[], centroids: RGB[]): RGB[] {
  let centers = centroids.map((c) => [...c] as RGB);
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const asgn = assign(samples, centers);
    const sums: RGB[] = Array.from({ length: K }, () => [0, 0, 0] as RGB);
    const counts = new Array<number>(K).fill(0);
    samples.forEach((s, i) => {
      const c = asgn[i];
      sums[c][0] += s[0]; sums[c][1] += s[1]; sums[c][2] += s[2];
      counts[c]++;
    });
    let moved = false;
    centers = sums.map((sum, i) => {
      if (counts[i] === 0) return centers[i];
      const next: RGB = [
        Math.round(sum[0] / counts[i]),
        Math.round(sum[1] / counts[i]),
        Math.round(sum[2] / counts[i]),
      ];
      if (dist2(next, centers[i]) > 0) moved = true;
      return next;
    });
    if (!moved) break;
  }
  return centers;
}

export async function extractColors(thumbnailUri: string): Promise<ExtractedColor[]> {
  const response = await fetch(thumbnailUri);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const skData = Skia.Data.fromBytes(bytes);
  const skImage = Skia.Image.MakeImageFromEncoded(skData);
  if (!skImage) throw new ExtractError('Skia could not decode image');

  const w = skImage.width(), h = skImage.height();
  const pixels = skImage.readPixels(0, 0, {
    width: w,
    height: h,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  }) as Uint8Array | null;
  if (!pixels) throw new ExtractError('readPixels returned null');

  const samples: RGB[] = [];
  for (let i = 0; i < pixels.length; i += 4 * SAMPLE_STEP) {
    if (pixels[i + 3] < 128) continue;
    samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  }
  if (samples.length < K) throw new ExtractError(`Too few opaque pixels: ${samples.length}`);

  const centroids = kmeans(samples, initCentroids(samples));
  const assignments = assign(samples, centroids);
  const counts = new Array<number>(K).fill(0);
  assignments.forEach((c) => counts[c]++);
  const total = samples.length;

  const colors: ExtractedColor[] = centroids.map(([r, g, b], i) => {
    const lab = rgbToLab(r, g, b);
    const [, , hslL] = rgbToHsl(r, g, b);
    return {
      hex: rgbToHex(r, g, b),
      rgb: [r, g, b],
      lab,
      name: findColorName(lab),
      hslLightness: hslL,
      weight: counts[i] / total,
    };
  });

  return colors.sort((a, b) => b.weight - a.weight);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
pnpm test -- --testPathPattern="extract.test"
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Typecheck**

```powershell
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```
git add src/lib/color/extract.ts "src/lib/color/__tests__/extract.test.ts"
git commit -m "feat(color): add extractColors() with Skia pixel sampling and k-means++ clustering"
```

---

### Task 3: DB update functions + tests

**Files:**
- Modify: `src/lib/db/palettes.ts`
- Create: `src/lib/db/__tests__/palettes-update.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/db/__tests__/palettes-update.test.ts`:

```typescript
import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import type { ExtractedColor, LayoutConfig } from '@/types/palette';
import { updatePaletteColors, updatePaletteLayout } from '../palettes';
import { getDb } from '../client';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../client');

const mockDb = {
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
};
(getDb as jest.Mock).mockResolvedValue(mockDb);

beforeEach(() => jest.clearAllMocks());

const sampleColors: ExtractedColor[] = [
  { hex: '#FF0000', rgb: [255, 0, 0], lab: [53, 80, 67], name: 'Rojo', hslLightness: 0.5, weight: 0.4 },
  { hex: '#00FF00', rgb: [0, 255, 0], lab: [88, -86, 83], name: 'Lima', hslLightness: 0.5, weight: 0.3 },
  { hex: '#0000FF', rgb: [0, 0, 255], lab: [32, 79, -108], name: 'Azul', hslLightness: 0.5, weight: 0.15 },
  { hex: '#FFFF00', rgb: [255, 255, 0], lab: [97, -22, 94], name: 'Amarillo', hslLightness: 0.5, weight: 0.1 },
  { hex: '#FF00FF', rgb: [255, 0, 255], lab: [60, 98, -61], name: 'Magenta', hslLightness: 0.5, weight: 0.05 },
];

describe('updatePaletteColors', () => {
  it('runs UPDATE with JSON-serialized colors', async () => {
    await updatePaletteColors('palette-1', sampleColors);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE palettes SET colors'),
      JSON.stringify(sampleColors),
      expect.any(Number),
      'palette-1'
    );
  });

  it('sets updated_at to current timestamp', async () => {
    const before = Date.now();
    await updatePaletteColors('palette-1', sampleColors);
    const [, , updatedAt] = mockDb.runAsync.mock.calls[0];
    expect(updatedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('updatePaletteLayout', () => {
  it('runs UPDATE with JSON-serialized layout_config', async () => {
    const config: LayoutConfig = { ...DEFAULT_LAYOUT_CONFIG, archetypeId: 'editorial', showHex: false };
    await updatePaletteLayout('palette-2', config);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE palettes SET layout_config'),
      JSON.stringify(config),
      expect.any(Number),
      'palette-2'
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
pnpm test -- --testPathPattern="palettes-update.test"
```

Expected: FAIL — `updatePaletteColors is not a function`

- [ ] **Step 3: Add functions to palettes.ts**

Open `src/lib/db/palettes.ts` and add after `listPalettes`:

```typescript
export async function updatePaletteColors(id: string, colors: ExtractedColor[]): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE palettes SET colors = ?, updated_at = ? WHERE id = ?',
    JSON.stringify(colors),
    Date.now(),
    id
  );
}

export async function updatePaletteLayout(id: string, config: LayoutConfig): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE palettes SET layout_config = ?, updated_at = ? WHERE id = ?',
    JSON.stringify(config),
    Date.now(),
    id
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
pnpm test -- --testPathPattern="palettes-update.test"
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Run all tests**

```powershell
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Typecheck**

```powershell
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```
git add src/lib/db/palettes.ts "src/lib/db/__tests__/palettes-update.test.ts"
git commit -m "feat(db): add updatePaletteColors and updatePaletteLayout"
```

---

### Task 4: Crop screen integration

**Files:**
- Modify: `app/crop.tsx`

- [ ] **Step 1: Read current crop.tsx**

Read `app/crop.tsx` to understand the current `handleCrop` function and `ScreenState` type.

- [ ] **Step 2: Update crop.tsx**

Replace the full content of `app/crop.tsx`:

```typescript
import * as Sentry from '@sentry/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import ImageCropPicker from 'react-native-image-crop-picker';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { trackEvent } from '@/lib/analytics/events';
import { extractColors, ExtractError } from '@/lib/color/extract';
import { savePalette, updatePaletteColors } from '@/lib/db/palettes';
import { optimize, thumbnail } from '@/lib/utils/image';
import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import type { CaptureSource } from '@/types/palette';
import { Colors, Radius, Spacing } from '@/lib/tokens';

type AspectRatio = '1:1' | '4:5' | '9:16' | 'original';

const ASPECT_SIZES: Record<AspectRatio, { width: number; height: number } | null> = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
  original: null,
};

const RATIOS: AspectRatio[] = ['1:1', '4:5', '9:16', 'original'];

type ScreenState = 'idle' | 'cropping' | 'saving' | 'extracting' | 'error';

export default function CropScreen() {
  const params = useLocalSearchParams<{ uri: string; source: string }>();
  const imageUri = params.uri as string | undefined;
  const captureSource = (params.source ?? 'camera') as CaptureSource;

  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('original');
  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cropStartRef = useRef<number>(0);

  if (!imageUri) {
    router.replace('/(tabs)');
    return null;
  }

  function handleCancel() {
    trackEvent('capture_cancelled', { source: captureSource, stage: 'crop' });
    router.replace('/(tabs)');
  }

  async function handleCrop() {
    cropStartRef.current = Date.now();
    setScreenState('cropping');
    setErrorMessage(null);

    try {
      const sizes = ASPECT_SIZES[selectedRatio];
      const cropResult = await ImageCropPicker.openCropper({
        path: imageUri as string,
        ...(sizes ? { width: sizes.width, height: sizes.height } : { freeStyleCropEnabled: true }),
        mediaType: 'photo',
        cropperToolbarTitle: 'Recortar',
        cropperChooseText: 'Confirmar',
        cropperCancelText: 'Cancelar',
        includeExif: false,
        compressImageQuality: 1,
      });

      setScreenState('saving');

      const [optimizedUri, thumbUri] = await Promise.all([
        optimize(cropResult.path),
        thumbnail(cropResult.path),
      ]);

      const palette = await savePalette({
        imageUri: optimizedUri,
        thumbnailUri: thumbUri,
        colors: [],
        layoutConfig: DEFAULT_LAYOUT_CONFIG,
        meta: {
          capturedAt: Date.now(),
          source: captureSource,
          aspectRatio: selectedRatio,
        },
      });

      trackEvent('capture_completed', {
        source: captureSource,
        duration_ms: Date.now() - cropStartRef.current,
      });

      setScreenState('extracting');
      const start = Date.now();
      try {
        const colors = await extractColors(palette.thumbnailUri);
        await updatePaletteColors(palette.id, colors);
        trackEvent('extract_completed', {
          duration_ms: Date.now() - start,
          image_size_kb: Math.round((await fetch(palette.thumbnailUri)).headers.get('content-length') ? parseInt((await fetch(palette.thumbnailUri)).headers.get('content-length') ?? '0') / 1024 : 0),
        });
      } catch (extractErr) {
        const reason = extractErr instanceof ExtractError ? extractErr.message : 'unknown';
        trackEvent('extract_failed', { reason });
        Sentry.captureException(extractErr);
        // Palette is saved with empty colors — compose screen handles retry
      }

      router.replace({ pathname: '/palette/[id]', params: { id: palette.id } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isUserCancel =
        msg.toLowerCase().includes('user cancelled') ||
        msg.toLowerCase().includes('user did not grant');

      if (isUserCancel) {
        trackEvent('capture_cancelled', { source: captureSource, stage: 'crop' });
        setScreenState('idle');
      } else {
        Sentry.captureException(err);
        setErrorMessage('No se pudo recortar la foto. Inténtalo de nuevo.');
        setScreenState('error');
      }
    }
  }

  const SAVING_LABELS: Record<ScreenState, string | null> = {
    idle: null,
    cropping: null,
    saving: 'Guardando paleta...',
    extracting: 'Extrayendo colores...',
    error: null,
  };

  const savingLabel = SAVING_LABELS[screenState];

  if (savingLabel) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text variant="small" color={Colors.textSecondary} style={styles.savingLabel}>
          {savingLabel}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.cancelTap}>
          <Text variant="body" color={Colors.accent}>Cancelar</Text>
        </TouchableOpacity>
        <Text variant="h2">Recortar</Text>
        <View style={styles.cancelTap} />
      </View>

      <View style={styles.ratioSection}>
        <Text variant="label" color={Colors.textSecondary} style={styles.ratioLabel}>
          PROPORCIÓN
        </Text>
        <View style={styles.ratioRow}>
          {RATIOS.map((ratio) => {
            const active = selectedRatio === ratio;
            return (
              <TouchableOpacity
                key={ratio}
                style={[styles.ratioPill, active && styles.ratioPillActive]}
                onPress={() => setSelectedRatio(ratio)}
              >
                <Text
                  variant="small"
                  weight={active ? 'semibold' : 'regular'}
                  color={active ? Colors.accentForeground : Colors.textPrimary}
                >
                  {ratio}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {errorMessage !== null && (
        <View style={styles.errorBanner}>
          <Text variant="small" color={Colors.error}>{errorMessage}</Text>
        </View>
      )}

      <View style={styles.actionBar}>
        <Button
          label={screenState === 'cropping' ? 'Abriendo...' : 'Recortar foto'}
          onPress={handleCrop}
          loading={screenState === 'cropping'}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgPrimary,
    gap: Spacing.md,
  },
  savingLabel: { marginTop: Spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  cancelTap: { minWidth: 70 },
  ratioSection: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  ratioLabel: { marginBottom: Spacing.sm },
  ratioRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  ratioPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
  },
  ratioPillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  errorBanner: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
    backgroundColor: Colors.bgPrimary,
  },
});
```

Note: The `image_size_kb` tracking in the extract_completed event uses a second fetch for the content-length header. If this causes issues on device, simplify to `image_size_kb: 0`.

- [ ] **Step 3: Typecheck**

```powershell
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```
git add app/crop.tsx
git commit -m "feat(crop): add color extraction step and navigate to compose screen after save"
```

---

### Task 5: PaletteCard + PaletteGrid + home screen update

**Files:**
- Create: `src/components/palette/PaletteCard.tsx`
- Create: `src/components/palette/PaletteGrid.tsx`
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Create PaletteCard.tsx**

Create `src/components/palette/PaletteCard.tsx`:

```typescript
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Colors, Radius, Shadow, Spacing } from '@/lib/tokens';
import { formatDateEs } from '@/lib/utils/dateUtils';
import type { Palette } from '@/types/palette';

interface Props {
  palette: Palette;
  onPress: (id: string) => void;
}

export function PaletteCard({ palette, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(palette.id)}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri: palette.thumbnailUri }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      <View style={styles.colorStrip}>
        {palette.colors.slice(0, 5).map((color, i) => (
          <View key={i} style={[styles.swatch, { backgroundColor: color.hex }]} />
        ))}
        {palette.colors.length === 0 && (
          <View style={[styles.swatch, styles.swatchEmpty]} />
        )}
      </View>
      <View style={styles.footer}>
        <Text variant="small" color={Colors.textSecondary} numberOfLines={1}>
          {formatDateEs(palette.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: Spacing.xs,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 1,
  },
  colorStrip: {
    flexDirection: 'row',
    height: 20,
  },
  swatch: {
    flex: 1,
  },
  swatchEmpty: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  footer: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
});
```

- [ ] **Step 2: Create PaletteGrid.tsx**

Create `src/components/palette/PaletteGrid.tsx`:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { PaletteCard } from './PaletteCard';
import { Colors, Radius, Spacing } from '@/lib/tokens';
import { listPalettes } from '@/lib/db/palettes';
import type { Palette } from '@/types/palette';

interface Props {
  onPressPalette: (id: string) => void;
}

function SkeletonCard() {
  return <View style={styles.skeleton} />;
}

export function PaletteGrid({ onPressPalette }: Props) {
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await listPalettes();
    setPalettes(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.grid}>
        {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
      </View>
    );
  }

  return (
    <FlatList
      data={palettes}
      keyExtractor={(p) => p.id}
      numColumns={2}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <PaletteCard palette={item} onPress={onPressPalette} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.xs },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.xs,
  },
  skeleton: {
    flex: 1,
    margin: Spacing.xs,
    aspectRatio: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgSecondary,
  },
});
```

- [ ] **Step 3: Read current index.tsx**

Read `app/(tabs)/index.tsx` to see current state.

- [ ] **Step 4: Update index.tsx**

Replace all content of `app/(tabs)/index.tsx`:

```typescript
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { launchGalleryPicker } from '@/components/capture/GalleryPicker';
import { PaletteGrid } from '@/components/palette/PaletteGrid';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { listPalettes } from '@/lib/db/palettes';
import { Colors, Radius, Spacing } from '@/lib/tokens';

export default function HomeScreen() {
  const [hasPalettes, setHasPalettes] = useState<boolean | null>(null);
  const [picking, setPicking] = useState(false);
  const [galleryDenied, setGalleryDenied] = useState(false);

  useEffect(() => {
    listPalettes().then((p) => setHasPalettes(p.length > 0));
  }, []);

  const handlePressPalette = useCallback((id: string) => {
    router.push({ pathname: '/palette/[id]', params: { id } });
  }, []);

  async function handleGallery() {
    if (picking) return;
    setPicking(true);
    setGalleryDenied(false);
    try {
      const result = await launchGalleryPicker();
      if (result.type === 'picked') {
        router.push({ pathname: '/crop', params: { uri: result.uri, source: 'gallery' } });
      } else if (result.type === 'denied') {
        setGalleryDenied(true);
      }
    } finally {
      setPicking(false);
    }
  }

  function handleCamera() {
    router.push('/(tabs)/capture');
  }

  if (hasPalettes === null) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text variant="h1">Hued</Text>
        <Text variant="small" color={Colors.textSecondary}>Tus paletas</Text>
      </View>

      {hasPalettes ? (
        <PaletteGrid onPressPalette={handlePressPalette} />
      ) : (
        <View style={styles.emptyState}>
          <Text variant="h3" style={styles.centered2}>Sin paletas todavía</Text>
          <Text variant="body" color={Colors.textSecondary} style={styles.centered2}>
            Captura una foto o elige de tu galería para crear tu primera paleta.
          </Text>
          <View style={styles.emptyActions}>
            <View style={styles.actionItem}>
              <Button label="Cámara" onPress={handleCamera} variant="primary" fullWidth />
            </View>
            <View style={styles.actionItem}>
              {picking ? (
                <View style={styles.loadingBtn}>
                  <ActivityIndicator size="small" color={Colors.accent} />
                  <Text variant="small" color={Colors.textSecondary}>Abriendo...</Text>
                </View>
              ) : (
                <Button label="Galería" onPress={handleGallery} variant="secondary" fullWidth />
              )}
            </View>
          </View>
          {galleryDenied && (
            <Text variant="small" color={Colors.textSecondary} style={styles.centered2}>
              Activa el permiso de galería en Ajustes del dispositivo.
            </Text>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.fab} onPress={handleCamera} activeOpacity={0.85}>
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  centered2: { textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  actionItem: { flex: 1 },
  loadingBtn: {
    height: 48,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabPlus: { color: Colors.accentForeground, fontSize: 28, lineHeight: 32 },
});
```

- [ ] **Step 5: Typecheck + run all tests**

```powershell
pnpm typecheck && pnpm test
```

Expected: 0 TS errors, all tests pass.

- [ ] **Step 6: Commit**

```
git add src/components/palette/PaletteCard.tsx src/components/palette/PaletteGrid.tsx "app/(tabs)/index.tsx"
git commit -m "feat(palette): add PaletteCard, PaletteGrid, and update home screen"
```

---

### Task 6: Archetype components

**Files:**
- Create: `src/components/compose/archetypes/types.ts`
- Create: `src/components/compose/archetypes/StripArchetype.tsx`
- Create: `src/components/compose/archetypes/EditorialArchetype.tsx`
- Create: `src/components/compose/archetypes/GridArchetype.tsx`
- Create: `src/components/compose/archetypes/BannerArchetype.tsx`
- Create: `src/components/compose/archetypes/SideArchetype.tsx`

- [ ] **Step 1: Create shared types**

Create `src/components/compose/archetypes/types.ts`:

```typescript
import type { Palette, LayoutConfig } from '@/types/palette';

export interface ArchetypeProps {
  palette: Palette;
  config: LayoutConfig;
  width: number;
  height: number;
}
```

- [ ] **Step 2: Create StripArchetype**

Create `src/components/compose/archetypes/StripArchetype.tsx`:

```typescript
import { useMemo } from 'react';
import {
  Group,
  Image,
  matchFont,
  Rect,
  Text,
  useImage,
} from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import type { ArchetypeProps } from './types';

const FONT_FAMILY = Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto';

export function StripArchetype({ palette, config, width, height }: ArchetypeProps) {
  const image = useImage(palette.imageUri);
  const imageH = height * 0.7;
  const stripH = height * 0.3;
  const barW = width / 5;

  const hexFont = useMemo(() => matchFont({ fontFamily: FONT_FAMILY, fontSize: 9 }), []);
  const nameFont = useMemo(() => matchFont({ fontFamily: FONT_FAMILY, fontSize: 8 }), []);

  return (
    <Group>
      {image && (
        <Image image={image} x={0} y={0} width={width} height={imageH} fit="cover" />
      )}
      {!image && <Rect x={0} y={0} width={width} height={imageH} color="#E5E5E5" />}

      {palette.colors.map((color, i) => {
        const x = i * barW;
        const textColor = color.hslLightness > 0.5 ? '#000000' : '#FFFFFF';
        return (
          <Group key={i}>
            <Rect x={x} y={imageH} width={barW} height={stripH} color={color.hex} />
            {config.showHex && (
              <Text
                x={x + barW / 2 - 16}
                y={imageH + stripH * 0.38}
                text={color.hex}
                font={hexFont}
                color={textColor}
              />
            )}
            {config.showName && (
              <Text
                x={x + barW / 2 - (color.name.length * 2.5)}
                y={imageH + stripH * 0.62}
                text={color.name}
                font={nameFont}
                color={textColor}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}
```

- [ ] **Step 3: Create EditorialArchetype**

Create `src/components/compose/archetypes/EditorialArchetype.tsx`:

```typescript
import { useMemo } from 'react';
import {
  Circle,
  Group,
  Image,
  LinearGradient,
  matchFont,
  Rect,
  Text,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import type { ArchetypeProps } from './types';

const FONT_FAMILY = Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto';
const DOT_R = 14;
const DOT_SPACING = 8;

export function EditorialArchetype({ palette, config, width, height }: ArchetypeProps) {
  const image = useImage(palette.imageUri);
  const gradientStart = height * 0.55;
  const dotY = height * 0.82;
  const totalDotsW = palette.colors.length * (DOT_R * 2) + (palette.colors.length - 1) * DOT_SPACING;
  const dotStartX = (width - totalDotsW) / 2 + DOT_R;

  const nameFont = useMemo(() => matchFont({ fontFamily: FONT_FAMILY, fontSize: 11 }), []);
  const hexFont = useMemo(() => matchFont({ fontFamily: FONT_FAMILY, fontSize: 9 }), []);

  return (
    <Group>
      {image && (
        <Image image={image} x={0} y={0} width={width} height={height} fit="cover" />
      )}
      {!image && <Rect x={0} y={0} width={width} height={height} color="#E5E5E5" />}

      <Rect x={0} y={gradientStart} width={width} height={height - gradientStart} color="transparent">
        <LinearGradient
          start={vec(0, gradientStart)}
          end={vec(0, height)}
          colors={['transparent', 'rgba(0,0,0,0.82)']}
        />
      </Rect>

      {palette.colors.map((color, i) => {
        const cx = dotStartX + i * (DOT_R * 2 + DOT_SPACING);
        return (
          <Group key={i}>
            <Circle cx={cx} cy={dotY} r={DOT_R} color={color.hex} />
            {config.showHex && (
              <Text
                x={cx - 14}
                y={dotY + DOT_R + 14}
                text={color.hex}
                font={hexFont}
                color="#FFFFFF"
              />
            )}
          </Group>
        );
      })}

      {config.showName && palette.colors[0] && (
        <Text
          x={Spacing.md}
          y={dotY - DOT_R - 12}
          text={palette.colors[0].name}
          font={nameFont}
          color="#FFFFFF"
        />
      )}
    </Group>
  );
}

// Spacing needed from tokens at module level for Text positioning
const Spacing = { md: 16 };
```

- [ ] **Step 4: Create GridArchetype**

Create `src/components/compose/archetypes/GridArchetype.tsx`:

```typescript
import { useMemo } from 'react';
import {
  Group,
  Image,
  matchFont,
  Rect,
  Text,
  useImage,
} from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import type { ArchetypeProps } from './types';

const FONT_FAMILY = Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto';

export function GridArchetype({ palette, config, width, height }: ArchetypeProps) {
  const image = useImage(palette.imageUri);

  // 2×3 grid: row0 = image spanning full width, rows 1-2 = 2×2 color cells (4 colors) + 1 extra
  // Layout: image top half, 5 color cells bottom half (2 cols × 2 rows + 1 wide)
  // Row 0: image (full width, top 50%)
  // Row 1: color[0] left, color[1] right
  // Row 2: color[2] left, color[3] right
  // Row 3 (if needed): color[4] full width — but we only have 5 colors so:
  // Actually: 2×3 grid. cell(0,0)+(0,1) = image. cells (1,0)(1,1)(2,0)(2,1) = colors 0-3. Cell (3,0)+(3,1) = color 4 full width
  // Simpler: image top 50%, then 2 rows of 2 colors = 4, last color is 5th as a wide cell
  const imageH = height * 0.5;
  const cellH = (height - imageH) / 3;
  const cellW = width / 2;

  const hexFont = useMemo(() => matchFont({ fontFamily: FONT_FAMILY, fontSize: 10 }), []);
  const nameFont = useMemo(() => matchFont({ fontFamily: FONT_FAMILY, fontSize: 9 }), []);

  return (
    <Group>
      {image && (
        <Image image={image} x={0} y={0} width={width} height={imageH} fit="cover" />
      )}
      {!image && <Rect x={0} y={0} width={width} height={imageH} color="#E5E5E5" />}

      {palette.colors.slice(0, 4).map((color, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = col * cellW;
        const y = imageH + row * cellH;
        const textColor = color.hslLightness > 0.5 ? '#000000' : '#FFFFFF';
        return (
          <Group key={i}>
            <Rect x={x} y={y} width={cellW} height={cellH} color={color.hex} />
            {config.showHex && (
              <Text x={x + 6} y={y + cellH * 0.45} text={color.hex} font={hexFont} color={textColor} />
            )}
            {config.showName && (
              <Text x={x + 6} y={y + cellH * 0.72} text={color.name} font={nameFont} color={textColor} />
            )}
          </Group>
        );
      })}

      {palette.colors[4] && (() => {
        const color = palette.colors[4];
        const y = imageH + 2 * cellH;
        const textColor = color.hslLightness > 0.5 ? '#000000' : '#FFFFFF';
        return (
          <Group>
            <Rect x={0} y={y} width={width} height={cellH} color={color.hex} />
            {config.showHex && (
              <Text x={6} y={y + cellH * 0.45} text={color.hex} font={hexFont} color={textColor} />
            )}
            {config.showName && (
              <Text x={6} y={y + cellH * 0.72} text={color.name} font={nameFont} color={textColor} />
            )}
          </Group>
        );
      })()}
    </Group>
  );
}
```

- [ ] **Step 5: Create BannerArchetype**

Create `src/components/compose/archetypes/BannerArchetype.tsx`:

```typescript
import {
  Group,
  Image,
  Rect,
  useImage,
} from '@shopify/react-native-skia';
import type { ArchetypeProps } from './types';

const STRIP_H = 48;

export function BannerArchetype({ palette, config: _config, width, height }: ArchetypeProps) {
  const image = useImage(palette.imageUri);
  const barW = width / 5;
  const stripY = height - STRIP_H;

  return (
    <Group>
      {image && (
        <Image image={image} x={0} y={0} width={width} height={height} fit="cover" />
      )}
      {!image && <Rect x={0} y={0} width={width} height={height} color="#E5E5E5" />}

      <Rect x={0} y={stripY} width={width} height={STRIP_H} color="rgba(0,0,0,0.35)" />

      {palette.colors.map((color, i) => (
        <Rect
          key={i}
          x={i * barW}
          y={stripY}
          width={barW}
          height={STRIP_H}
          color={color.hex + 'CC'}
        />
      ))}
    </Group>
  );
}
```

- [ ] **Step 6: Create SideArchetype**

Create `src/components/compose/archetypes/SideArchetype.tsx`:

```typescript
import { useMemo } from 'react';
import {
  Group,
  Image,
  matchFont,
  Rect,
  Text,
  useImage,
} from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import type { ArchetypeProps } from './types';

const FONT_FAMILY = Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto';

export function SideArchetype({ palette, config, width, height }: ArchetypeProps) {
  const image = useImage(palette.imageUri);
  const imageW = width * 0.6;
  const sideW = width - imageW;
  const rowH = height / 5;

  const hexFont = useMemo(() => matchFont({ fontFamily: FONT_FAMILY, fontSize: 8 }), []);
  const nameFont = useMemo(() => matchFont({ fontFamily: FONT_FAMILY, fontSize: 7 }), []);

  return (
    <Group>
      {image && (
        <Image image={image} x={0} y={0} width={imageW} height={height} fit="cover" />
      )}
      {!image && <Rect x={0} y={0} width={imageW} height={height} color="#E5E5E5" />}

      {palette.colors.map((color, i) => {
        const y = i * rowH;
        const textColor = color.hslLightness > 0.5 ? '#000000' : '#FFFFFF';
        return (
          <Group key={i}>
            <Rect x={imageW} y={y} width={sideW} height={rowH} color={color.hex} />
            {config.showHex && (
              <Text
                x={imageW + 6}
                y={y + rowH * 0.44}
                text={color.hex}
                font={hexFont}
                color={textColor}
              />
            )}
            {config.showName && (
              <Text
                x={imageW + 6}
                y={y + rowH * 0.72}
                text={color.name}
                font={nameFont}
                color={textColor}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}
```

- [ ] **Step 7: Typecheck**

```powershell
pnpm typecheck
```

Expected: 0 errors. If `matchFont` is not found, check that `@shopify/react-native-skia` exports it — import from `'@shopify/react-native-skia'` directly.

- [ ] **Step 8: Commit**

```
git add src/components/compose/archetypes/
git commit -m "feat(compose): add 5 Skia archetype components (strip, editorial, grid, banner, side)"
```

---

### Task 7: ArchetypeCanvas

**Files:**
- Create: `src/components/compose/ArchetypeCanvas.tsx`

- [ ] **Step 1: Create ArchetypeCanvas.tsx**

Create `src/components/compose/ArchetypeCanvas.tsx`:

```typescript
import { Canvas, RoundedRect } from '@shopify/react-native-skia';
import { useWindowDimensions } from 'react-native';

import { BannerArchetype } from './archetypes/BannerArchetype';
import { EditorialArchetype } from './archetypes/EditorialArchetype';
import { GridArchetype } from './archetypes/GridArchetype';
import { SideArchetype } from './archetypes/SideArchetype';
import { StripArchetype } from './archetypes/StripArchetype';
import type { Palette, LayoutConfig } from '@/types/palette';

interface Props {
  palette: Palette;
  config: LayoutConfig;
}

const CANVAS_W = 360;
const CANVAS_H = 450;

export function ArchetypeCanvas({ palette, config }: Props) {
  const { width: screenW } = useWindowDimensions();
  const scale = screenW / CANVAS_W;
  const displayH = CANVAS_H * scale;

  const archetypeProps = { palette, config, width: CANVAS_W, height: CANVAS_H };

  return (
    <Canvas style={{ width: screenW, height: displayH }}>
      {config.cardStyle === 'outlined' && (
        <RoundedRect
          x={1} y={1}
          width={CANVAS_W - 2} height={CANVAS_H - 2}
          r={config.cornerRadius}
          color="transparent"
          strokeWidth={2}
          style="stroke"
        />
      )}

      {config.archetypeId === 'strip' && <StripArchetype {...archetypeProps} />}
      {config.archetypeId === 'editorial' && <EditorialArchetype {...archetypeProps} />}
      {config.archetypeId === 'grid' && <GridArchetype {...archetypeProps} />}
      {config.archetypeId === 'banner' && <BannerArchetype {...archetypeProps} />}
      {config.archetypeId === 'side' && <SideArchetype {...archetypeProps} />}
    </Canvas>
  );
}
```

- [ ] **Step 2: Typecheck**

```powershell
pnpm typecheck
```

Expected: 0 errors. If `RoundedRect` doesn't accept `strokeWidth`/`style` props, replace the outlined border with a regular `Rect` with `color` set to the accent color and use a `clip` group.

- [ ] **Step 3: Commit**

```
git add src/components/compose/ArchetypeCanvas.tsx
git commit -m "feat(compose): add ArchetypeCanvas Skia wrapper with archetype switching and cornerRadius"
```

---

### Task 8: Compose screen

**Files:**
- Create: `app/palette/[id].tsx`

- [ ] **Step 1: Create app/palette/[id].tsx**

Create `app/palette/[id].tsx`:

```typescript
import * as Sentry from '@sentry/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArchetypeCanvas } from '@/components/compose/ArchetypeCanvas';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { extractColors, ExtractError } from '@/lib/color/extract';
import { getPalette, updatePaletteColors, updatePaletteLayout } from '@/lib/db/palettes';
import { trackEvent } from '@/lib/analytics/events';
import { Colors, Spacing, Radius } from '@/lib/tokens';
import type { ArchetypeId, LayoutConfig, Palette } from '@/types/palette';

const ARCHETYPES: { id: ArchetypeId; label: string }[] = [
  { id: 'strip', label: 'Franja' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'grid', label: 'Cuadrícula' },
  { id: 'banner', label: 'Banner' },
  { id: 'side', label: 'Lateral' },
];

export default function PaletteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [config, setConfig] = useState<LayoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;
    getPalette(id).then((p) => {
      if (p) { setPalette(p); setConfig(p.layoutConfig); }
      setLoading(false);
    });
  }, [id]);

  const updateConfig = useCallback((partial: Partial<LayoutConfig>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (id) {
          updatePaletteLayout(id, next).catch(Sentry.captureException);
        }
      }, 500);
      return next;
    });
  }, [id]);

  async function handleRetry() {
    if (!palette) return;
    setExtracting(true);
    try {
      const colors = await extractColors(palette.thumbnailUri);
      await updatePaletteColors(palette.id, colors);
      setPalette((p) => p ? { ...p, colors } : p);
    } catch (err) {
      const reason = err instanceof ExtractError ? err.message : 'unknown';
      trackEvent('extract_failed', { reason });
      Sentry.captureException(err);
    } finally {
      setExtracting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingBox]}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  if (!palette || !config) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingBox]}>
        <Text variant="body" color={Colors.textSecondary}>Paleta no encontrada.</Text>
        <Button label="Volver" onPress={() => router.back()} variant="ghost" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text variant="body" color={Colors.accent}>← Volver</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ArchetypeCanvas palette={palette} config={config} />

        {palette.colors.length === 0 ? (
          <View style={styles.errorBanner}>
            <Text variant="small" color={Colors.error}>
              No se pudieron extraer los colores.
            </Text>
            <Button
              label={extracting ? 'Extrayendo...' : 'Reintentar'}
              onPress={handleRetry}
              loading={extracting}
              variant="ghost"
            />
          </View>
        ) : (
          <View style={styles.swatchRow}>
            {palette.colors.map((c, i) => (
              <View key={i} style={[styles.swatch, { backgroundColor: c.hex }]} />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text variant="label" color={Colors.textSecondary} style={styles.sectionLabel}>
            ARQUETIPOS
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.archetypeScroll}>
            {ARCHETYPES.map((a) => {
              const active = config.archetypeId === a.id;
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.archPill, active && styles.archPillActive]}
                  onPress={() => {
                    updateConfig({ archetypeId: a.id });
                    trackEvent('archetype_selected', { archetype_id: a.id });
                  }}
                >
                  <Text
                    variant="small"
                    weight={active ? 'semibold' : 'regular'}
                    color={active ? Colors.accentForeground : Colors.textPrimary}
                  >
                    {a.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text variant="label" color={Colors.textSecondary} style={styles.sectionLabel}>
            ETIQUETAS
          </Text>
          {[
            { label: 'Mostrar hex', key: 'showHex' as const },
            { label: 'Mostrar nombre', key: 'showName' as const },
            { label: 'Mostrar RGB', key: 'showRGB' as const },
          ].map(({ label, key }) => (
            <View key={key} style={styles.toggleRow}>
              <Text variant="body">{label}</Text>
              <Switch
                value={config[key]}
                onValueChange={(val) => {
                  updateConfig({ [key]: val });
                  trackEvent('config_changed', { config_key: key });
                }}
                trackColor={{ true: Colors.accent }}
              />
            </View>
          ))}
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  loadingBox: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  backBtn: { alignSelf: 'flex-start' },
  scroll: { paddingBottom: Spacing['2xl'] },
  swatchRow: {
    flexDirection: 'row',
    height: 36,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  swatch: { flex: 1 },
  errorBanner: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.error,
    gap: Spacing.sm,
  },
  section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.md },
  sectionLabel: { marginBottom: Spacing.sm },
  archetypeScroll: { marginHorizontal: -Spacing.md, paddingHorizontal: Spacing.md },
  archPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
    marginRight: Spacing.sm,
  },
  archPillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  bottomPad: { height: Spacing.xl },
});
```

- [ ] **Step 2: Typecheck + run all tests**

```powershell
pnpm typecheck && pnpm test
```

Expected: 0 TS errors, all tests pass.

- [ ] **Step 3: Commit**

```
git add "app/palette/[id].tsx"
git commit -m "feat(compose): add palette compose screen with archetype selector and layout toggles"
```

---

## EOD Manual Verification (physical device)

After all tasks complete, test the full Sprint 2 flow:

**Extraction flow:**
- [ ] Take photo → crop → "Extrayendo colores..." spinner appears → navigates to compose screen
- [ ] Compose screen shows 5 color swatches below the canvas
- [ ] All 5 swatches have distinct colors (not all the same)

**Palette grid:**
- [ ] Home screen shows palette grid (not empty state) after saving one palette
- [ ] Grid shows 2-column layout with thumbnails + color strips + dates
- [ ] Tapping a palette card opens compose screen

**Archetype switching:**
- [ ] All 5 archetype pills appear in horizontal scroll
- [ ] Tapping each archetype changes the Skia canvas preview
- [ ] Toggle hex/name/RGB shows/hides labels on the canvas

**Auto-save:**
- [ ] Change archetype → leave screen → return → archetype is persisted

**Retry flow:**
- [ ] If palette saved with `colors: []` (simulate by opening an old palette), retry button appears and triggers extraction

**Gallery → compose:**
- [ ] Tap Galería on home → pick photo → crop → compose screen navigates correctly
