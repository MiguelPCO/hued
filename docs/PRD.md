# Hued — Product Requirements Document

> Mobile palette capture app that converts any photo into an editorial-grade, shareable color palette infographic in under 10 seconds.

**Author:** Miguel
**Status:** Discover/Define complete · entering Develop
**Version:** 0.1
**Last updated:** 2026-05-17
**Methodology:** Double Diamond (Discover → Define → Develop → Deliver)

---

## 1. Executive summary

Hued is a mobile-first Android app (Expo + React Native) that lets anyone — designers, content creators, and casual visual curators — point their camera at a beautiful scene (or pick a photo from their gallery) and instantly generate a shareable infographic combining the photo with its extracted color palette in editorial-quality layouts.

Unlike existing palette tools (Adobe Color, Coolors, Pigments, Palette Cam) that produce technical outputs — hex codes, share-via-link grids — Hued's output is the artifact itself: a polished image designed to live on Instagram, Pinterest, Tumblr, or a personal moodboard.

**The wedge:** existing apps make hex codes. Hued makes beautiful artifacts.

**Business model:** Freemium with paywall via RevenueCat. Free tier with watermark + daily export limit. Premium $2.99/month or $19.99/year unlocks unlimited exports, no watermark, premium templates (Phase 2), and cloud sync (Phase 2).

**MVP target platforms:** Android first via Google Play Store. iOS in Phase 2 (~80% codebase reuse with Expo).

---

## 2. Vision, mission, brand values

### Vision
Make capturing and sharing the colors of the world as effortless as taking a photo.

### Mission
Give visual creators a tool that produces editorial-quality palette infographics without any design skill required.

### Brand values

- **Editorial over technical** — every output should feel hand-curated, not algorithmic.
- **Speed over control** — the default output should be good enough to share immediately.
- **Light over heavy** — the app should feel weightless; one tap from intent to result.
- **Local over cloud** — by default, your photos and palettes stay on your device.

---

## 3. Diamond 1 · Discover

### 3.1 The problem space

When someone sees a beautiful color combination in the real world — sunset over the ocean, a market stall in Marrakech, an old building in Lisbon — they have three options today:

1. **Take a photo and forget it.** The colors live in the photo but never become a reusable artifact.
2. **Use a designer-focused tool** (Adobe Color, Coolors) to extract hex codes and copy them to a notes file. Utilitarian, time-consuming, breaks the moment.
3. **Manually build a moodboard image** in Instagram Story tools or Canva. Requires design skill and 5-10 minutes per palette.

None of these options serves the moment well. The job is being underserved.

### 3.2 The job-to-be-done

> When I see colors that move me, I want to capture them in a form I can save and share, so I can build a visual vocabulary and inspire others.

This job has three sub-jobs:
- **Functional:** extract the colors accurately
- **Emotional:** preserve the moment that made me notice them
- **Social:** generate something share-worthy

### 3.3 Why now (market context)

- **OKLCH and modern color theory** are mainstream in design tools (Figma, Tailwind v4). Users are increasingly color-aware.
- **Mobile cameras** now produce DSLR-quality images, raising the ceiling for what a palette extracted from a photo can look like.
- **Shareable visual content** is the dominant form of personal expression on Instagram, Pinterest, Threads, TikTok. "Color story" content has explicit hashtags and engaged communities.
- **AI-assisted design tools** (Canva Magic, Adobe Express) have democratized design — but none focus on palette extraction as the entry point.
- **Mobile photography subscription apps** (Halide $11.99/mo, VSCO $7.99/mo, Darkroom $5.99/mo) have proven willingness to pay for tools that make creators feel professional.

### 3.4 Competitive analysis

| Tool | Platform | Strength | Weakness | Pricing |
|---|---|---|---|---|
| Adobe Color | iOS/web | Powerful color theory tools | Designer-only UI, no shareable output | Free w/ CC sub |
| Coolors | iOS/web | Fast palette generation | Generator-first, photo is afterthought | $3/mo |
| Pigments | iOS | Simple, popular among artists | Output is utility, not artifact | $0.99 one-time |
| Palette Cam | iOS/Android | Camera-first capture | Ugly UI, no export polish | Free w/ ads |
| Canva | Mobile/web | Beautiful templates | Not palette-focused, requires manual setup | $12.99/mo |
| Pinterest "palette" | iOS/Android | Within ecosystem | Buried feature, generic output | Free |

