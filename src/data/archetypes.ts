import type { ComponentType } from 'react';

import { BannerArchetype } from '@/components/compose/archetypes/BannerArchetype';
import { EditorialArchetype } from '@/components/compose/archetypes/EditorialArchetype';
import { GridArchetype } from '@/components/compose/archetypes/GridArchetype';
import { SideArchetype } from '@/components/compose/archetypes/SideArchetype';
import { StripArchetype } from '@/components/compose/archetypes/StripArchetype';
import type { ArchetypeProps } from '@/components/compose/archetypes/types';
import type { ArchetypeId, LayoutConfig } from '@/types/palette';

export interface ArchetypeDefinition {
  id: ArchetypeId;
  displayName: string;
  description: string;
  Component: ComponentType<ArchetypeProps>;
  defaultConfig: Partial<LayoutConfig>;
  /**
   * Whether `cardStyle: 'blur'` produces any visible effect for this
   * archetype. `wrapMetadataInBlur` (shared.tsx) blurs the backdrop behind
   * each swatch's metadata text — for strip/grid/side that backdrop is just
   * the same flat, opaque swatch `Rect` drawn directly underneath it, so
   * blurring it is a no-op indistinguishable from `'filled'`. Only
   * editorial (blurs the underlying photo) and banner (translucent color
   * over photo) show a visible difference. The config panel
   * (app/palette/[id].tsx) uses this to hide the "Difuminado" option for
   * archetypes where it wouldn't do anything.
   */
  supportsBlur: boolean;
  /** Paywall hook — unset everywhere today. See src/lib/subscription/optionLock.ts. */
  premium?: boolean;
}

export const ARCHETYPES: Record<ArchetypeId, ArchetypeDefinition> = {
  strip: {
    id: 'strip',
    displayName: 'Franja',
    description: 'Imagen ocupando el 70% superior con una franja inferior dividida en barras verticales de color.',
    Component: StripArchetype,
    defaultConfig: { fontFamily: 'sans', cardStyle: 'filled' },
    supportsBlur: false,
  },
  editorial: {
    id: 'editorial',
    displayName: 'Editorial',
    description: 'Imagen a sangre completa con degradado oscuro inferior, puntos de color superpuestos y el nombre del color dominante como leyenda.',
    Component: EditorialArchetype,
    defaultConfig: { fontFamily: 'serif', cardStyle: 'filled' },
    supportsBlur: true,
  },
  grid: {
    id: 'grid',
    displayName: 'Cuadrícula',
    description: 'Imagen en la mitad superior y una cuadrícula de dos columnas con las muestras de color debajo.',
    Component: GridArchetype,
    defaultConfig: { fontFamily: 'sans', cardStyle: 'filled' },
    supportsBlur: false,
  },
  banner: {
    id: 'banner',
    displayName: 'Banner',
    description: 'Imagen a sangre completa con una franja translúcida inferior dividida en muestras de color verticales.',
    Component: BannerArchetype,
    defaultConfig: { fontFamily: 'sans', cardStyle: 'filled' },
    supportsBlur: true,
  },
  side: {
    id: 'side',
    displayName: 'Lateral',
    description: 'Imagen ocupando el 60% izquierdo con una columna lateral de filas horizontales de color.',
    Component: SideArchetype,
    defaultConfig: { fontFamily: 'sans', cardStyle: 'filled' },
    supportsBlur: false,
  },
};
