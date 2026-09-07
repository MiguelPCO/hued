import type { SubscriptionStatus } from '@/lib/store/settingsStore';

/** The RevenueCat entitlement identifier configured for hued's paid tier. */
export const PRO_ENTITLEMENT_ID = 'hued_pro';

export interface SubscriptionState {
  status: SubscriptionStatus;
  expiresAt: number | null;
}

/**
 * The narrow subset of RevenueCat's `CustomerInfo` this mapper reads.
 * Kept separate from the real SDK type so this file has no import from
 * `react-native-purchases` — the unit test never touches the native module.
 */
export interface CustomerInfoLike {
  entitlements: {
    active: Record<string, { expirationDate: string | null }>;
  };
}

export function mapCustomerInfoToSubscriptionState(info: CustomerInfoLike): SubscriptionState {
  const entitlement = info.entitlements.active[PRO_ENTITLEMENT_ID];
  if (!entitlement) {
    return { status: 'free', expiresAt: null };
  }
  return {
    status: 'premium',
    expiresAt: entitlement.expirationDate ? new Date(entitlement.expirationDate).getTime() : null,
  };
}
