# Sprint 6 (slice 1) — Monetization: RevenueCat + Paywall + Gating

## Context

This is Days 1-2 of the original "Sprint 5 — Monetization + Launch" plan in
`SPRINTS.md` (lines 499-532), renumbered to Sprint 6 when Sprint 5 was
reassigned to compose-completion work (merged 2026-09-07, commit `b8ce62b`).

Onboarding (old Day 3), Play Store assets (old Day 4), and submission (old
Day 5) are explicitly **out of scope** for this slice — they require a
Google Play Developer account, design assets, and legal copy the user
doesn't have ready yet. This spec covers only: RevenueCat SDK integration,
in-app purchase flow, and free-tier gating (export limit + forced
watermark).

## Adaptations vs. the original SPRINTS.md spec

SPRINTS.md's Day 1 assumed a `premium` entitlement with 2 products
(monthly $2.99 / annual $19.99). The user's actual RevenueCat dashboard
setup differs and this spec follows what's actually configured there:

- **Entitlement identifier:** `hued_pro` (not `premium`).
- **Three purchase tiers**, not two: Monthly, Yearly, and **Lifetime**
  (one-time, non-consumable) — added deliberately, confirmed in scope.
  Pricing for all three lives in RevenueCat/Play Console, not hardcoded —
  the app reads `package.product.priceString` at runtime.
- **RevenueCat project app:** currently configured against RevenueCat's
  **Test Store** (no Google Play Developer account exists yet). The public
  API key is already in `.env.local` as `EXPO_PUBLIC_REVENUECAT_API_KEY`.
  Switching to a real Google Play-backed app later is a dashboard +
  env-var change, not a code change — the SDK integration is
  store-agnostic.
- **Offering:** `default`, with 3 packages, each attached to the `hued_pro`
  entitlement.

## Existing scaffolding (already built, Sprint 0)

Discovered before writing this spec — significantly reduces new work:

- `src/lib/store/settingsStore.ts`: `subscriptionStatus: 'free' | 'premium'`,
  `subscriptionExpiresAt`, `exportDailyCount`, `exportDailyResetDate` with
  `incrementExportCount()` / `resetExportCountIfNewDay()` (UTC-day-string
  reset logic), all persisted via MMKV. This is the daily-counter mechanism
  SPRINTS.md Day 2 asked for — it already exists and is already tested.
- `src/lib/analytics/events.ts`: `PaywallTrigger = 'export_limit' |
  'watermark_tap' | 'settings'`, and `paywall_shown`, `paywall_dismissed`,
  `subscription_purchased` (with `plan?: 'monthly' | 'annual'` — needs
  `'lifetime'` added), `subscription_restored` already stubbed in the
  `EventMap`.
