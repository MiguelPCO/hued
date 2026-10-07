# Hued — Sprint 0 quickstart

> Exact commands to bootstrap Hued and start Sprint 0 with Claude Code. Run these in order. Each section completes in 5-15 minutes.

**Pre-flight assumption:** macOS or Linux machine with Node 20+, pnpm, git, and Android Studio already installed. If anything is missing, see "Prerequisites" below.

---

## 0. Prerequisites checklist

Before starting, verify each:

```bash
node --version         # v20.x or later
pnpm --version         # v9.x or later
git --version          # any recent version
java --version         # JDK 17 (for Android builds)
```

You also need:

- **Android Studio** with at least one Android Virtual Device (AVD) configured
- **Physical Android device** (recommended for camera + perf testing) with USB debugging enabled
- **Anthropic account** with Claude Pro/Max subscription (for Claude Code)
- **GitHub account** to push your repo

If anything is missing:

```bash
# Node 20 via nvm
nvm install 20 && nvm use 20

# pnpm
npm install -g pnpm

# Android Studio: download from https://developer.android.com/studio
# Claude Code: see Step 4 below
```

---

## 1. Create workspace folder

```bash
# Navigate to your miguel-dev-workspace
cd ~/Code/miguel-dev-workspace

# Create the Hued project folder
mkdir hued && cd hued
```

---

## 2. Initialize Expo project

```bash
# Use the latest Expo with TypeScript template
npx create-expo-app@latest . --template blank-typescript

# Switch to pnpm (remove the npm lockfile)
rm package-lock.json
pnpm install

# Verify it boots
pnpm start
```

When Metro opens, press `a` to launch on Android. Confirm "Open up App.tsx to start working on your app!" message appears on the emulator/device. Stop Metro with `Ctrl+C`.

---

## 3. Pin Node version and configure pnpm

```bash
# Pin Node version
echo "20" > .nvmrc

# Add engines to package.json
pnpm pkg set engines.node=">=20" engines.pnpm=">=9"

# Configure pnpm settings (required for Expo native modules)
echo "shamefully-hoist=true" > .npmrc
echo "node-linker=hoisted" >> .npmrc
```

The `shamefully-hoist` flag is required for some Expo native modules that expect a flat `node_modules` structure.

---

## 4. Install Claude Code (if not already installed)

```bash
# Install globally via npm (Node 18+ required)
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

First-time run: execute `claude` in your project folder. A browser window opens for OAuth authentication via your Anthropic account. Sign in and approve.

**If you get a "command not found: claude" error:** see Troubleshooting (Step 9 below).

**Important:** never use `sudo npm install` — if you hit `EACCES` errors, fix npm's prefix instead (Step 9).

---

## 5. Create the CLAUDE.md project context file

This is the most important file you'll create. It tells Claude Code everything it needs to know about Hued to be a good collaborator across sessions.

Copy the PRD.md, SCHEMA.md, and SPRINTS.md from the discovery package into the project root first, then create CLAUDE.md:

```bash
# Copy discovery docs into project (assuming they're in ~/Downloads/hued-discovery/)
cp ~/Downloads/hued-discovery/PRD.md .
cp ~/Downloads/hued-discovery/SCHEMA.md .
cp ~/Downloads/hued-discovery/SPRINTS.md .

# Create CLAUDE.md
cat > CLAUDE.md << 'EOF'
# Hued — Project Context for Claude Code

## What this is

Hued is a mobile-first Android app (Expo + React Native) that converts any photo into an editorial-grade, shareable color palette infographic in under 10 seconds.

The wedge: existing apps make hex codes. Hued makes beautiful artifacts.

## Stack

- Expo SDK 51+, React Native 0.74+
- TypeScript strict mode
- Expo Router (file-based, like Next.js App Router)
- Zustand v5 for state, MMKV for KV, expo-sqlite for history
- React Native Skia for canvas rendering
- RevenueCat for subscriptions, PostHog for analytics, Sentry for crashes

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
- Animations: use `useGSAP()` from `@gsap/react` OR reanimated worklets (never bare useEffect for animation)
- Centralize design tokens in `src/lib/tokens.ts` (OKLCH-based, three layers: Primitive → Semantic → Component)
- Skia: animate only `transform`, `opacity`, `clip-path`
- Color logic always in LAB space (perceptual uniformity)
- Conventional commits: `feat(scope): description`, `fix(scope): description`, etc.

