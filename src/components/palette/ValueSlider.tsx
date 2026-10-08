// src/components/palette/ValueSlider.tsx
import { useEffect, useRef, useState } from 'react';

import { PanResponder, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Colors, Radius, Spacing } from '@/lib/tokens';

const THUMB_SIZE = 20;
const TRACK_HEIGHT = 4;

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Shown after the number, e.g. "%" or "px". */
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** −/+ buttons instead of a draggable track (for small ranges typed or tapped, like the font size). */
  stepper?: boolean;
}

export function ValueSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  disabled,
  stepper,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [isEditingText, setIsEditingText] = useState(false);
  const [draftText, setDraftText] = useState(String(value));
  const trackWidthRef = useRef(0);
  const startValueRef = useRef(value);

  const snap = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));

  // The responder is created once, so it reads the latest props through this ref.
  const latest = useRef({ min, max, step, onChange, disabled, snap });
  useEffect(() => {
    latest.current = { min, max, step, onChange, disabled, snap };
  });

  // Raw touch-move ticks fire faster than the canvas can usefully redraw: coalesce to one change per frame.
  const pendingRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const schedule = (next: number) => {
    pendingRef.current = next;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingRef.current !== null) {
          latest.current.onChange(pendingRef.current);
          pendingRef.current = null;
        }
      });
    }
  };
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // `locationX` is only reliable on the first touch event (see CornerControl): read the start value
  // once on grant, then follow `gestureState.dx`.
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { min: lo, max: hi, disabled: off, snap: snapTo } = latest.current;
        const width = trackWidthRef.current;
        if (off || width <= 0) return;
        const x = Math.max(0, Math.min(evt.nativeEvent.locationX, width));
        startValueRef.current = snapTo(lo + (x / width) * (hi - lo));
        schedule(startValueRef.current);
      },
      onPanResponderMove: (_evt, gestureState) => {
        const { min: lo, max: hi, disabled: off, snap: snapTo } = latest.current;
        const width = trackWidthRef.current;
        if (off || width <= 0) return;
        schedule(snapTo(startValueRef.current + (gestureState.dx / width) * (hi - lo)));
      },
    }),
  );

  const shownText = isEditingText ? draftText : String(value);
  const thumbX =
    trackWidth > THUMB_SIZE ? ((snap(value) - min) / (max - min)) * (trackWidth - THUMB_SIZE) : 0;

  function commitDraftText() {
    const parsed = Number.parseFloat(draftText);
    const next = Number.isFinite(parsed) ? snap(parsed) : value;
    onChange(next);
    setDraftText(String(next));
  }

  const numberField = (
    <View style={styles.field}>
      <TextInput
        style={styles.input}
        value={shownText}
        editable={!disabled}
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
        accessibilityLabel={label}
      />
      {unit && (
        <Text variant="small" color={Colors.textSecondary}>
          {unit}
        </Text>
      )}
    </View>
  );

  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <Text variant="small" color={Colors.textSecondary} style={styles.label}>
        {label}
      </Text>

      {stepper ? (
        <View style={styles.stepper}>
          <TouchableOpacity
            style={styles.stepButton}
            disabled={disabled || value <= min}
            onPress={() => onChange(snap(value - step))}
            accessibilityLabel={`${label} menos`}
          >
            <Text variant="body">−</Text>
          </TouchableOpacity>
          {numberField}
          <TouchableOpacity
            style={styles.stepButton}
            disabled={disabled || value >= max}
            onPress={() => onChange(snap(value + step))}
            accessibilityLabel={`${label} más`}
          >
            <Text variant="body">+</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
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
          {numberField}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  disabled: { opacity: 0.4 },
  label: { width: 76 },
  track: { flex: 1, height: THUMB_SIZE, justifyContent: 'center' },
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
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
  },
  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  input: {
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