### 3.5 The market gap (the moat)

No competitor produces editorial-quality, shareable palette infographics as the primary output. Every existing app treats the palette as data; Hued treats it as content.

The visual reference library shows what "editorial quality" means in this category — the 20 reference images Miguel curated all share design characteristics:
- Generous whitespace
- Premium typography (serif display + sans body)
- Considered card geometry (rounded corners, deliberate shadows or no shadows)
- Named colors that feel poetic, not technical
- Layout variety while maintaining visual identity

This level of design discipline is the moat. It's not technically hard to extract 5 colors from an image — it IS hard to package those 5 colors in a way that feels worth sharing. That packaging is the product.

---

## 4. Diamond 1 · Define

### 4.1 User personas

#### Persona 1 — Lucía, the Visual Content Creator

- **Age:** 24
- **Role:** Freelance photographer + content creator (3,200 IG followers)
- **Frequency:** Posts to Instagram daily, posts to TikTok 3x/week
- **Devices:** Pixel 8, iPad Air
- **Current workflow:** Edits a photo in Lightroom Mobile → opens Canva → manually pulls 4-5 hex codes → designs a palette graphic by hand → posts as second slide in IG carousel
- **Pain:** 20 minutes per post building palette graphics. Inconsistent visual style. Resizing for different formats.
- **Job story:** "When I edit a photo with great colors, I want to publish a palette story alongside it, so my feed feels curated."
- **Willingness to pay:** $5/month for unlimited exports + no watermark
- **Conversion hypothesis:** Will convert within first week if free tier feels valuable but watermark is friction

#### Persona 2 — Daniel, the Designer/Moodboarder

- **Age:** 32
- **Role:** Senior UX designer at a SaaS company
- **Frequency:** Captures color references 2-3x/week (travel, restaurants, books, walks)
- **Devices:** OnePlus 11, MacBook Pro
- **Current workflow:** Takes photo → opens Notes app → manually types hex codes from memory or screenshot → loses context (which photo did this come from?)
- **Pain:** Notes lose visual context. Can't search by color. No connection between palette and originating photo.
- **Job story:** "When I see a color combination in the wild, I want to save it in a way I'll actually find later, so my visual vocabulary keeps growing."
- **Willingness to pay:** $20/year for cloud sync + history (Phase 2)
- **Conversion hypothesis:** Will pay annually once cloud sync ships in Phase 2 — uses free tier extensively until then

#### Persona 3 — Carla, the Curious Casual

- **Age:** 19
- **Role:** University student, hobbyist scrapbooker
- **Frequency:** A few times per month, mood-driven usage
- **Devices:** Samsung Galaxy A54 (mid-range)
- **Current workflow:** Saves Pinterest pins → screenshots → tries to identify colors visually
- **Pain:** Has no design skill but loves making her notes app and digital scrapbook pretty
- **Job story:** "When I see a beautiful Pinterest pin, I want to make my own version of the palette, just for fun."
- **Willingness to pay:** Free user, occasional convert to paid for one-off premium templates or seasonal offers
- **Conversion hypothesis:** Will not convert in first 30 days. May convert in 60-90 days if a feature unlocks something she wants (e.g. premium template that goes viral)

### 4.2 User journey — Lucía's flow (the primary persona)

| Stage | Action | Emotion | Pain point | Opportunity |
|---|---|---|---|---|
| Trigger | Edits a sunset photo in Lightroom | Excited | — | Notification: "Open Hued?" |
| Discovery | Opens Hued from home screen | Curious | First time: needs to grant camera + photos permission | Smooth permission flow with clear value |
| Capture | Picks photo from gallery | Eager | Wants minimal taps | Make picker the default first action |
| Extract | Sees 5 colors appear | Delighted | — | This is the "wow" moment |
| Compose | Picks an archetype, customizes | Engaged | Too many options can paralyze | Strong defaults that don't need adjustment |
| Export | Shares to Instagram Stories | Satisfied | Watermark on free tier is friction | Clear path to remove (paywall trigger) |
| Return | Comes back for next photo | Habituated | — | Push notif when she takes a "Lightroom edit" |

