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

export type ArchetypeId = 'strip' | 'editorial' | 'grid' | 'banner' | 'side' | 'libre';

export type CardStyle = 'filled' | 'outlined' | 'blur';

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
  fontFamily: 'sans' | 'serif' | 'mono' | 'condensed' | 'display';
  cornerRadius: number;
  cardStyle: CardStyle;
  watermarkVisible: boolean;
  /** Number of colors to extract (3-8). Rows saved before this field existed read as `undefined` — consumers fall back to 5. */
  paletteSize: number;
  /**
   * Per-swatch geometry for the libre archetype, array order = z-order
   * (front = last). Empty/length-mismatched against `colors` means "not
   * generated yet" — the archetype and the edit screen both fall back to
   * `generateScatterLayout`. Reset to `[]` whenever paletteSize changes
   * (ADR-0001): stale positions would silently point at the wrong color
   * once colors are re-sorted by luminosity.
   */
  freeformSwatches: FreeformSwatch[];
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

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  archetypeId: 'strip',
  position: 0,
  showHex: true,
  showName: true,
  showRGB: false,
  fontFamily: 'sans',
  cornerRadius: 16,
  cardStyle: 'filled',
  // Off by default: the paywall/gate deciding when to show branding is
  // Sprint 6 (monetization) scope, not built yet. Shipping this ON with no
  // way to disable it would force permanent branding on every export before
  // that gate exists. The component/wiring stays fully implemented — this
  // is a one-line default flip, not a removal.
  watermarkVisible: false,
  paletteSize: 5,
  freeformSwatches: [],
};
