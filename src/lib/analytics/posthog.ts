import PostHog from 'posthog-react-native';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;

// Only construct the client when a real key is configured — trackEvent()
// already no-ops without one, and PostHog's storage probe can throw at
// construction time (e.g. no storage backend on web), which would otherwise
// take down the whole app since this is rendered at the root layout.
export const posthog = POSTHOG_KEY
  ? new PostHog(POSTHOG_KEY, { host: 'https://eu.i.posthog.com' })
  : null;
