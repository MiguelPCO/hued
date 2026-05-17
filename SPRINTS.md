# Hued — Sprint Plan

> 6 sprints (Sprint 0-5) totaling ~32 working days, distributed across 6-8 weeks part-time.

**Methodology:** Each sprint has a goal, day-by-day tasks, acceptance criteria, and definition of done. Tasks are intentionally specific so each day has a clear "what should be done by EOD".

**Working assumption:** Solo developer (Miguel) using Claude Code in agentic flow. Day = ~3-4 focused hours of coding.

---

## Sprint timeline overview

| Sprint | Name | Duration | Key deliverable |
|---|---|---|---|
| 0 | Foundations | 4 days | Empty Expo app boots with Skia, design tokens, analytics, persistence |
| 1 | Capture flow | 5 days | Camera + Gallery + Crop save images to sandbox |
| 2 | Extract engine | 6 days | K-means + LAB + naming returns 5 ExtractedColors |
| 3 | Layout Engine + 5 archetypes | 8 days | All 5 archetypes render in live Skia preview |
| 4 | Export + History | 4 days | PNG export at 3 resolutions + SQLite history with favorites |
| 5 | Monetization + Launch | 5 days | Paywall + onboarding + Play Store Internal Testing |

**Total: 32 working days = ~6-8 weeks part-time**

---

## Sprint 0 — Foundations (4 days)

### Goal
Empty Expo app boots on Android emulator + physical device, with TypeScript strict, Expo Router, design tokens, Skia installed, Sentry and PostHog wired, and a "Hello Skia" smoke test rendering at 60fps.

### Day 1 — Project bootstrap

- [ ] Initialize Expo project: `npx create-expo-app@latest hued --template blank-typescript`
- [ ] Switch to pnpm, remove `package-lock.json`, run `pnpm install`
- [ ] Configure `tsconfig.json` for strict mode (`strict: true`, `noImplicitAny: true`)
- [ ] Add path aliases (`@/*` → `./src/*`)
- [ ] Initialize git, first commit
- [ ] Add `.nvmrc` pinning Node 20 LTS
- [ ] Configure ESLint + Prettier with Miguel's standard config
- [ ] Add `engines` field in package.json (node >=20, pnpm >=9)
- [ ] Create folder structure per SCHEMA.md (`src/components/`, `src/lib/`, `src/data/`, `src/types/`)

**EOD check:** `pnpm start` boots Metro, app runs on Android emulator. `tsc --noEmit` passes. `pnpm lint` passes with zero warnings.

### Day 2 — Routing, design system, fonts

- [ ] Install and configure `expo-router`
- [ ] Create `app/_layout.tsx` with providers (Theme, SafeArea, Gestures)
- [ ] Create `app/(tabs)/_layout.tsx` and stub tabs (Home, Capture, Settings)
- [ ] Build design tokens in `src/lib/tokens.ts` (OKLCH-based palette, spacing, radius, typography scale)
- [ ] Build atom components: `Button`, `Card`, `Text`, `Icon`, `Sheet`
- [ ] Load custom fonts via `expo-font`: Outfit (sans), Instrument Serif (display), JetBrains Mono (mono)
- [ ] Verify all 3 tabs navigate and render with consistent typography

**EOD check:** All 3 tabs render with consistent typography and tokens. Bottom navigation works on emulator and physical device.

### Day 3 — Observability, Skia smoke test

- [ ] Install `@shopify/react-native-skia`
- [ ] Run prebuild: `npx expo prebuild --platform android`
- [ ] Build dev client: `npx expo run:android`
- [ ] Create `src/components/test/SkiaSmokeTest.tsx` rendering a circle, rect, and gradient
- [ ] Verify 60fps in React DevTools Profiler
- [ ] Install Sentry: `npx @sentry/wizard@latest -i reactNative`
- [ ] Install PostHog: `npx expo install posthog-react-native`
- [ ] Wire PostHog provider in `_layout.tsx`
- [ ] Create `src/lib/analytics/events.ts` with typed `EventMap` (per SCHEMA.md §8)
- [ ] Fire test event `app_opened` on mount

