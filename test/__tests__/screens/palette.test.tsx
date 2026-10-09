import * as Sentry from '@sentry/react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { baseStyleConfig, libreSeed, NEUTRAL_SCALES } from '@/components/compose/archetypes/cardLayouts';
import { trackEvent } from '@/lib/analytics/events';
import { ExtractError, extractColors } from '@/lib/color/extract';
import {
  deletePalette, getPalette, incrementExportCount, updatePaletteColors, updatePaletteLayout,
} from '@/lib/db/palettes';
import { exportPalette } from '@/lib/export/exportPalette';
import { useSettingsStore } from '@/lib/store/settingsStore';
import PaletteScreen from '@app/palette/[id]';
import { makeColors, makeLayoutConfig, makePalette } from '@test/factories';
import { resetRouterMocks, routerMock, searchParamsMock } from '@test/router';

jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/db/palettes', () => ({
  getPalette: jest.fn(),
  updatePaletteColors: jest.fn(),
  updatePaletteLayout: jest.fn(),
  incrementExportCount: jest.fn(),
  deletePalette: jest.fn(),
}));
jest.mock('@/lib/color/extract', () => ({
  ...jest.requireActual('@/lib/color/extract'),
  extractColors: jest.fn(),
}));
jest.mock('@/lib/export/exportPalette', () => ({
  ...jest.requireActual('@/lib/export/exportPalette'),
  exportPalette: jest.fn(),
}));

const media = MediaLibrary as jest.Mocked<typeof MediaLibrary>;
const sharing = Sharing as jest.Mocked<typeof Sharing>;
const palette = makePalette({ id: 'p1', colors: makeColors(5) });

// Drains the promise chains the screen starts (several awaits deep) inside act().
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => {});
};

async function mount(p = palette) {
  searchParamsMock.mockReturnValue({ id: p.id });
  (getPalette as jest.Mock).mockResolvedValue(p);
  const view = render(<PaletteScreen />);
  await settle();
  expect(screen.getByText('Exportar')).toBeOnTheScreen();
  return view;
}

const advance = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });
const lastWrite = () => (updatePaletteLayout as jest.Mock).mock.calls.at(-1)![1];

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetRouterMocks();
  useSettingsStore.setState({ subscriptionStatus: 'free' });
  (updatePaletteLayout as jest.Mock).mockResolvedValue(undefined);
  (updatePaletteColors as jest.Mock).mockResolvedValue(undefined);
  (incrementExportCount as jest.Mock).mockResolvedValue(undefined);
  (deletePalette as jest.Mock).mockResolvedValue(undefined);
  (extractColors as jest.Mock).mockImplementation((_uri: string, n = 5) => Promise.resolve(makeColors(n)));
  (exportPalette as jest.Mock).mockResolvedValue('file:///cache/out.png');
  media.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
  media.saveToLibraryAsync.mockResolvedValue(undefined as never);
  sharing.isAvailableAsync.mockResolvedValue(true);
  sharing.shareAsync.mockResolvedValue(undefined);
});

afterEach(() => jest.useRealTimers());

