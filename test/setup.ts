// RNTL 13.3 registra los matchers (toBeOnTheScreen...) al importar el paquete raíz;
// `/extend-expect` ya no existe como subruta.
import '@testing-library/react-native';

declare global {
   
  var __HUED_MMKV__: Map<string, string> | undefined;
}

jest.mock('@shopify/react-native-skia', () => require('./mocks/skia').skiaMock);

jest.mock('expo-camera', () => require('./mocks/expoCamera').expoCameraMock);

// Memoria compartida entre registros de módulos (jest.isolateModules) para poder
// simular un "reinicio de la app" que conserva lo persistido.
jest.mock('react-native-mmkv', () => {
  const memory = (globalThis.__HUED_MMKV__ ??= new Map<string, string>());
  return {
    createMMKV: () => ({
      getString: (key: string) => memory.get(key),
      set: (key: string, value: string) => {
        memory.set(key, value);
      },
      remove: (key: string) => {
        memory.delete(key);
      },
    }),
  };
});

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  copyAsync: jest.fn(() => Promise.resolve()),
  deleteAsync: jest.fn(() => Promise.resolve()),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-media-library/legacy', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  saveToLibraryAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('react-native-image-crop-picker', () => ({
  __esModule: true,
  default: { openCropper: jest.fn() },
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    getCustomerInfo: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
    getOfferings: jest.fn(() => Promise.resolve({ current: null })),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
  LOG_LEVEL: { DEBUG: 'DEBUG' },
}));

jest.mock('posthog-react-native', () => {
  const PostHog = jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    optIn: jest.fn(),
    optOut: jest.fn(),
    ready: jest.fn(() => Promise.resolve()),
    optedOut: false,
  }));
  return {
    __esModule: true,
    default: PostHog,
    PostHogProvider: ({ children }: { children?: unknown }) => children,
  };
});

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  wrap: (component: unknown) => component,
}));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');

jest.mock('expo-router', () => {
  const React = require('react');
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    dismissAll: jest.fn(),
    canDismiss: jest.fn(() => false),
    navigate: jest.fn(),
  };
  const withScreen = (host: string, screenHost: string) =>
    Object.assign(
      ({ children, ...props }: { children?: unknown }) => React.createElement(host, props, children),
      { Screen: (props: Record<string, unknown>) => React.createElement(screenHost, props) }
    );
  return {
    router,
    Stack: withScreen('Stack', 'StackScreen'),
    Tabs: withScreen('Tabs', 'TabsScreen'),
    Link: 'Link',
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(effect, [effect]);
    },
  };
});

afterEach(() => {
  globalThis.__HUED_MMKV__?.clear();
});
