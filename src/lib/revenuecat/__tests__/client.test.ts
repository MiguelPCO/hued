import type { PurchasesPackage } from 'react-native-purchases';

const ENV_KEY = 'EXPO_PUBLIC_REVENUECAT_API_KEY';
const EXPIRES = '2027-01-01T00:00:00.000Z';

const premiumInfo = { entitlements: { active: { hued_pro: { expirationDate: EXPIRES } } } };
const lifetimeInfo = { entitlements: { active: { hued_pro: { expirationDate: null } } } };
const freeInfo = { entitlements: { active: {} } };

const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

afterEach(() => {
  delete process.env[ENV_KEY];
});

// `initialized` es una variable de módulo: un registro nuevo por test.
function load(apiKey?: string) {
  if (apiKey === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = apiKey;
  let client!: typeof import('../client');
  let Purchases!: Record<string, jest.Mock>;
  let store!: typeof import('@/lib/store/settingsStore').useSettingsStore;
  jest.isolateModules(() => {
    Purchases = require('react-native-purchases').default;
    store = require('@/lib/store/settingsStore').useSettingsStore;
    client = require('../client');
  });
  return { client, Purchases, store };
}

describe('init', () => {
  it('does nothing without an API key', () => {
    const { client, Purchases } = load();

    client.init();

    expect(Purchases.configure).not.toHaveBeenCalled();
    expect(Purchases.addCustomerInfoUpdateListener).not.toHaveBeenCalled();
  });

  it('configures the SDK once even if called repeatedly', () => {
    const { client, Purchases } = load('rc_test');

    client.init();
    client.init();

    expect(Purchases.configure).toHaveBeenCalledTimes(1);
    expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: 'rc_test' });
    expect(Purchases.addCustomerInfoUpdateListener).toHaveBeenCalledTimes(1);
  });

  it('enables verbose logging in development builds', () => {
    const { client, Purchases } = load('rc_test');

    client.init();

    expect(Purchases.setLogLevel).toHaveBeenCalledWith('DEBUG');
  });

  it('syncs the entitlement into the store on cold start', async () => {
    const { client, Purchases, store } = load('rc_test');
    Purchases.getCustomerInfo.mockResolvedValueOnce(premiumInfo);

    client.init();
    await flushPromises();

    expect(store.getState().subscriptionStatus).toBe('premium');
    expect(store.getState().subscriptionExpiresAt).toBe(new Date(EXPIRES).getTime());
  });

  it('keeps the persisted state when the cold-start sync fails (offline)', async () => {
    const { client, Purchases, store } = load('rc_test');
    store.setState({ subscriptionStatus: 'premium', subscriptionExpiresAt: 5 });
    Purchases.getCustomerInfo.mockRejectedValueOnce(new Error('offline'));

    client.init();
    await flushPromises();

    expect(store.getState().subscriptionStatus).toBe('premium');
    expect(store.getState().subscriptionExpiresAt).toBe(5);
  });

  it('applies later entitlement changes pushed by the SDK (renewals, expirations)', async () => {
    const { client, Purchases, store } = load('rc_test');
    client.init();
    await flushPromises();
    const listener = Purchases.addCustomerInfoUpdateListener.mock.calls[0][0];

    listener(premiumInfo);
    expect(store.getState().subscriptionStatus).toBe('premium');

    listener(freeInfo);
    expect(store.getState().subscriptionStatus).toBe('free');
    expect(store.getState().subscriptionExpiresAt).toBeNull();
  });
});

describe('getOfferings', () => {
  it('returns the current offering', async () => {
    const { client, Purchases } = load('rc_test');
    Purchases.getOfferings.mockResolvedValueOnce({ current: { identifier: 'default' } });

    await expect(client.getOfferings()).resolves.toEqual({ identifier: 'default' });
  });

  it('returns null when there is no current offering', async () => {
    const { client, Purchases } = load('rc_test');
    Purchases.getOfferings.mockResolvedValueOnce({ current: null });

    await expect(client.getOfferings()).resolves.toBeNull();
  });

  it('propagates SDK errors so the paywall can show them', async () => {
    const { client, Purchases } = load('rc_test');
    Purchases.getOfferings.mockRejectedValueOnce(new Error('network'));

    await expect(client.getOfferings()).rejects.toThrow('network');
  });
});

describe('purchasePackage', () => {
  const pkg = { identifier: '$rc_monthly' } as PurchasesPackage;

  it('writes the new entitlement to the store before returning', async () => {
    const { client, Purchases, store } = load('rc_test');
    Purchases.purchasePackage.mockResolvedValueOnce({ customerInfo: premiumInfo });

    const info = await client.purchasePackage(pkg);

    expect(Purchases.purchasePackage).toHaveBeenCalledWith(pkg);
    expect(info).toBe(premiumInfo);
    expect(store.getState().subscriptionStatus).toBe('premium');
  });

  it('stores a lifetime purchase without an expiry date', async () => {
    const { client, Purchases, store } = load('rc_test');
    Purchases.purchasePackage.mockResolvedValueOnce({ customerInfo: lifetimeInfo });

    await client.purchasePackage(pkg);

    expect(store.getState().subscriptionStatus).toBe('premium');
    expect(store.getState().subscriptionExpiresAt).toBeNull();
  });

  it('leaves the store untouched when the purchase is cancelled or fails', async () => {
    const { client, Purchases, store } = load('rc_test');
    Purchases.purchasePackage.mockRejectedValueOnce(Object.assign(new Error('cancelled'), { userCancelled: true }));

    await expect(client.purchasePackage(pkg)).rejects.toMatchObject({ userCancelled: true });

    expect(store.getState().subscriptionStatus).toBe('free');
  });
});

describe('restorePurchases', () => {
  it('writes the restored entitlement to the store', async () => {
    const { client, Purchases, store } = load('rc_test');
    Purchases.restorePurchases.mockResolvedValueOnce(premiumInfo);

    await client.restorePurchases();

    expect(store.getState().subscriptionStatus).toBe('premium');
  });

  it('downgrades to free when nothing is restored', async () => {
    const { client, Purchases, store } = load('rc_test');
    store.setState({ subscriptionStatus: 'premium', subscriptionExpiresAt: 99 });
    Purchases.restorePurchases.mockResolvedValueOnce(freeInfo);

    await client.restorePurchases();

    expect(store.getState().subscriptionStatus).toBe('free');
    expect(store.getState().subscriptionExpiresAt).toBeNull();
  });
});
