import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

import { mapCustomerInfoToSubscriptionState } from '@/lib/revenuecat/mapCustomerInfo';
import { useSettingsStore } from '@/lib/store/settingsStore';

let initialized = false;

/**
 * Configures the RevenueCat SDK and starts syncing customer entitlement
 * state into `settingsStore`. Safe to call multiple times — only the first
 * call with a present API key does anything. No-ops silently if
 * `EXPO_PUBLIC_REVENUECAT_API_KEY` is unset (matches the existing
 * Sentry/PostHog "empty key = disabled" convention in this codebase).
 */
export function init(): void {
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
  if (!apiKey || initialized) return;
  initialized = true;

  Purchases.configure({ apiKey });
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.addCustomerInfoUpdateListener((info: CustomerInfo) => {
    const { status, expiresAt } = mapCustomerInfoToSubscriptionState(info);
    useSettingsStore.getState().setSubscriptionStatus(status, expiresAt ?? undefined);
  });

  // One-time sync on cold start: the listener above only fires on future
  // updates, so an offline (or otherwise slow-to-callback) cold start would
  // run entirely on stale persisted MMKV state until it eventually does.
  // Fire-and-forget — don't block init()'s synchronous return on this, and a
  // failure here just leaves the existing persisted state in place.
  Purchases.getCustomerInfo()
    .then((info) => {
      const { status, expiresAt } = mapCustomerInfoToSubscriptionState(info);
      useSettingsStore.getState().setSubscriptionStatus(status, expiresAt ?? undefined);
    })
    .catch(() => {});
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  const { status, expiresAt } = mapCustomerInfoToSubscriptionState(customerInfo);
  useSettingsStore.getState().setSubscriptionStatus(status, expiresAt ?? undefined);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  const customerInfo = await Purchases.restorePurchases();
  const { status, expiresAt } = mapCustomerInfoToSubscriptionState(customerInfo);
  useSettingsStore.getState().setSubscriptionStatus(status, expiresAt ?? undefined);
  return customerInfo;
}
