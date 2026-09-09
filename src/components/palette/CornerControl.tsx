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

  useEffect(() => {
    if (!isEditingText) setDraftText(String(value));
  }, [value, isEditingText]);

  const clampedValue = Math.max(MIN_RADIUS, Math.min(value, MAX_RADIUS));
  const thumbX =
    trackWidth > THUMB_SIZE ? (clampedValue / MAX_RADIUS) * (trackWidth - THUMB_SIZE) : 0;

  const handleTrackGesture = (evt: GestureResponderEvent) => {
    const width = trackWidthRef.current;
    if (width <= 0) return;
    const x = Math.max(0, Math.min(evt.nativeEvent.locationX, width));
    const radius = Math.round((x / width) * MAX_RADIUS);
    onChange(radius);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: handleTrackGesture,
      onPanResponderMove: handleTrackGesture,
    })
  ).current;

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
            value={draftText}
            onChangeText={setDraftText}
            onFocus={() => setIsEditingText(true)}
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
