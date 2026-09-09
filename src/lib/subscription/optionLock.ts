import type { SubscriptionStatus } from '@/lib/store/settingsStore';

export function isOptionLocked(premium: boolean | undefined, status: SubscriptionStatus): boolean {
  return premium === true && status !== 'premium';
}
