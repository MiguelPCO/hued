// src/components/palette/PaletteSizeControl.tsx
import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

import { OptionCarousel } from '@/components/palette/OptionCarousel';
import { Text } from '@/components/ui/Text';
import { Colors, Radius, Spacing } from '@/lib/tokens';

const MIN_SIZE = 3;
const MAX_SIZE = 8;
const THUMB_SIZE = 20;
const TRACK_HEIGHT = 4;

const PRESETS = [
  { key: 3, label: '3' },
  { key: 5, label: '5' },
  { key: 8, label: '8' },
];

interface Props {
  value: number;
  onChange: (paletteSize: number) => void;
  disabled?: boolean;
}

export function PaletteSizeControl({ value, onChange, disabled }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);

  // Dragging re-extracts the palette (K-means + DB write) per committed
  // value, which is far too heavy to run on every touch-move tick — that's
  // what caused the reported stutter/freeze. So the thumb/label track a
  // local `liveValue` during the drag (cheap, instant), and `onChange` (the
  // expensive path) fires only once, on release.
  const [liveValue, setLiveValue] = useState(value);
  const liveValueRef = useRef(value);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    trackWidthRef.current = trackWidth;
  }, [trackWidth]);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLiveValue(value);
      liveValueRef.current = value;
    }
  }, [value]);

  // If the committed size's re-extraction fails, the parent never updates
  // `value` — so the effect above (keyed on `value`) never re-fires, and
  // `liveValue` is left stuck showing the dragged-to size forever even
  // though nothing actually changed. `disabled` (paletteSizeChanging)
  // flipping back to false is the signal that the async attempt settled,
  // success or failure, so resync from the authoritative prop then.
  const wasDisabledRef = useRef(disabled);
  useEffect(() => {
    if (wasDisabledRef.current && !disabled) {
      setLiveValue(value);
      liveValueRef.current = value;
    }
    wasDisabledRef.current = disabled;
  }, [disabled, value]);

  const clampedValue = Math.max(MIN_SIZE, Math.min(liveValue, MAX_SIZE));
  const range = MAX_SIZE - MIN_SIZE;
  const thumbX =
    trackWidth > THUMB_SIZE
      ? ((clampedValue - MIN_SIZE) / range) * (trackWidth - THUMB_SIZE)
      : 0;

  // `locationX` is only reliable on the very first touch event — once the
  // thumb view re-renders under the finger mid-drag, Android re-hit-tests
  // per move and reports locationX relative to whatever view is currently
  // underneath, not the track, producing a "jump". Read the start size once
  // via locationX on grant, then drive the rest of the drag off
  // `gestureState.dx` (a page-space delta from the initial touch), which
  // isn't subject to re-hit-testing.
  const startSizeRef = useRef(clampedValue);

  const commit = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    onChange(liveValueRef.current);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        if (disabled) return;
        const width = trackWidthRef.current;
        if (width <= 0) return;
        isDraggingRef.current = true;
        const x = Math.max(0, Math.min(evt.nativeEvent.locationX, width));
        const size = MIN_SIZE + Math.round((x / width) * range);
        startSizeRef.current = size;
        liveValueRef.current = size;
        setLiveValue(size);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (disabled) return;
        const width = trackWidthRef.current;
        if (width <= 0) return;
        const deltaSize = (gestureState.dx / width) * range;
        const size = Math.round(
          Math.max(MIN_SIZE, Math.min(startSizeRef.current + deltaSize, MAX_SIZE))
        );
        liveValueRef.current = size;
        setLiveValue(size);
      },
      onPanResponderRelease: commit,
      onPanResponderTerminate: commit,
    })
  ).current;

  return (
    <View>
      <OptionCarousel options={PRESETS} activeKey={clampedValue} onSelect={onChange} disabled={disabled} />

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

        <Text variant="small" color={Colors.textSecondary} style={styles.countLabel}>
          {clampedValue} colores
        </Text>
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
  countLabel: { minWidth: 64 },
});
