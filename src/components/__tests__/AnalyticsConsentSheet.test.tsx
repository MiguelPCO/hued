import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Modal } from 'react-native';

import { useSettingsStore } from '@/lib/store/settingsStore';
import { AnalyticsConsentSheet } from '../AnalyticsConsentSheet';

let mockPosthog: { optIn: jest.Mock; optOut: jest.Mock } | null = null;
jest.mock('@/lib/analytics/posthog', () => ({
  get posthog() {
    return mockPosthog;
  },
}));

const TITLE = '¿Nos ayudas a mejorar Hued?';

beforeEach(() => {
  mockPosthog = { optIn: jest.fn(), optOut: jest.fn() };
  useSettingsStore.setState({ analyticsPromptShown: false });
});

describe('AnalyticsConsentSheet', () => {
  it('asks for consent on first launch when analytics is configured', () => {
    render(<AnalyticsConsentSheet />);

    expect(screen.getByText(TITLE)).toBeOnTheScreen();
    expect(screen.getByText('Aceptar')).toBeOnTheScreen();
    expect(screen.getByText('No, gracias')).toBeOnTheScreen();
  });

  it('stays hidden when no PostHog key is configured (nothing to consent to)', () => {
    mockPosthog = null;

    render(<AnalyticsConsentSheet />);

    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('stays hidden once the prompt was already answered', () => {
    useSettingsStore.setState({ analyticsPromptShown: true });

    render(<AnalyticsConsentSheet />);

    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('accepting opts in, records the answer and closes the sheet', () => {
    render(<AnalyticsConsentSheet />);

    fireEvent.press(screen.getByText('Aceptar'));

    expect(mockPosthog?.optIn).toHaveBeenCalledTimes(1);
    expect(mockPosthog?.optOut).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().analyticsPromptShown).toBe(true);
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('declining opts out and records the answer', () => {
    render(<AnalyticsConsentSheet />);

    fireEvent.press(screen.getByText('No, gracias'));

    expect(mockPosthog?.optOut).toHaveBeenCalledTimes(1);
    expect(mockPosthog?.optIn).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().analyticsPromptShown).toBe(true);
  });

  it('dismissing the sheet without choosing counts as a refusal', () => {
    render(<AnalyticsConsentSheet />);

    act(() => {
      screen.UNSAFE_getByType(Modal).props.onRequestClose();
    });

    expect(mockPosthog?.optOut).toHaveBeenCalledTimes(1);
    expect(mockPosthog?.optIn).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().analyticsPromptShown).toBe(true);
  });

  it('explains that photos and colors are never collected', () => {
    render(<AnalyticsConsentSheet />);

    expect(screen.getByText(/Nunca incluye tus fotos ni tus colores/)).toBeOnTheScreen();
  });
});
