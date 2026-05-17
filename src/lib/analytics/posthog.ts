import PostHog from 'posthog-react-native';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';

export const posthog = new PostHog(POSTHOG_KEY || 'phc_placeholder', {
  host: 'https://eu.i.posthog.com',
});
