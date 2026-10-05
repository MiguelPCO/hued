import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library/legacy';

import { useSettingsStore } from '@/lib/store/settingsStore';
import PaletteScreen from '@app/palette/[id]';
import { makeColors, makePalette } from '@test/factories';
import { peekPalette, resetFakePaletteDb, seedPalette } from '@test/fakePaletteDb';
import { resetRouterMocks, routerMock, searchParamsMock } from '@test/router';

jest.mock('@/lib/db/palettes', () => require('@test/fakePaletteDb'));
jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));

const media = MediaLibrary as jest.Mocked<typeof MediaLibrary>;
// Local calendar day, computed independently of the store (en-CA formats as YYYY-MM-DD).
const today = () => new Date().toLocaleDateString('en-CA');

// Drains the promise chains the screen starts (several awaits deep) inside act().
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => {});
};

async function openEditor() {
  seedPalette(makePalette({ id: 'p1', colors: makeColors(5) }));
  searchParamsMock.mockReturnValue({ id: 'p1' });
  render(<PaletteScreen />);
  await settle();
  expect(screen.getByText('Exportar')).toBeOnTheScreen();
}

// El editor está montado y suscrito al store: los cambios van dentro de act.
const setStore = (state: Partial<ReturnType<typeof useSettingsStore.getState>>) =>
  act(async () => { useSettingsStore.setState(state); });

async function exportOnce() {
  fireEvent.press(screen.getByText('Exportar'));
  fireEvent.press(screen.getByText('1×'));
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  resetFakePaletteDb();
  resetRouterMocks();
  useSettingsStore.setState({ subscriptionStatus: 'free', exportDailyCount: 0, exportDailyResetDate: today() });
});

describe('free-tier export gate across several exports', () => {
  it('allows three exports a day and sends the fourth to the paywall', async () => {
    await openEditor();

    for (let i = 1; i <= 3; i++) {
      await exportOnce();
      expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(i);
      expect(screen.queryByText('Exportar paleta')).toBeNull(); // la hoja se cierra tras exportar
    }
    expect(peekPalette('p1')!.exportCount).toBe(3);
    expect(routerMock.push).not.toHaveBeenCalled();

    await exportOnce();

    expect(routerMock.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { trigger: 'export_limit' } });
    expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(3);
    expect(peekPalette('p1')!.exportCount).toBe(3);
  });

  it('lets the same user export again after upgrading to premium', async () => {
    await openEditor();
    await setStore({ exportDailyCount: 3 });
    await exportOnce();
    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(media.saveToLibraryAsync).not.toHaveBeenCalled();

    await setStore({ subscriptionStatus: 'premium' });
    await exportOnce();

    expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledTimes(1);
  });

  it('gives the allowance back on the next day (regression: the counter used to stay at 3 forever)', async () => {
    await openEditor();
    await setStore({ exportDailyCount: 3, exportDailyResetDate: '2000-01-01' });

    await exportOnce();

    expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(1);
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().exportDailyCount).toBe(1);
    expect(useSettingsStore.getState().exportDailyResetDate).toBe(today());
  });

  it('does not spend the allowance when the photo permission is denied', async () => {
    media.requestPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
    await openEditor();

    await exportOnce();

    expect(screen.getByText('Activa el permiso de fotos en Ajustes del dispositivo.')).toBeOnTheScreen();
    expect(media.saveToLibraryAsync).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().exportDailyCount).toBe(0);
    expect(peekPalette('p1')!.exportCount).toBe(0);

    // contraprueba: con permiso, el mismo gesto sí gasta el cupo
    await exportOnce();
    expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().exportDailyCount).toBe(1);
    expect(peekPalette('p1')!.exportCount).toBe(1);
  });
});
