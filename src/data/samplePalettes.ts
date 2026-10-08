/**
 * Starter palettes seeded on first launch (see src/lib/samples/seedSamplePalettes.ts).
 *
 * Only the hex values come from the reference screenshots — no third-party
 * photos or palette names. Colour names are resolved at seed time by the
 * app's own `findColorName`. `hexes` are in dominance order (largest area
 * first); the generated image (scripts/generate-sample-images.ts) and the
 * stored `weight`s both derive from that order via `sampleWeights`.
 *
 * Archetypes are spread over the four card layouts (never libre: it needs dragged geometry).
 */
import type { ArchetypeId } from '@/types/palette';

export interface SamplePalette {
  hexes: string[];
  archetypeId: Exclude<ArchetypeId, 'libre'>;
}

export const SAMPLE_COLLECTION_NAME = 'Ejemplos';

export const SAMPLE_PALETTES: SamplePalette[] = [
  { archetypeId: 'pila', hexes: ['#264414', '#DDE255', '#F98805', '#F35695', '#F8DBDB'] },
  { archetypeId: 'mosaico', hexes: ['#E4CBA9', '#7FC7CC', '#092F33', '#4B5B34', '#AF5031', '#FDABA5', '#980204', '#EA8913'] },
  { archetypeId: 'columnas', hexes: ['#647364', '#BAAABF', '#B1C0AD', '#F7F0E6', '#D8AEA7', '#915F6D'] },
  { archetypeId: 'mosaico', hexes: ['#576238', '#8D844D', '#FFD95E', '#F0EADC'] },
  { archetypeId: 'pila', hexes: ['#A6171C', '#D6D0C5', '#F1C045'] },
  { archetypeId: 'pila', hexes: ['#0029FF', '#F9E793', '#7F4A16'] },
  { archetypeId: 'columnas', hexes: ['#457298', '#B0613F', '#F2A54F', '#CAB6AB', '#6F6D72', '#3B3629'] },
  { archetypeId: 'escalonado', hexes: ['#3A5635', '#D57B0E', '#F4E2D0'] },
  { archetypeId: 'mosaico', hexes: ['#25799B', '#CB1B03', '#A2C5D8', '#F7E6CB'] },
  { archetypeId: 'escalonado', hexes: ['#542916', '#B79858', '#A13A1E', '#88B8CE', '#FEFAF0', '#F1C166'] },
];

/** Area share per colour, descending, summing to 1. */
export function sampleWeights(n: number): number[] {
  const raw = Array.from({ length: n }, (_, i) => 1 / (i + 2));
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / total);
}
