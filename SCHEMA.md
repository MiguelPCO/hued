# Hued — Technical Schema & Architecture

> Complete architecture, data model, engine designs, and decision log for the Hued mobile app.

**Stack:** Expo SDK 51+ · React Native 0.74+ · TypeScript strict · React Native Skia
**Author:** Miguel
**Status:** v0.1 — pre-Sprint 0
**Last updated:** 2026-05-17

---

## 1. Tech stack with rationale

### Core runtime

| Layer | Choice | Why |
|---|---|---|
| Mobile framework | Expo SDK 51+ | OTA updates, cross-platform foundation, native module ecosystem without ejection |
| RN version | 0.74+ | New Architecture (Fabric + TurboModules) opt-in available, Hermes by default |
| Language | TypeScript strict | Type safety, IDE support, direct transfer from Miguel's web stack |
| Navigation | Expo Router | File-based routing — identical mental model to Next.js App Router |

### State & persistence

| Layer | Choice | Why |
|---|---|---|
| Client state | Zustand v5 | Familiar from CUPPING, minimal boilerplate, persists with middleware |
| Local KV | MMKV (react-native-mmkv) | ~30× faster than AsyncStorage, synchronous reads (critical for boot path) |
| Local DB | expo-sqlite | Structured palette history with future FTS5 search |
| Cloud sync (Phase 2) | Supabase | Familiar, RLS-friendly, realtime if needed later |

### Color processing

| Layer | Choice | Why |
|---|---|---|
| Extraction | Custom k-means in TypeScript | Educational value, full control over color space and tie-breaking |
| Color space | CIE LAB | Perceptual uniformity — RGB distance lies, LAB doesn't |
| Naming | color-name-list dataset + nearest-neighbor in LAB | ~1500 named colors, evocative names, deterministic matching |
| Image manipulation | expo-image-manipulator | Resize before extraction for speed |

### Rendering & export

| Layer | Choice | Why |
|---|---|---|
| Canvas | @shopify/react-native-skia | 60fps composition, full control, perfect for layout engine |
| Capture | react-native-view-shot | Captures Skia canvas as PNG at arbitrary resolution |
| Share | expo-sharing | Native share sheet on Android |
| Save | expo-media-library | Save to camera roll with proper permissions |
| Camera | expo-camera | Permissions, capture, basic composition guides |
| Gallery | expo-image-picker | Standard photo picker |
| Crop | react-native-image-crop-picker | Mature, well-maintained, custom aspect ratios |

### Business layer

| Layer | Choice | Why |
|---|---|---|
| Paywall | RevenueCat | Industry standard, cross-platform subscriptions, restore purchases, analytics |
| Analytics | PostHog | Open-source, EU servers, generous free tier, mobile SDK mature |
| Crash reporting | Sentry | Free for hobby tier, RN SDK well-supported |

---

## 2. System architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Hued mobile app                          │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ Capture  │→ │  Extract │→ │ Compose  │→ │   Export    │ │
│  │  engine  │  │  engine  │  │  engine  │  │   engine    │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘ │
│       ↓             ↓              ↓              ↓         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Zustand stores (in-memory state)           │   │
│  └─────────────────────────────────────────────────────┘   │
│       ↓             ↓              ↓              ↓         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  MMKV (settings)  |  SQLite (history) |  FS (images) │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
       ↓                                            ↓
  ┌─────────┐                              ┌─────────────┐
  │ PostHog │                              │ RevenueCat  │
  │ Sentry  │                              │  (paywall)  │
  └─────────┘                              └─────────────┘
