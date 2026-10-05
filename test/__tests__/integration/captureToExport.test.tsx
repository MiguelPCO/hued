import { drawAsImage, matchFont, Skia, useImage } from '@shopify/react-native-skia';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library/legacy';

import { trackEvent } from '@/lib/analytics/events';
import { processCapture } from '@/lib/capture/processCapture';
import { useSettingsStore } from '@/lib/store/settingsStore';
import PaletteScreen from '@app/palette/[id]';
import { peekPalette, resetFakePaletteDb } from '@test/fakePaletteDb';
import { resetRouterMocks, searchParamsMock } from '@test/router';
import { findAll, treeSignature } from '@test/skiaTree';

jest.mock('@/lib/db/palettes', () => require('@test/fakePaletteDb'));
jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/utils/image', () => ({
  optimize: jest.fn((uri: string) => Promise.resolve(uri)),
  thumbnail: jest.fn((uri: string) => Promise.resolve(uri)),
}));
jest.mock('@/lib/color/extract', () => ({
  ...jest.requireActual('@/lib/color/extract'),
  extractColors: jest.fn((_uri: string, n = 5) => Promise.resolve(require('@test/factories').makeColors(n))),
}));

const media = MediaLibrary as jest.Mocked<typeof MediaLibrary>;
const today = () => new Date().toISOString().slice(0, 10);

// Drains the promise chains the screen starts (several awaits deep) inside act().
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => {});
};
const advance = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });

async function openEditor(id: string) {
  searchParamsMock.mockReturnValue({ id });
  const view = render(<PaletteScreen />);
  await settle();
  expect(screen.getByText('Exportar')).toBeOnTheScreen();
  return view;
}

async function exportAt1x() {
  fireEvent.press(screen.getByText('Exportar'));
  fireEvent.press(screen.getByText('1×'));
  await settle();
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetFakePaletteDb();
  resetRouterMocks();
  (useImage as jest.Mock).mockReturnValue(null);
  (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(null);
  useSettingsStore.setState({ subscriptionStatus: 'free', exportDailyCount: 0, exportDailyResetDate: today() });
});

afterEach(() => jest.useRealTimers());

describe('from capture to a saved export', () => {
  it('turns a photo into a palette, edits it, persists the edit and exports it', async () => {
    // 1) captura → palette guardada sin colores y con el layout por defecto
    const captured = await processCapture('file:///tmp/photo.jpg', 'gallery');
    expect(peekPalette(captured.id)).toMatchObject({
      colors: [],
      layoutConfig: { archetypeId: 'strip' },
      meta: { source: 'gallery' },
    });

    // 2) el editor abre la paleta y extrae los colores en segundo plano
    await openEditor(captured.id);
    expect(peekPalette(captured.id)!.colors).toHaveLength(5);

    // 3) el usuario elige Cuadrícula; tras el debounce queda guardado
    fireEvent.press(screen.getByText('Cuadrícula'));
    await advance(499);
    expect(peekPalette(captured.id)!.layoutConfig.archetypeId).toBe('strip'); // aún no
    await advance(1);
    expect(peekPalette(captured.id)!.layoutConfig.archetypeId).toBe('grid');

    // 4) exporta a 1×
    await exportAt1x();

    expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(1);
    expect(media.saveToLibraryAsync).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/\/cache\/hued-export-\d+\.png$/));
    expect(peekPalette(captured.id)!.exportCount).toBe(1);
    expect(useSettingsStore.getState().exportDailyCount).toBe(1);

    // 5) la analítica cuenta la historia completa, en orden
    const events = (trackEvent as jest.Mock).mock.calls.map((c) => c[0]);
    expect(events).toEqual(
      expect.arrayContaining(['capture_completed', 'archetype_selected', 'palette_exported', 'palette_shared'])
    );
    expect(events.indexOf('capture_completed')).toBeLessThan(events.indexOf('archetype_selected'));
    expect(events.indexOf('archetype_selected')).toBeLessThan(events.indexOf('palette_exported'));
    expect(trackEvent).toHaveBeenCalledWith('palette_exported', {
      palette_id: captured.id, resolution: '1x', archetype_id: 'grid',
    });
  });

  it('exports what is on screen even before the debounced save has reached the database', async () => {
    const captured = await processCapture('file:///tmp/photo.jpg', 'camera');
    await openEditor(captured.id);

    fireEvent.press(screen.getByText('Tipografía'));
    fireEvent.press(screen.getByText('Clásica')); // serif; todavía sin guardar (debounce de 500 ms)
    await exportAt1x();
    expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(1);

    // el export dibuja con la tipografía nueva…
    (matchFont as jest.Mock).mockClear();
    const exported = render((drawAsImage as jest.Mock).mock.calls.at(-1)![0]);
    expect(matchFont).toHaveBeenCalledWith(
      expect.objectContaining({ fontFamily: expect.stringMatching(/^(Georgia|serif)$/) })
    );
    exported.unmount();

    // …aunque la base de datos aún no la tiene; llega después
    expect(peekPalette(captured.id)!.layoutConfig.fontFamily).toBe('sans');
    await advance(500);
    expect(peekPalette(captured.id)!.layoutConfig.fontFamily).toBe('serif');
  });

  // Task 7 solo cubre la rama sin foto. Aquí el mismo flujo con la foto cargada: useImage (preview) y
  // MakeImageFromEncoded (export) devuelven la misma imagen, y los dos árboles deben coincidir.
  it('draws the same tree with a loaded photo in the preview and in the export', async () => {
    const photo = { __photo: true };
    (useImage as jest.Mock).mockReturnValue(photo);
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(photo);
    const captured = await processCapture('file:///tmp/photo.jpg', 'gallery');
    const editor = await openEditor(captured.id);
    // el preview es el canvas real de la pantalla (aparece cuando la región de lienzo mide su alto)
    const region = editor.UNSAFE_root.findAll((n) => (n.type as unknown) === 'View' && typeof n.props.onLayout === 'function')[0];
    fireEvent(region, 'layout', { nativeEvent: { layout: { width: 360, height: 450 } } });
    const previewCanvas = findAll(editor.toJSON(), 'SkCanvas')[0];

    await exportAt1x();

    const exported = render((drawAsImage as jest.Mock).mock.calls.at(-1)![0]);
    const exportedTree = exported.toJSON();
    exported.unmount();

    expect(findAll(previewCanvas, 'SkImage')[0].props.image).toBe(photo);
    expect(findAll(exportedTree, 'SkImage')[0].props.image).toBe(photo); // la foto cargada se dibuja…
    expect(findAll(exportedTree, 'SkRect').some((r) => r.props.color === '#E5E5E5')).toBe(false); // …sin el gris de relleno
    expect(treeSignature(exportedTree)).toBe(treeSignature(previewCanvas.children?.[0]));
  });
});
