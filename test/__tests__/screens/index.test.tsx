import * as Sentry from '@sentry/react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ActivityIndicator } from 'react-native';

import { launchGalleryPicker } from '@/components/capture/GalleryPicker';
import { processCapture } from '@/lib/capture/processCapture';
import { createCollection, deleteCollection, listCollections, renameCollection } from '@/lib/db/collections';
import { listPalettes } from '@/lib/db/palettes';
import { seedSamplePalettesOnce } from '@/lib/samples/seedSamplePalettes';
import type { Collection } from '@/types/palette';
import HomeScreen from '@app/(tabs)/index';
import { makePalette } from '@test/factories';
import { resetRouterMocks, routerMock, searchParamsMock } from '@test/router';

jest.mock('@/lib/db/palettes', () => ({ listPalettes: jest.fn() }));
jest.mock('@/lib/db/collections', () => ({
  listCollections: jest.fn(),
  createCollection: jest.fn(),
  renameCollection: jest.fn(),
  deleteCollection: jest.fn(),
}));
jest.mock('@/components/capture/GalleryPicker', () => ({ launchGalleryPicker: jest.fn() }));
jest.mock('@/lib/capture/processCapture', () => ({ processCapture: jest.fn() }));
jest.mock('@/lib/samples/seedSamplePalettes', () => ({ seedSamplePalettesOnce: jest.fn() }));
jest.mock('@/components/palette/PaletteGrid', () => {
  const { createElement } = require('react');
  const { Text } = require('react-native');
  return {
    PaletteGrid: (p: { filter: string; query: string }) => createElement(Text, null, `grid:${p.filter}:${p.query}`),
  };
});

const CAFE: Collection = { id: 'c1', name: 'Café', createdAt: 1, position: 0 };

function mount(opts: { palettes?: number; collections?: Collection[] } = {}) {
  (listPalettes as jest.Mock).mockResolvedValue(Array.from({ length: opts.palettes ?? 2 }, (_, i) => makePalette({ id: `p${i}` })));
  (listCollections as jest.Mock).mockResolvedValue(opts.collections ?? []);
  render(<HomeScreen />);
}

const flush = () => act(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  (seedSamplePalettesOnce as jest.Mock).mockResolvedValue(undefined);
  resetRouterMocks();
});

describe('HomeScreen — loading', () => {
  it('waits for the first-launch seed before reading palettes and collections', async () => {
    let finish!: () => void;
    (seedSamplePalettesOnce as jest.Mock).mockReturnValue(new Promise<void>((r) => { finish = r; }));
    mount();
    await flush();
    expect(listPalettes).not.toHaveBeenCalled();
    expect(listCollections).not.toHaveBeenCalled();

    await act(async () => { finish(); });

    expect(listPalettes).toHaveBeenCalledTimes(1);
    expect(listCollections).toHaveBeenCalledTimes(1);
  });

  it('still loads the library and reports to Sentry when the seed fails', async () => {
    (seedSamplePalettesOnce as jest.Mock).mockRejectedValue(new Error('seed'));
    mount();
    await flush();

    expect(Sentry.captureException).toHaveBeenCalledWith(new Error('seed'));
    expect(screen.getByText('Tus paletas')).toBeOnTheScreen();
  });

  it('shows only a spinner until the palettes load', async () => {
    mount();

    expect(screen.queryByText('Hued')).toBeNull();
    expect(screen.UNSAFE_getAllByType(ActivityIndicator)).toHaveLength(1);
    await flush();

    expect(screen.getByText('Hued')).toBeOnTheScreen();
    expect(screen.getByText('Tus paletas')).toBeOnTheScreen();
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    expect(listPalettes).toHaveBeenCalledTimes(1);
  });

  it('reports a load failure to Sentry', async () => {
    (listPalettes as jest.Mock).mockRejectedValue(new Error('db'));
    (listCollections as jest.Mock).mockResolvedValue([]);

    render(<HomeScreen />);
    await flush();

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(new Error('db'));
  });

  // Pins the loading states around the H-08 failure test below: spinner while `listPalettes` is
  // pending, content once it resolves.
  it('keeps the spinner while listPalettes is pending and shows the screen once it resolves (H-08)', async () => {
    let resolve!: (v: unknown[]) => void;
    (listPalettes as jest.Mock).mockReturnValue(new Promise((r) => { resolve = r; }));
    (listCollections as jest.Mock).mockResolvedValue([]);

    render(<HomeScreen />);
    await flush();
    expect(screen.queryByText('Hued')).toBeNull();
    expect(screen.UNSAFE_getAllByType(ActivityIndicator)).toHaveLength(1);

    await act(async () => { resolve([makePalette({ id: 'p0' })]); });

    expect(screen.getByText('Hued')).toBeOnTheScreen();
  });

  // H-08 (corregido): si `listPalettes` fallaba, `hasPalettes` se quedaba en `null` y la pantalla
  // era un spinner para siempre. Ahora muestra el error con un botón de reintento.
  it('shows an error with a retry button when listPalettes fails, and recovers on retry (H-08)', async () => {
    (listPalettes as jest.Mock)
      .mockRejectedValueOnce(new Error('db'))
      .mockResolvedValueOnce([makePalette({ id: 'p0' })]);
    (listCollections as jest.Mock).mockResolvedValue([]);

    render(<HomeScreen />);
    await flush();

    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    expect(screen.getByText('No se pudieron cargar tus paletas.')).toBeOnTheScreen();
    expect(screen.queryByText('Hued')).toBeNull();

    fireEvent.press(screen.getByText('Reintentar'));
    await flush();

    expect(screen.queryByText('No se pudieron cargar tus paletas.')).toBeNull();
    expect(screen.getByText('Hued')).toBeOnTheScreen();
    expect(listPalettes).toHaveBeenCalledTimes(2);
  });
});

