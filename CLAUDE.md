# Hued — Project Context for Claude Code

## What this is

Hued is a mobile-first Android app (Expo + React Native) that converts any photo into an editorial-grade, shareable color palette infographic in under 10 seconds.

The wedge: existing apps make hex codes. Hued makes beautiful artifacts.

1. Think Before Coding
   Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask. 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
   Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
   Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
   Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Stack

- Expo SDK 57, React Native 0.86.3, React 19.2.3
- TypeScript strict mode (noImplicitAny: true)
- Expo Router (file-based, like Next.js App Router)
- Zustand v5 for state, MMKV for KV, expo-sqlite for history
- React Native Skia for canvas rendering (`drawAsImage()` single-pass export, no native views in export tree)
- react-native-reanimated v4 + react-native-worklets (babel plugin is `react-native-worklets/plugin`, not the old reanimated one)
- expo-dev-client (required for EAS dev builds — Expo Go can't load this app's native modules: Skia, image-crop-picker, RevenueCat, media-library)
- expo-media-library: import from `expo-media-library/legacy`, not the bare package — SDK57 split the API and the default export throws at runtime on `saveToLibraryAsync`/most legacy methods
- RevenueCat for subscriptions, PostHog for analytics, Sentry for crashes
- New Architecture enabled (Fabric + TurboModules)
- pnpm, EAS Build (Android dev-client profile). `.nvmrc` must stay ≥22.13 in sync with `package.json`'s `engines.node` — EAS reads `.nvmrc` for the builder's Node version, and a stale one breaks pnpm install with a misleading "Failed to install pnpm" error

Full stack rationale: see SCHEMA.md §1.

## Architecture principles (non-negotiable)

1. **Layout Engine first**: 5 archetypes (Strip, Editorial, Grid, Banner, Side) live in `src/components/compose/archetypes/` and share a common contract (`ArchetypeProps`, `shared.tsx` helpers). Adding a new archetype = one component file + one entry in the `ARCHETYPES` registry (`src/data/archetypes.ts`). Both `ArchetypeCanvas.tsx` (preview) and `exportPalette.tsx` (export) dispatch through this registry — never hand-duplicate conditional chains, and keep preview/export pixel-identical by putting shared logic in `shared.tsx`.

2. **Engines are tier-agnostic**: Extract, Compose, Export engines don't know about free vs premium. Subscription gating happens at the UI layer only.

3. **Local-first**: No accounts in MVP. All data in app sandbox (MMKV + SQLite + filesystem). Cloud sync is Phase 2.

4. **Performance is design**: extraction <800ms, preview at 60fps, export <2s (1×) / <4s (4×). Lag breaks the spell — profile aggressively.

5. **Editorial defaults**: every default config produces a publication-quality output without user adjustments.

## Code conventions

- TypeScript strict, no `any`, prefer `unknown` + type guards
- Path alias `@/*` → `./src/*` (configured in tsconfig.json)
- Components are functional, hooks-first
- Centralize design tokens in `src/lib/tokens.ts` (OKLCH-based, three layers: Primitive → Semantic → Component)
- Color logic always in LAB space (perceptual uniformity)
- Conventional commits: `feat(scope): description`, `fix(scope): description`, etc.

## Folder structure

- `app/` = Expo Router screens (file-based routing) — created Day 2
- `src/components/` = reusable React components
- `src/lib/` = business logic, engines, stores
- `src/data/` = static datasets (named colors, archetypes registry)
- `src/types/` = TypeScript type definitions

See SCHEMA.md §3 for full tree.

## Sprint plan

See SPRINTS.md — increasingly stale vs. actual state; trust git log/code over it. Sprints 0-5 (foundations through compose+export+history) and Sprint 6 slice 1 (RevenueCat monetization) are merged to master. Sprint 6's remaining scope (onboarding, Play Store assets, production submission) is deferred pending external accounts. Current focus (2026-09-09) is post-redesign polish on the edit screen, see "Recent changes" below.

## Recent changes (2026-09-09)

- **Capture → edit flow redesign** (`docs/superpowers/specs/2026-09-09-edit-screen-tabs-design.md` / plan in `docs/superpowers/plans/`): removed the standalone crop screen (`app/crop.tsx` deleted); capture now routes straight to `app/palette/[id].tsx` with the full photo. Edit screen is a fixed photo-on-top / tabs-on-bottom layout with 6 tabs (Recorte, Arquetipo, Tipografía, Esquinas, Estilo, Etiquetas), each a carousel (`OptionCarousel.tsx`) or dedicated control, composed in `EditTabs.tsx`. Crop is now on-demand inside its own tab (`CropTab.tsx`) instead of a gate before editing.
- **EAS dev-client build working** on a physical Android device (project `@mikeloide69/hued`). Needed: `expo-dev-client` dependency, `eas init` linking (`app.json` `extra.eas.projectId`/`owner`), and `.nvmrc` bumped to `22.13.0` (was stale at `20` from before the SDK57 upgrade — mismatched Node broke pnpm install on the builder).
- **Export bug fix**: `expo-media-library` import switched to the `/legacy` subpath — SDK57's default export throws at runtime for `saveToLibraryAsync`/`requestPermissionsAsync`.
- **Card style bug fix**: `getCardFrame()`'s `outlined` overlay had `color="transparent"` on the stroke itself, so the card border never rendered on any archetype — filled and outlined looked identical. Fixed to a real color.
- **Font bug fix**: `FONT_FAMILIES.sans.android` was `'Roboto'`, not a Skia/Android font alias — silently fell back to the default typeface, making the "Moderna" font option look broken. Fixed to `'sans-serif'`. Added `condensed`/`display` font options.
- **Corners tab**: added a draggable slider + numeric px input (`CornerControl.tsx`) alongside the existing preset pills, for manual fine-tuning beyond Recta/Redonda/Píldora.
- **Open item, not yet designed or built**: photo currently changes crop/size per archetype (Grid=50% height, Side=60% width, Strip=70% height, Banner/Editorial=100%) — by original design. Miguel wants a fixed-size photo with swatches overlaid on top instead, which means redesigning the visual identity of all 5 archetype components. Needs its own design pass before touching code — don't improvise this solo.

Each sprint has day-by-day tasks with EOD checks, acceptance criteria, and definition of done. Follow them strictly.

## Files NOT to touch unless asked

- `node_modules/`
- `android/` and `ios/` (after `npx expo prebuild`)
- `.expo/`
- Auto-generated files

## Reference documents

- **PRD.md** — product vision, personas, scope, success metrics
- **SCHEMA.md** — technical architecture, data models, ADRs
- **SPRINTS.md** — day-by-day execution plan
