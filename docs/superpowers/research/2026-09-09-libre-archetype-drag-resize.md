# Research: draggable + resizable Skia swatches for the Libre archetype

Installed versions verified directly in `node_modules`: `@shopify/react-native-skia@2.6.2`, `react-native-gesture-handler@2.32.0`, `react-native-reanimated@4.5.1`.

## 1. Driving one Rect's x/y/width/height from a SharedValue

Confirmed via the official docs (shopify.github.io/react-native-skia, "Animations" page): Skia 2.6 supports **passing Reanimated shared/derived values directly as component props**, no wrapper needed —

> "React Native Skia supports the direct usage of Reanimated's shared and derived values as properties. There is no need for functions like `createAnimatedComponent`"

```js
const r = useSharedValue(0);
<Circle cx={r} cy={r} r={r} color="cyan" />
```

For a group of related values (a swatch's x/y/width/height together), the docs recommend `select()` over separate `useDerivedValue`s per field, for single-subscription efficiency — **requires Reanimated v4+** (we're on 4.5.1, satisfied):

```js
const rect = useSharedValue({ x: 0, y: 0, width: 80, height: 60 });
<Rect x={select(rect, 'x')} y={select(rect, 'y')} width={select(rect, 'width')} height={select(rect, 'height')} color={color.hex} />
```

This also confirms redraws happen entirely on the UI thread via Skia's own subscription to the SharedValue — there is no React re-render, and thus no bridge round-trip, per drag frame. This directly answers "no re-render of the other N-1 rects": each swatch has its own SharedValue, so nothing about swatch B's render is invalidated by swatch A's gesture.

Confirmed independently from the package's own `.d.ts`: `Canvas` (`renderer/Canvas.d.ts`) takes `{ debug, opaque, children, onSize, colorSpace, androidWarmup, ref, onLayout, ...viewProps }` — no `onTouch`/touch-handler prop exists on the 2.6.x `Canvas`. The old `useTouchHandler`/`useValue`/`useComputedValue` API from pre-1.0 Skia only exists today in the package's `mock` module (`lib/.../mock/index.d.ts`) — i.e. it's legacy/test-mock surface, not the real API. Confirms the gesture-handler + Reanimated pattern below is the only current path, not a stale tutorial artifact.

## 2 & 3. N independent shapes + hit-testing / z-order

Per the official gestures doc (shopify.github.io/react-native-skia, "Gestures" page), the documented approach for targeting one shape among several is **not** manual hit-test math against the Canvas's single gesture stream. It's the "Element Tracking Pattern":

> "overlay an animated view on it, ensuring that the same transformations applied to the canvas element are mirrored on the animated view."

Concretely: render one invisible, absolutely-positioned `Animated.View` per swatch (not one `GestureDetector` wrapping the whole `<Canvas>`), each carrying its own `Gesture.Pan()` wired to that swatch's own SharedValue. This solves both open questions for free:

- **Independent shapes**: each overlay's gesture only ever touches its own SharedValue — no shared gesture state to coordinate across swatches.
- **Z-order hit-testing**: native touch dispatch on stacked Views already resolves "topmost view wins" — if the overlays are rendered in the same array order as the Skia swatches (this repo's agreed rule: array order = z-order, last = front), the DOM/view stacking order matches the visual stacking order automatically. No manual "iterate reversed, test bounding box" code needed.

The official docs explicitly do not cover multi-shape overlap hit-testing beyond this pattern — this repo's "topmost overlay wins" reasoning above is an inference from how native touch dispatch works, not a docs quote.

## 4. Clamping into the fixed 360×450 design-space canvas

Not covered by the official docs (this is app-specific). The nuance specific to this repo: `ArchetypeCanvas.tsx` renders everything at a fixed **360×450 design space**, then wraps the whole `<Canvas>` in a `<Group transform={[{ scale }]}>` for display, where `scale = displayW / 360`. The invisible gesture-tracking overlay `View`s, however, must be sized/positioned in **display** pixels (`displayW`/`displayH`) to align with what the Skia canvas actually renders on screen underneath them.

Two coordinate spaces are therefore in play:

- The overlay `View`'s layout (`left`, `top`, `width`, `height`) — display-space, `design_value * scale`.
- The `SharedValue` feeding the `Rect` prop inside Skia — design-space (360×450), unscaled.

Recommended: keep the canonical `SharedValue` in **design-space** units (so it can be clamped against constant `0..360` / `0..450` bounds regardless of the device's screen width), and derive the overlay's display-space position with `useDerivedValue(() => sv.value.x * scale)` etc. Inside the pan gesture's `.onChange`, convert the incoming `e.changeX` (a display-space delta, since the gesture fires on the display-space overlay) back to design-space before mutating the SharedValue: `sv.value.x = clamp(sv.value.x + e.changeX / scale, 0, 360 - sv.value.width)`. Clamping in design-space, before scale, is what the task brief asked for, and it's also simplest: one set of bounds constants, independent of `scale`/screen width.

## 5. Pitfalls specific to this version combination

- **Reanimated 4 requires the New Architecture** (verified via web search of Expo's own `expo/fyi` upgrade notes and the SDK 54 changelog — Reanimated v4 dropped Old Architecture support entirely; SDK 54 is the last SDK that even supports Old Arch at all). This repo is on Expo SDK 57 with Reanimated 4.5.1 already installed and already building/running on-device per existing project state, so New Architecture is already a satisfied precondition here — not a new risk this feature introduces, just worth knowing why Reanimated 4 works at all in this repo.
- **`select()` needs Reanimated v4+** — satisfied (4.5.1). On an older Reanimated this pattern would need per-field `useDerivedValue`s instead.
- **The old Skia touch API is gone, not just discouraged** — confirmed above via `.d.ts` inspection, not just a docs preference. Any tutorial referencing `useTouchHandler`/`Skia.useValue` is for a pre-1.0 API surface not present in 2.6.x outside the test mock.
- The official docs did not surface any Android/iOS-specific gesture divergence for this exact pattern (overlay `Animated.View` + `Gesture.Pan()`) — nothing found to flag beyond the general gesture-handler requirement that `GestureDetector` needs to sit under `GestureHandlerRootView` at the app root, which this repo almost certainly already has for any existing gesture-driven UI (not verified in this research pass — check before implementation if this is the *first* gesture-handler usage in the app).

## Recommended pattern

Per-swatch invisible `GestureDetector`-wrapped `Animated.View` overlays (rendered in the same array order as the swatches, so native stacking gives z-order for free), each driving a design-space `{x, y, width, height}` SharedValue via `select()` into the swatch's Skia `Rect` props; a small second `Gesture.Pan()` on a corner-handle sub-view (visible only on the active swatch) mutates the same SharedValue's `width`/`height` instead of `x`/`y`; all mutation and clamping happens directly on the SharedValue on the UI thread, so the `<Canvas>` never re-renders via React for a drag/resize frame.

```js
// one per swatch, index i, array position = z-order (last = front)
const rect = useSharedValue({ x, y, width, height }); // design-space units

const move = Gesture.Pan().onChange((e) => {
  rect.value = {
    ...rect.value,
    x: clamp(rect.value.x + e.changeX / scale, 0, CANVAS_W - rect.value.width),
    y: clamp(rect.value.y + e.changeY / scale, 0, CANVAS_H - rect.value.height),
  };
});

const resize = Gesture.Pan().onChange((e) => {
  rect.value = {
    ...rect.value,
    width: clamp(rect.value.width + e.changeX / scale, MIN_SIZE, CANVAS_W - rect.value.x),
    height: clamp(rect.value.height + e.changeY / scale, MIN_SIZE, CANVAS_H - rect.value.y),
  };
});

// Skia side, inside the Canvas, unaffected by the overlay's display-space scale:
<Rect x={select(rect, 'x')} y={select(rect, 'y')} width={select(rect, 'width')} height={select(rect, 'height')} color={color.hex} />

// overlay side, absolutely positioned in display pixels, one per swatch, same array order:
<GestureDetector gesture={move}>
  <Animated.View style={overlayStyleFrom(rect, scale)} />
</GestureDetector>
```

## Sources

- https://shopify.github.io/react-native-skia/docs/animations/animations — direct SharedValue-as-prop, `select()`, Reanimated v4 requirement
- https://shopify.github.io/react-native-skia/docs/animations/gestures — Gesture.Pan() + GestureDetector pattern, "Element Tracking Pattern" for overlay-per-shape
- `node_modules/@shopify/react-native-skia/lib/typescript/lib/module/renderer/Canvas.d.ts` — confirms no touch-handler prop on 2.6.x `Canvas`
- `node_modules/@shopify/react-native-skia/lib/typescript/lib/module/mock/index.d.ts` — confirms `useTouchHandler`/`useValue`/`useComputedValue` only exist in the mock/legacy surface
- https://github.com/expo/fyi/blob/main/expo-54-reanimated.md and https://expo.dev/changelog/sdk-54 — Reanimated 4 / New Architecture requirement, SDK 54 as the Old-Arch cutoff