describe('HomeScreen — empty state', () => {
  it('invites the user to create the first palette', async () => {
    mount({ palettes: 0 });

    expect(await screen.findByText('Sin paletas todavía')).toBeOnTheScreen();
    expect(screen.queryByText('grid:all:')).toBeNull();
  });

  it('opens the camera tab from the "Cámara" button', async () => {
    mount({ palettes: 0 });
    fireEvent.press(await screen.findByText('Cámara'));

    expect(routerMock.push).toHaveBeenCalledWith('/(tabs)/capture');
  });

  it('turns a gallery pick into a palette and opens the editor', async () => {
    (launchGalleryPicker as jest.Mock).mockResolvedValue({ type: 'picked', uri: 'file:///g.jpg' });
    (processCapture as jest.Mock).mockResolvedValue(makePalette({ id: 'fresh' }));
    mount({ palettes: 0 });

    fireEvent.press(await screen.findByText('Galería'));

    await flush();

    expect(routerMock.push).toHaveBeenCalledWith({ pathname: '/palette/[id]', params: { id: 'fresh' } });
    expect(processCapture).toHaveBeenCalledWith('file:///g.jpg', 'gallery');
  });

  it('explains how to grant gallery access when permission is denied', async () => {
    (launchGalleryPicker as jest.Mock).mockResolvedValue({ type: 'denied' });
    mount({ palettes: 0 });

    fireEvent.press(await screen.findByText('Galería'));

    expect(await screen.findByText('Activa el permiso de galería en Ajustes del dispositivo.')).toBeOnTheScreen();
  });

  it('does nothing when the gallery is dismissed', async () => {
    (launchGalleryPicker as jest.Mock).mockResolvedValue({ type: 'cancelled' });
    mount({ palettes: 0 });

    fireEvent.press(await screen.findByText('Galería'));
    await flush();

    expect(launchGalleryPicker).toHaveBeenCalledTimes(1);
    expect(processCapture).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('shows a retry message and reports to Sentry when the photo cannot be processed', async () => {
    (launchGalleryPicker as jest.Mock).mockResolvedValue({ type: 'picked', uri: 'file:///g.jpg' });
    (processCapture as jest.Mock).mockRejectedValue(new Error('optimize'));
    mount({ palettes: 0 });

    fireEvent.press(await screen.findByText('Galería'));

    expect(await screen.findByText('No se pudo procesar la foto. Intentalo de nuevo.')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('swaps the "Galería" button for "Abriendo..." while the picker is open and restores it afterwards', async () => {
    let finish!: (v: { type: 'cancelled' }) => void;
    (launchGalleryPicker as jest.Mock).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    mount({ palettes: 0 });

    fireEvent.press(await screen.findByText('Galería'));
    expect(await screen.findByText('Abriendo...')).toBeOnTheScreen();
    expect(screen.queryByText('Galería')).toBeNull();

    expect(launchGalleryPicker).toHaveBeenCalledTimes(1);

    await act(async () => { finish({ type: 'cancelled' }); });

    expect(screen.getByText('Galería')).toBeOnTheScreen();
    expect(screen.queryByText('Abriendo...')).toBeNull();
  });

  it('shows the failure message after a failed capture sent the user back with ?captureFailed=1', async () => {
    searchParamsMock.mockReturnValue({ captureFailed: '1' });
    mount({ palettes: 0 });

    expect(await screen.findByText('No se pudo procesar la foto. Intentalo de nuevo.')).toBeOnTheScreen();
  });
});

describe('HomeScreen — with palettes', () => {
  it('shows the grid, search box and the default filters', async () => {
    mount();

    expect(await screen.findByText('grid:all:')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Buscar por color...')).toBeOnTheScreen();
    expect(screen.getByText('Todas')).toBeOnTheScreen();
    expect(screen.getByText('Favoritas')).toBeOnTheScreen();
  });

  it('passes the search text to the grid', async () => {
    mount();
    await screen.findByText('grid:all:');

    fireEvent.changeText(screen.getByPlaceholderText('Buscar por color...'), 'rojo');

    expect(screen.getByText('grid:all:rojo')).toBeOnTheScreen();
  });

  it('switches the grid filter between all, favorites and a folder', async () => {
    mount({ collections: [CAFE] });
    await screen.findByText('grid:all:');

    fireEvent.press(screen.getByText('Favoritas'));
    expect(screen.getByText('grid:favorites:')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Café'));
    expect(screen.getByText('grid:c1:')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Todas'));
    expect(screen.getByText('grid:all:')).toBeOnTheScreen();
  });

  it('opens the camera tab from the floating "+" button', async () => {
    mount();
    fireEvent.press(await screen.findByText('+'));

    expect(routerMock.push).toHaveBeenCalledWith('/(tabs)/capture');
  });
});

describe('HomeScreen — folders', () => {
  const openCreate = async () => {
    mount({ collections: [CAFE] });
    fireEvent.press(await screen.findByText('+ Nueva'));
  };

  it('creates a folder with a trimmed name and adds its pill', async () => {
    (createCollection as jest.Mock).mockResolvedValue({ id: 'c2', name: 'Viajes', createdAt: 2, position: 1 });
    await openCreate();

    fireEvent.changeText(screen.getByPlaceholderText('Nombre de la carpeta'), '  Viajes  ');
    fireEvent.press(screen.getByText('Crear'));

    expect(await screen.findByText('Viajes')).toBeOnTheScreen();
    expect(createCollection).toHaveBeenCalledWith('Viajes');
  });

  it('does not create a folder with an empty name', async () => {
    await openCreate();

    fireEvent.press(screen.getByText('Crear'));

    expect(createCollection).not.toHaveBeenCalled();
  });

  it('keeps the sheet open and reports when creating fails', async () => {
    (createCollection as jest.Mock).mockRejectedValue(new Error('db'));
    await openCreate();

    fireEvent.changeText(screen.getByPlaceholderText('Nombre de la carpeta'), 'Viajes');
    fireEvent.press(screen.getByText('Crear'));

    await flush();

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(screen.getByText('NUEVA CARPETA')).toBeOnTheScreen();
  });

  it('renames a folder from its long-press menu', async () => {
    (renameCollection as jest.Mock).mockResolvedValue(undefined);
    mount({ collections: [CAFE] });
    fireEvent(await screen.findByText('Café'), 'longPress');

    fireEvent.press(screen.getByText('Renombrar'));
    expect(screen.getByDisplayValue('Café')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByDisplayValue('Café'), 'Cafetería');
    fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('Cafetería')).toBeOnTheScreen();
    expect(renameCollection).toHaveBeenCalledWith('c1', 'Cafetería');
    expect(screen.queryByText('Café')).toBeNull();
  });

  it('asks for confirmation, deletes the folder and falls back to "Todas" if it was selected', async () => {
    (deleteCollection as jest.Mock).mockResolvedValue(undefined);
    mount({ collections: [CAFE] });
    fireEvent.press(await screen.findByText('Café'));
    expect(screen.getByText('grid:c1:')).toBeOnTheScreen();

    fireEvent(screen.getByText('Café'), 'longPress');
    fireEvent.press(screen.getByText('Eliminar'));
    expect(screen.getByText(/¿Eliminar "Café"\?/)).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Eliminar'));

    await flush();

    expect(deleteCollection).toHaveBeenCalledWith('c1');
    expect(screen.queryByText('Café')).toBeNull();
    expect(screen.getByText('grid:all:')).toBeOnTheScreen();
  });

  it('cancelling the delete confirmation keeps the folder', async () => {
    mount({ collections: [CAFE] });
    fireEvent(await screen.findByText('Café'), 'longPress');
    fireEvent.press(screen.getByText('Eliminar'));

    fireEvent.press(screen.getByText('Cancelar'));

    expect(deleteCollection).not.toHaveBeenCalled();
    expect(screen.getByText('Café')).toBeOnTheScreen();
  });
});