```

**Data flow (capture → export):**

1. User opens Camera or Gallery → image URI captured
2. Crop confirms → image saved to app sandbox + thumbnail generated
3. Image fed to Extract engine → 5 `ExtractedColor`s returned
4. Result + image stored in Zustand → persisted to SQLite as `Palette`
5. User picks Archetype → `LayoutConfig` initialized with defaults
6. Compose engine renders Skia canvas with image + colors + config (live preview)
7. User taps Export → view-shot captures canvas as PNG → share sheet opens

**Key separation of concerns:**

- **Engines** (capture, extract, compose, export) are pure logic. They don't know about subscription tier, UI state, or analytics.
- **Stores** (Zustand) are the single source of truth for UI state.
- **Gating** happens at the UI layer — engines treat all users equally.

---

## 3. Folder structure (annotated)

```
hued/
├── app/                          # Expo Router (file-based)
│   ├── (tabs)/
│   │   ├── index.tsx             # Home — palette history grid
│   │   ├── capture.tsx           # Camera entrypoint
│   │   └── settings.tsx          # Profile, subscription, about
│   ├── palette/
│   │   └── [id].tsx              # Compose screen (the heart)
│   ├── onboarding.tsx
│   ├── paywall.tsx
│   ├── crop.tsx
│   ├── _layout.tsx               # Root layout, providers
│   └── +not-found.tsx
│
├── src/
│   ├── components/
│   │   ├── ui/                   # Atoms — Button, Card, Text, Icon, Sheet
│   │   ├── capture/
│   │   │   ├── CameraView.tsx
│   │   │   ├── GalleryPicker.tsx
│   │   │   └── CropTool.tsx
│   │   ├── compose/
│   │   │   ├── ArchetypePicker.tsx   # 5 thumbnails
│   │   │   ├── ConfigPanel.tsx       # Position, font, style toggles
│   │   │   ├── SkiaPreview.tsx       # Live preview canvas
│   │   │   └── ExportSheet.tsx
│   │   └── palette/
│   │       ├── PaletteCard.tsx       # Grid card in Home
│   │       ├── ColorSwatch.tsx
│   │       └── EmptyState.tsx
│   │
│   ├── lib/
│   │   ├── extract/
│   │   │   ├── kmeans.ts             # K-means implementation
│   │   │   ├── colorSpace.ts         # RGB ↔ LAB conversions
│   │   │   ├── colorNaming.ts        # Nearest-neighbor naming
│   │   │   └── pipeline.ts           # End-to-end extract orchestrator
│   │   ├── skia/
│   │   │   ├── archetype.ts          # Archetype interface + registry
│   │   │   ├── renderers/
│   │   │   │   ├── strip.tsx
│   │   │   │   ├── editorial.tsx
│   │   │   │   ├── grid.tsx
│   │   │   │   ├── banner.tsx
│   │   │   │   └── side.tsx
│   │   │   ├── tokens.ts             # Design tokens (colors, spacing, fonts)
│   │   │   └── watermark.tsx         # Watermark renderer for free tier
│   │   ├── store/
│   │   │   ├── paletteStore.ts       # Zustand: current palette + history
│   │   │   ├── subscriptionStore.ts  # Zustand: subscription state from RevenueCat
│   │   │   └── settingsStore.ts      # Zustand: user preferences (MMKV-backed)
│   │   ├── db/
│   │   │   ├── schema.ts             # SQLite schema + migrations
│   │   │   ├── palettes.ts           # CRUD for palettes
│   │   │   └── client.ts             # SQLite client wrapper
│   │   ├── analytics/
│   │   │   ├── posthog.ts
│   │   │   └── events.ts             # Event taxonomy (typed)
│   │   ├── revenuecat/
│   │   │   └── client.ts             # Subscription helpers
│   │   └── utils/
│   │       ├── image.ts              # expo-image-manipulator wrappers
│   │       └── permissions.ts
│   │
│   ├── data/
│   │   ├── named-colors.json         # ~1500 named colors with LAB precomputed
│   │   └── archetypes.ts             # Slot configs per archetype
│   │
│   └── types/
│       ├── palette.ts                # Palette, ExtractedColor, LayoutConfig
│       └── archetype.ts              # Archetype, Slot
│
├── assets/
│   ├── fonts/
│   ├── images/
│   └── icons/
│
├── app.config.ts                 # Expo config (programmatic)
├── tsconfig.json
├── package.json
├── eas.json                      # EAS Build config
├── CLAUDE.md                     # Project context for Claude Code
└── README.md
```

**Path aliases (tsconfig.json):**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/lib/*": ["src/lib/*"],
      "@/types/*": ["src/types/*"],
      "@/data/*": ["src/data/*"]
    }
  }
}
```

---

## 4. Core data models

### Palette (the primary entity)

