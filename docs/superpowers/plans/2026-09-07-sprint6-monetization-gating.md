# Sprint 6 Slice 1 — Monetization: RevenueCat + Paywall + Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the RevenueCat SDK into the hued app, build a custom paywall screen offering the 3 configured tiers (Monthly / Yearly / Lifetime under the `hued_pro` entitlement), and enforce free-tier gating (3 exports/day, forced watermark) using the daily-counter/subscription-status scaffolding already built in Sprint 0's `settingsStore.ts`.

**Architecture:** A small `src/lib/revenuecat/` module wraps the `react-native-purchases` SDK behind a testable pure mapper (`CustomerInfo` → app's `SubscriptionStatus`) plus a thin imperative client (init/getOfferings/purchase/restore). `app/paywall.tsx` (route already registered in `app/_layout.tsx`) is the only UI surface for purchasing. Gating logic lives as small pure functions (`canExportToday`, `shouldRenderWatermark`) consumed from the existing `settingsStore` state at the 3 call sites the spec identifies: export flow, watermark render (both preview and export, kept in parity per the project's existing constraint), and Settings.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript strict, `react-native-purchases` (RevenueCat SDK), Zustand v5 (existing `settingsStore`), `@shopify/react-native-skia` (existing watermark render pipeline), Jest.

**Spec:** `docs/superpowers/specs/2026-09-07-sprint6-monetization-gating-design.md`

## Global Constraints

