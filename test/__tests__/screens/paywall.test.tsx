import * as Sentry from '@sentry/react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ActivityIndicator, Linking } from 'react-native';

import { trackEvent } from '@/lib/analytics/events';
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal';
import { getOfferings, purchasePackage, restorePurchases } from '@/lib/revenuecat/client';
import PaywallScreen from '@app/paywall';
import { resetRouterMocks, routerMock, searchParamsMock } from '@test/router';

jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/revenuecat/client', () => ({
  getOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
}));

const pkg = (identifier: string, packageType: string, priceString: string) => ({
  identifier, packageType, product: { priceString },
});
const MONTHLY = pkg('$rc_monthly', 'MONTHLY', '2,99 €');
const ANNUAL = pkg('$rc_annual', 'ANNUAL', '19,99 €');
const LIFETIME = pkg('$rc_lifetime', 'LIFETIME', '49,99 €');

const flush = () => act(async () => {});

function mount(packages = [MONTHLY, ANNUAL, LIFETIME], trigger?: string) {
  searchParamsMock.mockReturnValue(trigger ? { trigger } : {});
  (getOfferings as jest.Mock).mockResolvedValue({ availablePackages: packages });
  render(<PaywallScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetRouterMocks();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => jest.restoreAllMocks());

describe('PaywallScreen — plans', () => {
  it('lists every offered plan with its Spanish name and store price', async () => {
    mount();

    expect(await screen.findByText('Mensual')).toBeOnTheScreen();
    expect(screen.getByText('Anual')).toBeOnTheScreen();
    expect(screen.getByText('De por vida')).toBeOnTheScreen();
    expect(screen.getByText('2,99 €')).toBeOnTheScreen();
    expect(screen.getByText('49,99 €')).toBeOnTheScreen();
    expect(screen.getAllByText('Elegir')).toHaveLength(3);
  });

  it('falls back to the raw package type for an unknown plan', async () => {
    mount([pkg('$rc_weekly', 'WEEKLY', '0,99 €')]);

    expect(await screen.findByText('WEEKLY')).toBeOnTheScreen();
  });

  it('shows no plans (but still the restore link) when there is no current offering', async () => {
    (getOfferings as jest.Mock).mockResolvedValue(null);
    render(<PaywallScreen />);

    expect(await screen.findByText('Restaurar compras')).toBeOnTheScreen();
    expect(screen.queryByText('Elegir')).toBeNull();
  });

  it('shows a retry message and reports to Sentry when the plans cannot be loaded', async () => {
    (getOfferings as jest.Mock).mockRejectedValue(new Error('network'));
    render(<PaywallScreen />);

    expect(await screen.findByText('No se pudieron cargar los planes. Intentalo de nuevo.')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});

describe('PaywallScreen — analytics', () => {
  it('records the paywall view once with the trigger that opened it', async () => {
    mount(undefined, 'export_limit');
    await screen.findByText('Mensual');

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('paywall_shown', { trigger: 'export_limit' });
  });

  it('attributes a paywall opened without a trigger to "settings"', async () => {
    mount();
    await screen.findByText('Mensual');

    expect(trackEvent).toHaveBeenCalledWith('paywall_shown', { trigger: 'settings' });
  });

  it('records the dismissal and goes back when closed', async () => {
    mount(undefined, 'watermark_tap');
    fireEvent.press(await screen.findByText('Cerrar'));

    expect(trackEvent).toHaveBeenCalledWith('paywall_dismissed', { trigger: 'watermark_tap' });
    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });
});

describe('PaywallScreen — purchase', () => {
  it.each([
    ['monthly', MONTHLY, 0],
    ['annual', ANNUAL, 1],
    ['lifetime', LIFETIME, 2],
  ] as const)('buying the %s plan records it and closes the paywall', async (plan, selected, index) => {
    (purchasePackage as jest.Mock).mockResolvedValue({});
    mount(undefined, 'export_limit');

    fireEvent.press((await screen.findAllByText('Elegir'))[index]);

    await flush();

    expect(routerMock.back).toHaveBeenCalledTimes(1);
    expect(purchasePackage).toHaveBeenCalledWith(selected);
    expect(trackEvent).toHaveBeenCalledWith('subscription_purchased', { trigger: 'export_limit', plan });
  });

  it('stays open and silent when the user cancels the store dialog', async () => {
    (purchasePackage as jest.Mock).mockRejectedValue({ userCancelled: true });
    mount();

    fireEvent.press((await screen.findAllByText('Elegir'))[0]);

    await flush();

    expect(purchasePackage).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Elegir')).toHaveLength(3);
    expect(screen.queryByText(/No se pudo completar la compra/)).toBeNull();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(routerMock.back).not.toHaveBeenCalled();
  });

  it('shows an error under the plans and reports to Sentry when the purchase fails', async () => {
    (purchasePackage as jest.Mock).mockRejectedValue(new Error('billing unavailable'));
    mount();

    fireEvent.press((await screen.findAllByText('Elegir'))[0]);

    expect(await screen.findByText('No se pudo completar la compra. Intentalo de nuevo.')).toBeOnTheScreen();
    expect(screen.getByText('Mensual')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('blocks the other plans while one purchase is in progress', async () => {
    let finish!: (v: object) => void;
    (purchasePackage as jest.Mock).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    mount();
    const buttons = await screen.findAllByText('Elegir');

    fireEvent.press(buttons[0]);
    // <Button loading> swaps its label ("Procesando...") for a spinner, so the spinner marks the busy plan.
    expect(screen.UNSAFE_getAllByType(ActivityIndicator)).toHaveLength(1);
    screen.getAllByText('Elegir').forEach((other) => fireEvent.press(other));

    expect(screen.getAllByText('Elegir')).toHaveLength(2);
    expect(purchasePackage).toHaveBeenCalledTimes(1);
    await act(async () => { finish({}); });
  });
});

describe('PaywallScreen — restore and legal', () => {
  it('restores purchases, records it and closes', async () => {
    (restorePurchases as jest.Mock).mockResolvedValue({});
    mount();

    fireEvent.press(await screen.findByText('Restaurar compras'));

    await flush();

    expect(routerMock.back).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('subscription_restored', {});
  });

  it('shows an error and reports to Sentry when restoring fails', async () => {
    (restorePurchases as jest.Mock).mockRejectedValue(new Error('no account'));
    mount();

    fireEvent.press(await screen.findByText('Restaurar compras'));

    expect(await screen.findByText('No se pudieron restaurar las compras.')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(routerMock.back).not.toHaveBeenCalled();
  });

  it('links to the terms and the privacy policy (Apple 3.1.2)', async () => {
    mount();

    fireEvent.press(await screen.findByText('Condiciones de uso'));
    fireEvent.press(screen.getByText('Política de privacidad'));

    expect(Linking.openURL).toHaveBeenNthCalledWith(1, TERMS_URL);
    expect(Linking.openURL).toHaveBeenNthCalledWith(2, PRIVACY_URL);
  });
});