```typescript
type Palette = {
  id: string;                       // ULID for time-orderable IDs
  imageUri: string;                 // Local file URI (app sandbox)
  thumbnailUri: string;             // 200×200 optimized preview
  colors: ExtractedColor[];         // Always 5 in MVP
  layoutConfig: LayoutConfig;       // Current layout state
  createdAt: number;                // Unix timestamp ms
  updatedAt: number;
  isFavorite: boolean;
  exportCount: number;
  meta: PaletteMeta;
};

type PaletteMeta = {
  imageWidth: number;
  imageHeight: number;
  imageBytes: number;
  extractionDurationMs: number;     // For analytics
  source: 'camera' | 'gallery';
};
```

### ExtractedColor

```typescript
type ExtractedColor = {
  hex: string;                      // "#0E2931"
  rgb: [number, number, number];    // [14, 41, 49]
  lab: [number, number, number];    // [15.2, -8.1, -6.4]
  name: string;                     // "Deep Sea"
  hslLightness: number;             // 0-1, for sorting
  samplePosition?: {                // Where in the image this color came from
    x: number;                      // 0-1 normalized
    y: number;                      // 0-1 normalized
  };
  weight: number;                   // Cluster weight (% of pixels) 0-1
};
```

### LayoutConfig

```typescript
type LayoutConfig = {
  archetypeId: ArchetypeId;
  position: SlotPosition;
  showHex: boolean;
  showName: boolean;
  showRGB: boolean;
  fontFamily: FontKey;
  cornerRadius: CornerRadius;
  cardStyle: CardStyle;
  watermarkVisible: boolean;        // Forced true for free tier
};

type ArchetypeId = 'strip' | 'editorial' | 'grid' | 'banner' | 'side';
type SlotPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';
type FontKey = 'sans' | 'serif' | 'mono' | 'display';
type CornerRadius = 'sharp' | 'rounded' | 'pill';
type CardStyle = 'solid' | 'transparent' | 'blur';
```

### Archetype (registry)

```typescript
type Archetype = {
  id: ArchetypeId;
  displayName: string;
  description: string;
  slots: SlotConfig[];
  defaultConfig: Partial<LayoutConfig>;
  isPremium: boolean;               // Future-proofing for Phase 2
  renderer: SkiaRenderer;
};

type SlotConfig = {
  type: 'photo' | 'swatch' | 'metadata' | 'watermark';
  defaultPosition: SlotPosition;
  allowedPositions: SlotPosition[];
};

type SkiaRenderer = (props: RendererProps) => JSX.Element;

type RendererProps = {
  image: SkImage;
  colors: ExtractedColor[];
  config: LayoutConfig;
  canvasSize: { width: number; height: number };
};
```

---

## 5. Storage strategy

### MMKV (settings + small KV)

Used for: user preferences, last-used archetype, onboarding completion flag, premium status cache, feature flags.

```typescript
// MMKV keys (typed via @/lib/store/settingsStore)
'onboarding.completed': boolean
'preferences.lastArchetype': ArchetypeId
'preferences.defaultFont': FontKey
'subscription.cachedStatus': 'free' | 'premium'
'subscription.cachedExpiresAt': number
'analytics.installDate': number
'export.dailyCount': number       // Reset per day in subscriptionStore
'export.dailyResetDate': string   // YYYY-MM-DD
```

### SQLite (palette history)

```sql
CREATE TABLE palettes (
  id TEXT PRIMARY KEY,
  image_uri TEXT NOT NULL,
  thumbnail_uri TEXT NOT NULL,
  colors TEXT NOT NULL,           -- JSON-encoded ExtractedColor[]
  layout_config TEXT NOT NULL,    -- JSON-encoded LayoutConfig
  meta TEXT NOT NULL,             -- JSON-encoded PaletteMeta
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  export_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_palettes_created_at ON palettes(created_at DESC);
CREATE INDEX idx_palettes_favorite ON palettes(is_favorite) WHERE is_favorite = 1;

-- Phase 2: search by color name (FTS5)
CREATE VIRTUAL TABLE palettes_fts USING fts5(
  palette_id UNINDEXED,
  color_names
);

-- Migrations table
CREATE TABLE migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL
);
```

### Filesystem (images)

```
${FileSystem.documentDirectory}palettes/
  ${paletteId}/
    full.jpg       # Max 2048px on longest edge
    thumb.jpg      # 200×200 square
```

