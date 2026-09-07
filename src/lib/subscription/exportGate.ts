import type { SubscriptionStatus } from '@/lib/store/settingsStore';

export const FREE_TIER_DAILY_EXPORT_LIMIT = 3;

export function canExportToday(status: SubscriptionStatus, dailyCount: number): boolean {
  if (status === 'premium') return true;
  return dailyCount < FREE_TIER_DAILY_EXPORT_LIMIT;
}
