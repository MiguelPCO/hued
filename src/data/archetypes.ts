import type { ComponentType } from 'react';

import { LibreEditOverlay } from '@/components/compose/LibreEditOverlay';
import { LibreArchetype } from '@/components/compose/archetypes/LibreArchetype';
import { cardsArchetype } from '@/components/compose/archetypes/PhotoSwatches';
import type { ArchetypeProps, EditOverlayComponent } from '@/components/compose/archetypes/types';
import type { ArchetypeId } from '@/types/palette';

export interface ArchetypeDefinition {
  id: ArchetypeId;
  displayName: string;
  description: string;
  Component: ComponentType<ArchetypeProps>;
  /**
   * Whether `cardStyle: 'blur'` produces any visible effect for this
   * archetype. `wrapMetadataInBlur` (shared.tsx) blurs the backdrop behind
   * each swatch's metadata text — for every card layout that backdrop is just
   * the same flat, opaque card drawn directly underneath it, so blurring it is
   * a no-op indistinguishable from `'filled'`. The config panel
   * (app/palette/[id].tsx) uses this to hide the "Difuminado" option for
   * archetypes where it wouldn't do anything.
   */
  supportsBlur: boolean;
  /** Paywall hook — unset everywhere today. See src/lib/subscription/optionLock.ts. */
  premium?: boolean;
  /** Interactive edit-screen overlay (currently only Libre's drag/resize handles) — see EditOverlayProps. */
  EditOverlay?: EditOverlayComponent;
}

export const ARCHETYPES: Record<ArchetypeId, ArchetypeDefinition> = {
  pila: {
    id: 'pila',
    displayName: 'Pila',
    description:
      'Foto completa con las tarjetas en zigzag, apiladas en una columna o en barras de distinta altura.',
    Component: cardsArchetype('pila'),
    supportsBlur: false,
  },
  mosaico: {
    id: 'mosaico',
    displayName: 'Mosaico',
    description: 'Foto completa con las tarjetas en cuadrícula, o en una columna si son pocas.',
    Component: cardsArchetype('mosaico'),
    supportsBlur: false,
  },
  escalonado: {
    id: 'escalonado',
    displayName: 'Escalonado',
    description:
      'Foto completa con las tarjetas repartidas por las esquinas y el centro, o en zigzag.',
    Component: cardsArchetype('escalonado'),
    supportsBlur: false,
  },
  columnas: {
    id: 'columnas',
    displayName: 'Columnas',
    description: 'Foto completa con las tarjetas en filas, en pirámide o en círculos.',
    Component: cardsArchetype('columnas'),
    supportsBlur: false,
  },
  libre: {
    id: 'libre',
    displayName: 'Libre',
    description:
      'Imagen a sangre completa con muestras de color que arrastras y redimensionas donde quieras.',
    Component: LibreArchetype,
    supportsBlur: false,
    EditOverlay: LibreEditOverlay,
  },
};