When a palette is deleted, both files are removed. No automatic eviction in MVP — Phase 2 adds size-based eviction (LRU when over 500MB).

---

## 6. Core engines

### 6.1 Capture engine

Three entry points: camera, gallery picker, and (Phase 2) URL-based image fetch.

**Camera flow:**

1. Request `expo-camera` permissions (handled by hook)
2. Display `CameraView` with rule-of-thirds grid overlay (optional toggle)
3. Capture button: `takePictureAsync({ quality: 1, exif: false })`
4. Pass URI to crop screen

**Gallery flow:**

1. `expo-image-picker` with `mediaTypes: ['images']`, `quality: 1`
2. Pass URI to crop screen

**Crop & confirm:**

1. `react-native-image-crop-picker` with free-form aspect ratio + 4 presets (1:1, 4:5, 9:16, original)
2. Resize to max 2048px on the longest edge (for extraction speed)
3. Generate 200×200 thumbnail via `expo-image-manipulator`
4. Save both to app sandbox under palette ID
5. Trigger Extract engine

### 6.2 Extract engine

The heart of the data processing. Designed to feel instant (<800ms total).

**Pipeline:**

```typescript
// src/lib/extract/pipeline.ts
async function extract(imageUri: string): Promise<ExtractedColor[]> {
  // 1. Downsample to ~150×150 for k-means (sufficient for color extraction)
  const sample = await downsample(imageUri, 150);
  
  // 2. Decode pixels to RGB array
  const pixels = await decodePixels(sample);
  
  // 3. Convert all pixels to LAB
  const labPixels = pixels.map(rgbToLab);
  
  // 4. Run k-means in LAB space, k=5
  const centroids = kmeans(labPixels, 5, { 
    maxIter: 20, 
    tolerance: 0.5,
    seedStrategy: 'kmeans++',
  });
  
  // 5. Sort by luminosity (L channel) descending
  centroids.sort((a, b) => b.center[0] - a.center[0]);
  
  // 6. For each centroid: convert back to RGB, lookup name
  return centroids.map(c => ({
    hex: rgbToHex(labToRgb(c.center)),
    rgb: labToRgb(c.center),
    lab: c.center,
    name: nearestColorName(c.center),
    hslLightness: c.center[0] / 100,
    weight: c.weight,
  }));
}
```

**K-means specifics:**

- k-means++ seeding for stable convergence
- Max 20 iterations or convergence tolerance 0.5 in LAB units
- Runs on JS thread for MVP; profile and move to Worklets if >800ms on Pixel 3a
- Deterministic random seed option for reproducible test results

**Color naming:**

- Dataset: `color-name-list` (~1500 entries) preprocessed at build time to include LAB values
- Nearest neighbor in LAB space (Euclidean distance in L*a*b* approximates perceptual difference)
- Lookup is O(n) per color = O(5 × 1500) = ~7500 distance calculations per extraction — negligible

### 6.3 Layout engine (the architectural centerpiece)

This is the abstraction that lets us ship 5 archetypes in MVP and scale to 30+ without refactoring.

**Archetype registry:**

```typescript
// src/data/archetypes.ts
import { stripRenderer } from '@/lib/skia/renderers/strip';
import { editorialRenderer } from '@/lib/skia/renderers/editorial';
// ...

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  strip: {
    id: 'strip',
    displayName: 'Strip',
    description: 'Dots below photo',
    slots: [
      { type: 'photo', defaultPosition: 'top', allowedPositions: ['top', 'bottom'] },
      { type: 'swatch', defaultPosition: 'bottom', allowedPositions: ['top', 'bottom'] },
    ],
    defaultConfig: { 
      fontFamily: 'sans', 
      cornerRadius: 'pill', 
      showName: false,
      showHex: false,
      showRGB: false,
    },
    isPremium: false,
    renderer: stripRenderer,
  },
  editorial: {
    id: 'editorial',
    displayName: 'Editorial',
    description: 'Stack of named cards',
    slots: [
      { type: 'photo', defaultPosition: 'center', allowedPositions: ['center'] },
      { type: 'swatch', defaultPosition: 'center', allowedPositions: ['top', 'bottom', 'center'] },
    ],
    defaultConfig: { 
      fontFamily: 'serif', 
      cornerRadius: 'sharp',
      cardStyle: 'solid',
      showName: true,
      showHex: true,
    },
    isPremium: false,
    renderer: editorialRenderer,
  },
  // grid, banner, side follow the same pattern
};
```

