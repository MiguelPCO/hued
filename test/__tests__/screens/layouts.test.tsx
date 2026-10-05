import * as fs from 'fs';
import * as path from 'path';

import * as Sentry from '@sentry/react-native';
import { render } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import type { ReactElement } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { trackEvent } from '@/lib/analytics/events';
import { init as initRevenueCat } from '@/lib/revenuecat/client';
import { Colors } from '@/lib/tokens';
import RootLayout from '@app/_layout';
import TabLayout from '@app/(tabs)/_layout';
import { findAll } from '@test/skiaTree';

let mockPosthog: object | null = null;
jest.mock('@/lib/analytics/posthog', () => ({
  get posthog() {
    return mockPosthog;
  },
}));
jest.mock('posthog-react-native', () => {
  const { createElement } = require('react');
  return {
    __esModule: true,
    default: jest.fn(),
    PostHogProvider: ({ children }: { children?: unknown }) => createElement('PostHogProvider', null, children),
  };
});
jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'GestureHandlerRootView' }));
jest.mock('@expo-google-fonts/fraunces', () => ({
  Fraunces_500Medium: 'f500', Fraunces_600SemiBold: 'f600', Fraunces_500Medium_Italic: 'f500i',
}));
jest.mock('@expo-google-fonts/jetbrains-mono', () => ({ JetBrainsMono_400Regular: 'jb400' }));
jest.mock('@expo-google-fonts/outfit', () => ({
  Outfit_400Regular: 'o400', Outfit_500Medium: 'o500', Outfit_600SemiBold: 'o600', Outfit_700Bold: 'o700',
}));
jest.mock('@/lib/revenuecat/client', () => ({ init: jest.fn() }));
jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('@/components/AnalyticsConsentSheet', () => {
  const { createElement } = require('react');
  return { AnalyticsConsentSheet: () => createElement('ConsentSheet') };
});

const APP_DIR = path.resolve(__dirname, '../../../app');

function routeFileExists(name: string): boolean {
  return [`${name}.tsx`, path.join(name, 'index.tsx'), path.join(name, '_layout.tsx')].some((relative) =>
    fs.existsSync(path.join(APP_DIR, relative))
  );
}

// No se limpian los mocks de módulo (`Sentry.init`, `initRevenueCat`, `preventAutoHideAsync`):
// se llaman una sola vez al importar el layout y se comprueban abajo.
beforeEach(() => {
  mockPosthog = null;
  (trackEvent as jest.Mock).mockClear();
  (SplashScreen.hideAsync as jest.Mock).mockClear();
  (useFonts as jest.Mock).mockReset();
  (useFonts as jest.Mock).mockReturnValue([true, null]);
});

describe('RootLayout — startup', () => {
  it('configures Sentry, RevenueCat and holds the splash screen when the module loads', () => {
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ tracesSampleRate: 0.2 }));
    expect(initRevenueCat).toHaveBeenCalledTimes(1);
    expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while the fonts are loading and keeps the splash screen', () => {
    (useFonts as jest.Mock).mockReturnValue([false, null]);

    const view = render(<RootLayout />);

    expect(view.toJSON()).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('hides the splash screen once the fonts load', () => {
    render(<RootLayout />);

    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('still starts when a font fails to load (system font fallback)', () => {
    (useFonts as jest.Mock).mockReturnValue([false, new Error('font')]);

    const view = render(<RootLayout />);

    expect(view.toJSON()).not.toBeNull();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('records the cold start', () => {
    render(<RootLayout />);

    expect(trackEvent).toHaveBeenCalledWith('app_opened', { source: 'cold_start' });
  });

  it('loads the four font families the design tokens reference', () => {
    render(<RootLayout />);

    const families = Object.keys((useFonts as jest.Mock).mock.calls[0][0]);
    expect(families).toEqual(
      expect.arrayContaining(['Outfit', 'Fraunces', 'Fraunces-Italic', 'JetBrainsMono'])
    );
  });
});

describe('RootLayout — structure', () => {
  it('asks for analytics consent over the app and uses dark status-bar icons', () => {
    const json = render(<RootLayout />).toJSON();

    expect(findAll(json, 'ConsentSheet')).toHaveLength(1);
    expect(findAll(json, 'StatusBar')[0].props.style).toBe('dark');
  });

  it('wraps the app in PostHogProvider only when analytics is configured', () => {
    expect(findAll(render(<RootLayout />).toJSON(), 'PostHogProvider')).toHaveLength(0);

    mockPosthog = {};
    expect(findAll(render(<RootLayout />).toJSON(), 'PostHogProvider')).toHaveLength(1);
  });

  it('registers the tabs, the editor card and the paywall modal', () => {
    const screens = findAll(render(<RootLayout />).toJSON(), 'StackScreen');

    expect(screens.map((s) => s.props.name)).toEqual(['(tabs)', 'palette/[id]', 'paywall']);
    expect(Object.fromEntries(screens.map((s) => [s.props.name, (s.props.options as { presentation?: string } | undefined)?.presentation]))).toEqual({
      '(tabs)': undefined,
      'palette/[id]': 'card',
      paywall: 'modal',
    });
  });

  it('the route-file helper finds the routes that do exist and rejects one that does not (guards the H-02 check below)', () => {
    const registered = findAll(render(<RootLayout />).toJSON(), 'StackScreen').map((s) => String(s.props.name));

    expect(registered.filter((name) => routeFileExists(name))).toEqual(['(tabs)', 'palette/[id]', 'paywall']);
    expect(routeFileExists('no-such-route')).toBe(false);
  });

  // H-02 (corregido): `onboarding` estaba registrada sin `app/onboarding.tsx`; expo-router
  // avisaba de la ruta inexistente. Se quitó el registro hasta que exista la pantalla.
  it('every registered Stack.Screen has a route file (H-02)', () => {
    const names = findAll(render(<RootLayout />).toJSON(), 'StackScreen').map((s) => String(s.props.name));

    expect(names.filter((name) => !routeFileExists(name))).toEqual([]);
  });
});

describe('TabLayout', () => {
  const tabs = () => findAll(render(<TabLayout />).toJSON(), 'TabsScreen');

  it('declares Paletas, Capturar and Ajustes in that order', () => {
    expect(tabs().map((t) => [t.props.name, (t.props.options as { title: string }).title])).toEqual([
      ['index', 'Paletas'],
      ['capture', 'Capturar'],
      ['settings', 'Ajustes'],
    ]);
  });

  it.each(['index', 'capture', 'settings'])('"%s" has a route file in app/(tabs)', (name) => {
    expect(fs.existsSync(path.join(APP_DIR, '(tabs)', `${name}.tsx`))).toBe(true);
  });

  it.each([
    ['index', 'palette'],
    ['capture', 'camera-alt'],
    ['settings', 'settings'],
  ])('"%s" tab shows the %s icon in the tint it is given', (name, icon) => {
    const tab = tabs().find((t) => t.props.name === name)!;
    const renderIcon = (tab.props.options as { tabBarIcon: (a: { color: string }) => ReactElement }).tabBarIcon;

    const props = findAll(render(renderIcon({ color: '#123456' })).toJSON(), 'MaterialIcons')[0].props;

    expect(props).toMatchObject({ name: icon, size: 22, color: '#123456' });
  });

  it('hides the header and tints the active tab with the accent color', () => {
    const tabsHost = findAll(render(<TabLayout />).toJSON(), 'Tabs')[0];

    expect(tabsHost.props.screenOptions).toMatchObject({
      headerShown: false,
      tabBarActiveTintColor: Colors.accent,
      tabBarInactiveTintColor: Colors.textTertiary,
    });
  });
});