describe('PaletteScreen — loading', () => {
  it('shows the editor once the palette loads', async () => {
    await mount();

    expect(screen.getByText('Exportar')).toBeOnTheScreen();
    expect(screen.getByText('← Volver')).toBeOnTheScreen();
  });

  it('shows "Paleta no encontrada." with a way back for an unknown id', async () => {
    searchParamsMock.mockReturnValue({ id: 'missing' });
    (getPalette as jest.Mock).mockResolvedValue(null);
    render(<PaletteScreen />);
    await settle();

    fireEvent.press(screen.getByText('Volver'));

    expect(screen.getByText('Paleta no encontrada.')).toBeOnTheScreen();
    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });

  // Pins the loading states around the H-07 failure test below: spinner while `getPalette` is
  // pending, editor once it resolves.
  it('shows the spinner while getPalette is pending and the editor when it resolves', async () => {
    let resolve!: (p: typeof palette) => void;
    searchParamsMock.mockReturnValue({ id: 'p1' });
    (getPalette as jest.Mock).mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<PaletteScreen />);
    await settle();

    expect(screen.UNSAFE_getAllByType(ActivityIndicator)).toHaveLength(1);
    expect(screen.queryByText('Exportar')).toBeNull();

    await act(async () => resolve(palette));

    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    expect(screen.getByText('Exportar')).toBeOnTheScreen();
  });

  // H-07 (corregido): `getPalette(id).then(...)` no tenía `catch`/`finally`: si la base de datos
  // fallaba, `setLoading(false)` no llegaba a ejecutarse y la pantalla quedaba en spinner para
  // siempre. Ahora muestra el error con un botón de reintento y avisa a Sentry.
  it('shows an error with a retry button when getPalette fails, and recovers on retry (H-07)', async () => {
    searchParamsMock.mockReturnValue({ id: 'p1' });
    (getPalette as jest.Mock).mockRejectedValueOnce(new Error('db')).mockResolvedValueOnce(palette);

    render(<PaletteScreen />);
    await settle();

    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    expect(screen.getByText('No se pudo cargar la paleta.')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledWith(new Error('db'));
    expect(screen.queryByText('Exportar')).toBeNull();

    fireEvent.press(screen.getByText('Reintentar'));
    await settle();

    expect(screen.queryByText('No se pudo cargar la paleta.')).toBeNull();
    expect(screen.getByText('Exportar')).toBeOnTheScreen();
    expect(getPalette).toHaveBeenCalledTimes(2);
  });
});

describe('PaletteScreen — extraction on open', () => {
  const empty = makePalette({ id: 'p1', colors: [] });
  // Background colors of the swatch strip under the canvas (the row is 36 high and clips its children).
  // Scoped to that row: the same hexes also appear in tab previews and in the accent-coloured controls.
  const stripColors = () => {
    const flat = (n: { props: { style?: unknown } }): Record<string, unknown> => StyleSheet.flatten(n.props.style as never) ?? {};
    const row = screen.UNSAFE_root.findAll(
      (n) => (n.type as unknown) === 'View' && flat(n).height === 36 && flat(n).overflow === 'hidden'
    )[0];
    return row ? row.findAll((n) => (n.type as unknown) === 'View' && flat(n).flex === 1).map((n) => flat(n).backgroundColor) : [];
  };

  it('extracts the colors of a palette that has none and shows them', async () => {
    const hexes = makeColors(5).map((c) => c.hex);
    await mount(empty);

    expect(updatePaletteColors).toHaveBeenCalledWith('p1', expect.any(Array));
    expect(extractColors).toHaveBeenCalledWith(empty.thumbnailUri);
    expect(stripColors()).toEqual(hexes);
    expect(screen.queryByText('Reintentar')).toBeNull();
  });

  it('does not re-extract a palette that already has colors', async () => {
    await mount();

    expect(extractColors).not.toHaveBeenCalled();
    // positive counterpart: the swatch strip is drawn from the stored colors
    expect(stripColors()).toEqual(makeColors(5).map((c) => c.hex));
  });

  it('offers a retry when extraction fails, and reports it', async () => {
    (extractColors as jest.Mock).mockRejectedValueOnce(new ExtractError('Skia could not decode image'));
    await mount(empty);

    expect(screen.getByText('Reintentar')).toBeOnTheScreen();
    expect(stripColors()).toEqual([]);
    expect(trackEvent).toHaveBeenCalledWith('extract_failed', { reason: 'Skia could not decode image' });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText('Reintentar'));
    await settle();

    expect(extractColors).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Reintentar')).toBeNull();
    expect(stripColors()).toEqual(makeColors(5).map((c) => c.hex));
  });

  it('reports "unknown" for a non-ExtractError failure', async () => {
    (extractColors as jest.Mock).mockRejectedValueOnce(new Error('weird'));
    await mount(empty);

    expect(screen.getByText('Reintentar')).toBeOnTheScreen();
    expect(trackEvent).toHaveBeenCalledWith('extract_failed', { reason: 'unknown' });
  });
});

