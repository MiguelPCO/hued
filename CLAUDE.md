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
