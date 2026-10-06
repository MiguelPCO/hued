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
  analyticsPromptShown: boolean;
  samplesSeeded: boolean;
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
  markAnalyticsPromptShown: () => void;
  markSamplesSeeded: () => void;
  setLastArchetype: (id: ArchetypeId) => void;
  setDefaultFont: (font: FontKey) => void;
  setSubscriptionStatus: (status: SubscriptionStatus, expiresAt?: number) => void;
  incrementExportCount: () => void;
  resetExportCountIfNewDay: () => void;
  setProfileName: (name: string | null) => void;
  setProfilePhotoUri: (uri: string | null) => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// Local calendar day (YYYY-MM-DD): the daily export allowance resets at the user's midnight, not UTC's.
const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set, get) => ({
      onboardingCompleted: false,
      analyticsPromptShown: false,
      samplesSeeded: false,
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

      markAnalyticsPromptShown: () => set({ analyticsPromptShown: true }),

      markSamplesSeeded: () => set({ samplesSeeded: true }),

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
