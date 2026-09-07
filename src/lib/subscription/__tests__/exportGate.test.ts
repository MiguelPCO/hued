import { canExportToday, FREE_TIER_DAILY_EXPORT_LIMIT } from '../exportGate';

describe('canExportToday', () => {
  it('always allows premium users regardless of daily count', () => {
    expect(canExportToday('premium', 0)).toBe(true);
    expect(canExportToday('premium', 999)).toBe(true);
  });

  it('allows free users under the daily limit', () => {
    expect(canExportToday('free', 0)).toBe(true);
    expect(canExportToday('free', FREE_TIER_DAILY_EXPORT_LIMIT - 1)).toBe(true);
  });

  it('blocks free users at or above the daily limit', () => {
    expect(canExportToday('free', FREE_TIER_DAILY_EXPORT_LIMIT)).toBe(false);
    expect(canExportToday('free', FREE_TIER_DAILY_EXPORT_LIMIT + 5)).toBe(false);
  });
});
