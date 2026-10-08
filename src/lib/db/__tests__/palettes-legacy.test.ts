import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import { getDb } from '../client';
import { getPalette, listPalettes } from '../palettes';

jest.mock('../client');

const mockDb = { getFirstAsync: jest.fn(), getAllAsync: jest.fn() };
(getDb as jest.Mock).mockResolvedValue(mockDb);

// Fila guardada antes de que existieran `paletteSize`, `freeformSwatches` y las fuentes nuevas.
const legacyLayout = {
  archetypeId: 'grid',
  position: 0,
  showHex: true,
  showName: false,
  showRGB: false,
  fontFamily: 'serif',
  cornerRadius: 24,
  cardStyle: 'outlined',
  watermarkVisible: false,
};

const legacyRow = {
  id: '01HXLEGACY000000000000000A',
  image_uri: 'file:///palettes/a/full.jpg',
  thumbnail_uri: 'file:///palettes/a/thumb.jpg',
  colors: '[]',
  layout_config: JSON.stringify(legacyLayout),
  collection_id: null,
  meta: JSON.stringify({ capturedAt: 1, source: 'camera', aspectRatio: 'original' }),
  created_at: 1,
  updated_at: 1,
  is_favorite: 1,
  export_count: 2,
};

beforeEach(() => jest.clearAllMocks());

describe('rows saved before newer LayoutConfig fields existed', () => {
  it('getPalette fills in paletteSize and freeformSwatches from the defaults', async () => {
    mockDb.getFirstAsync.mockResolvedValue(legacyRow);

    const palette = await getPalette(legacyRow.id);

    expect(palette?.layoutConfig.paletteSize).toBe(DEFAULT_LAYOUT_CONFIG.paletteSize);
    expect(palette?.layoutConfig.freeformSwatches).toEqual([]);
  });

  it('getPalette fills in the card look fields from the defaults', async () => {
    mockDb.getFirstAsync.mockResolvedValue(legacyRow);

    const palette = await getPalette(legacyRow.id);

    expect(palette?.layoutConfig).toMatchObject({
      cardOpacity: 100,
      cardWidthScale: 100,
      cardHeightScale: 100,
      gapScale: 100,
      fontSize: 10,
      labelPosition: 'split',
      labelOrder: 'name-first',
      labelAlign: 'left',
      libreSource: 'pila',
    });
  });

  it('keeps every value the user had stored', async () => {
    mockDb.getFirstAsync.mockResolvedValue(legacyRow);

    const palette = await getPalette(legacyRow.id);

    // 'grid' no longer exists: it reads back as its closest current archetype
    expect(palette?.layoutConfig).toMatchObject({
      archetypeId: 'mosaico',
      fontFamily: 'serif',
      cornerRadius: 24,
      cardStyle: 'outlined',
      showName: false,
    });
  });

  it('listPalettes applies the same defaults to every row', async () => {
    mockDb.getAllAsync.mockResolvedValue([legacyRow, { ...legacyRow, id: 'b' }]);

    const palettes = await listPalettes();

    expect(palettes).toHaveLength(2);
    palettes.forEach((p) => {
      expect(p.layoutConfig.paletteSize).toBe(5);
      expect(p.layoutConfig.freeformSwatches).toEqual([]);
    });
  });

  it('a stored paletteSize wins over the default', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      ...legacyRow,
      layout_config: JSON.stringify({ ...legacyLayout, paletteSize: 8 }),
    });

    const palette = await getPalette(legacyRow.id);

    expect(palette?.layoutConfig.paletteSize).toBe(8);
  });

  it('maps the integer flags and counters to their domain types', async () => {
    mockDb.getFirstAsync.mockResolvedValue(legacyRow);

    const palette = await getPalette(legacyRow.id);

    expect(palette?.isFavorite).toBe(true);
    expect(palette?.exportCount).toBe(2);
  });
});
