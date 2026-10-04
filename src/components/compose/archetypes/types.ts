import type { ComponentType } from 'react';
import type { SkImage } from '@shopify/react-native-skia';
import type { FreeformSwatch, Palette, LayoutConfig } from '@/types/palette';

export interface ArchetypeProps {
  palette: Palette;
  config: LayoutConfig;
  width: number;
  height: number;
  image: SkImage | null;
}

/**
 * Props for an archetype's optional interactive edit overlay (currently
 * only Libre's drag/resize handles). Rendered by ArchetypeCanvas.tsx over
 * the Canvas, on the edit screen only — never by exportPalette.tsx, which
 * has no interactivity.
 */
export interface EditOverlayProps {
  palette: Palette;
  config: LayoutConfig;
  scale: number;
  canvasW: number;
  canvasH: number;
  onFreeformSwatchesChange: (updater: (prev: FreeformSwatch[]) => FreeformSwatch[]) => void;
}

export type EditOverlayComponent = ComponentType<EditOverlayProps>;
