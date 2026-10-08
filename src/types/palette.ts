import type { FontKey } from '@/data/fonts';

export interface ExtractedColor {
  hex: string;
  rgb: [number, number, number];
  lab: [number, number, number];
  name: string;
  hslLightness: number;
  weight: number;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
  position: number;
}

export type ArchetypeId = 'pila' | 'mosaico' | 'escalonado' | 'columnas' | 'libre';

/** The archetypes whose positions come from a base layout table (everything but libre). */
export type CardArchetypeId = Exclude<ArchetypeId, 'libre'>;

/** Ids saved before the archetypes were rebuilt on a full-bleed photo, mapped to the closest current one. */
export const LEGACY_ARCHETYPE_IDS: Record<string, ArchetypeId> = {
  strip: 'pila',
  side: 'pila',
  grid: 'mosaico',
  editorial: 'escalonado',
  banner: 'columnas',
};

export type CardStyle = 'filled' | 'outlined' | 'blur';

/** Where the label lines sit in a card; `split` puts the first line at the top and the last at the bottom. */
export type LabelPosition = 'top' | 'center' | 'bottom' | 'split';
export type LabelOrder = 'name-first' | 'hex-first';
/** `diagonal` (only meaningful with `split`) puts the first line on the left and the last on the right. */
export type LabelAlign = 'left' | 'center' | 'right' | 'diagonal';

/**
 * One swatch's position/size in the libre archetype, in the fixed 360x450
 * design-space canvas. `colorIndex` points at `palette.colors` — array
 * position within `freeformSwatches` itself is z-order (front = last), so
 * `colorIndex` is what keeps a swatch pointing at the right color across
 * z-order reshuffles (see ADR-0001).
 */
export interface FreeformSwatch {
  x: number;
  y: number;
  width: number;
  height: number;
  colorIndex: number;
}

export interface LayoutConfig {
  archetypeId: ArchetypeId;
  position: number;
  showHex: boolean;
  showName: boolean;
  showRGB: boolean;
  fontFamily: FontKey;
  cornerRadius: number;
  cardStyle: CardStyle;
  /** Card fill opacity, 30-100 (%). The label text is never faded. */
  cardOpacity: number;
  /** Card width / height relative to the base layout, 50-150 (%), each card scaled from its own center. */
  cardWidthScale: number;
  cardHeightScale: number;
  /** Distance between cards relative to the base layout, 50-150 (%), scaled from the group's center. Not used by libre. */
  gapScale: number;
  /** Label text size in design-space px (6-24); shrunk per card when it doesn't fit. */
  fontSize: number;
  labelPosition: LabelPosition;
  labelOrder: LabelOrder;
  labelAlign: LabelAlign;
  watermarkVisible: boolean;
  /** Number of colors to extract (3-8). Rows saved before this field existed read as `undefined` — consumers fall back to 5. */
  paletteSize: number;
  /**
   * Per-swatch geometry for the libre archetype, array order = z-order
   * (front = last). Empty/length-mismatched against `colors` means "not
   * generated yet" — the archetype and the edit screen both fall back to
   * the base layout of `libreSource`. Reset to that layout whenever paletteSize
   * changes (ADR-0001): stale positions would silently point at the wrong color
   * once colors are re-sorted by luminosity.
   */
  freeformSwatches: FreeformSwatch[];
  /** The card archetype libre starts from (and returns to on reset / palette-size change). */
  libreSource: CardArchetypeId;
}

export type CaptureSource = 'camera' | 'gallery';

export interface PaletteMeta {
  capturedAt: number;
  source: CaptureSource | 'sample';
  aspectRatio: string;
}

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

// The style fields below mirror the Pila base layout, so a palette saved before they existed reads
// back with a sensible look (see rowToPalette).
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  archetypeId: 'pila',
  position: 0,
  showHex: true,
  showName: true,
  showRGB: false,
  fontFamily: 'sans',
  cornerRadius: 16,
  cardStyle: 'filled',
  cardOpacity: 100,
  cardWidthScale: 100,
  cardHeightScale: 100,
  gapScale: 100,
  fontSize: 10,
  labelPosition: 'split',
  labelOrder: 'name-first',
  labelAlign: 'left',
  // Off by default: the paywall/gate deciding when to show branding is
  // Sprint 6 (monetization) scope, not built yet. Shipping this ON with no
  // way to disable it would force permanent branding on every export before
  // that gate exists. The component/wiring stays fully implemented — this
  // is a one-line default flip, not a removal.
  watermarkVisible: false,
  paletteSize: 5,
  freeformSwatches: [],
  libreSource: 'pila',
};
