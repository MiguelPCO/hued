import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';

export type SubscriptionStatus = 'free' | 'premium';

const mmkv = createMMKV({ id: 'settings' });

const mmkvStorage: StateStorage = {
  getItem: (key) => mmkv.getString(key) ?? null,
  setItem: (key, value) => mmkv.set(key, value),
  removeItem: (key) => mmkv.remove(key),
};

interface SettingsState {
  analyticsPromptShown: boolean;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: number | null;
  installDate: number;
  profileName: string | null;
  profilePhotoUri: string | null;
}

interface SettingsActions {
  markAnalyticsPromptShown: () => void;
  setSubscriptionStatus: (status: SubscriptionStatus, expiresAt?: number) => void;
  setProfileName: (name: string | null) => void;
  setProfilePhotoUri: (uri: string | null) => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      analyticsPromptShown: false,
      subscriptionStatus: 'free',
      subscriptionExpiresAt: null,
      installDate: Date.now(),
      profileName: null,
      profilePhotoUri: null,


      markAnalyticsPromptShown: () => set({ analyticsPromptShown: true }),




      setSubscriptionStatus: (status, expiresAt) =>
        set({ subscriptionStatus: status, subscriptionExpiresAt: expiresAt ?? null }),

      setProfileName: (name) => set({ profileName: name }),

      setProfilePhotoUri: (uri) => set({ profilePhotoUri: uri }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