### 4.3 "How might we..." statements

These guide the development phase:

- **HMW** make the first export feel like a "wow" moment so the user shares within 60 seconds?
- **HMW** present 5 layout archetypes without overwhelming the user with options?
- **HMW** let users customize without losing the editorial quality of the defaults?
- **HMW** make the free tier valuable enough that users stick around, but constrained enough that power users convert?
- **HMW** handle the case where extracted colors are visually similar (e.g. a photo of a forest) so the output still feels rich?
- **HMW** make the watermark feel like a feature, not a punishment, so it converts rather than annoys?
- **HMW** name colors in a way that feels editorial ("Sunset Coral") rather than technical ("#FF6F4F")?

### 4.4 Design principles

These are the non-negotiables that constrain every product decision:

1. **One-tap-to-result** — the path from open-app to shareable artifact must be 3 taps or fewer.
2. **Editorial defaults** — every default config produces a publication-quality output. No user should have to adjust anything to get a great result.
3. **Constraints, not choices** — 5 archetypes, 3 default fonts, 3 corner styles. Limited choice is editorial discipline, not feature poverty.
4. **No design vocabulary required** — never use words like "kerning", "tracking", "CMYK separation". UI speaks in "name", "form", "position".
5. **Performance is design** — extraction <800ms, preview at 60fps, export <2s (1×) / <4s (4×). Lag breaks the spell.
6. **Watermark is gentle** — small, bottom corner, light opacity. Visible but not loud. A free tier user should still want to share.
7. **Permissions are explained** — never trigger a permission request without context. Show value first.

---

## 5. Diamond 2 · Develop

### 5.1 Product vision statement

> Hued is the fastest way to turn a photo into a shareable color story. Point your camera, pick a layout, share. Built for people who see in color.

### 5.2 Feature scope

#### MVP scope (Sprints 0-5)

| Epic | Feature | Priority |
|---|---|---|
| Capture | Camera with composition guides | P0 |
| Capture | Gallery picker | P0 |
| Capture | Crop & confirm (free-form + 4 presets) | P0 |
| Extract | 5-color k-means extraction in LAB space | P0 |
| Extract | Color naming from ~1500-color dataset | P0 |
| Extract | Sorting (light → dark by L channel) | P0 |
| Compose | 5 archetypes (Strip, Editorial, Grid, Banner, Side) | P0 |
| Compose | Position config per archetype | P0 |
| Compose | Font selection (3 default fonts) | P0 |
| Compose | Show/hide hex, RGB, name | P0 |
| Compose | Corner radius (sharp / rounded / pill) | P1 |
| Compose | Card style (solid / transparent / blur) | P1 |
| Export | PNG at 1×, 2×, 4× | P0 |
| Export | Native share sheet | P0 |
| Export | Save to camera roll | P0 |
| Export | Watermark (free tier, forced) | P0 |
| History | Saved palettes list | P0 |
| History | Favorites | P1 |
| History | Search by color name | P2 (Phase 2) |
| Monetization | Free tier (3 exports/day, watermark) | P0 |
| Monetization | Premium paywall (RevenueCat) | P0 |
| Monetization | Restore purchases | P0 |
| Settings | Subscription management | P0 |
| Onboarding | 3-slide value prop | P0 |

#### Phase 2 (Post-launch)

- iOS port (Expo handles ~80% out of the box)
- Cloud sync via Supabase (premium feature)
- +10 premium templates (paid expansion of archetype library)
- Custom fonts (premium)
- Palette collections / folders
- Web export (palette as HTML page with copy buttons)
- API endpoint for power users (developer tier $9.99/month)
- FTS5 full-text search on color names

#### Future explorations

