import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Sentry from '@sentry/react-native';
import * as Sharing from 'expo-sharing';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { trackEvent } from '@/lib/analytics/events';
import { listCollections } from '@/lib/db/collections';
import { deletePalette, duplicatePalette, setPaletteCollection, toggleFavorite } from '@/lib/db/palettes';
import { exportPalette } from '@/lib/export/exportPalette';
import { Colors } from '@/lib/tokens';
import { makeColors, makePalette } from '@test/factories';
import { PaletteCard } from '../PaletteCard';

jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/db/collections', () => ({ listCollections: jest.fn() }));
jest.mock('@/lib/export/exportPalette', () => ({ exportPalette: jest.fn() }));
jest.mock('@/lib/db/palettes', () => ({
  deletePalette: jest.fn(),
  duplicatePalette: jest.fn(),
  setPaletteCollection: jest.fn(),
  toggleFavorite: jest.fn(),
}));

const sharing = Sharing as jest.Mocked<typeof Sharing>;
const palette = makePalette({ id: 'p1', createdAt: Date.UTC(2026, 9, 4, 12) });

function setup(overrides = {}) {
  const props = {
    palette,
    onPress: jest.fn(),
    onToggleFavorite: jest.fn(),
    onDuplicated: jest.fn(),
    onDeleted: jest.fn(),
    onCollectionChanged: jest.fn(),
    ...overrides,
  };
  render(<PaletteCard {...props} />);
  return props;
}

const card = () => screen.UNSAFE_getAllByType(TouchableOpacity)[0];
const longPress = () => fireEvent(card(), 'longPress');
const heart = (name: string) =>
  screen.UNSAFE_root.findAll((n) => (n.type as unknown) === 'MaterialIcons' && n.props.name === name)[0];

const flush = () => act(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  (toggleFavorite as jest.Mock).mockResolvedValue(undefined);
  (duplicatePalette as jest.Mock).mockResolvedValue(makePalette({ id: 'dup' }));
  (deletePalette as jest.Mock).mockResolvedValue(undefined);
  (setPaletteCollection as jest.Mock).mockResolvedValue(undefined);
  (exportPalette as jest.Mock).mockResolvedValue('file:///cache/share.png');
  (listCollections as jest.Mock).mockResolvedValue([{ id: 'c1', name: 'Café', createdAt: 1, position: 0 }]);
  sharing.isAvailableAsync.mockResolvedValue(true);
});

describe('PaletteCard — card', () => {
  it('shows the creation date in Spanish', () => {
    setup();

    expect(screen.getByText('4 oct 2026')).toBeOnTheScreen();
  });

  it('shows at most five color chips', () => {
    const big = makePalette({ colors: makeColors(8) });
    setup({ palette: big });

    const hexes = big.colors.map((c) => c.hex);
    const chips = screen.UNSAFE_root.findAll(
      (n) => (n.type as unknown) === 'View' && hexes.includes(StyleSheet.flatten(n.props.style)?.backgroundColor as string)
    );

    expect(chips).toHaveLength(5);
  });

  it('renders a palette that has no colors yet (still extracting)', () => {
    setup({ palette: makePalette({ colors: [], createdAt: palette.createdAt }) });

    expect(screen.getByText('4 oct 2026')).toBeOnTheScreen();
  });

  it('opens the palette on tap', () => {
    const props = setup();

    fireEvent.press(card());

    expect(props.onPress).toHaveBeenCalledWith('p1');
  });

  it('shows a filled red heart for favorites and an outline otherwise', () => {
    setup({ palette: makePalette({ isFavorite: true }) });

    expect(heart('favorite').props.color).toBe(Colors.error);
    expect(heart('favorite-border')).toBeUndefined();
  });
});

