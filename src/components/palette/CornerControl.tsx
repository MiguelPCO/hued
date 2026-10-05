// src/components/palette/CornerControl.tsx
import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, TextInput, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

import { OptionCarousel } from '@/components/palette/OptionCarousel';
import type { CarouselOption } from '@/components/palette/OptionCarousel';
import { Text } from '@/components/ui/Text';
import { Colors, Radius, Spacing } from '@/lib/tokens';

const MIN_RADIUS = 0;
// Half the smallest canvas dimension (360x450 design units) — beyond this the
// clip already reads as a full pill, so the draggable range stops being useful.
const MAX_RADIUS = 180;
const THUMB_SIZE = 20;
const TRACK_HEIGHT = 4;

interface Props {
  presets: CarouselOption<number>[];
  value: number;
  onChange: (radius: number) => void;
  onLockedPress?: (key: number) => void;
}

export function CornerControl({ presets, value, onChange, onLockedPress }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [isEditingText, setIsEditingText] = useState(false);
  const [draftText, setDraftText] = useState(String(value));
  const trackWidthRef = useRef(0);

  // While the field is not being edited it mirrors the prop directly; the draft
  // only takes over from focus until blur.
  const shownText = isEditingText ? draftText : String(value);

  const clampedValue = Math.max(MIN_RADIUS, Math.min(value, MAX_RADIUS));
  const thumbX =
    trackWidth > THUMB_SIZE ? (clampedValue / MAX_RADIUS) * (trackWidth - THUMB_SIZE) : 0;

  // Committing on every raw touch-move tick fires far more than once per
  // frame and floods the parent with setState + full canvas re-renders,
  // which read as stutter/freeze. Coalesce to at most one `onChange` per
  // animation frame instead.
  const pendingRadiusRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // The responder below is created once, so it reads the latest `onChange`
  // through this ref instead of closing over the first render's prop.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const scheduleRadius = (radius: number) => {
    pendingRadiusRef.current = radius;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingRadiusRef.current !== null) {
          onChangeRef.current(pendingRadiusRef.current);
          pendingRadiusRef.current = null;
        }
      });
    }
  };

  // `locationX` is only reliable on the very first touch event — once the
  // thumb view re-renders under the finger mid-drag, Android re-hit-tests
  // per move and reports locationX relative to whatever view is currently
  // underneath, not the track. That produced the reported "jump" (thumb
  // snapping to bogus positions during a drag). Fix: read the start radius
  // once via locationX on grant, then drive the rest of the drag off
  // `gestureState.dx` (a page-space delta from the initial touch), which
  // isn't subject to re-hit-testing.
  const startRadiusRef = useRef(clampedValue);

  // Created once. The handlers read refs only when a gesture event fires, never
  // during render, so react-hooks/refs is a false positive here.
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const width = trackWidthRef.current;
        if (width <= 0) return;
        const x = Math.max(0, Math.min(evt.nativeEvent.locationX, width));
        const radius = Math.round((x / width) * MAX_RADIUS);
        startRadiusRef.current = radius;
        scheduleRadius(radius);
      },
      onPanResponderMove: (_evt, gestureState) => {
        const width = trackWidthRef.current;
        if (width <= 0) return;
        const deltaRadius = (gestureState.dx / width) * MAX_RADIUS;
        const radius = Math.round(
          Math.max(MIN_RADIUS, Math.min(startRadiusRef.current + deltaRadius, MAX_RADIUS))
        );
        scheduleRadius(radius);
      },
    })
  );

  function commitDraftText() {
    const parsed = Number.parseInt(draftText, 10);
    const radius = Number.isFinite(parsed) ? Math.max(MIN_RADIUS, parsed) : value;
    onChange(radius);
    setDraftText(String(radius));
  }

  return (
    <View>
      <OptionCarousel options={presets} activeKey={value} onSelect={onChange} onLockedPress={onLockedPress} />

      <View style={styles.controlRow}>
        <View
          style={styles.track}
          onLayout={(e) => {
            trackWidthRef.current = e.nativeEvent.layout.width;
            setTrackWidth(e.nativeEvent.layout.width);
          }}
          {...panResponder.panHandlers}
        >
          <View style={styles.trackFill} />
          <View style={[styles.thumb, { left: thumbX }]} />
        </View>

        <View style={styles.pxField}>
          <TextInput
            style={styles.pxInput}
            value={shownText}
            onChangeText={setDraftText}
            onFocus={() => {
              setDraftText(String(value));
              setIsEditingText(true);
            }}
            onBlur={() => {
              setIsEditingText(false);
              commitDraftText();
            }}
            keyboardType="number-pad"
            maxLength={4}
          />
          <Text variant="small" color={Colors.textSecondary}>
            px
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  track: {
    flex: 1,
    height: THUMB_SIZE,
    justifyContent: 'center',
  },
  trackFill: {
    height: TRACK_HEIGHT,
    borderRadius: Radius.pill,
    backgroundColor: Colors.borderStrong,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
  },
  pxField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pxInput: {
    minWidth: 44,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
});