- Color naming via AI (custom names that match brand personality)
- Style transfer (apply a palette to a different photo)
- Palette-to-Tailwind-tokens export (designer power feature)
- Integration with Decoria (Miguel's interior design AI tool) — pass extracted palettes as design seeds
- Color blindness simulation overlay

### 5.3 User stories (selected, by epic)

**Epic: Capture**

- As Lucía, I want to take a photo within the app so I can capture inspiration in real-time.
- As Daniel, I want to pick from my gallery so I can use existing photos.
- As Carla, I want to crop tightly so the extracted palette focuses on the part of the photo I love.

**Epic: Extract**

- As any user, I want extraction to feel instant so the magic isn't broken by waiting.
- As Lucía, I want color names that feel poetic (not "color #4") so the output feels editorial.
- As Daniel, I want technical metadata (hex, RGB) available on demand so I can use the palette in Figma.

**Epic: Compose**

- As Carla, I want a great default output so I don't have to think.
- As Daniel, I want to customize position and metadata visibility so the output fits my use case.
- As Lucía, I want to preview changes in real-time so I can iterate to the perfect shot.

**Epic: Export**

- As Lucía, I want to share to Instagram Stories with one tap.
- As any user, I want the export to be high-resolution so it doesn't pixelate on big screens.
- As Carla, I want to save to my camera roll so I can use it later in other apps.

**Epic: History**

- As Daniel, I want to see all my past palettes so I can revisit favorites.
- As Lucía, I want to mark palettes as favorites so I can find my best work quickly.

### 5.4 Information architecture

```
Hued/
├── Home (gallery of past palettes)
│   ├── Empty state (onboarding CTA)
│   └── Filled state (grid of palette cards + new CTA)
├── Capture flow
│   ├── Camera
│   ├── Gallery picker
│   └── Crop & confirm
├── Compose screen (the heart)
│   ├── Live preview (Skia canvas)
│   ├── Archetype picker (5 thumbnails)
│   ├── Config panel (collapsed by default)
│   └── Export button
├── Settings
│   ├── Profile (anonymous by default)
│   ├── Subscription
│   ├── About
│   └── Privacy/Terms
└── Paywall (modal, triggered contextually)
```

---

## 6. Diamond 2 · Deliver

### 6.1 Success metrics

**North Star Metric:** Weekly active exporters (users who export at least one palette per week).

**AARRR funnel KPIs:**

| Stage | Metric | Target |
|---|---|---|
| Acquisition | Install rate from Play Store listing | 25%+ from impressions |
| Activation | First export in initial session | 60%+ |
| Retention | D1 retention | 25%+ |
| Retention | D7 retention | 15%+ |
| Revenue | Free → Paid conversion (30 days) | 3%+ |
| Referral | Share rate post-export | 40%+ |

**Engagement metrics:**

- Average exports per WAU: 3+
- Average session duration: 90+ seconds
- Free tier daily limit hit rate (signal for paywall trigger effectiveness): 15%+ of free users hit limit in 30 days

### 6.2 Monetization model

#### Free tier

- 3 exports per day (rolling 24h window)
- Watermark "Made with Hued" in bottom corner on all exports
- All 5 archetypes
- 3 default fonts
- 3 corner styles
- Local history (no cloud sync)
- All extraction features

#### Premium tier — $2.99/month or $19.99/year

(annual price = $1.67/month effective, ~45% savings vs monthly)

- Unlimited exports
- No watermark
- All 5 archetypes (Phase 2: +10 premium templates)
- 8 fonts (Phase 2: custom font upload)
- All corner & card styles
- Cloud sync (Phase 2)
- Export at 4K resolution
- Priority support

#### Pricing rationale

- $2.99 monthly aligns with mobile creator tool benchmarks on the value-conscious end (VSCO $7.99, Halide $11.99, Darkroom $5.99)
- $19.99 annual = $1.67/month effective = strong incentive for commitment
- RevenueCat handles cross-platform receipt validation, restore purchases, and subscription analytics
- Annual upsell at first paywall view: "Save 45% with annual"

#### Paywall triggers

| Trigger | Context | Expected conversion |
|---|---|---|
| Daily limit reached | 4th export attempt in 24h | Highest — user is engaged |
| Watermark tap | Tap on watermark in preview | High — explicit intent |
| Settings upgrade tap | User self-initiates from Settings | High — explicit intent |
| Premium template tap | Phase 2 — tap on locked template | Medium |

### 6.3 Launch plan

| Phase | When | What | Goal |
|---|---|---|---|
| Internal Testing | End of Sprint 5 | Play Console Internal track, 5 testers (Miguel + close friends) | Smoke test, catch obvious bugs |
| Closed Beta | +1 week after Internal | 50-100 testers via Play Console Closed track | Real-world feedback, crash detection |
| Open Beta | +2 weeks | Play Store Open Testing, public link | Volume testing, App Store reviews |
| Production | +1 week | Full Play Store release | Public availability |
| iOS port | +6 weeks post-launch | TestFlight → App Store | iOS coverage |

---

## 7. Out of scope (explicit)

These are NOT in the MVP and are not considered missing features. Stating them explicitly to prevent scope creep:

- **Color blindness simulation** — Phase 2 feature for accessibility palette validation
- **Custom number of extracted colors** — fixed at 5 for MVP (simplifies layout engine massively)
- **Video color extraction** — out of scope entirely; static photos only
- **Multi-photo palettes** — composite palettes from multiple photos are Phase 2+
- **Editing photo before extraction** — Hued is not a photo editor; users edit elsewhere
- **Real-time palette extraction in camera preview** — battery drain risk; capture-then-extract is the chosen flow
- **Account creation in MVP** — local-only; cloud sync is Phase 2 with Supabase Auth
- **Sharing palette as JSON/CSV/Tailwind tokens** — Phase 2 feature for designer power users
- **Manual hex code input** — users with hex codes already have other tools
- **Browser extension or web app** — mobile-first, native exclusive in MVP
- **iOS support** — Phase 2 (after Android MVP validates the model)

---

## 8. Risks & assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| K-means on-device too slow on low-end Android | Medium | High | Benchmark on Pixel 3a equivalent in Sprint 2; fall back to react-native-image-colors if needed |
| Skia rendering performance issues for complex layouts | Low | High | Profile early in Sprint 0 with "Hello Skia" smoke test |
| Play Store review delays due to subscription model | Medium | Medium | Submit Internal Test build early to surface review issues |
| Free tier too generous → no conversion | Medium | High | Watch D30 conversion metric; tighten limits if <2% at 30 days |
| Watermark too aggressive → uninstalls | Low | Medium | A/B test watermark size/position post-launch |
| Color naming dataset feels generic | Medium | Medium | Curate dataset to favor evocative names (Sherwin-Williams style + curated additions) |
| Camera permissions denied — user can't use core feature | Medium | Medium | Provide gallery picker as immediate fallback; never trap user |

### Assumptions to validate

- Users will share exports at >40% rate (driving organic growth) — **validate in Closed Beta**
- $2.99/month is the right price point for the target audience — **validate in Production with price experiments**
- 5 layout archetypes is enough variety for MVP retention — **validate in D30 retention metrics**
- Android-first is the right starting platform — **validate vs iOS post-launch**
- The "editorial output" hypothesis (this is the moat) — **validate via share rate + qualitative feedback**

---

## 9. Glossary

- **Archetype:** One of 5 layout patterns (Strip, Editorial, Grid, Banner, Side) that defines slot positions for the photo and color swatches.
- **LayoutConfig:** The configuration object for a specific instance of an archetype (position, font, corner style, metadata visibility, etc.).
- **LAB color space:** CIE L*a*b* — a color space designed to be perceptually uniform, used for accurate color distance calculations.
- **K-means:** Unsupervised clustering algorithm used to find the N most dominant colors in an image.
- **Skia:** Cross-platform 2D graphics library used by @shopify/react-native-skia for canvas-based rendering.
- **NSM:** North Star Metric — the single metric that best captures the value delivered to users.
- **AARRR:** Acquisition, Activation, Retention, Revenue, Referral — Dave McClure's pirate metrics framework.
- **RevenueCat:** Third-party subscription management platform for mobile apps.
- **Watermark:** Visible "Made with Hued" mark on free tier exports, used as both branding and conversion lever.

---

## 10. References

- Miguel's project knowledge: Guía Integral para Crear una Web Moderna desde Cero (Double Diamond methodology source)
- Double Diamond Design Process — British Design Council (2005)
- Mobile App Monetization Benchmarks 2025-2026 — Adjust
- RevenueCat State of Subscription Apps — annual report
- WCAG 2.1 Level AA — accessibility standard for export labels

---

## Document changelog

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-05-17 | Miguel + AI mentor | Initial draft post Discover + Define |