**Renderer contract (example):**

```typescript
// src/lib/skia/renderers/strip.tsx
import { Canvas, Image, Circle } from '@shopify/react-native-skia';
import type { SkiaRenderer } from '@/types/archetype';
import { Watermark } from '@/lib/skia/watermark';

export const stripRenderer: SkiaRenderer = ({ image, colors, config, canvasSize }) => {
  const { width, height } = canvasSize;
  const photoHeight = height * 0.85;
  const swatchAreaHeight = height - photoHeight;
  const swatchSize = Math.min(swatchAreaHeight * 0.6, 48);
  const swatchY = photoHeight + (swatchAreaHeight - swatchSize) / 2;
  const spacing = (width - swatchSize * 5) / 6;
  
  return (
    <>
      <Image image={image} x={0} y={0} width={width} height={photoHeight} fit="cover" />
      {colors.map((color, i) => (
        <Circle
          key={color.hex}
          cx={spacing + swatchSize * i + spacing * i + swatchSize / 2}
          cy={swatchY + swatchSize / 2}
          r={swatchSize / 2}
          color={color.hex}
        />
      ))}
      {config.watermarkVisible && (
        <Watermark x={width - 120} y={height - 24} />
      )}
    </>
  );
};
```

**Why this pattern matters:**

Adding a new archetype = creating one new file in `lib/skia/renderers/` + one registry entry in `ARCHETYPES`. Zero changes elsewhere. This is what enables:

- Premium template expansion in Phase 2 (+10 archetypes without refactor)
- Seasonal templates (holiday, fashion-week-themed)
- User-submitted templates (Phase 3 fantasy)

### 6.4 Export engine

```typescript
// src/lib/export/exportPalette.ts
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { trackEvent } from '@/lib/analytics/posthog';

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1350; // 4:5 aspect, IG-friendly

export async function exportPalette(
  paletteId: string,
  resolution: '1x' | '2x' | '4x',
  skiaCanvasRef: React.RefObject<View>,
): Promise<string> {
  const scale = { '1x': 1, '2x': 2, '4x': 4 }[resolution];
  
  const uri = await captureRef(skiaCanvasRef, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width: BASE_WIDTH * scale,
    height: BASE_HEIGHT * scale,
  });
  
  await MediaLibrary.createAssetAsync(uri);
  await trackEvent('palette_exported', { 
    palette_id: paletteId, 
    resolution,
  });
  
  return uri;
}
```

Sharing uses `expo-sharing.shareAsync(uri, { mimeType: 'image/png' })` — Android's native share sheet handles target selection (Instagram, Pinterest, Threads, etc.).

### 6.5 Monetization engine

```typescript
// src/lib/revenuecat/client.ts
import Purchases from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { trackEvent } from '@/lib/analytics/posthog';

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_KEY!;

export async function initRevenueCat(userId?: string) {
  await Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: userId });
}

export async function checkSubscription(): Promise<SubscriptionStatus> {
  const info = await Purchases.getCustomerInfo();
  const isPremium = info.entitlements.active['premium'] !== undefined;
  return {
    tier: isPremium ? 'premium' : 'free',
    expiresAt: info.entitlements.active['premium']?.expirationDate
      ? new Date(info.entitlements.active['premium'].expirationDate)
      : null,
  };
}

export async function presentPaywall(trigger: PaywallTrigger): Promise<boolean> {
  await trackEvent('paywall_shown', { trigger });
  const offerings = await Purchases.getOfferings();
  const result = await RevenueCatUI.presentPaywallIfNeeded({ 
    offering: offerings.current,
    requiredEntitlementIdentifier: 'premium',
  });
  if (result === 'PURCHASED') {
    await trackEvent('subscription_purchased', { trigger });
    return true;
  }
  return false;
}

export type PaywallTrigger =
  | 'daily_limit_reached'
  | 'watermark_remove_tap'
  | 'premium_template_tap'
  | 'settings_upgrade_tap';

export type SubscriptionStatus = {
  tier: 'free' | 'premium';
  expiresAt: Date | null;
};
```

