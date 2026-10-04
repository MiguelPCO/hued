// Invisible drag/resize handles laid over the ArchetypeCanvas's <Canvas>,
// one per libre swatch, in the same array order as the swatches themselves
// so native touch/view stacking gives z-order "topmost wins" for free —
// matching how the swatches are painted inside the Canvas. Plain
// PanResponder (this codebase's existing drag idiom — see CornerControl's
// slider), not gesture-handler/reanimated: at 3-8 swatches, a normal React
// re-render per committed move is not a perf concern, and this reuses the
// existing updateConfig debounce-to-DB path instead of a parallel
// UI-thread-only state system that would still need its own bridge back to
// persistence. Committing is throttled to one `onChange` per animation
// frame (see `scheduleChange` below) since raw touch-move ticks fire faster
// than that.
//
// Alignment guides (docs/adr/0002-libre-alignment-guides.md) are entirely
// ephemeral UI state — never written to `freeformSwatches` — so they live
// here in the overlay, lifted to this component so a guide line or a
// size-match outline can be drawn once against the full swatch list, rather
// than duplicated per handle.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import {
  bringToFront,
  clampSwatch,
  clampResizeSwatch,
  snapPosition,
  snapSize,
} from '@/components/compose/archetypes/freeformLayout';
import type { AlignmentGuide } from '@/components/compose/archetypes/freeformLayout';
import type { EditOverlayProps } from '@/components/compose/archetypes/types';
import { Colors } from '@/lib/tokens';
import type { FreeformSwatch } from '@/types/palette';

const MIN_SIZE = 24;
const HANDLE_SIZE = 28;
const GUIDE_WIDTH = 1;
const MATCH_BORDER_WIDTH = 2;

export function LibreEditOverlay({ palette, config, scale, canvasW, canvasH, onFreeformSwatchesChange }: EditOverlayProps) {
  const swatches = config.freeformSwatches;
  const colors = palette.colors;
  const onChange = onFreeformSwatchesChange;
  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);
  const [sizeMatchColorIndexes, setSizeMatchColorIndexes] = useState<number[]>([]);

  return (
    <>
      {swatches.map((swatch) =>
        colors[swatch.colorIndex] ? (
          <SwatchHandle
            key={swatch.colorIndex}
            swatch={swatch}
            allSwatches={swatches}
            scale={scale}
            canvasW={canvasW}
            canvasH={canvasH}
            onChange={onChange}
            onGuidesChange={setActiveGuides}
            onSizeMatchChange={setSizeMatchColorIndexes}
            highlighted={sizeMatchColorIndexes.includes(swatch.colorIndex)}
          />
        ) : null
      )}

      {activeGuides.map((guide, i) => (
        <View
          key={`${guide.axis}-${i}`}
          pointerEvents="none"
          style={
            guide.axis === 'x'
              ? [styles.guideVertical, { left: guide.position * scale, height: canvasH * scale }]
              : [styles.guideHorizontal, { top: guide.position * scale, width: canvasW * scale }]
          }
        />
      ))}
    </>
  );
}

interface HandleProps {
  swatch: FreeformSwatch;
  allSwatches: FreeformSwatch[];
  scale: number;
  canvasW: number;
  canvasH: number;
  onChange: (updater: (prev: FreeformSwatch[]) => FreeformSwatch[]) => void;
  onGuidesChange: (guides: AlignmentGuide[]) => void;
  onSizeMatchChange: (colorIndexes: number[]) => void;
  highlighted: boolean;
}

