import { mapCustomerInfoToSubscriptionState, PRO_ENTITLEMENT_ID } from '../mapCustomerInfo';

describe('mapCustomerInfoToSubscriptionState', () => {
  it('returns free when the hued_pro entitlement is not active', () => {
    const result = mapCustomerInfoToSubscriptionState({ entitlements: { active: {} } });
    expect(result).toEqual({ status: 'free', expiresAt: null });
  });

  it('returns premium with a numeric expiresAt for an active time-limited subscription', () => {
    const result = mapCustomerInfoToSubscriptionState({
      entitlements: {
        active: { [PRO_ENTITLEMENT_ID]: { expirationDate: '2027-01-01T00:00:00Z' } },
      },
    });
    expect(result.status).toBe('premium');
    expect(result.expiresAt).toBe(new Date('2027-01-01T00:00:00Z').getTime());
  });

  it('returns premium with null expiresAt for a non-expiring (Lifetime) entitlement', () => {
    const result = mapCustomerInfoToSubscriptionState({
      entitlements: {
        active: { [PRO_ENTITLEMENT_ID]: { expirationDate: null } },
      },
    });
    expect(result).toEqual({ status: 'premium', expiresAt: null });
  });

  it('ignores entitlements other than hued_pro', () => {
    const result = mapCustomerInfoToSubscriptionState({
      entitlements: {
        active: { some_other_entitlement: { expirationDate: null } },
      },
    });
    expect(result).toEqual({ status: 'free', expiresAt: null });
  });
});
