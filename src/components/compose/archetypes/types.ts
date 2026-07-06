import type { SkImage } from '@shopify/react-native-skia';
import type { Palette, LayoutConfig } from '@/types/palette';

export interface ArchetypeProps {
  palette: Palette;
  config: LayoutConfig;
  width: number;
  height: number;
  image: SkImage | null;
}