## Folder structure

See SCHEMA.md §3 for full tree. Key conventions:

- `app/` = Expo Router screens (file-based routing)
- `src/components/` = reusable React components
- `src/lib/` = business logic, engines, stores
- `src/data/` = static datasets (named colors, archetypes registry)
- `src/types/` = TypeScript type definitions

## Sprint plan

See SPRINTS.md. Currently in Sprint 0 — Foundations.

Each sprint has day-by-day tasks with EOD checks, acceptance criteria, and definition of done. Follow them strictly.

## Workflow

I work in a feedback loop:
1. **Gather context** — read relevant files before changing anything
2. **Propose plan** — use Plan Mode (Shift+Tab) to outline diffs before executing
3. **Execute** — make minimal, focused changes
4. **Verify** — run `tsc --noEmit` and `pnpm lint` after every change
5. **Repeat**

For visual verification of UI changes, use `/chrome` if available (or screenshot via Android emulator).

Use `/clear` when switching tasks to keep context focused.

## Files NOT to touch unless asked

- `node_modules/`
- `android/` and `ios/` (after `npx expo prebuild`)
- `.expo/`
- Auto-generated files (e.g. `metro.config.js` unless explicitly needed)

## Reference documents

- **PRD.md** — product vision, personas, scope, success metrics
- **SCHEMA.md** — technical architecture, data models, ADRs
- **SPRINTS.md** — day-by-day execution plan
EOF
```

---

## 6. Initialize git and first commit

```bash
git init

# Add a basic .gitignore (Expo template already includes a good one)
cat >> .gitignore << 'EOF'

# Claude Code
.claude/

# Local env
.env.local
.env.*.local
EOF

git add .
git commit -m "chore: bootstrap Hued with Expo + TypeScript"

# Create the repo on GitHub via gh CLI (or manually)
# gh repo create miguel/hued --private --source=. --push
```

---

## 7. Start Claude Code and kick off Sprint 0

```bash
claude
```

Once Claude Code is running in your terminal, paste this exact prompt to start Sprint 0:

```
I'm starting Sprint 0 of Hued. Please read CLAUDE.md, then PRD.md (just §1, §2, §5), then SCHEMA.md (§1, §3, §4), then SPRINTS.md (Sprint 0 section). This gives you full context.

For Sprint 0 Day 1, here's what we need to accomplish:

