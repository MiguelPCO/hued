# Hued — Project Context for Claude Code

## What this is

Hued is a mobile-first Android app (Expo + React Native) that converts any photo into an editorial-grade, shareable color palette infographic in under 10 seconds.

The wedge: existing apps make hex codes. Hued makes beautiful artifacts.

## Stack

- Expo SDK 54, React Native 0.81.5, React 19
- TypeScript strict mode (noImplicitAny: true)
- Expo Router (file-based, like Next.js App Router) — configured in Day 2
- Zustand v5 for state, MMKV for KV, expo-sqlite for history
- React Native Skia for canvas rendering
- RevenueCat for subscriptions, PostHog for analytics, Sentry for crashes
- New Architecture enabled (Fabric + TurboModules)

Full stack rationale: see SCHEMA.md §1.

## Architecture principles (non-negotiable)

1. **Layout Engine first**: 5 archetypes (Strip, Editorial, Grid, Banner, Side) share a `SkiaRenderer` contract. Adding a new archetype = one file in `src/lib/skia/renderers/` + one entry in the `ARCHETYPES` registry. Never hardcode screens; always go through the registry.

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

See SPRINTS.md. Currently in Sprint 0 — Foundations.

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