- TypeScript strict, no `any`.
- Entitlement identifier is `hued_pro` (not `premium` — the user's actual RevenueCat dashboard setup, confirmed 2026-09-07). Use this exact string everywhere an entitlement identifier is needed.
- 3 purchase tiers exist in the `default` offering: Monthly, Yearly (RevenueCat `packageType` `ANNUAL`), Lifetime (non-consumable, `packageType` `LIFETIME`). Do not hardcode assumptions of only 2 tiers — the paywall renders whatever `availablePackages` the offering returns.
- RevenueCat is currently configured against RevenueCat's **Test Store** (no Google Play Developer account yet). The public API key is already in `.env.local` as `EXPO_PUBLIC_REVENUECAT_API_KEY` — read it via `process.env.EXPO_PUBLIC_REVENUECAT_API_KEY`, never hardcode it.
- Preview (`ArchetypeCanvas.tsx`) and export (`exportPalette.tsx`) watermark rendering must stay in parity — any gating logic that affects whether the watermark renders goes through one shared function (`shouldRenderWatermark` in `shared.tsx`), consumed identically by both files. This is an existing project constraint from Sprint 5, unchanged.
- Match existing code style: Spanish UI strings, existing `Colors`/`Spacing`/`Radius`/`Shadow` tokens from `src/lib/tokens.ts`, existing `trackEvent()` analytics calls alongside new user actions (follow the pattern already at `app/palette/[id].tsx:207,240,273,304,335`).
- This plan's automated verification is `npx tsc --noEmit` and `npx jest` only. On-device purchase-flow testing (RevenueCat Test Store sandbox, real button taps) is manual, done by the user after all tasks land — no task should attempt to launch the app, start a dev-client build, or connect to a device/emulator.
- `react-native-purchases` is a native module — installing it requires a dev-client rebuild (`npx expo run:android`) before purchases work on-device, same as `react-native-mmkv`/`@shopify/react-native-skia` before it (see `CLAUDE.md`/project memory "Key runtime notes"). This is a note for the user's manual follow-up, not a plan step — no task here runs a native build.
- On Windows, `pnpm install` after any lockfile change may block on a TTY prompt for touching `node_modules`; prefix with `CI=true` (project memory "Known repo gotchas"). Relevant if a task needs to add a dependency to `package.json`.

---

### Task 1: RevenueCat client — pure mapper + SDK wrapper

**Files:**
- Modify: `package.json` (add `react-native-purchases` dependency)
- Create: `src/lib/revenuecat/mapCustomerInfo.ts`
- Test: `src/lib/revenuecat/__tests__/mapCustomerInfo.test.ts`
- Create: `src/lib/revenuecat/client.ts`

**Interfaces:**
- Consumes: `useSettingsStore` from `@/lib/store/settingsStore` (existing — `getState().setSubscriptionStatus(status: SubscriptionStatus, expiresAt?: number): void`), `SubscriptionStatus` type (existing, `'free' | 'premium'`).
- Produces: `PRO_ENTITLEMENT_ID = 'hued_pro'` (string const), `mapCustomerInfoToSubscriptionState(info: CustomerInfoLike): { status: SubscriptionStatus; expiresAt: number | null }` (pure, from `mapCustomerInfo.ts`), and from `client.ts`: `init(): void`, `getOfferings(): Promise<PurchasesOffering | null>`, `purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo>`, `restorePurchases(): Promise<CustomerInfo>` — all consumed by later tasks.

`mapCustomerInfo.ts` deliberately has **zero import** from `react-native-purchases` (or any native module) — it takes a narrow local `CustomerInfoLike` type covering only the fields it reads, so its unit test never touches the native SDK and can't crash in the Jest environment. `client.ts` imports the real SDK types and passes the real `CustomerInfo` object through (structurally compatible with `CustomerInfoLike`).

- [ ] **Step 1: Add the RevenueCat SDK dependency**

Run: `cd "D:\Miguel\Portfolio\miguel-dev-workspace\projects\hued" && CI=true pnpm add react-native-purchases@^10.6.0`

Expected: `package.json`'s `dependencies` gains `"react-native-purchases": "^10.6.0"`, `pnpm-lock.yaml` updates, exit code 0.

- [ ] **Step 2: Write the failing test for the pure mapper**

Create `src/lib/revenuecat/__tests__/mapCustomerInfo.test.ts`:

```ts
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
```

- [ ] **Step 2b: Run test to verify it fails**

Run: `npx jest src/lib/revenuecat/__tests__/mapCustomerInfo.test.ts`
Expected: FAIL — `Cannot find module '../mapCustomerInfo'`.

- [ ] **Step 3: Implement the pure mapper**

Create `src/lib/revenuecat/mapCustomerInfo.ts`:

```ts
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
```

- [ ] **Step 3b: Run test to verify it passes**

Run: `npx jest src/lib/revenuecat/__tests__/mapCustomerInfo.test.ts`
Expected: PASS, 4/4 tests.

- [ ] **Step 4: Implement the SDK wrapper**

Create `src/lib/revenuecat/client.ts`:

```ts
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
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors. (If `react-native-purchases`'s type exports differ from `CustomerInfo`/`PurchasesOffering`/`PurchasesPackage`/`LOG_LEVEL` — check the installed version's `node_modules/react-native-purchases/dist/index.d.ts` for the exact exported names and adjust the imports in `client.ts` to match; the mapper in `mapCustomerInfo.ts` needs no changes either way since it doesn't import the SDK.)

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/revenuecat/mapCustomerInfo.ts src/lib/revenuecat/__tests__/mapCustomerInfo.test.ts src/lib/revenuecat/client.ts
git commit -m "Add RevenueCat client wrapper with testable entitlement mapper"
```

---

### Task 2: Wire RevenueCat init into app startup

**Files:**
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `init()` from `@/lib/revenuecat/client` (Task 1).
- Produces: nothing new consumed by later tasks — this task only ensures the SDK is configured and the `CustomerInfo` listener is live before any screen that reads `subscriptionStatus` mounts.

- [ ] **Step 1: Call `init()` alongside the existing SDK setup**

In `app/_layout.tsx`, add the import and call it at module scope, mirroring the existing `Sentry.init(...)` pattern (both run once at cold start, before the first component renders):

```ts
import { init as initRevenueCat } from '@/lib/revenuecat/client';
```

Add this import near the existing `import { trackEvent } from '@/lib/analytics/events';` line. Then, immediately after the existing `Sentry.init({...})` block (currently ending at line 32) and before `SplashScreen.preventAutoHideAsync();`, add:

```ts
initRevenueCat();
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Run the full test suite (regression check)**

Run: `npx jest`
Expected: all suites pass (no new tests in this task — this file has no existing test coverage; the check confirms nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "Initialize RevenueCat SDK at app startup"
```

---

### Task 3: Paywall UI + analytics event type update

**Files:**
- Modify: `src/lib/analytics/events.ts:32`
- Modify: `app/paywall.tsx` (currently does not exist as a file — the route is pre-registered in `app/_layout.tsx:68` but has no component; expo-router will 404 on it until this file exists)

**Interfaces:**
- Consumes: `getOfferings`, `purchasePackage`, `restorePurchases` from `@/lib/revenuecat/client` (Task 1); `trackEvent`, `PaywallTrigger` from `@/lib/analytics/events` (existing, this task extends the `plan` field); `Button`, `Text` from `@/components/ui/*` (existing); `Colors`, `Spacing`, `Radius` from `@/lib/tokens` (existing).
- Produces: the `/paywall` route, navigable via `router.push({ pathname: '/paywall', params: { trigger: <PaywallTrigger> } })` — consumed by Tasks 4, 5, 6, 7.

- [ ] **Step 1: Extend the `subscription_purchased` event type**

In `src/lib/analytics/events.ts`, change line 32 from:

```ts
  subscription_purchased: { trigger: PaywallTrigger; plan?: 'monthly' | 'annual' };
```

to:

```ts
  subscription_purchased: { trigger: PaywallTrigger; plan?: 'monthly' | 'annual' | 'lifetime' };
```

- [ ] **Step 2: Create the paywall screen**

Create `app/paywall.tsx`:

```tsx
import * as Sentry from '@sentry/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { trackEvent } from '@/lib/analytics/events';
import type { PaywallTrigger } from '@/lib/analytics/events';
import { getOfferings, purchasePackage, restorePurchases } from '@/lib/revenuecat/client';
import { Colors, Radius, Spacing } from '@/lib/tokens';

const PACKAGE_TYPE_LABELS: Record<string, string> = {
  MONTHLY: 'Mensual',
  ANNUAL: 'Anual',
  LIFETIME: 'De por vida',
};

const PACKAGE_TYPE_TO_PLAN: Record<string, 'monthly' | 'annual' | 'lifetime'> = {
  MONTHLY: 'monthly',
  ANNUAL: 'annual',
  LIFETIME: 'lifetime',
};

export default function PaywallScreen() {
  const { trigger } = useLocalSearchParams<{ trigger?: PaywallTrigger }>();
  const activeTrigger: PaywallTrigger = trigger ?? 'settings';

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackEvent('paywall_shown', { trigger: activeTrigger });
    getOfferings()
      .then((offering) => setPackages(offering?.availablePackages ?? []))
      .catch((err) => {
        Sentry.captureException(err);
        setError('No se pudieron cargar los planes. Intentalo de nuevo.');
      })
      .finally(() => setLoading(false));
    // trigger is read once on mount to attribute this paywall view — a
    // param change would mean navigating to a *new* paywall instance, not
    // re-showing this one, so this effect intentionally runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    trackEvent('paywall_dismissed', { trigger: activeTrigger });
    router.back();
  }

  async function handlePurchase(pkg: PurchasesPackage) {
    setPurchasingId(pkg.identifier);
    setError(null);
    try {
      await purchasePackage(pkg);
      const plan = PACKAGE_TYPE_TO_PLAN[pkg.packageType];
      trackEvent('subscription_purchased', { trigger: activeTrigger, plan });
      router.back();
    } catch (err) {
      const isCancelled = (err as { userCancelled?: boolean } | null)?.userCancelled === true;
      if (!isCancelled) {
        Sentry.captureException(err);
        setError('No se pudo completar la compra. Intentalo de nuevo.');
      }
    } finally {
      setPurchasingId(null);
    }
  }

  async function handleRestore() {
    setError(null);
    try {
      await restorePurchases();
      trackEvent('subscription_restored', {});
      router.back();
    } catch (err) {
      Sentry.captureException(err);
      setError('No se pudieron restaurar las compras.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="h1">Hued Pro</Text>
        <TouchableOpacity onPress={handleClose}>
          <Text variant="body" color={Colors.accent}>Cerrar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="body" color={Colors.textSecondary} style={styles.subtitle}>
          Exportaciones ilimitadas y sin marca de agua.
        </Text>

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={styles.loading} />
        ) : error && packages.length === 0 ? (
          <Text variant="small" color={Colors.error}>{error}</Text>
        ) : (
          packages.map((pkg) => (
            <View key={pkg.identifier} style={styles.card}>
              <Text variant="h3">{PACKAGE_TYPE_LABELS[pkg.packageType] ?? pkg.packageType}</Text>
              <Text variant="body" color={Colors.textSecondary}>{pkg.product.priceString}</Text>
              <Button
                label={purchasingId === pkg.identifier ? 'Procesando...' : 'Elegir'}
                onPress={() => handlePurchase(pkg)}
                loading={purchasingId === pkg.identifier}
                disabled={purchasingId !== null}
                fullWidth
              />
            </View>
          ))
        )}

        {error && packages.length > 0 && (
          <Text variant="small" color={Colors.error} style={styles.errorText}>{error}</Text>
        )}

        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
          <Text variant="small" color={Colors.textSecondary}>Restaurar compras</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  subtitle: { marginBottom: Spacing.md },
  loading: { marginTop: Spacing.xl },
  card: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: { marginTop: Spacing.sm },
  restoreBtn: { alignSelf: 'center', marginTop: Spacing.lg, padding: Spacing.sm },
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors. (If `PurchasesPackage`'s `packageType` field's type is a string-literal union rather than plain `string` — check `node_modules/react-native-purchases/dist/index.d.ts` — the `Record<string, ...>` lookups in `PACKAGE_TYPE_LABELS`/`PACKAGE_TYPE_TO_PLAN` still type-check fine either way since `Record<string, T>` accepts any string key.)

- [ ] **Step 4: Run the full test suite (regression check)**

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/events.ts app/paywall.tsx
git commit -m "Add paywall screen with RevenueCat offering, purchase, and restore flow"
```

---

### Task 4: Export gating (3/day free-tier limit)

**Files:**
- Create: `src/lib/subscription/exportGate.ts`
- Test: `src/lib/subscription/__tests__/exportGate.test.ts`
- Modify: `app/palette/[id].tsx`

**Interfaces:**
- Consumes: `SubscriptionStatus` type from `@/lib/store/settingsStore` (existing); `useSettingsStore` (existing, `subscriptionStatus: SubscriptionStatus`, `exportDailyCount: number`, `incrementExportCount(): void` state/action already built in Sprint 0); the `/paywall` route (Task 3).
- Produces: `FREE_TIER_DAILY_EXPORT_LIMIT` (const, `3`), `canExportToday(status: SubscriptionStatus, dailyCount: number): boolean` (pure) — not consumed by any later task in this plan, but this is the gate other free-tier limit UI (e.g. a future "2/3 exports today" indicator) would read from.

- [ ] **Step 1: Write the failing test**

Create `src/lib/subscription/__tests__/exportGate.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/subscription/__tests__/exportGate.test.ts`
Expected: FAIL — `Cannot find module '../exportGate'`.

- [ ] **Step 3: Implement the gate**

Create `src/lib/subscription/exportGate.ts`:

```ts
import type { SubscriptionStatus } from '@/lib/store/settingsStore';

export const FREE_TIER_DAILY_EXPORT_LIMIT = 3;

export function canExportToday(status: SubscriptionStatus, dailyCount: number): boolean {
  if (status === 'premium') return true;
  return dailyCount < FREE_TIER_DAILY_EXPORT_LIMIT;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/subscription/__tests__/exportGate.test.ts`
Expected: PASS, 3/3 tests.

- [ ] **Step 5: Wire the gate into the export flow**

In `app/palette/[id].tsx`, add imports (near the existing `import { trackEvent } from '@/lib/analytics/events';` line):

```ts
import { canExportToday } from '@/lib/subscription/exportGate';
import { useSettingsStore } from '@/lib/store/settingsStore';
```

Inside `PaletteScreen()`, add these three hook calls alongside the existing `useState`/`useRef` declarations (after the `pendingFlushRef` declaration, before the `useEffect` blocks):

```ts
const subscriptionStatus = useSettingsStore((s) => s.subscriptionStatus);
const exportDailyCount = useSettingsStore((s) => s.exportDailyCount);
const incrementDailyExportCount = useSettingsStore((s) => s.incrementExportCount);
```

Then change the start of `handleExport` (currently `async function handleExport(resolution: ExportResolution) { if (!palette || !config) return; setExportState('exporting');`) to gate before doing any export work:

```ts
async function handleExport(resolution: ExportResolution) {
    if (!palette || !config) return;

    if (!canExportToday(subscriptionStatus, exportDailyCount)) {
      trackEvent('paywall_shown', { trigger: 'export_limit' });
      setExportSheetVisible(false);
      router.push({ pathname: '/paywall', params: { trigger: 'export_limit' } });
      return;
    }

    setExportState('exporting');
```

And, in the same function, immediately after the existing `await incrementExportCount(palette.id);` line (the per-palette DB counter — unchanged, keep it), add the daily counter increment:

```ts
      await incrementExportCount(palette.id);
      incrementDailyExportCount();
```

(These are two different counters with a naming collision resolved by the local alias: `incrementExportCount` imported from `@/lib/db/palettes` bumps that specific palette's lifetime export-count stat; `incrementDailyExportCount` — the aliased store action — bumps the app-wide free-tier daily gate. Both fire on every successful export.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Run the full test suite (regression check)**

Run: `npx jest`
Expected: all suites pass, including the 3 new `exportGate` tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/subscription/exportGate.ts src/lib/subscription/__tests__/exportGate.test.ts app/palette/[id].tsx
git commit -m "Gate exports at 3/day for free-tier users, route to paywall when blocked"
```

---

### Task 5: Force watermark visible for free-tier users

**Files:**
- Modify: `src/components/compose/archetypes/shared.tsx`
- Modify: `src/components/compose/archetypes/__tests__/shared.test.tsx`
- Modify: `src/components/compose/ArchetypeCanvas.tsx`
- Modify: `src/lib/export/exportPalette.tsx`

**Interfaces:**
- Consumes: `SubscriptionStatus` type and `useSettingsStore` from `@/lib/store/settingsStore` (existing).
- Produces: `shouldRenderWatermark(watermarkVisible: boolean, status: SubscriptionStatus): boolean` (pure, from `shared.tsx`) — consumed by both `ArchetypeCanvas.tsx` and `exportPalette.tsx` in this same task, and by Task 6 (which needs to know the watermark is actually showing before rendering a tap target over it).

- [ ] **Step 1: Write the failing test**

In `src/components/compose/archetypes/__tests__/shared.test.tsx`, add this import alongside the existing one at the top of the file:

```ts
import { shouldRenderWatermark, wrapMetadataInBlur } from '../shared';
```

(replacing the current `import { wrapMetadataInBlur } from '../shared';` line). Then append this new `describe` block at the end of the file, after the existing `describe('wrapMetadataInBlur', ...)` block:

```ts
describe('shouldRenderWatermark', () => {
  it('shows the watermark for free-tier users even when the config has it off', () => {
    expect(shouldRenderWatermark(false, 'free')).toBe(true);
  });

  it('respects the config for premium users', () => {
    expect(shouldRenderWatermark(false, 'premium')).toBe(false);
    expect(shouldRenderWatermark(true, 'premium')).toBe(true);
  });

  it('shows the watermark for free-tier users when the config already has it on', () => {
    expect(shouldRenderWatermark(true, 'free')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/compose/archetypes/__tests__/shared.test.tsx`
Expected: FAIL — `shouldRenderWatermark` is not exported from `../shared`.

- [ ] **Step 3: Implement `shouldRenderWatermark`**

In `src/components/compose/archetypes/shared.tsx`, add this import alongside the existing ones at the top:

```ts
import type { SubscriptionStatus } from '@/lib/store/settingsStore';
```

Then add this function anywhere after `getContrastTextColor` (e.g. immediately below it):

```ts
/**
 * Free-tier users always see the watermark, regardless of their per-palette
 * `watermarkVisible` config — Sprint 6's gating rule. Premium users' own
 * preference is respected as-is.
 */
export function shouldRenderWatermark(watermarkVisible: boolean, status: SubscriptionStatus): boolean {
  return watermarkVisible || status === 'free';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/compose/archetypes/__tests__/shared.test.tsx`
Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 5: Wire into `ArchetypeCanvas.tsx` (preview)**

In `src/components/compose/ArchetypeCanvas.tsx`, add imports:

```ts
import { getCardFrame, shouldRenderWatermark } from '@/components/compose/archetypes/shared';
import { useSettingsStore } from '@/lib/store/settingsStore';
```

(the first line replaces the existing `import { getCardFrame } from '@/components/compose/archetypes/shared';`). Inside `ArchetypeCanvas`, add a hook call alongside the existing `useImage`/`useWindowDimensions` calls:

```ts
const subscriptionStatus = useSettingsStore((s) => s.subscriptionStatus);
```

Then change:

```tsx
        {config.watermarkVisible && (
          <Watermark width={CANVAS_W} height={CANVAS_H} cornerRadius={config.cornerRadius} />
        )}
```

to:

```tsx
        {shouldRenderWatermark(config.watermarkVisible, subscriptionStatus) && (
          <Watermark width={CANVAS_W} height={CANVAS_H} cornerRadius={config.cornerRadius} />
        )}
```

- [ ] **Step 6: Wire into `exportPalette.tsx` (export) — identically**

In `src/lib/export/exportPalette.tsx`, add imports:

```ts
import { getCardFrame, shouldRenderWatermark } from '@/components/compose/archetypes/shared';
import { useSettingsStore } from '@/lib/store/settingsStore';
```

(the first line replaces the existing `import { getCardFrame } from '@/components/compose/archetypes/shared';`). This file is a plain async function, not a component, so read the store via `.getState()` rather than the hook — add this line inside `exportPalette()`, near the top (after the `const { clip, overlay } = getCardFrame(...)` line):

```ts
  const subscriptionStatus = useSettingsStore.getState().subscriptionStatus;
```

Then change:

```tsx
      {config.watermarkVisible && (
        <Watermark width={CANVAS_W} height={CANVAS_H} cornerRadius={config.cornerRadius} />
      )}
```

to:

```tsx
      {shouldRenderWatermark(config.watermarkVisible, subscriptionStatus) && (
        <Watermark width={CANVAS_W} height={CANVAS_H} cornerRadius={config.cornerRadius} />
      )}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 8: Run the full test suite (regression check)**

Run: `npx jest`
Expected: all suites pass, including the existing `exportPalette.test.ts` (verify it doesn't assert on `config.watermarkVisible` directly in a way this change would break — if it mocks `useSettingsStore`, no change needed there since the default `subscriptionStatus` is `'free'` and any test asserting watermark-off behavior with `watermarkVisible: false` would now need `subscriptionStatus: 'premium'` in its fixture; read the test file first and adjust its fixtures only if a pre-existing assertion actually breaks).

- [ ] **Step 9: Commit**

```bash
git add src/components/compose/archetypes/shared.tsx src/components/compose/archetypes/__tests__/shared.test.tsx src/components/compose/ArchetypeCanvas.tsx src/lib/export/exportPalette.tsx
git commit -m "Force watermark visible for free-tier users in both preview and export"
```

---

### Task 6: Tap watermark → paywall (preview only)

**Files:**
- Modify: `src/components/compose/archetypes/Watermark.tsx`
- Modify: `src/components/compose/ArchetypeCanvas.tsx`
- Modify: `app/palette/[id].tsx`

**Interfaces:**
- Consumes: `shouldRenderWatermark` (Task 5); the `/paywall` route (Task 3).
- Produces: `ArchetypeCanvas`'s new optional `onWatermarkPress?: () => void` prop — consumed by `app/palette/[id].tsx` in this same task. `getWatermarkTapRegion(width, height)` from `Watermark.tsx` — consumed only within `ArchetypeCanvas.tsx` in this task.

This is preview-only by design (per spec): the exported PNG is a static image, there's nothing to tap once shared. `exportPalette.tsx` is untouched by this task.

- [ ] **Step 1: Export a tap-region helper from `Watermark.tsx`**

In `src/components/compose/archetypes/Watermark.tsx`, add this function after the existing `Watermark` component (at the end of the file):

```ts
/**
 * The screen region (in the same design-unit space as `Watermark`'s own
 * `x`/`y` math above) a tap target should cover to hit the rendered mark.
 * Kept in this file, next to the render math it mirrors, so the two never
 * drift apart — `ArchetypeCanvas.tsx` uses this to position an absolutely-
 * positioned `Pressable` sibling of the Skia `<Canvas>` (Skia text isn't
 * natively tappable).
 */
export function getWatermarkTapRegion(width: number, height: number) {
  const approxTextWidth = WATERMARK_TEXT.length * WATERMARK_FONT_SIZE * 0.6;
  const centerX = width - WATERMARK_MARGIN - approxTextWidth / 2;
  const centerY = height / 2 + WATERMARK_VERTICAL_OFFSET;
  const tapWidth = 64;
  const tapHeight = 44;
  return {
    x: centerX - tapWidth / 2,
    y: centerY - tapHeight / 2,
    width: tapWidth,
    height: tapHeight,
  };
}
```

- [ ] **Step 2: Add the tappable overlay to `ArchetypeCanvas.tsx`**

In `src/components/compose/ArchetypeCanvas.tsx`, add imports:

```ts
import { Pressable, View, useWindowDimensions } from 'react-native';

import { getCardFrame, shouldRenderWatermark } from '@/components/compose/archetypes/shared';
import { getWatermarkTapRegion, Watermark } from '@/components/compose/archetypes/Watermark';
```

(the first line replaces the existing `import { useWindowDimensions } from 'react-native';`; the third line replaces the existing `import { Watermark } from '@/components/compose/archetypes/Watermark';`). Update the `Props` interface:

```ts
interface Props {
  palette: Palette;
  config: LayoutConfig;
  onWatermarkPress?: () => void;
}
```

Update the component signature and body — change:

```tsx
export function ArchetypeCanvas({ palette, config }: Props) {
```

to:

```tsx
export function ArchetypeCanvas({ palette, config, onWatermarkPress }: Props) {
```

Then compute the watermark-visible flag once and reuse it for both the Skia render and the tap overlay — change:

```tsx
        {shouldRenderWatermark(config.watermarkVisible, subscriptionStatus) && (
          <Watermark width={CANVAS_W} height={CANVAS_H} cornerRadius={config.cornerRadius} />
        )}
      </Group>
    </Canvas>
  );
}
```

to:

```tsx
        {watermarkShown && (
          <Watermark width={CANVAS_W} height={CANVAS_H} cornerRadius={config.cornerRadius} />
        )}
      </Group>
    </Canvas>
  );
}
```

and, immediately before the `return (` line, add:

```ts
  const watermarkShown = shouldRenderWatermark(config.watermarkVisible, subscriptionStatus);
  const tapRegion = getWatermarkTapRegion(CANVAS_W, CANVAS_H);
```

Finally, wrap the whole return value in a `View` and add the `Pressable` overlay (positioned only when the mark is showing, tappable only for free-tier users, and only if a handler was passed) — change the full `return (...)` block from:

```tsx
  return (
    <Canvas style={{ width: screenW, height: displayH }}>
      <Group transform={[{ scale }]}>
        <Group clip={clip}>
          <Component {...archetypeProps} />
        </Group>

        {overlay}
        {watermarkShown && (
          <Watermark width={CANVAS_W} height={CANVAS_H} cornerRadius={config.cornerRadius} />
        )}
      </Group>
    </Canvas>
  );
}
```

to:

```tsx
  return (
    <View style={{ width: screenW, height: displayH }}>
      <Canvas style={{ width: screenW, height: displayH }}>
        <Group transform={[{ scale }]}>
          <Group clip={clip}>
            <Component {...archetypeProps} />
          </Group>

          {overlay}
          {watermarkShown && (
            <Watermark width={CANVAS_W} height={CANVAS_H} cornerRadius={config.cornerRadius} />
          )}
        </Group>
      </Canvas>

      {watermarkShown && subscriptionStatus === 'free' && onWatermarkPress && (
        <Pressable
          onPress={onWatermarkPress}
          style={{
            position: 'absolute',
            left: tapRegion.x * scale,
            top: tapRegion.y * scale,
            width: tapRegion.width * scale,
            height: tapRegion.height * scale,
          }}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 3: Wire the handler from the palette screen**

In `app/palette/[id].tsx`, change:

```tsx
        <ArchetypeCanvas palette={palette} config={config} />
```

to:

```tsx
        <ArchetypeCanvas
          palette={palette}
          config={config}
          onWatermarkPress={() => {
            trackEvent('paywall_shown', { trigger: 'watermark_tap' });
            router.push({ pathname: '/paywall', params: { trigger: 'watermark_tap' } });
          }}
        />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Run the full test suite (regression check)**

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/compose/archetypes/Watermark.tsx src/components/compose/ArchetypeCanvas.tsx "app/palette/[id].tsx"
git commit -m "Make the free-tier watermark tappable, routing to the paywall"
```

---

### Task 7: Settings screen — subscription status + upgrade entry point

**Files:**
- Modify: `app/(tabs)/settings.tsx`

**Interfaces:**
- Consumes: `useSettingsStore` (`subscriptionStatus`, `subscriptionExpiresAt` — existing); the `/paywall` route (Task 3).
- Produces: nothing consumed elsewhere — this is the plan's last task.

- [ ] **Step 1: Replace the placeholder with a real subscription section**

Replace the full contents of `app/(tabs)/settings.tsx` with:

```tsx
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { Colors, Radius, Spacing } from '@/lib/tokens';

function formatExpiration(expiresAt: number | null): string {
  if (expiresAt === null) return 'De por vida';
  return new Date(expiresAt).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function SettingsScreen() {
  const subscriptionStatus = useSettingsStore((s) => s.subscriptionStatus);
  const subscriptionExpiresAt = useSettingsStore((s) => s.subscriptionExpiresAt);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text variant="h1">Ajustes</Text>
      </View>

      <View style={styles.section}>
        {subscriptionStatus === 'premium' ? (
          <View style={styles.proCard}>
            <Text variant="label" color={Colors.accent}>HUED PRO</Text>
            <Text variant="body" color={Colors.textSecondary}>
              {formatExpiration(subscriptionExpiresAt)}
            </Text>
          </View>
        ) : (
          <Button
            label="Mejorar a Pro"
            onPress={() => router.push({ pathname: '/paywall', params: { trigger: 'settings' } })}
            variant="primary"
            fullWidth
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  proCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Run the full test suite (regression check)**

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/settings.tsx"
git commit -m "Add subscription status and upgrade entry point to Settings"
```

---

## Verification (final, whole-branch)

- `npx tsc --noEmit` clean.
- `npx jest` — all existing + new tests green (`mapCustomerInfo.test.ts`, `exportGate.test.ts` new; `shared.test.tsx` extended).
- Manual, by the user, after a dev-client rebuild (`npx expo run:android`) — not part of automated task verification: open Settings → "Mejorar a Pro" → paywall shows 3 packages with live Test Store pricing → purchase each tier in sandbox → confirm Settings flips to the Pro card, watermark disappears from preview/export, export limit lifts; force a free account back to 3/3 exports and confirm the 4th attempt redirects to the paywall instead of exporting; tap the watermark on a free-tier palette and confirm it opens the paywall; "Restaurar compras" round-trips correctly after a simulated reinstall.