1. Confirm TypeScript strict mode is on (verify tsconfig.json)
2. Add path alias @/* → ./src/* in tsconfig.json
3. Create the src/ folder structure per SCHEMA.md §3:
   - src/components/ (with ui/, capture/, compose/, palette/ subfolders, each with a .gitkeep)
   - src/lib/ (with extract/, skia/, store/, db/, analytics/, revenuecat/, utils/ subfolders)
   - src/data/
   - src/types/
4. Install and configure ESLint + Prettier with my standard config (React + TypeScript + import sorting)
5. Set up Husky pre-commit hook running lint + typecheck

Before making changes, enter Plan Mode (Shift+Tab) and propose:
1. The exact diffs you'll apply
2. Any dependency installs needed
3. Verification commands to run after each change

After I approve the plan, execute it. After each command, verify with `pnpm tsc --noEmit` and `pnpm lint`.

Acceptance criteria for Day 1 (from SPRINTS.md):
- `pnpm start` boots Metro
- App runs on Android emulator
- No TypeScript errors
- ESLint passes with zero warnings
- Folder structure matches SCHEMA.md §3
```

Claude Code will enter Plan Mode and propose the changes. Review the plan, approve, and let it execute.

---

## 8. Daily routine (Sprint 0 onward)

Each day, follow this loop:

```bash
# Morning: pull latest, sync deps
cd ~/Code/miguel-dev-workspace/hued
git pull --rebase
pnpm install

# Start Claude Code with today's sprint context
claude
```

In Claude Code, your daily kickoff prompt template:

```
Today is Sprint X, Day Y. Read CLAUDE.md and the Sprint X section of SPRINTS.md.

Today's tasks:
[paste the day's checklist from SPRINTS.md]

Enter Plan Mode and propose the implementation order. After I approve, execute step by step, running typecheck and lint after each change.
```

End of day:

```bash
# Run all checks
pnpm tsc --noEmit
pnpm lint
pnpm test          # once tests exist (Sprint 2+)

# Commit with conventional commits
git add .
git commit -m "feat(sprint-X): implement Y"
git push
```

---

## 9. Troubleshooting

### "command not found: claude" after npm install

```bash
# Check npm global prefix
npm config get prefix
# Output is typically /usr/local or ~/.npm-global

# Add its /bin to your PATH in ~/.zshrc (or ~/.bashrc)
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Verify
claude --version
```

### EACCES permission error on `npm install -g`

Do NOT use `sudo`. Configure a user-writable prefix:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Retry install
npm install -g @anthropic-ai/claude-code
```

### Android emulator won't start

- Open Android Studio → AVD Manager → start the emulator manually first
- Then run `pnpm start` and press `a`
- If hardware acceleration is missing, install Intel HAXM (Intel Mac/Linux) or enable Hyper-V (Windows)

### Skia install fails (Sprint 0 Day 3)

```bash
# Try forcing reinstall
pnpm install --force

# On macOS, verify Xcode CLI tools
xcode-select --install

# On Apple Silicon, you may need Rosetta
softwareupdate --install-rosetta
```

### Metro bundler stuck or weird errors

```bash
# Clear Metro cache
pnpm start --clear

# Full nuke (last resort)
rm -rf node_modules .expo
pnpm install
pnpm start --clear
```

### Prebuild fails on Day 3

```bash
# Clean prebuild artifacts
rm -rf android ios
npx expo prebuild --platform android --clean
```

---

## 10. Useful Claude Code commands during Sprint 0

| Command | What it does |
|---|---|
| `Shift+Tab` | Toggle Plan Mode (investigate without changing files) |
| `/clear` | Clear conversation memory when switching tasks |
| `/cost` | See token usage for this session |
| `/chrome` | Open Chrome for visual verification of web previews |
| `/mcp add [name] --transport http [url]` | Connect an MCP server (e.g. Expo MCP if available) |

Use `Shift+Tab` aggressively in early sprints — Plan Mode prevents Claude from making changes you didn't approve.

Use `/clear` between major tasks to keep the context focused. The pattern is: load context → execute task → `/clear` → load next task's context.

---

## 11. Sprint 0 deliverables checklist

By end of Sprint 0 (Day 4), you should have:

- [ ] Expo project with TypeScript strict mode
- [ ] Expo Router with stub tabs (Home, Capture, Settings)
- [ ] Design tokens in `src/lib/tokens.ts` (OKLCH)
- [ ] Atom components: `Button`, `Card`, `Text`, `Icon`, `Sheet`
- [ ] React Native Skia installed + smoke test rendering at 60fps
- [ ] Sentry capturing sessions
- [ ] PostHog tracking `app_opened`
- [ ] MMKV + SQLite operational with first migration
- [ ] CLAUDE.md, PRD.md, SCHEMA.md, SPRINTS.md committed to repo
- [ ] EAS Build configured with development, preview, production profiles
- [ ] Development build runs on physical Android device

Once all checked, you're ready for Sprint 1 (Capture flow).

---

## 12. First-day mental model

Sprint 0 is about **proving the stack**, not building features. By end of Day 4, the app does almost nothing visible — but every architectural commitment from SCHEMA.md is wired and verified working. This includes:

- Skia renders at 60fps → unlocks Sprint 3 (Layout Engine)
- SQLite migrations run idempotently → unlocks Sprint 2 (palette persistence)
- PostHog captures events → unlocks data-driven decisions in Sprints 4-5
- Sentry catches crashes → unlocks confident shipping in Sprint 5

If any of these are shaky at end of Sprint 0, Sprint 1 will feel fine but Sprint 2+ will hurt. Don't skip the smoke tests.

---

Let's go. 🎨
