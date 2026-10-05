import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { generateScatterLayout } from '@/components/compose/archetypes/freeformLayout';
import { useSettingsStore } from '@/lib/store/settingsStore';
import PaletteScreen from '@app/palette/[id]';
import { makeColors, makePalette } from '@test/factories';
import { peekPalette, resetFakePaletteDb, seedPalette } from '@test/fakePaletteDb';
import { resetRouterMocks, searchParamsMock } from '@test/router';

jest.mock('@/lib/db/palettes', () => require('@test/fakePaletteDb'));
jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/color/extract', () => ({
  ...jest.requireActual('@/lib/color/extract'),
  extractColors: jest.fn((_uri: string, n = 5) => Promise.resolve(require('@test/factories').makeColors(n))),
}));

// Drains the promise chains the screen starts (several awaits deep) inside act().
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => {});
};
const advance = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });

async function open() {
  searchParamsMock.mockReturnValue({ id: 'p1' });
  const view = render(<PaletteScreen />);
  await settle();
  expect(screen.getByText('Exportar')).toBeOnTheScreen();
  return view;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetFakePaletteDb();
  resetRouterMocks();
  useSettingsStore.setState({ subscriptionStatus: 'free' });
  seedPalette(makePalette({ id: 'p1', colors: makeColors(5) }));
});

afterEach(() => jest.useRealTimers());

describe('what the editor saves is what it loads next time', () => {
  it('keeps the Libre archetype and its generated layout after closing and reopening', async () => {
    const first = await open();
    expect(screen.queryByText('Restablecer layout')).toBeNull(); // contraprueba: antes de elegir Libre no está
    fireEvent.press(screen.getByText('Libre'));
    await advance(500);
    first.unmount();

    await open();

    expect(screen.getByText('Restablecer layout')).toBeOnTheScreen(); // Libre sigue activo
    expect(peekPalette('p1')!.layoutConfig.archetypeId).toBe('libre');
    expect(peekPalette('p1')!.layoutConfig.freeformSwatches).toEqual(generateScatterLayout(5, 360, 450));
  });

  it('saves a pending edit when the editor is closed within the debounce window', async () => {
    const first = await open();
    fireEvent.press(screen.getByText('Tipografía'));
    fireEvent.press(screen.getByText('Técnica'));
    expect(peekPalette('p1')!.layoutConfig.fontFamily).toBe('sans'); // todavía no guardado

    first.unmount(); // sin esperar 500 ms

    expect(peekPalette('p1')!.layoutConfig.fontFamily).toBe('mono');
  });

  it('remembers the chosen palette size and regenerates the Libre swatches for it (ADR-0001)', async () => {
    seedPalette(
      makePalette({
        id: 'p1',
        colors: makeColors(5),
        layoutConfig: { ...makePalette().layoutConfig, archetypeId: 'libre', freeformSwatches: generateScatterLayout(5, 360, 450) },
      })
    );
    const first = await open();

    fireEvent.press(screen.getByText('Colores'));
    fireEvent.press(screen.getByText('8'));
    await settle();
    await advance(500);
    first.unmount();

    await open();

    const saved = peekPalette('p1')!;
    expect(saved.layoutConfig.paletteSize).toBe(8);
    expect(saved.colors).toHaveLength(8);
    expect(saved.layoutConfig.freeformSwatches).toEqual(generateScatterLayout(8, 360, 450)); // reiniciado a [] y resembrado por el efecto de Libre
    fireEvent.press(screen.getByText('Colores'));
    expect(screen.getByText('8 colores')).toBeOnTheScreen();
  });

  it('opens a palette saved before paletteSize existed with the default of 5', async () => {
    const legacy = makePalette({ id: 'p1', colors: makeColors(5) });
    const oldLayout: Record<string, unknown> = { ...legacy.layoutConfig };
    delete oldLayout.paletteSize;
    delete oldLayout.freeformSwatches;
    seedPalette({ ...legacy, layoutConfig: oldLayout as never });
    expect(peekPalette('p1')!.layoutConfig).not.toHaveProperty('paletteSize'); // la fila guardada de verdad no lo tiene

    await open();
    fireEvent.press(screen.getByText('Colores'));

    expect(screen.getByText('5 colores')).toBeOnTheScreen();
  });
});
