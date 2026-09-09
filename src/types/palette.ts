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

export type ArchetypeId = 'strip' | 'editorial' | 'grid' | 'banner' | 'side';

export type CardStyle = 'filled' | 'outlined' | 'blur';

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
}

export type CaptureSource = 'camera' | 'gallery';

export interface PaletteMeta {
  capturedAt: number;
  source: CaptureSource;
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
};