**EOD check:** Sentry dashboard shows session, PostHog shows `app_opened` event, Skia smoke test renders at 60fps.

### Day 4 — Persistence layer, EAS Build config

- [ ] Install `react-native-mmkv` and `expo-sqlite`
- [ ] Create `src/lib/db/client.ts` (SQLite singleton with migration runner)
- [ ] Create `src/lib/db/schema.ts` with migration table
- [ ] Write migration 001 (palettes table per SCHEMA.md §5)
- [ ] Create `src/lib/store/settingsStore.ts` (Zustand + MMKV middleware)
- [ ] Add EAS Build config (`eas.json`) with development, preview, and production profiles
- [ ] Run `eas build:configure` to link to Expo account
- [ ] Verify development build runs on physical device via QR code

**EOD check:** App boots, settings persist across restarts, SQLite migration runs idempotently. Development build installable on physical device.

### Acceptance criteria (Sprint 0)

- App boots on Android emulator and physical device without errors
- All tabs accessible via bottom navigation
- Design tokens visible in all atom components
- Sentry captures crashes
- PostHog tracks events
- SQLite migrations run idempotently
- Skia renders at 60fps
- TypeScript strict passes

### Definition of done (Sprint 0)

- All code committed to git with descriptive commits
- README.md updated with setup instructions
- CLAUDE.md created with project context (see START.md template)
- No TypeScript errors with `tsc --noEmit`
- ESLint passes with zero warnings
- EAS Build artifact downloadable from Expo dashboard

### Risks to watch

- Expo prebuild can hit native module conflicts — budget extra time on Day 3 if first build fails
- Skia install on Apple Silicon can require Rosetta — flag for Miguel if hitting this
- Android emulator hardware acceleration: requires Hyper-V or KVM enabled

---

## Sprint 1 — Capture flow (5 days)

### Goal
User can take a photo (camera) or pick from gallery, crop it, confirm, and have it saved to app sandbox with a generated thumbnail and database row.

### Day 1 — Camera screen

- [ ] Install `expo-camera`
- [ ] Add camera permissions to `app.config.ts`
- [ ] Build `src/components/capture/CameraView.tsx`
- [ ] Implement permission request flow with denied/granted states
- [ ] Capture button: `takePictureAsync({ quality: 1, exif: false })`
- [ ] Optional rule-of-thirds grid toggle
- [ ] Front/back camera toggle
- [ ] Flash toggle (auto/on/off)
- [ ] Track `capture_started` and `capture_completed` events

**EOD check:** Photo captured on physical device, saved temporarily, navigates to crop screen with URI.

### Day 2 — Gallery picker

- [ ] Install `expo-image-picker`
- [ ] Build `src/components/capture/GalleryPicker.tsx`
- [ ] Request `mediaLibraryPermissions`
- [ ] Launch picker with `mediaTypes: ['images']`, `allowsEditing: false`, `quality: 1`
- [ ] Handle cancel state (fire `capture_cancelled` event)
- [ ] Pass selected URI to crop screen
- [ ] Wire entry point from Home empty state and "+" CTA

**EOD check:** Picker opens, image selected, navigates to crop screen.

### Day 3 — Crop tool

- [ ] Install `react-native-image-crop-picker`
- [ ] Build `app/crop.tsx` screen
- [ ] Allow free-form aspect ratio
- [ ] Add aspect ratio presets (1:1, 4:5, 9:16, original)
- [ ] Loading state during crop
- [ ] Error state if user cancels mid-crop
- [ ] Confirm button → navigates to Compose screen

**EOD check:** Image cropped for all 4 aspect ratio presets, navigates correctly.

### Day 4 — Image optimization + sandbox storage