describe('PaletteCard — favorite', () => {
  it('updates the UI first, then persists', async () => {
    const props = setup();

    fireEvent.press(heart('favorite-border'));

    expect(props.onToggleFavorite).toHaveBeenCalledWith('p1');
    await flush();
    expect(toggleFavorite).toHaveBeenCalledWith('p1');
  });

  it('reverts the optimistic update and reports when persisting fails', async () => {
    (toggleFavorite as jest.Mock).mockRejectedValueOnce(new Error('db'));
    const props = setup();

    fireEvent.press(heart('favorite-border'));

    await flush();
    expect(props.onToggleFavorite).toHaveBeenCalledTimes(2);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('is also available from the long-press sheet with the right label', () => {
    setup();
    longPress();

    expect(screen.getByText('Marcar como favorito')).toBeOnTheScreen();
  });

  it('offers to remove a favorite', () => {
    setup({ palette: makePalette({ isFavorite: true }) });
    longPress();

    expect(screen.getByText('Quitar de favoritos')).toBeOnTheScreen();
  });
});

describe('PaletteCard — duplicate', () => {
  it('duplicates, reports the copy and closes the sheet', async () => {
    const props = setup();
    longPress();

    fireEvent.press(screen.getByText('Duplicar'));

    await flush();
    expect(props.onDuplicated).toHaveBeenCalledWith(expect.objectContaining({ id: 'dup' }));
    expect(duplicatePalette).toHaveBeenCalledWith('p1');
    await flush();
    expect(screen.queryByText('Duplicar')).toBeNull();
  });

  it('keeps the sheet open and reports when duplicating fails', async () => {
    (duplicatePalette as jest.Mock).mockRejectedValueOnce(new Error('no space'));
    const props = setup();
    longPress();

    fireEvent.press(screen.getByText('Duplicar'));

    await flush();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(props.onDuplicated).not.toHaveBeenCalled();
    expect(screen.getByText('Duplicar')).toBeOnTheScreen();
  });
});

describe('PaletteCard — share', () => {
  it('exports at 2x with the palette layout and opens the share sheet', async () => {
    setup();
    longPress();

    fireEvent.press(screen.getByText('Compartir'));

    await flush();
    expect(sharing.shareAsync).toHaveBeenCalledWith('file:///cache/share.png', { mimeType: 'image/png' });
    expect(exportPalette).toHaveBeenCalledWith(palette, palette.layoutConfig, '2x');
    await flush();
    expect(screen.queryByText('Compartir')).toBeNull();
  });

  it('skips the share sheet when sharing is unavailable but still closes', async () => {
    sharing.isAvailableAsync.mockResolvedValueOnce(false);
    setup();
    longPress();

    fireEvent.press(screen.getByText('Compartir'));

    await flush();
    expect(screen.queryByText('Compartir')).toBeNull();
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('reports an export failure', async () => {
    (exportPalette as jest.Mock).mockRejectedValueOnce(new Error('skia'));
    setup();
    longPress();

    fireEvent.press(screen.getByText('Compartir'));

    await flush();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });
});

describe('PaletteCard — move to folder', () => {
  it('lists the folders and assigns the chosen one', async () => {
    const props = setup();
    longPress();

    fireEvent.press(screen.getByText('Mover a carpeta'));
    await flush();
    fireEvent.press(screen.getByText('Café'));

    await flush();
    expect(setPaletteCollection).toHaveBeenCalledWith('p1', 'c1');
    expect(props.onCollectionChanged).toHaveBeenCalledWith('p1', 'c1');
  });

  it('"Sin carpeta" removes the palette from its folder', async () => {
    const props = setup();
    longPress();

    fireEvent.press(screen.getByText('Mover a carpeta'));
    await flush();
    fireEvent.press(screen.getByText('Sin carpeta'));

    await flush();
    expect(setPaletteCollection).toHaveBeenCalledWith('p1', null);
    expect(props.onCollectionChanged).toHaveBeenCalledWith('p1', null);
  });

  it('keeps the main sheet open when the folders cannot be loaded', async () => {
    (listCollections as jest.Mock).mockRejectedValueOnce(new Error('db'));
    setup();
    longPress();

    fireEvent.press(screen.getByText('Mover a carpeta'));

    await flush();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Duplicar')).toBeOnTheScreen();
  });
});

describe('PaletteCard — delete', () => {
  const askToDelete = () => {
    longPress();
    fireEvent.press(screen.getByText('Eliminar'));
  };

  it('asks for confirmation before deleting', () => {
    setup();

    askToDelete();

    expect(screen.getByText(/¿Eliminar esta paleta\?/)).toBeOnTheScreen();
    expect(deletePalette).not.toHaveBeenCalled();
  });

  it('deletes after confirming, records the event and reports the removal', async () => {
    const props = setup();
    askToDelete();

    fireEvent.press(screen.getByText('Eliminar'));

    await flush();
    expect(props.onDeleted).toHaveBeenCalledWith('p1');
    expect(deletePalette).toHaveBeenCalledWith('p1');
    expect(trackEvent).toHaveBeenCalledWith('palette_deleted', { palette_id: 'p1', source: 'grid' });
  });

  it('cancelling closes the sheet without deleting', () => {
    setup();
    askToDelete();

    fireEvent.press(screen.getByText('Cancelar'));

    expect(deletePalette).not.toHaveBeenCalled();
    expect(screen.queryByText(/¿Eliminar esta paleta\?/)).toBeNull();
  });

  it('stays on the confirmation and can retry when deleting fails', async () => {
    (deletePalette as jest.Mock).mockRejectedValueOnce(new Error('locked'));
    const props = setup();
    askToDelete();

    fireEvent.press(screen.getByText('Eliminar'));
    await flush();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(props.onDeleted).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Eliminar'));
    await flush();
    expect(props.onDeleted).toHaveBeenCalledWith('p1');
  });
});
