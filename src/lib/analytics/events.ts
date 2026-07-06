import { posthog } from './posthog';

// Stub types — refined in Sprint 3 and Sprint 5 respectively
export type ArchetypeId = string;
export type PaywallTrigger = 'export_limit' | 'watermark_tap' | 'settings';

type EventMap = {
  // Lifecycle
  app_opened: { source: 'cold_start' | 'background_return' };
  onboarding_completed: { duration_ms: number };

  // Capture
  capture_started: { source: 'camera' | 'gallery' };
  capture_completed: { source: 'camera' | 'gallery'; duration_ms: number };
  capture_cancelled: { source: 'camera' | 'gallery'; stage: 'pick' | 'crop' };

  // Extract
  extract_completed: { duration_ms: number; image_size_kb: number };
  extract_failed: { reason: string };

  // Compose
  archetype_selected: { archetype_id: ArchetypeId };
  config_changed: { config_key: string };

  // Export
  palette_exported: { palette_id: string; resolution: '1x' | '2x' | '4x'; archetype_id: ArchetypeId };
  palette_shared: { palette_id: string; target?: string };

  // Monetization
  paywall_shown: { trigger: PaywallTrigger };
  paywall_dismissed: { trigger: PaywallTrigger };
  subscription_purchased: { trigger: PaywallTrigger; plan?: 'monthly' | 'annual' };
  subscription_restored: Record<string, never>;
};

export function trackEvent<K extends keyof EventMap>(event: K, props: EventMap[K]): void {
  posthog?.capture(event, props);
}
