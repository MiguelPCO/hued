import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';

export type FontKey = 'sans' | 'display' | 'mono';
export type SubscriptionStatus = 'free' | 'premium';
export type ArchetypeId = string;

const mmkv = createMMKV({ id: 'settings' });

const mmkvStorage: StateStorage = {
  getItem: (key) => mmkv.getString(key) ?? null,
  setItem: (key, value) => mmkv.set(key, value),
  removeItem: (key) => mmkv.remove(key),
};

interface SettingsState {
  onboardingCompleted: boolean;
  lastArchetype: ArchetypeId | null;
  defaultFont: FontKey;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: number | null;
  installDate: number;
  exportDailyCount: number;
  exportDailyResetDate: string;
  profileName: string | null;
  profilePhotoUri: string | null;
}

interface SettingsActions {
  completeOnboarding: () => void;
  setLastArchetype: (id: ArchetypeId) => void;
  setDefaultFont: (font: FontKey) => void;
  setSubscriptionStatus: (status: SubscriptionStatus, expiresAt?: number) => void;
  incrementExportCount: () => void;
  resetExportCountIfNewDay: () => void;
  setProfileName: (name: string | null) => void;
  setProfilePhotoUri: (uri: string | null) => void;
}

const todayString = () => new Date().toISOString().slice(0, 10);

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set, get) => ({
      onboardingCompleted: false,
      lastArchetype: null,
      defaultFont: 'sans',
      subscriptionStatus: 'free',
      subscriptionExpiresAt: null,
      installDate: Date.now(),
      exportDailyCount: 0,
      exportDailyResetDate: todayString(),
      profileName: null,
      profilePhotoUri: null,

      completeOnboarding: () => set({ onboardingCompleted: true }),

      setLastArchetype: (id) => set({ lastArchetype: id }),

      setDefaultFont: (font) => set({ defaultFont: font }),

      setSubscriptionStatus: (status, expiresAt) =>
        set({ subscriptionStatus: status, subscriptionExpiresAt: expiresAt ?? null }),

      incrementExportCount: () => {
        get().resetExportCountIfNewDay();
        set((s) => ({ exportDailyCount: s.exportDailyCount + 1 }));
      },

      resetExportCountIfNewDay: () => {
        const today = todayString();
        if (get().exportDailyResetDate !== today) {
          set({ exportDailyCount: 0, exportDailyResetDate: today });
        }
      },

      setProfileName: (name) => set({ profileName: name }),

      setProfilePhotoUri: (uri) => set({ profilePhotoUri: uri }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
