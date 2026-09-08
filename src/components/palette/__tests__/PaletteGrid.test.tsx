// Mock dependencies BEFORE any imports that might trigger them
jest.mock('expo-router');
jest.mock('@/lib/db/palettes', () => ({
  listPalettes: jest.fn(),
}));
jest.mock('../PaletteCard', () => ({
  PaletteCard: () => null,
}));
jest.mock('@shopify/react-native-skia', () => ({
  Skia: {},
  Group: () => null,
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
}));

import { filterPalettes } from '../PaletteGrid';
import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import type { Palette } from '@/types/palette';

function makePalette(overrides: Partial<Palette>): Palette {
  return {
    id: 'p1',
    imageUri: 'file:///a.jpg',
    thumbnailUri: 'file:///a-thumb.jpg',
    colors: [],
    layoutConfig: DEFAULT_LAYOUT_CONFIG,
    collectionId: null,
    meta: { capturedAt: 0, source: 'camera', aspectRatio: 'original' },
    createdAt: 0,
    updatedAt: 0,
    isFavorite: false,
    exportCount: 0,
    ...overrides,
  };
}

describe('filterPalettes', () => {
  const all = [
    makePalette({ id: 'p1', isFavorite: true, collectionId: null }),
    makePalette({ id: 'p2', isFavorite: false, collectionId: 'col-1' }),
    makePalette({ id: 'p3', isFavorite: false, collectionId: null }),
  ];

  it('"all" returns every palette regardless of favorite/collection', () => {
    expect(filterPalettes(all, 'all', '').map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('"favorites" returns only isFavorite palettes', () => {
    expect(filterPalettes(all, 'favorites', '').map((p) => p.id)).toEqual(['p1']);
  });

  it('a collection id returns only palettes with that collectionId', () => {
    expect(filterPalettes(all, 'col-1', '').map((p) => p.id)).toEqual(['p2']);
  });

  it('an unknown collection id returns no palettes', () => {
    expect(filterPalettes(all, 'col-does-not-exist', '').map((p) => p.id)).toEqual([]);
  });
});
