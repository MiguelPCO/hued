// The store persists to MMKV, a native module unavailable under jest.
// Mock react-native-mmkv with a tiny in-memory implementation exposing the
// same getString/set/remove surface settingsStore.ts uses — mirrors how
// exportPalette.test.ts avoids pulling in the real (native-backed) store.
jest.mock('react-native-mmkv', () => {
  const memory = new Map<string, string>();
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

import { useSettingsStore } from '../settingsStore';

describe('profile', () => {
  afterEach(() => {
    useSettingsStore.setState({ profileName: null, profilePhotoUri: null });
  });

  it('setProfileName stores a trimmed-by-caller name as-is', () => {
    useSettingsStore.getState().setProfileName('Miguel');
    expect(useSettingsStore.getState().profileName).toBe('Miguel');
  });

  it('setProfileName(null) clears the name', () => {
    useSettingsStore.setState({ profileName: 'Miguel' });
    useSettingsStore.getState().setProfileName(null);
    expect(useSettingsStore.getState().profileName).toBeNull();
  });

  it('setProfilePhotoUri stores the given uri', () => {
    useSettingsStore.getState().setProfilePhotoUri('file:///profile/avatar.jpg?t=123');
    expect(useSettingsStore.getState().profilePhotoUri).toBe('file:///profile/avatar.jpg?t=123');
  });
});

describe('markAnalyticsPromptShown', () => {
  afterEach(() => {
    useSettingsStore.setState({ analyticsPromptShown: false });
  });

  it('starts unasked and flips to shown', () => {
    expect(useSettingsStore.getState().analyticsPromptShown).toBe(false);
    useSettingsStore.getState().markAnalyticsPromptShown();
    expect(useSettingsStore.getState().analyticsPromptShown).toBe(true);
  });
});
