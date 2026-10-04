import { trackEvent } from '../events';
import { posthog } from '../posthog';

jest.mock('../posthog', () => ({ posthog: { capture: jest.fn() } }));

const capture = (posthog as unknown as { capture: jest.Mock }).capture;

beforeEach(() => capture.mockClear());

describe('trackEvent', () => {
  it('forwards the event name and its props to PostHog', () => {
    trackEvent('paywall_shown', { trigger: 'export_limit' });

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('paywall_shown', { trigger: 'export_limit' });
  });

  it('sends events without extra properties unchanged', () => {
    trackEvent('subscription_restored', {});

    expect(capture).toHaveBeenCalledWith('subscription_restored', {});
  });

  it('is a silent no-op when PostHog is not configured', () => {
    jest.isolateModules(() => {
      jest.doMock('../posthog', () => ({ posthog: null }));
      const { trackEvent: isolatedTrackEvent } = require('../events');

      expect(() => isolatedTrackEvent('app_opened', { source: 'cold_start' })).not.toThrow();
    });
  });
});