- [ ] Install `expo-image-manipulator`
- [ ] Create `src/lib/utils/image.ts` with `optimize()` (max 2048 longest edge) and `thumbnail()` (200×200 square)
- [ ] Create `src/lib/db/palettes.ts` with `savePalette()` (writes both files + DB row)
- [ ] Generate ULID for palette ID (install `ulidx`)
- [ ] Save full image to `${docDir}palettes/${id}/full.jpg`
- [ ] Save thumbnail to `${docDir}palettes/${id}/thumb.jpg`
- [ ] Stub `colors`, `layoutConfig` for now (will fill in Sprint 2-3)
- [ ] Verify with DB Browser for SQLite that rows persist correctly

**EOD check:** Palette row created in SQLite with all metadata, both files exist on disk at correct paths.

### Day 5 — Capture flow integration, tests

- [ ] Wire CameraView → Crop → Confirm into a single flow
- [ ] Wire GalleryPicker → Crop → Confirm
- [ ] Add loading states between transitions
- [ ] Add cancel-back-to-home affordance from every stage
- [ ] Smoke test: full flow on physical device with 5 different photos
- [ ] Write jest tests for image utility functions (resize, thumbnail, hex conversion)
- [ ] Write jest tests for ULID generation determinism

**EOD check:** Full capture flow works end-to-end on physical device. Cancel from any stage returns home cleanly.

### Acceptance criteria (Sprint 1)

- Camera opens, captures photo, saves correctly
- Gallery picker opens, selects photo, saves correctly
- Crop tool works for all aspect ratio presets
- Thumbnails generated correctly (200×200, max 30KB)
- Palette row visible in SQLite with correct metadata
- Permission denials handled gracefully (not a dead-end)

### Definition of done (Sprint 1)

- All capture screens have loading, error, and empty states
- Permission denial UI is friendly (not a dead-end, offers alternative)
- No memory leaks (verify with React DevTools profiler over 20 captures)
- Sentry captures any thrown errors
- PostHog tracks all capture lifecycle events

### Risks to watch

- Camera/gallery permissions can be denied — robust UX matters
- `react-native-image-crop-picker` may need iOS pod install on macOS later (track but defer)
- Large photos can cause OOM on low-end devices — optimize before saving

---

## Sprint 2 — Extract engine (6 days)

### Goal
Given an image URI, return 5 `ExtractedColor`s in <800ms with accurate, evocative names. The engine is testable in isolation with deterministic seeded mode.

### Day 1 — Color space conversions

- [ ] Create `src/lib/extract/colorSpace.ts`
- [ ] Implement `rgbToXyz(rgb)`, `xyzToLab(xyz)`, `rgbToLab(rgb)`
- [ ] Implement inverse: `labToXyz`, `xyzToRgb`, `labToRgb`
- [ ] Implement `rgbToHex(rgb)`, `hexToRgb(hex)`
- [ ] Implement `rgbToHsl(rgb)`
- [ ] Write unit tests with known reference colors (red, green, blue, white, black, gray, sRGB pure primaries)

**EOD check:** All conversions round-trip with <0.5 error in LAB units. 15+ unit tests passing.

### Day 2 — K-means core

- [ ] Create `src/lib/extract/kmeans.ts`
- [ ] Implement k-means++ seeding for stable initialization
- [ ] Implement Lloyd's algorithm (assignment → update → repeat)
- [ ] Convergence criterion: <0.5 LAB distance per centroid, or 20 iterations max
- [ ] Return centroids with cluster weights (% of total pixels assigned)
- [ ] Deterministic mode with seeded RNG (for tests and reproducibility)
- [ ] Write unit tests with synthetic 5-color images (planted clusters)

**EOD check:** K-means recovers planted clusters with <2 LAB distance error. Deterministic mode produces identical output across runs.

### Day 3 — Image decode + downsample

