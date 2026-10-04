const ENV_KEY = 'EXPO_PUBLIC_POSTHOG_KEY';
const original = process.env[ENV_KEY];

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
});

function load(key?: string) {
  if (key === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = key;
  let mod!: typeof import('../posthog');
  let PostHog!: jest.Mock;
  jest.isolateModules(() => {
    PostHog = require('posthog-react-native').default;
    mod = require('../posthog');
  });
  return { mod, PostHog };
}

describe('posthog client', () => {
  it('is null and never constructs a client without a key', () => {
    const { mod, PostHog } = load();

    expect(mod.posthog).toBeNull();
    expect(PostHog).not.toHaveBeenCalled();
  });

  it('is null for an empty key (empty = disabled, like Sentry and RevenueCat)', () => {
    const { mod } = load('');

    expect(mod.posthog).toBeNull();
  });

  it('constructs the EU client with the configured key', () => {
    const { mod, PostHog } = load('phc_test_key');

    expect(mod.posthog).not.toBeNull();
    expect(PostHog).toHaveBeenCalledWith('phc_test_key', expect.objectContaining({ host: 'https://eu.i.posthog.com' }));
  });

  it('starts opted out: nothing is captured until the user accepts (art. 22.2 LSSI)', () => {
    const { PostHog } = load('phc_test_key');

    expect(PostHog.mock.calls[0][1].defaultOptIn).toBe(false);
  });

  it('disables the requests that optOut would not stop (flags, remote config, surveys)', () => {
    const { PostHog } = load('phc_test_key');

    expect(PostHog.mock.calls[0][1]).toMatchObject({
      preloadFeatureFlags: false,
      disableRemoteConfig: true,
      disableSurveys: true,
    });
  });
});