**Free tier gating happens at the UI layer:**

- Daily export counter in MMKV with date check (reset on UTC midnight)
- Watermark renderer always added when `tier === 'free'`
- All gating happens at the UI layer; engines themselves are tier-agnostic

---

## 7. State management

### Zustand store shapes

```typescript
// src/lib/store/paletteStore.ts
type PaletteStore = {
  current: Palette | null;
  history: Palette[];
  isLoading: boolean;
  
  setCurrent: (palette: Palette) => void;
  updateConfig: (config: Partial<LayoutConfig>) => void;
  saveCurrent: () => Promise<void>;
  loadHistory: () => Promise<void>;
  deletePalette: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
};

// src/lib/store/subscriptionStore.ts
type SubscriptionStore = {
  tier: 'free' | 'premium';
  expiresAt: Date | null;
  dailyExportCount: number;
  dailyExportLimit: number;          // 3 for free, Infinity for premium
  
  refresh: () => Promise<void>;
  incrementExport: () => void;
  resetDailyCount: () => void;
  canExport: () => boolean;
};

// src/lib/store/settingsStore.ts (MMKV-backed via persist middleware)
type SettingsStore = {
  onboardingCompleted: boolean;
  lastArchetype: ArchetypeId;
  defaultFont: FontKey;
  
  markOnboardingComplete: () => void;
  setLastArchetype: (id: ArchetypeId) => void;
  setDefaultFont: (font: FontKey) => void;
};
```

---

## 8. Analytics — event taxonomy

```typescript
// src/lib/analytics/events.ts
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
  subscription_restored: {};
};

export function trackEvent<K extends keyof EventMap>(event: K, props: EventMap[K]) {
  posthog.capture(event, props);
}
```

---

## 9. Performance budgets

| Metric | Target | Measured on |
|---|---|---|
| Cold start time | <2s | Pixel 6 / equivalent mid-range |
| Extract duration | <800ms | Average device |
| Skia preview FPS | 60 | All supported devices |
| Export 1× | <2s | Mid-range |
| Export 4× | <4s | Mid-range |
| App bundle size (APK) | <50MB | Production build |
| Memory usage idle | <150MB | Mid-range |
| Memory usage during compose | <300MB | Mid-range |

**Profiling tools:**

- React DevTools Profiler for component re-renders
- Flipper for native side
- `react-native-performance` for custom metrics in production
- Sentry Performance Monitoring (free tier limits but useful)

---

## 10. Accessibility

- All interactive elements have `accessibilityLabel`
- Minimum tap target 44×44dp (Material guideline)
- Color is never the only signifier — color name labels accompany swatches in accessibility mode
- `prefers-reduced-motion` honored for all transitions (haptics still fire)
- High-contrast mode: borders thicken, text weight increases
- Screen reader walks through palette in light-to-dark order (matches visual sort)
- Labels in export PNG include color names + hex for screen-reader-aware sharing

---

## 11. Security & privacy

### What Hued does NOT do

- No account required in MVP — anonymous, local-only
- No photos uploaded to any server in MVP
- No analytics on photo content (we never read pixels off-device)
- No third-party trackers beyond PostHog (EU servers) and Sentry
- No social graph access

### What Hued does

- Stores photos in app sandbox (private to app by OS)
- Local SQLite database with palettes (encrypted at rest via OS sandbox)
- PostHog events with anonymous device ID — no PII
- Sentry crash reports — no PII attached to events
- Subscription state cached locally via RevenueCat (anonymous user ID)

### Phase 2 cloud sync

Will require explicit opt-in, clear data flow disclosure, and per-feature consent (sync, sharing, analytics opt-in beyond install).

---

## 12. ADR-lite (decisions log)

### ADR-001: Expo over bare React Native

- **Status:** Accepted
- **Context:** Need cross-platform mobile foundation that lets Miguel ship fast and learn the RN ecosystem.
- **Decision:** Expo SDK 51+ with Managed Workflow.
- **Consequences:** OTA updates "free", larger initial bundle, slightly less native control. Acceptable trade-off for MVP.