- [ ] Research best approach: `expo-image-manipulator` for resize, then decode with Skia/canvas
- [ ] Implement `decodePixels(uri, size)` returning `Uint8Array` of RGBA
- [ ] Downsample to 150×150 before k-means (sufficient for color extraction)
- [ ] Strip alpha channel before passing to k-means
- [ ] Benchmark on Pixel 6 and Pixel 3a (or equivalent emulator profiles)

**EOD check:** Decode+downsample completes in <200ms for 12MP photo on mid-range device.

### Day 4 — Color naming dataset

- [ ] Source `color-name-list` from npm
- [ ] Write build-time script `scripts/preprocess-colors.ts`: compute LAB for each color, save as `src/data/named-colors.json`
- [ ] Curate dataset: remove generic numeric names ("color1234"), prefer evocative names (Sherwin-Williams, Pantone-like, vintage paint names)
- [ ] Implement `src/lib/extract/colorNaming.ts` with `nearestColorName(lab)` using O(n) scan
- [ ] Optional optimization: KD-tree if scan is >5ms per lookup
- [ ] Snapshot test 20 known colors against expected names

**EOD check:** Naming returns evocative names for 20 test colors. No "color1234" generic names in dataset.

### Day 5 — End-to-end pipeline + benchmarks

- [ ] Create `src/lib/extract/pipeline.ts` orchestrating decode → kmeans → naming
- [ ] Sort centroids by L (luminosity) descending
- [ ] Wire into Confirm screen so palette is populated after crop
- [ ] Update SQLite row with extracted colors
- [ ] Benchmark on 5 reference images representing different scene types (sunset, monochrome, neon, forest, indoor)
- [ ] If >800ms on mid-range device: optimize (smaller sample, parallelization, reservoir sampling)
- [ ] If still slow: document ADR for fallback to `react-native-image-colors`

**EOD check:** Full pipeline <800ms on Pixel 6 with 5 test images. Palette persisted to SQLite.

### Day 6 — Visual review + edge cases

- [ ] Test on 20 diverse images (the reference set Miguel curated + new photos)
- [ ] Handle edge case: image is mostly one color (k-means returns near-duplicates) → add minimum distance threshold between centroids
- [ ] Handle edge case: image has alpha/transparency → strip alpha pre-extraction
- [ ] Handle edge case: image is very small (<150px on shortest edge) → skip downsample
- [ ] Handle edge case: extraction fails (corrupt image, decode error) → graceful error with retry
- [ ] Tune k-means iterations and tolerance for best speed/quality balance
- [ ] Add Sentry breadcrumbs for extract timing
- [ ] Visual review session with Miguel: side-by-side palettes vs reference images

**EOD check:** Extract returns visually plausible palettes for all 20 test images. Edge cases handled without crashes.

### Acceptance criteria (Sprint 2)

- Extract returns exactly 5 colors per image
- Colors are sorted light → dark by L channel
- Names are non-empty, unique per palette, and evocative
- Pipeline completes in <800ms on mid-range device (Pixel 6 baseline)
- All color space conversions round-trip accurately (<0.5 LAB error)
- Deterministic seeded mode produces reproducible results

### Definition of done (Sprint 2)

- 15+ unit tests for color space conversions
- 5+ unit tests for k-means (planted clusters)
- 20+ snapshot tests for color naming
- Benchmark script committed (`scripts/benchmark-extract.ts`)
- ADR documented for any fallback decisions made during sprint
- Sentry breadcrumbs configured for extract timing in production

### Risks to watch

- Performance on Android Go / very low-end devices — may need fallback library
- Pixel decoding API may differ between Expo SDK versions — pin Expo version explicitly
- Color naming dataset license — verify `color-name-list` MIT/permissive

---

## Sprint 3 — Layout Engine + 5 archetypes (8 days)

### Goal
All 5 archetypes render in a live Skia preview that updates at 60fps as the user changes config. Layout engine is config-driven with shared `RendererProps` contract.