describe('PaletteScreen — saving the layout (500 ms debounce)', () => {
  const openFonts = () => fireEvent.press(screen.getByText('Fuente'));

  it('writes the config once, 500 ms after the last change', async () => {
    await mount();
    openFonts();

    fireEvent.press(screen.getByText('Clásica'));
    await advance(499);
    expect(updatePaletteLayout).not.toHaveBeenCalled();

    await advance(1);
    expect(updatePaletteLayout).toHaveBeenCalledTimes(1);
    expect(updatePaletteLayout).toHaveBeenCalledWith('p1', expect.objectContaining({ fontFamily: 'serif' }));
  });

  it('collapses rapid changes into a single write with the last value', async () => {
    await mount();
    openFonts();

    fireEvent.press(screen.getByText('Clásica'));
    await advance(100);
    fireEvent.press(screen.getByText('Técnica'));
    await advance(500);

    expect(updatePaletteLayout).toHaveBeenCalledTimes(1);
    expect(lastWrite().fontFamily).toBe('mono');
  });

  it('flushes a pending write when the screen closes (no lost edits)', async () => {
    const view = await mount();
    openFonts();
    fireEvent.press(screen.getByText('Clásica'));
    expect(updatePaletteLayout).not.toHaveBeenCalled();

    view.unmount();

    expect(updatePaletteLayout).toHaveBeenCalledWith('p1', expect.objectContaining({ fontFamily: 'serif' }));
  });

  it('reports a failed write to Sentry', async () => {
    (updatePaletteLayout as jest.Mock).mockRejectedValue(new Error('locked'));
    await mount();
    openFonts();

    fireEvent.press(screen.getByText('Clásica'));
    await advance(500);

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});

describe('PaletteScreen — Libre archetype', () => {
  it('seeds the layout it came from the first time Libre is chosen, keeping the look', async () => {
    await mount();

    fireEvent.press(screen.getByText('Libre'));
    await advance(500);

    expect(lastWrite()).toMatchObject({
      archetypeId: 'libre',
      freeformSwatches: libreSeed('pila', 5, NEUTRAL_SCALES),
    });
  });

  it('does not rewrite swatches that already match the colors', async () => {
    const custom = makeLayoutConfig({
      archetypeId: 'libre',
      freeformSwatches: libreSeed('pila', 5, NEUTRAL_SCALES).map((s) => ({ ...s, x: s.x + 1 })),
    });
    await mount(makePalette({ id: 'p1', colors: makeColors(5), layoutConfig: custom }));

    await advance(1000);

    expect(updatePaletteLayout).not.toHaveBeenCalled();
  });

  it('"Restablecer layout" goes back to the base layout and records the event', async () => {
    const custom = makeLayoutConfig({
      archetypeId: 'libre',
      freeformSwatches: libreSeed('pila', 5, NEUTRAL_SCALES).map((s) => ({ ...s, x: s.x + 1 })),
    });
    await mount(makePalette({ id: 'p1', colors: makeColors(5), layoutConfig: custom }));

    fireEvent.press(screen.getByText('Restablecer layout'));
    await advance(500);

    expect(lastWrite().freeformSwatches).toEqual(libreSeed('pila', 5, NEUTRAL_SCALES));
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'freeformSwatches_reset' });
  });
});