- Sprint 5 (compose-completion) already built the full watermark render
  pipeline (`Watermark.tsx`, wired into both `ArchetypeCanvas.tsx` and
  `exportPalette.tsx`, gated on `config.watermarkVisible`, default `false`
  per that sprint's product-owner ruling — permanent unremovable branding
  was rejected pending this sprint's gating logic).

## Design

### 1. RevenueCat client (`src/lib/revenuecat/client.ts`)

New file. Exports:
- `init(): void` — `Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY! })`, called once.
- `getOfferings(): Promise<PurchasesOffering | null>` — fetches the `default` offering.
- `purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo>` — wraps `Purchases.purchasePackage`.
- `restorePurchases(): Promise<CustomerInfo>` — wraps `Purchases.restorePurchases`.
- A `CustomerInfo → subscriptionStatus` mapper: `hued_pro` entitlement active → `'premium'` (+ `expirationDate` if present, `null` for the Lifetime non-consumable which never expires), otherwise `'free'`.
- Registers `Purchases.addCustomerInfoUpdateListener` (in `init()`) that calls `useSettingsStore.getState().setSubscriptionStatus(...)` on every update — this is what keeps the store in sync after purchase/restore/expiration/renewal, not just the one-shot post-purchase call.

### 2. Wiring in `app/_layout.tsx`

Call `revenuecat.init()` alongside the existing Sentry/PostHog setup already there. No UI change to this file beyond the one call.

### 3. Paywall UI (`app/paywall.tsx`)

New modal route. Fetches the `default` offering on mount, renders 3 package cards (Monthly / Yearly / Lifetime) with live localized pricing, a primary purchase button per card, and a "Restaurar compras" (Restore Purchases) text button. Accepts a `trigger` param (`PaywallTrigger`) for analytics. Tracks `paywall_shown` on mount, `paywall_dismissed` on close without purchase, `subscription_purchased` (with `plan` mapped from the purchased package) on success. Purchase errors (user cancellation, network) are caught and surfaced inline — cancellation is not an error state, just a dismiss.

### 4. Export gating

Wherever the export/share action currently fires (`app/palette/[id].tsx` export flow — verify exact call site during planning), check `subscriptionStatus === 'free' && exportDailyCount >= 3` before proceeding:
- If blocked: `trackEvent('paywall_shown', { trigger: 'export_limit' })`, navigate to `/paywall`, do not export.
- If allowed: proceed with export, then `incrementExportCount()` (which internally calls `resetExportCountIfNewDay()` first, per existing store logic — no new reset logic needed).

### 5. Forced watermark for free tier

`ArchetypeCanvas.tsx` and `exportPalette.tsx` currently gate the `<Watermark>` render on `config.watermarkVisible` (stored per-palette config, defaults `false` per Sprint 5's ruling). Both call sites change the gate to:

```ts
config.watermarkVisible || useSettingsStore.getState().subscriptionStatus === 'free'
```

This forces the watermark on for every free-tier user regardless of their per-palette config, while leaving premium users' own `watermarkVisible` preference in charge. Preview/export parity is preserved — both call sites get the identical change (same constraint Sprint 5 held to).

### 6. Watermark tap → paywall

The rendered `<Watermark>` in the **preview** (`ArchetypeCanvas.tsx`, not the static export image) needs to be tappable when the viewer is free-tier: wrap it (or the canvas region it occupies) in a pressable that navigates to `/paywall?trigger=watermark_tap` when `subscriptionStatus === 'free'`. No-op for premium users (nothing to upsell).

### 7. Settings "Upgrade" entry point

`app/(tabs)/settings.tsx` gets a new row (only shown when `subscriptionStatus === 'free'`) that navigates to `/paywall?trigger=settings`. Premium users see their plan/expiration instead (read from `subscriptionExpiresAt`; `null` + active entitlement means Lifetime — render "Lifetime" not a date).

### 8. `events.ts` type update

`subscription_purchased`'s `plan` field: `'monthly' | 'annual'` → `'monthly' | 'annual' | 'lifetime'`.

## Out of scope (explicitly deferred)

- Onboarding flow (old Day 3).
- Play Store assets, privacy policy, terms of service (old Day 4).
- Production build, Play Console submission, Internal Testing track (old Day 5).
- Switching the RevenueCat app from Test Store to a real Google Play-backed app (blocked on the user creating a Google Play Developer account — no code change needed when that happens, just a dashboard reconfiguration + confirming the env var still points at the right key).

## Testing

- Unit: `revenuecat/client.ts`'s `CustomerInfo → subscriptionStatus` mapper (pure function, easy to test with fixture `CustomerInfo` objects covering: no entitlement, active subscription with expiration, active Lifetime with no expiration).
- Unit: export-gating decision logic (free + under limit → allow; free + at limit → block; premium → always allow) — extract as a small pure function if not already trivially testable inline.
- Manual (RevenueCat Test Store sandbox, no real money): purchase each of the 3 tiers, confirm `subscriptionStatus` flips to `'premium'`, confirm watermark disappears, confirm export limit lifts, confirm restore purchases works after a simulated reinstall (clear MMKV / fresh store state), confirm daily counter resets correctly across the UTC boundary (can fake via `exportDailyResetDate` in dev).