### Day 1 — Layout engine abstraction

- [ ] Create `src/types/archetype.ts` with `Archetype`, `SlotConfig`, `SkiaRenderer`, `RendererProps` types (per SCHEMA.md §4)
- [ ] Create `src/data/archetypes.ts` with empty `ARCHETYPES` registry
- [ ] Create `src/components/compose/SkiaPreview.tsx` that dispatches to the registered renderer based on `archetypeId`
- [ ] Create stub renderers for all 5 archetypes (return empty Group with id label)
- [ ] Verify dispatching works: switching `archetypeId` swaps the renderer

**EOD check:** SkiaPreview renders the correct stub when archetypeId changes. Switching is instant with no flicker.

### Day 2 — Strip renderer

- [ ] Implement `src/lib/skia/renderers/strip.tsx`
- [ ] Photo at top (configurable 70-85% height based on `position`)
- [ ] 5 swatches (circles or pills based on `cornerRadius`)
- [ ] Optional hex/name labels below swatches
- [ ] Watermark in bottom-right corner if `watermarkVisible`
- [ ] Test all `position`, `cornerRadius`, `showHex`, `showName` combinations

**EOD check:** Strip renders correctly for 3 different test palettes with all config combinations.

### Day 3 — Editorial renderer

- [ ] Implement `src/lib/skia/renderers/editorial.tsx`
- [ ] Photo as full background
- [ ] 5 named cards stacked vertically with hex codes
- [ ] Card style: solid / transparent / blur (use Skia's `BlurMask`)
- [ ] Font family from config (serif by default for editorial feel)
- [ ] Vertical positioning based on `position` (top, center, bottom)

**EOD check:** Editorial renders cleanly with all 3 card styles. Typography matches design tokens.

### Day 4 — Grid renderer

- [ ] Implement `src/lib/skia/renderers/grid.tsx`
- [ ] Photo as full background
- [ ] 2×3 grid of cards (5 cards + 1 watermark slot in card #6 for free tier)
- [ ] Or 2×2 floating cards with watermark separate for premium tier
- [ ] Centered with 16px margin from edges
- [ ] Card spacing: 12px

**EOD check:** Grid handles both 5-card free (with watermark card) and 5-card premium layouts.

### Day 5 — Banner renderer

- [ ] Implement `src/lib/skia/renderers/banner.tsx`
- [ ] Photo on top 75-80%
- [ ] Continuous horizontal swatch strip below (or above based on `position`)
- [ ] Optional hex labels inside strip if strip is tall enough
- [ ] Swatches divide width equally with subtle dividers

**EOD check:** Banner renders correctly in both top and bottom positions. Labels are legible.

### Day 6 — Side renderer

- [ ] Implement `src/lib/skia/renderers/side.tsx`
- [ ] Photo as full background
- [ ] 5 cards stacked on right or left edge based on `position`
- [ ] Cards have consistent widths
- [ ] Optional hex/name labels
- [ ] Card style affects opacity/blur

**EOD check:** Side renders correctly on both left and right positions.

### Day 7 — Compose screen UI

- [ ] Build `app/palette/[id].tsx` (Compose screen)
- [ ] Top: SkiaPreview (60% of screen height, 4:5 aspect ratio frame)
- [ ] Below: ArchetypePicker (5 thumbnails in horizontal scroll, each is a mini-SkiaPreview)
- [ ] Below: ConfigPanel (collapsible accordion, sections for Position, Font, Style, Metadata)
- [ ] Bottom: Export button (full width, primary CTA)
- [ ] Wire all config changes to Zustand store → SkiaPreview re-renders
- [ ] Track `archetype_selected` and `config_changed` events

**EOD check:** User can navigate Compose, switch archetypes, see preview update at 60fps on physical device.

### Day 8 — Polish + edge cases

- [ ] Loading state while image decodes into Skia
- [ ] Handle palette with very similar colors (visual differentiation in render — minimum gap or border)
- [ ] Handle very dark photos (label legibility — auto-invert label color)
- [ ] Handle very light photos (same — auto-darken label background)
- [ ] Watermark renderer (shared across archetypes via `src/lib/skia/watermark.tsx`)
- [ ] Performance pass: confirm 60fps with React DevTools Profiler
- [ ] Skia memory: confirm image is released when navigating away from Compose

**EOD check:** Compose screen feels polished and responsive on physical device. No FPS drops during rapid config changes.

### Acceptance criteria (Sprint 3)

- All 5 archetypes render correctly with all config combinations
- Switching archetype is instant (no flash, no flicker)
- Config changes update preview at 60fps
- Watermark renders correctly for free tier in all 5 archetypes
- ArchetypePicker thumbnails accurately preview each layout

### Definition of done (Sprint 3)

- Visual review with Miguel: side-by-side with the 20 reference images
- Snapshot tests for each renderer (Skia canvas → captured image → diff)
- TypeScript strict passes
- No runtime warnings in console
- Memory usage stable across 20 archetype switches

### Risks to watch

- Skia + React reconciliation can flicker during fast updates — use `useDerivedValue` from reanimated where needed
- Font loading on first render — preload fonts in Sprint 0 paid off here
- Skia memory: large `SkImage`s must be explicitly disposed

---

## Sprint 4 — Export + History (4 days)

### Goal
User can export the current palette as PNG at 3 resolutions, share via native share sheet, save to camera roll. History tab shows all saved palettes with favorite + delete actions.

### Day 1 — Export pipeline

- [ ] Install `react-native-view-shot`
- [ ] Wire `captureRef` to SkiaPreview component
- [ ] Build `app/export.tsx` modal with resolution picker (1×, 2×, 4×)
- [ ] Implement `exportPalette(id, resolution)` in `src/lib/export/exportPalette.ts`
- [ ] Resolution scaling: BASE_WIDTH=1080 → 1×=1080, 2×=2160, 4×=4320
- [ ] BASE_HEIGHT=1350 (4:5 aspect, IG-friendly)
- [ ] Save to camera roll via `expo-media-library.createAssetAsync`
- [ ] Track `palette_exported` event with resolution and archetype

**EOD check:** Export saves PNG at correct resolution to camera roll. Watermark visible on free tier exports.

### Day 2 — Share sheet integration

- [ ] Install `expo-sharing`
- [ ] After export, present `Sharing.shareAsync(uri, { mimeType: 'image/png' })`
- [ ] Handle cancel state
- [ ] Track `palette_shared` event
- [ ] Increment `exportCount` on Palette row
- [ ] Increment daily export counter in subscription store (gate at 3 for free tier)

**EOD check:** Share sheet opens with Instagram, Pinterest, Threads, etc. Free tier blocked at 4th export with paywall.

### Day 3 — History grid + actions

- [ ] Build `app/(tabs)/index.tsx` (Home / History) with palette grid
- [ ] Grid layout: 2 columns of `PaletteCard`
- [ ] PaletteCard shows thumbnail + 5 color dots + relative date ("2h ago", "Yesterday", "3 days ago")
- [ ] Tap card → navigate to Compose screen with that palette
- [ ] Long-press card → action sheet (Favorite, Delete, Duplicate, Share)
- [ ] Empty state: friendly illustration + "Take your first photo" CTA → Capture flow
- [ ] Pull-to-refresh

**EOD check:** History grid renders palettes correctly, all actions work, navigation back from Compose preserves scroll position.

### Day 4 — Filter + favorites

- [ ] Add favorite toggle (heart icon) in PaletteCard
- [ ] Filter pills at top: All / Favorites
- [ ] Simple search bar (LIKE query against color names — full FTS5 deferred to Phase 2)
- [ ] Empty state for filtered/searched empty results
- [ ] Toggle favorite updates SQLite and re-renders without full reload

**EOD check:** Filter and search work, favorite toggle persists across app restarts.

### Acceptance criteria (Sprint 4)

- Export produces correct-resolution PNG with watermark for free tier
- Share sheet shows native targets on Android
- Save to camera roll works with proper permissions
- History grid displays all palettes correctly with thumbnails
- Filter and search are responsive (<50ms perceived)
- Long-press actions work on every palette

### Definition of done (Sprint 4)

- Export retry path if write fails (e.g. storage full)
- All async operations have loading and error states
- Sentry captures export failures with full context
- Camera roll permissions handled gracefully (Android 13+ granular permissions)
- Thumbnail generation works for all aspect ratios

### Risks to watch

- Camera roll permissions on Android 13+ (granular permissions vs READ_MEDIA_IMAGES)
- File system errors when disk is near full — show clear error message
- View-shot with Skia: confirm captures full canvas, not just visible portion

---

## Sprint 5 — Monetization + Launch prep (5 days)

### Goal
Free tier gating fully enforced, RevenueCat paywall, onboarding flow, Play Store assets uploaded, submitted to Internal Testing track with 5 testers.

### Day 1 — RevenueCat setup

- [ ] Create RevenueCat account (free tier)
- [ ] Configure entitlement: `premium`
- [ ] Configure offering: `default` with monthly ($2.99) + annual ($19.99) products
- [ ] Create Google Play developer account ($25 one-time) if not already
- [ ] Create in-app product in Play Console for monthly and annual subscriptions
- [ ] Link Play Console to RevenueCat
- [ ] Install `react-native-purchases` and `react-native-purchases-ui`
- [ ] Initialize SDK in `_layout.tsx`
- [ ] Build `src/lib/revenuecat/client.ts` with `init`, `checkSubscription`, `presentPaywall`
- [ ] Sync subscription state to Zustand store on app launch

**EOD check:** SDK initializes, can query offerings without errors. Sandbox account configured for test purchases.

### Day 2 — Paywall UI + gating

- [ ] Build `app/paywall.tsx` modal with feature comparison
- [ ] Wire paywall triggers:
  - Daily limit reached (4th export attempt in 24h for free)
  - Tap on watermark in preview
  - Tap "Upgrade" in Settings
- [ ] Implement watermark forced render for free tier (already in Sprint 3)
- [ ] Implement daily counter in `src/lib/store/subscriptionStore.ts` (UTC midnight reset)
- [ ] Test purchase flow with RevenueCat sandbox
- [ ] Implement "Restore Purchases" button
- [ ] Track `paywall_shown`, `paywall_dismissed`, `subscription_purchased`, `subscription_restored`

**EOD check:** Paywall renders, sandbox purchase succeeds, premium tier unlocks features. Restore purchases works.

### Day 3 — Onboarding flow

- [ ] Build `app/onboarding.tsx` with 3 slides:
  - Slide 1: "Capture color, anywhere" — photo illustration
  - Slide 2: "We find the palette" — extraction illustration
  - Slide 3: "Share it. Pin it. Save it." — export illustration
- [ ] Each slide with smooth swipe transition (use Reanimated)
- [ ] CTA on slide 3: "Start" → permissions request → Home
- [ ] Persist `onboarding.completed` in MMKV (already in Sprint 0 settingsStore)
- [ ] "Reset onboarding" option in Settings for testing
- [ ] Track `onboarding_completed` event with duration

**EOD check:** Onboarding plays on first install, skipped on subsequent launches. Permissions requested with context.

### Day 4 — Play Store assets

- [ ] App icon: 512×512 PNG (designed in Figma per Miguel's brand)
- [ ] Adaptive icon: foreground + background layers
- [ ] Feature graphic: 1024×500
- [ ] Phone screenshots: 6 captures (Home, Capture, Compose, Export, Premium upsell, Onboarding) — use device frames
- [ ] Short description (80 chars): "Turn any photo into a beautiful color palette infographic."
- [ ] Long description (4000 chars max) — emphasize editorial output, ease of use
- [ ] Privacy policy URL (use TermsFeed or generate)
- [ ] Terms of service URL
- [ ] Content rating questionnaire
- [ ] Target audience: 13+
- [ ] Data safety form: declare PostHog analytics, Sentry crash reporting, no PII

**EOD check:** All assets uploaded to Play Console with zero rejected fields.

### Day 5 — Submission + smoke test

- [ ] EAS Build: production AAB (`eas build --platform android --profile production`)
- [ ] Upload to Play Console Internal Testing track
- [ ] Add 5 internal testers (Miguel + close friends, by Gmail addresses)
- [ ] Send testing link
- [ ] Smoke test full flow on Internal track build (downloaded from Play Store):
  - Onboarding completes
  - Camera permissions granted
  - Capture works (both camera and gallery)
  - Extract returns palette in <800ms
  - All 5 archetypes render correctly
  - Export saves and shares to Instagram, Pinterest, Threads
  - Paywall triggers on 4th export
  - Subscribe (test mode) → unlocks features → watermark removed
- [ ] Tag git release `v1.0.0-internal`
- [ ] Create GitHub Release with notes

**EOD check:** Internal testers can install and run app from Play Store link. Full happy path completes without crashes.

### Acceptance criteria (Sprint 5)

- Free tier limits enforced (3 exports/day, watermark forced)
- Paywall converts in sandbox
- Subscription state persists across app restarts
- Restore purchases works
- Onboarding shows once, persists completion
- All Play Store assets approved (no rejected fields)
- Internal Testing build downloadable by testers

### Definition of done (Sprint 5)

- App submitted to Play Console Internal Testing
- At least 1 successful purchase in sandbox
- All Sentry events configured correctly with release tracking
- PostHog dashboard shows install + onboarding events from testers
- README updated with launch checklist
- `v1.0.0-internal` tagged and pushed

### Risks to watch

- Play Store review can flag subscription wording — pre-read Google Play subscription policies before submission
- Crash on first launch after install (cold start) — test on freshly installed app multiple times
- RevenueCat sandbox limitations — test on a real Play Console internal track build, not just dev build

---

## Post-launch plan (weeks after Sprint 5)

### Week 1 — Monitor & iterate

- Watch Sentry for crashes daily
- Review PostHog funnel: install → onboarding completion → first export → share
- Gather Internal Testing feedback via shared doc
- Hotfix any critical bugs via OTA (Expo Updates)

### Week 2 — Closed Beta

- Promote to Play Console Closed Beta track
- Recruit 50-100 testers via Twitter/X, Threads, Miguel's network
- Target metrics: D1 retention, share rate, paywall conversion

### Week 3 — Open Beta or Production

- If metrics look good (D1 >20%, share rate >30%): promote to Production
- If not: stay in Open Beta, iterate

### Week 4 — Marketing kickoff

- Product Hunt launch
- Twitter/X thread with palette gallery
- Threads + Instagram Stories using the app itself
- Reach out to design newsletters (Sidebar, Designer News)

---

## Phase 2 backlog (post-launch)

Ordered by expected impact:

1. **iOS port via TestFlight** — opens the higher-spending audience
2. **Cloud sync via Supabase** — converts Daniel persona to premium
3. **Premium template library** (+10 archetypes) — converts Lucía persona
4. **FTS5 search on color names** — quality-of-life for power users
5. **Custom font upload** — premium feature
6. **Color blindness simulation** — accessibility palette validation
7. **Tailwind tokens export** — designer power feature
8. **Palette collections / folders** — organization
9. **Style transfer** — apply a palette to a different photo
10. **API endpoint** — developer tier $9.99/month

---

## Document changelog

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-05-17 | Miguel + AI mentor | Initial sprint plan |
