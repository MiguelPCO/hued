import PostHog from 'posthog-react-native';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;

// Only construct the client when a real key is configured — trackEvent()
// already no-ops without one, and PostHog's storage probe can throw at
// construction time (e.g. no storage backend on web), which would otherwise
// take down the whole app since this is rendered at the root layout.
// defaultOptIn: false → no captura eventos hasta que el usuario lo active en Ajustes (art. 22.2 LSSI).
// PostHog guarda la elección de optIn()/optOut() entre sesiones. optOut no frena flags, remote config
// ni encuestas, que se piden al arrancar (flags con el id del dispositivo); la app no los usa → apagados.
export const posthog = POSTHOG_KEY
  ? new PostHog(POSTHOG_KEY, {
      host: 'https://eu.i.posthog.com',
      defaultOptIn: false,
      preloadFeatureFlags: false,
      disableRemoteConfig: true,
      disableSurveys: true,
    })
  : null;
