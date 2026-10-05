import * as Sentry from '@sentry/react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { generateScatterLayout } from '@/components/compose/archetypes/freeformLayout';
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
const today = () => new Date().toISOString().slice(0, 10);

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
  useSettingsStore.setState({ subscriptionStatus: 'free', exportDailyCount: 0, exportDailyResetDate: today() });
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

  // Plain guard for H-07: pins the two states the it.failing below sits between, so a wrong-reason
  // throw (it.failing passes on ANY error) cannot masquerade as the intended failure.
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

  // H-07: `getPalette(id).then(...)` no tiene `catch`/`finally`: si la base de datos falla,
  // `setLoading(false)` no llega a ejecutarse y la pantalla queda en spinner para siempre.
  // Se simula con un thenable que entrega el fallo solo por el manejador de rechazo que reciba:
  // con el `.then(cb)` actual no hay ninguno (sin `unhandledRejection` que rompa el worker de
  // Jest) y el spinner se queda; con `await` + `finally` o `.then(cb, onErr)` el fallo llega al
  // manejador y el test pasa a fallar ("expected to fail"), señal de que H-07 está arreglado.
  // La aserción no depende del texto que muestre un arreglo: solo exige que el spinner se vaya.
  it.failing('leaves the spinner when the database fails (H-07)', async () => {
    searchParamsMock.mockReturnValue({ id: 'p1' });
    (getPalette as jest.Mock).mockReturnValue({
      then: (_ok: unknown, fail?: (e: Error) => void) => {
        fail?.(new Error('db'));
        return Promise.resolve();
      },
    });

    render(<PaletteScreen />);
    await settle();

    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
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
  const openFonts = () => fireEvent.press(screen.getByText('Tipografía'));

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
  it('seeds a scatter layout the first time Libre is chosen', async () => {
    await mount();

    fireEvent.press(screen.getByText('Libre'));
    await advance(500);

    expect(lastWrite()).toMatchObject({
      archetypeId: 'libre',
      freeformSwatches: generateScatterLayout(5, 360, 450),
    });
  });

  it('does not rewrite swatches that already match the colors', async () => {
    const custom = makeLayoutConfig({
      archetypeId: 'libre',
      freeformSwatches: generateScatterLayout(5, 360, 450).map((s) => ({ ...s, x: s.x + 1 })),
    });
    await mount(makePalette({ id: 'p1', colors: makeColors(5), layoutConfig: custom }));

    await advance(1000);

    expect(updatePaletteLayout).not.toHaveBeenCalled();
  });

  it('"Restablecer layout" regenerates the scatter and records the event', async () => {
    const custom = makeLayoutConfig({
      archetypeId: 'libre',
      freeformSwatches: generateScatterLayout(5, 360, 450).map((s) => ({ ...s, x: s.x + 1 })),
    });
    await mount(makePalette({ id: 'p1', colors: makeColors(5), layoutConfig: custom }));

    fireEvent.press(screen.getByText('Restablecer layout'));
    await advance(500);

    expect(lastWrite().freeformSwatches).toEqual(generateScatterLayout(5, 360, 450));
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'freeformSwatches_reset' });
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

  it('exports, saves write-only, counts the export, shares and closes the sheet', async () => {
    await mount();

    await exportAt('2×');

    expect(sharing.shareAsync).toHaveBeenCalledWith('file:///cache/out.png', { mimeType: 'image/png' });
    expect(exportPalette).toHaveBeenCalledWith(palette, palette.layoutConfig, '2x');
    expect(media.requestPermissionsAsync).toHaveBeenCalledWith(true);
    expect(media.saveToLibraryAsync).toHaveBeenCalledWith('file:///cache/out.png');
    expect(incrementExportCount).toHaveBeenCalledWith('p1');
    expect(useSettingsStore.getState().exportDailyCount).toBe(1);
    expect(trackEvent).toHaveBeenCalledWith('palette_exported', { palette_id: 'p1', resolution: '2x', archetype_id: 'strip' });
    expect(trackEvent).toHaveBeenCalledWith('palette_shared', { palette_id: 'p1' });
    expect(screen.queryByText('Exportar paleta')).toBeNull();
  });

  it('still counts the export when the share sheet is unavailable', async () => {
    sharing.isAvailableAsync.mockResolvedValue(false);
    await mount();

    await exportAt('1×');

    expect(useSettingsStore.getState().exportDailyCount).toBe(1);
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
    expect(useSettingsStore.getState().exportDailyCount).toBe(0);
  });

  it('shows an error, reports to Sentry and does not count a failed export', async () => {
    (exportPalette as jest.Mock).mockRejectedValue(new Error('skia'));
    await mount();

    await exportAt('1×');

    expect(screen.getByText('No se pudo exportar la paleta. Intentalo de nuevo.')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().exportDailyCount).toBe(0);
  });

  it('sends a free user at the daily limit to the paywall instead of exporting', async () => {
    useSettingsStore.setState({ exportDailyCount: 3 });
    await mount();

    await exportAt('1×');

    expect(routerMock.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { trigger: 'export_limit' } });
    expect(exportPalette).not.toHaveBeenCalled();
    expect(screen.queryByText('Exportar paleta')).toBeNull();
  });

  it('lets premium users export past the daily limit', async () => {
    useSettingsStore.setState({ subscriptionStatus: 'premium', exportDailyCount: 99 });
    await mount();

    await exportAt('1×');

    expect(exportPalette).toHaveBeenCalledTimes(1);
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('resets the daily counter on a new day before checking the limit', async () => {
    useSettingsStore.setState({ exportDailyCount: 3, exportDailyResetDate: '2000-01-01' });
    await mount();

    await exportAt('1×');

    expect(exportPalette).toHaveBeenCalledTimes(1);
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().exportDailyCount).toBe(1);
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