### ADR-002: React Native Skia for rendering

- **Status:** Accepted
- **Context:** Need 60fps composition of photo + colors + text + shapes with full control.
- **Decision:** @shopify/react-native-skia.
- **Consequences:** Steeper learning curve than View-based composition. Trade-off justified by output quality requirement.

### ADR-003: Custom k-means over react-native-image-colors

- **Status:** Accepted
- **Context:** Need control over color count, space (LAB vs RGB), and tie-breaking.
- **Decision:** Implement k-means in TypeScript.
- **Consequences:** More code to maintain, but full control. Fallback to react-native-image-colors if perf becomes blocking on low-end devices (would be ADR-007).

### ADR-004: LAB color space for distance calculations

- **Status:** Accepted
- **Context:** Color naming and similarity require perceptually-uniform distance.
- **Decision:** All color comparisons in CIE LAB.
- **Consequences:** Conversion overhead (negligible at 5 colors); dramatically better naming accuracy than RGB.

### ADR-005: MMKV over AsyncStorage

- **Status:** Accepted
- **Context:** Subscription cache and preferences need sync reads on app launch.
- **Decision:** react-native-mmkv.
- **Consequences:** Native module (slight setup), 30× faster reads. Worth it for boot path.

### ADR-006: RevenueCat over native Billing

- **Status:** Accepted
- **Context:** Want subscription analytics, restore purchases, and cross-platform parity for Phase 2 iOS.
- **Decision:** RevenueCat.
- **Consequences:** Free tier covers our scale. Tax abstraction is the main win for indie devs.

### ADR-007: Local-only in MVP (no cloud sync)

- **Status:** Accepted
- **Context:** Cloud sync adds significant complexity (auth, sync conflict resolution, costs).
- **Decision:** Local-only for MVP. Cloud sync via Supabase is Phase 2 premium feature.
- **Consequences:** Users lose data if they uninstall. Acceptable for v1 launch; cloud sync becomes a paywall feature.

### ADR-008: 5 fixed colors per palette

- **Status:** Accepted
- **Context:** Variable color count complicates layout engine significantly.
- **Decision:** Always extract 5 dominant colors.
- **Consequences:** Some images would benefit from 3 or 7. Acceptable trade-off for layout consistency.

### ADR-009: Android-first, iOS Phase 2

- **Status:** Accepted
- **Context:** Lower upfront cost ($25 vs $99/year), faster review cycle, Miguel's daily driver is Android.
- **Decision:** Ship Android first via Play Store, iOS in Phase 2.
- **Consequences:** Misses higher-spending iOS audience initially. iOS port estimated at 6 weeks post-launch due to Expo cross-platform foundation.

### ADR-010: Free tier with watermark + daily limit

- **Status:** Accepted
- **Context:** Need to drive conversion without making the free tier feel useless.
- **Decision:** 3 exports/day + watermark on free tier.
- **Consequences:** May see uninstalls from users who feel limited. A/B test post-launch.

---

## 13. Phase 2 architecture notes

When cloud sync ships:

- Supabase Postgres schema mirrors local SQLite
- Row-level security: `user_id = auth.uid()` on every palette row
- Sync conflict resolution: last-writer-wins on `updatedAt`
- Image upload to Supabase Storage with user-scoped bucket policy
- Realtime subscriptions only for paid tier (cost control)
- Background sync via React Native Background Fetch (Android)
- Offline-first: local writes always win, sync happens when online

**Sync state machine:**

```
   ┌─────────┐
   │  IDLE   │
   └────┬────┘
        │ user action
        ↓
   ┌─────────┐        ┌──────────┐
   │ LOCAL   │───────→│ DIRTY    │
   │ WRITE   │        │ (queued) │
   └─────────┘        └────┬─────┘
                            │ network available
                            ↓
                       ┌──────────┐
                       │ SYNCING  │
                       └────┬─────┘
                            │ success | error
                       ┌────┴─────┐
                       ↓          ↓
                   ┌──────┐  ┌─────────┐
                   │ IDLE │  │ RETRY   │
                   └──────┘  │ BACKOFF │
                             └─────────┘
```

---

## Document changelog

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-05-17 | Miguel + AI mentor | Initial draft |
