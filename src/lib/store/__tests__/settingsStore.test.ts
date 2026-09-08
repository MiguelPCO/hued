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

const todayString = () => new Date().toISOString().slice(0, 10);
const yesterdayString = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe('resetExportCountIfNewDay', () => {
  afterEach(() => {
    useSettingsStore.setState({ exportDailyCount: 0, exportDailyResetDate: todayString() });
  });

  it('resets the count and bumps the reset date when the persisted date is in the past', () => {
    useSettingsStore.setState({ exportDailyCount: 3, exportDailyResetDate: yesterdayString() });

    useSettingsStore.getState().resetExportCountIfNewDay();

    const state = useSettingsStore.getState();
    expect(state.exportDailyCount).toBe(0);
    expect(state.exportDailyResetDate).toBe(todayString());
  });

  it('leaves the count untouched when the reset date is already today', () => {
    useSettingsStore.setState({ exportDailyCount: 3, exportDailyResetDate: todayString() });

    useSettingsStore.getState().resetExportCountIfNewDay();

    const state = useSettingsStore.getState();
    expect(state.exportDailyCount).toBe(3);
    expect(state.exportDailyResetDate).toBe(todayString());
  });
});

describe('incrementExportCount', () => {
  afterEach(() => {
    useSettingsStore.setState({ exportDailyCount: 0, exportDailyResetDate: todayString() });
  });

  it('resets a stale count to 0 before incrementing, instead of adding onto it', () => {
    useSettingsStore.setState({ exportDailyCount: 3, exportDailyResetDate: yesterdayString() });

    useSettingsStore.getState().incrementExportCount();

    const state = useSettingsStore.getState();
    expect(state.exportDailyCount).toBe(1);
    expect(state.exportDailyResetDate).toBe(todayString());
  });

  it('adds onto the count within the same day', () => {
    useSettingsStore.setState({ exportDailyCount: 1, exportDailyResetDate: todayString() });

    useSettingsStore.getState().incrementExportCount();

    expect(useSettingsStore.getState().exportDailyCount).toBe(2);
  });
});

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
