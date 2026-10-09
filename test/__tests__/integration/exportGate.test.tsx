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

async function exportAt(label: string) {
  fireEvent.press(screen.getByText('Exportar'));
  fireEvent.press(screen.getByText(label));
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  resetFakePaletteDb();
  resetRouterMocks();
  useSettingsStore.setState({ subscriptionStatus: 'free' });
});

describe('free-tier export gate across several exports', () => {
  it('lets a free user export without a daily limit at 1× and 2×', async () => {
    await openEditor();

    for (let i = 1; i <= 5; i++) {
      await exportAt(i % 2 ? '1×' : '2×');
      expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(i);
      expect(screen.queryByText('Exportar paleta')).toBeNull(); // la hoja se cierra tras exportar
    }

    expect(peekPalette('p1')!.exportCount).toBe(5);
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('sends a free user tapping 4× to the paywall, and lets the same user export it after upgrading', async () => {
    await openEditor();

    await exportAt('4×');

    expect(routerMock.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { trigger: 'resolution_locked' } });
    expect(media.saveToLibraryAsync).not.toHaveBeenCalled();
    expect(peekPalette('p1')!.exportCount).toBe(0);

    await setStore({ subscriptionStatus: 'premium' });
    await exportAt('4×');

    expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(peekPalette('p1')!.exportCount).toBe(1);
  });

  it('does not count the export when the photo permission is denied', async () => {
    media.requestPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
    await openEditor();

    await exportAt('1×');

    expect(screen.getByText('Activa el permiso de fotos en Ajustes del dispositivo.')).toBeOnTheScreen();
    expect(media.saveToLibraryAsync).not.toHaveBeenCalled();
    expect(peekPalette('p1')!.exportCount).toBe(0);

    // contraprueba: con permiso, el mismo gesto sí guarda y cuenta
    await exportAt('1×');
    expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(1);
    expect(peekPalette('p1')!.exportCount).toBe(1);
  });
});
