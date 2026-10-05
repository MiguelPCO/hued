import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Switch } from 'react-native';

import { AnalyticsConsentSheet } from '@/components/AnalyticsConsentSheet';
import { useSettingsStore } from '@/lib/store/settingsStore';
import SettingsScreen from '@app/(tabs)/settings';
import { resetRouterMocks } from '@test/router';

interface FakePosthog {
  optedOut: boolean;
  optIn: jest.Mock;
  optOut: jest.Mock;
  ready: jest.Mock;
  capture: jest.Mock;
}

let mockPosthog: FakePosthog | null = null;
jest.mock('@/lib/analytics/posthog', () => ({
  get posthog() {
    return mockPosthog;
  },
}));

// PostHog real: opt-in apagado hasta que se acepta; optIn/optOut cambian `optedOut`.
function makePosthog(): FakePosthog {
  const ph: FakePosthog = {
    optedOut: true,
    optIn: jest.fn(() => { ph.optedOut = false; }),
    optOut: jest.fn(() => { ph.optedOut = true; }),
    ready: jest.fn(() => Promise.resolve()),
    capture: jest.fn(),
  };
  return ph;
}

const TITLE = '¿Nos ayudas a mejorar Hued?';
const persisted = () => JSON.parse(globalThis.__HUED_MMKV__!.get('settings')!).state;
const settle = async () => {
  for (let i = 0; i < 3; i++) await act(async () => {});
};

beforeEach(() => {
  jest.clearAllMocks();
  resetRouterMocks();
  mockPosthog = makePosthog();
  useSettingsStore.setState({ analyticsPromptShown: false });
});

describe('analytics consent, end to end', () => {
  it('asks once, and accepting turns analytics on everywhere', async () => {
    const first = render(<AnalyticsConsentSheet />);
    expect(screen.getByText(TITLE)).toBeOnTheScreen();
    expect(mockPosthog!.optedOut).toBe(true); // nada se captura antes de aceptar

    fireEvent.press(screen.getByText('Aceptar'));

    expect(mockPosthog!.optedOut).toBe(false);
    expect(persisted().analyticsPromptShown).toBe(true); // se restaurará en el próximo arranque
    first.unmount();

    // la pantalla de Ajustes (que se monta después) refleja la elección
    render(<SettingsScreen />);
    await settle();
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(true);
  });

  it('declining keeps analytics off and the switch off', async () => {
    render(<AnalyticsConsentSheet />);

    fireEvent.press(screen.getByText('No, gracias'));

    expect(mockPosthog!.optedOut).toBe(true);
    expect(mockPosthog!.optOut).toHaveBeenCalledTimes(1);
    expect(persisted().analyticsPromptShown).toBe(true);
    render(<SettingsScreen />);
    await settle();
    expect(mockPosthog!.ready).toHaveBeenCalled();
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(false);
  });

  it('can be changed later from Settings without asking again', async () => {
    const first = render(<AnalyticsConsentSheet />);
    expect(screen.getByText(TITLE)).toBeOnTheScreen();
    fireEvent.press(screen.getByText('No, gracias'));
    first.unmount(); // el sheet original desaparece: lo que sigue es un montaje nuevo
    render(<SettingsScreen />);
    await settle();

    fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', true);

    expect(mockPosthog!.optedOut).toBe(false);
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(true);
    expect(screen.queryByText(TITLE)).toBeNull();

    render(<AnalyticsConsentSheet />); // un montaje nuevo ya no vuelve a preguntar
    await settle();
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('never asks when analytics is not configured', () => {
    mockPosthog = null;

    render(<AnalyticsConsentSheet />);

    expect(screen.queryByText(TITLE)).toBeNull();
    expect(useSettingsStore.getState().analyticsPromptShown).toBe(false);
  });
});