describe('PaletteScreen — archetypes and card adjustments', () => {
  const typeValue = (label: string, value: string) => {
    const input = screen.getByLabelText(label);
    fireEvent(input, 'focus');
    fireEvent.changeText(input, value);
    fireEvent(input, 'blur');
  };

  it('applies the whole base look of the archetype that is picked', async () => {
    await mount();

    fireEvent.press(screen.getByText('Escalonado'));
    await advance(500);

    expect(lastWrite()).toMatchObject({ archetypeId: 'escalonado', ...baseStyleConfig('escalonado', 5) });
    expect(lastWrite()).toMatchObject({ labelPosition: 'bottom', labelAlign: 'center', labelOrder: 'name-first' });
  });

  it('discards the size and spacing tweaks when another archetype is picked', async () => {
    await mount(
      makePalette({ id: 'p1', colors: makeColors(5), layoutConfig: makeLayoutConfig({ cardWidthScale: 70, gapScale: 140 }) }),
    );

    fireEvent.press(screen.getByText('Mosaico'));
    await advance(500);

    expect(lastWrite()).toMatchObject({ cardWidthScale: 100, gapScale: 100 });
  });

  it('keeps the tweaks when the current archetype is picked again', async () => {
    await mount(makePalette({ id: 'p1', colors: makeColors(5), layoutConfig: makeLayoutConfig({ fontSize: 14 }) }));

    fireEvent.press(screen.getByText('Pila'));
    await advance(500);

    expect(lastWrite().fontSize).toBe(14);
  });

  it('writes a size change of a card archetype to the config', async () => {
    await mount();
    fireEvent.press(screen.getByText('Tarjetas'));

    typeValue('Ancho', '120');
    await advance(500);

    expect(lastWrite()).toMatchObject({ cardWidthScale: 120, cardHeightScale: 100 });
  });

  it('starts Libre from the current archetype with its size and spacing already applied', async () => {
    const tweaked = makeLayoutConfig({ archetypeId: 'mosaico', cardWidthScale: 80, gapScale: 120 });
    await mount(makePalette({ id: 'p1', colors: makeColors(5), layoutConfig: tweaked }));

    fireEvent.press(screen.getByText('Libre'));
    await advance(500);

    expect(lastWrite()).toMatchObject({
      archetypeId: 'libre',
      libreSource: 'mosaico',
      freeformSwatches: libreSeed('mosaico', 5, tweaked),
    });
  });

  it('resizes the hand-placed cards of Libre by the ratio of the change', async () => {
    const seeded = libreSeed('pila', 5, NEUTRAL_SCALES);
    const libre = makeLayoutConfig({ archetypeId: 'libre', freeformSwatches: seeded, cardWidthScale: 100 });
    await mount(makePalette({ id: 'p1', colors: makeColors(5), layoutConfig: libre }));
    fireEvent.press(screen.getByText('Tarjetas'));

    typeValue('Ancho', '50');
    await advance(500);

    expect(lastWrite().cardWidthScale).toBe(50);
    expect(lastWrite().freeformSwatches[0]).toMatchObject({ width: seeded[0].width / 2, height: seeded[0].height });
  });
});

describe('PaletteScreen — palette size', () => {
  const setSize = (n: string) => {
    fireEvent.press(screen.getByText('Colores'));
    fireEvent.press(screen.getByText(n));
  };

  it('re-extracts at the new size and resets Libre swatches (ADR-0001)', async () => {
    await mount();

    setSize('8');
    await settle();

    expect(extractColors).toHaveBeenCalledWith(palette.thumbnailUri, 8);
    expect(updatePaletteColors).toHaveBeenCalledWith('p1', makeColors(8));
    await advance(500);
    expect(lastWrite()).toMatchObject({ paletteSize: 8, freeformSwatches: [] });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'paletteSize' });
  });

  it('takes on the look of the base layout for the new count', async () => {
    await mount();

    setSize('8');
    await settle();
    await advance(500);

    expect(lastWrite()).toMatchObject(baseStyleConfig('pila', 8));
    expect(lastWrite().cornerRadius).toBe(0);
  });

  it('sends Libre back to the layout it came from, for the new count', async () => {
    const libre = makeLayoutConfig({
      archetypeId: 'libre',
      libreSource: 'columnas',
      cardWidthScale: 70,
      freeformSwatches: libreSeed('columnas', 5, NEUTRAL_SCALES),
    });
    await mount(makePalette({ id: 'p1', colors: makeColors(5), layoutConfig: libre }));

    setSize('8');
    await settle();
    await advance(500);

    expect(lastWrite()).toMatchObject({
      archetypeId: 'libre',
      paletteSize: 8,
      cardWidthScale: 100,
      freeformSwatches: libreSeed('columnas', 8, NEUTRAL_SCALES),
    });
  });

  it('does nothing when the chosen size is already extracted', async () => {
    await mount();

    setSize('5');
    await settle();

    expect(extractColors).not.toHaveBeenCalled();
  });

  it('keeps the old palette and reports when re-extraction fails', async () => {
    (extractColors as jest.Mock).mockRejectedValueOnce(new ExtractError('Too few opaque pixels: 1'));
    await mount();

    setSize('8');
    await settle();

    expect(trackEvent).toHaveBeenCalledWith('extract_failed', { reason: 'Too few opaque pixels: 1' });
    await advance(500);
    expect(updatePaletteLayout).not.toHaveBeenCalled();
    expect(updatePaletteColors).not.toHaveBeenCalled();
  });
});

