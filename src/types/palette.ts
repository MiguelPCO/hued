export interface ExtractedColor {
  hex: string;
  rgb: [number, number, number];
  lab: [number, number, number];
  name: string;
  hslLightness: number;
  weight: number;
}

export type ArchetypeId = 'strip' | 'editorial' | 'grid' | 'banner' | 'side';

export type CardStyle = 'filled' | 'outlined';

export interface LayoutConfig {
  archetypeId: ArchetypeId;
  position: number;
  showHex: boolean;
  showName: boolean;
  showRGB: boolean;
  fontFamily: 'sans' | 'serif' | 'mono';
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
  cornerRadius: 8,
  cardStyle: 'filled',
  watermarkVisible: true,
};