function SwatchHandle({
  swatch,
  allSwatches,
  scale,
  canvasW,
  canvasH,
  onChange,
  onGuidesChange,
  onSizeMatchChange,
  highlighted,
}: HandleProps) {
  // Kept fresh every render so gesture callbacks (created once per deps via
  // useMemo, not per render) always read the latest committed rect instead
  // of the one from whichever render happened to create them.
  const rectRef = useRef(swatch);
  useEffect(() => {
    rectRef.current = swatch;
  }, [swatch]);
  const dragStartRef = useRef(swatch);

  // The other swatches' geometry, for alignment-guide candidates. Read via a
  // ref for the same reason as `rectRef`: the gesture callbacks are created
  // once (useMemo) and must see live data without being recreated mid-drag.
  const othersRef = useRef<FreeformSwatch[]>([]);
  useEffect(() => {
    othersRef.current = allSwatches.filter((s) => s.colorIndex !== swatch.colorIndex);
  }, [allSwatches, swatch.colorIndex]);

  // Raw touch-move ticks fire faster than the canvas can usefully redraw;
  // committing on every one of them (each a full parent setState + Skia
  // re-render) is what caused the reported stutter. Coalesce to at most one
  // flush — position commit, local guide state, local size-match state —
  // per animation frame.
  const rafRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<((prev: FreeformSwatch[]) => FreeformSwatch[]) | null>(null);
  const pendingGuidesRef = useRef<AlignmentGuide[] | null>(null);
  const pendingSizeMatchRef = useRef<number[] | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingUpdateRef.current) {
        onChange(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
      if (pendingGuidesRef.current !== null) {
        onGuidesChange(pendingGuidesRef.current);
        pendingGuidesRef.current = null;
      }
      if (pendingSizeMatchRef.current !== null) {
        onSizeMatchChange(pendingSizeMatchRef.current);
        pendingSizeMatchRef.current = null;
      }
    });
  }, [onChange, onGuidesChange, onSizeMatchChange]);

  const clearGuides = useCallback(() => {
    pendingGuidesRef.current = null;
    onGuidesChange([]);
  }, [onGuidesChange]);

  const clearSizeMatch = useCallback(() => {
    pendingSizeMatchRef.current = null;
    onSizeMatchChange([]);
  }, [onSizeMatchChange]);

  const movePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = rectRef.current;
          const { colorIndex } = rectRef.current;
          onChange((prev) => {
            const idx = prev.findIndex((s) => s.colorIndex === colorIndex);
            return idx === -1 ? prev : bringToFront(prev, idx);
          });
        },
        onPanResponderMove: (_evt, gestureState) => {
          const start = dragStartRef.current;
          const rawNext = clampSwatch(
            { ...start, x: start.x + gestureState.dx / scale, y: start.y + gestureState.dy / scale },
            canvasW,
            canvasH
          );
          const snap = snapPosition(rawNext, othersRef.current, canvasW, canvasH);
          const next = clampSwatch({ ...rawNext, x: snap.x, y: snap.y }, canvasW, canvasH);
          pendingUpdateRef.current = (prev) => prev.map((s) => (s.colorIndex === next.colorIndex ? next : s));
          pendingGuidesRef.current = snap.guides;
          scheduleFlush();
        },
        onPanResponderRelease: clearGuides,
        onPanResponderTerminate: clearGuides,
      }),
    [scale, canvasW, canvasH, onChange, scheduleFlush, clearGuides]
  );

  const resizePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = rectRef.current;
        },
        onPanResponderMove: (_evt, gestureState) => {
          const start = dragStartRef.current;
          const rawNext = clampResizeSwatch(
            {
              ...start,
              width: Math.max(MIN_SIZE, start.width + gestureState.dx / scale),
              height: Math.max(MIN_SIZE, start.height + gestureState.dy / scale),
            },
            canvasW,
            canvasH
          );
          const sizeSnap = snapSize(rawNext, othersRef.current);
          const next = clampResizeSwatch(
            { ...rawNext, width: sizeSnap.width, height: sizeSnap.height },
            canvasW,
            canvasH
          );
          pendingUpdateRef.current = (prev) => prev.map((s) => (s.colorIndex === next.colorIndex ? next : s));
          pendingSizeMatchRef.current =
            sizeSnap.matchedColorIndexes.length > 0 ? [next.colorIndex, ...sizeSnap.matchedColorIndexes] : [];
          scheduleFlush();
        },
        onPanResponderRelease: clearSizeMatch,
        onPanResponderTerminate: clearSizeMatch,
      }),
    [scale, canvasW, canvasH, scheduleFlush, clearSizeMatch]
  );

  return (
    <View
      style={[
        styles.handle,
        {
          left: swatch.x * scale,
          top: swatch.y * scale,
          width: swatch.width * scale,
          height: swatch.height * scale,
        },
        highlighted && styles.handleMatched,
      ]}
      {...movePanResponder.panHandlers}
    >
      <View style={styles.resizeHandle} {...resizePanResponder.panHandlers} />
    </View>
  );
}

const styles = StyleSheet.create({
  handle: { position: 'absolute' },
  handleMatched: { borderWidth: MATCH_BORDER_WIDTH, borderColor: Colors.accent },
  resizeHandle: {
    position: 'absolute',
    right: -HANDLE_SIZE / 2,
    bottom: -HANDLE_SIZE / 2,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: Colors.bgElevated,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  guideVertical: {
    position: 'absolute',
    top: 0,
    width: GUIDE_WIDTH,
    backgroundColor: Colors.accent,
  },
  guideHorizontal: {
    position: 'absolute',
    left: 0,
    height: GUIDE_WIDTH,
    backgroundColor: Colors.accent,
  },
});