describe('PaletteScreen — export', () => {
  const openExport = () => fireEvent.press(screen.getByText('Exportar'));
  const exportAt = async (label: string) => {
    openExport();
    fireEvent.press(screen.getByText(label));
    await settle();
  };

  it('offers the three resolutions with their pixel sizes', async () => {
    await mount();
    expect(screen.queryByText('1080 × 1350')).toBeNull();

    openExport();

    expect(screen.getByText('1080 × 1350')).toBeOnTheScreen();
    expect(screen.getByText('2160 × 2700')).toBeOnTheScreen();
    expect(screen.getByText('4320 × 5400')).toBeOnTheScreen();
  });

  it('exports, saves write-only, counts the export on the palette, shares and closes the sheet', async () => {
    await mount();

    await exportAt('2×');

    expect(sharing.shareAsync).toHaveBeenCalledWith('file:///cache/out.png', { mimeType: 'image/png' });
    expect(exportPalette).toHaveBeenCalledWith(palette, palette.layoutConfig, '2x');
    expect(media.requestPermissionsAsync).toHaveBeenCalledWith(true);
    expect(media.saveToLibraryAsync).toHaveBeenCalledWith('file:///cache/out.png');
    expect(incrementExportCount).toHaveBeenCalledWith('p1');
    expect(trackEvent).toHaveBeenCalledWith('palette_exported', { palette_id: 'p1', resolution: '2x', archetype_id: 'pila' });
    expect(trackEvent).toHaveBeenCalledWith('palette_shared', { palette_id: 'p1' });
    expect(screen.queryByText('Exportar paleta')).toBeNull();
  });

  it('still counts the export on the palette when the share sheet is unavailable', async () => {
    sharing.isAvailableAsync.mockResolvedValue(false);
    await mount();

    await exportAt('1×');

    expect(incrementExportCount).toHaveBeenCalledWith('p1');
    expect(sharing.shareAsync).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalledWith('palette_shared', expect.anything());
  });

  it('asks the user to enable photo permission and does not count the export when denied', async () => {
    media.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);
    await mount();

    await exportAt('1×');

    expect(screen.getByText('Activa el permiso de fotos en Ajustes del dispositivo.')).toBeOnTheScreen();
    expect(media.saveToLibraryAsync).not.toHaveBeenCalled();
    expect(incrementExportCount).not.toHaveBeenCalled();
  });

  it('shows an error, reports to Sentry and does not count a failed export', async () => {
    (exportPalette as jest.Mock).mockRejectedValue(new Error('skia'));
    await mount();

    await exportAt('1×');

    expect(screen.getByText('No se pudo exportar la paleta. Intentalo de nuevo.')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(incrementExportCount).not.toHaveBeenCalled();
  });

  it('exports as many times as a free user wants at 1× and 2×', async () => {
    await mount();

    for (let i = 0; i < 5; i++) await exportAt(i % 2 ? '2×' : '1×');

    expect(exportPalette).toHaveBeenCalledTimes(5);
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('marks 4× as Pro and sends a free user to the paywall instead of exporting', async () => {
    await mount();
    openExport();
    expect(screen.getByText('Pro')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('4×'));
    await settle();

    expect(routerMock.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { trigger: 'resolution_locked' } });
    expect(exportPalette).not.toHaveBeenCalled();
    expect(screen.queryByText('Exportar paleta')).toBeNull();
  });

  it('lets premium users export at 4× with no Pro badge', async () => {
    useSettingsStore.setState({ subscriptionStatus: 'premium' });
    await mount();
    openExport();
    expect(screen.queryByText('Pro')).toBeNull();

    fireEvent.press(screen.getByText('4×'));
    await settle();

    expect(exportPalette).toHaveBeenCalledWith(palette, palette.layoutConfig, '4x');
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});

describe('PaletteScreen — delete and navigation', () => {
  const CONFIRM_TEXT = '¿Eliminar esta paleta? Esta acción no se puede deshacer.';
  const trash = () => screen.UNSAFE_root.findAll((n) => (n.type as unknown) === 'MaterialIcons' && n.props.name === 'delete')[0];
  const confirm = () => fireEvent.press(trash());

  it('asks for confirmation before deleting', async () => {
    await mount();
    expect(screen.queryByText(CONFIRM_TEXT)).toBeNull();

    confirm();

    expect(screen.getByText(CONFIRM_TEXT)).toBeOnTheScreen();
    expect(deletePalette).not.toHaveBeenCalled();
  });

  it('deletes, records it and returns to the home tab', async () => {
    await mount();
    confirm();

    fireEvent.press(screen.getByText('Eliminar'));
    await settle();

    expect(routerMock.replace).toHaveBeenCalledWith('/(tabs)');
    expect(deletePalette).toHaveBeenCalledWith('p1');
    expect(trackEvent).toHaveBeenCalledWith('palette_deleted', { palette_id: 'p1', source: 'detail' });
  });

  it('dismisses the whole stack when it can', async () => {
    routerMock.canDismiss.mockReturnValue(true);
    await mount();
    confirm();

    fireEvent.press(screen.getByText('Eliminar'));
    await settle();

    expect(routerMock.dismissAll).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('stays on the screen and reports when deleting fails', async () => {
    (deletePalette as jest.Mock).mockRejectedValue(new Error('locked'));
    await mount();
    confirm();

    fireEvent.press(screen.getByText('Eliminar'));
    await settle();

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(routerMock.dismissAll).not.toHaveBeenCalled();
    expect(screen.getByText('Eliminar')).toBeOnTheScreen();
  });

  it('"Cancelar" closes the confirmation without deleting', async () => {
    await mount();
    confirm();

    fireEvent.press(screen.getByText('Cancelar'));
    await settle();

    expect(deletePalette).not.toHaveBeenCalled();
    expect(screen.queryByText(CONFIRM_TEXT)).toBeNull();
  });

  it('"← Volver" goes back', async () => {
    await mount();

    fireEvent.press(screen.getByText('← Volver'));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });

  it('"← Volver" returns to the home tab when there is nothing to go back to (after a capture)', async () => {
    routerMock.canGoBack.mockReturnValue(false);
    await mount();

    fireEvent.press(screen.getByText('← Volver'));

    expect(routerMock.back).not.toHaveBeenCalled();
    expect(routerMock.replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('"Listo" returns to the home tab', async () => {
    await mount();

    fireEvent.press(screen.getByText('Listo'));

    expect(routerMock.replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('tapping the watermark opens the paywall tagged "watermark_tap" (free users)', async () => {
    await mount();
    const region = screen.UNSAFE_root.findAll((n) => (n.type as unknown) === 'View' && typeof n.props.onLayout === 'function')[0];
    fireEvent(region, 'layout', { nativeEvent: { layout: { width: 360, height: 450 } } });

    const overlay = screen.UNSAFE_getAllByType((Pressable as any).type).find((p) => typeof p.props.style !== 'function')!;
    fireEvent.press(overlay);

    expect(routerMock.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { trigger: 'watermark_tap' } });
  });
});
