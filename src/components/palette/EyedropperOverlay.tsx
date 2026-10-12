// src/components/palette/EyedropperOverlay.tsx
import { useEffect, useRef, useState } from 'react';

import { Image, Modal, PanResponder, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';

import { Text } from '@/components/ui/Text';
import { rgbToHex } from '@/lib/color/colorMath';
import type { RGB } from '@/lib/color/colorModes';
import { readThumbnailPixels } from '@/lib/color/extract';
import { type Size, averageAround, containRect, touchToPixel } from '@/lib/color/eyedropper';
import { Colors, Radius, Spacing } from '@/lib/tokens';
import type { ExtractedColor } from '@/types/palette';

const LOUPE_SIZE = 112;
const LOUPE_ZOOM = 8;
/** Keeps the loupe above the fingertip so it isn't hidden under it. */
const LOUPE_LIFT = 90;

interface Props {
  visible: boolean;
  thumbnailUri: string;
  colors: ExtractedColor[];
  onPick: (index: number, rgb: RGB) => void;
  onClose: () => void;
}

interface Touch {
  x: number;
  y: number;
  rgb: RGB;
}

// Mounted only while open, so every opening starts from a clean state (first swatch, no touch, fresh pixels).
export function EyedropperOverlay({ visible, ...props }: Props) {
  if (!visible) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={props.onClose}>
      <EyedropperContent {...props} />
    </Modal>
  );
}

function EyedropperContent({ thumbnailUri, colors, onPick, onClose }: Omit<Props, 'visible'>) {
  const [slot, setSlot] = useState(0);
  const [box, setBox] = useState<Size | null>(null);
  const [touch, setTouch] = useState<Touch | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [data, setData] = useState<{ pixels: Uint8Array; size: Size } | null>(null);

  useEffect(() => {
    let cancelled = false;
    readThumbnailPixels(thumbnailUri)
      .then(({ pixels, width, height }) => {
        if (!cancelled) setData({ pixels, size: { width, height } });
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [thumbnailUri]);

  // The responder is created once; it reads the latest values through refs.
  const dataRef = useRef(data);
  const boxRef = useRef(box);
  const slotRef = useRef(slot);
  const touchRef = useRef(touch);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    dataRef.current = data;
    boxRef.current = box;
    slotRef.current = slot;
    touchRef.current = touch;
    onPickRef.current = onPick;
  });

  const sample = (evt: GestureResponderEvent) => {
    const d = dataRef.current;
    const b = boxRef.current;
    if (!d || !b) return;
    const { locationX, locationY } = evt.nativeEvent;
    const p = touchToPixel(b, d.size, locationX, locationY);
    if (!p) return;
    const rgb = averageAround(d.pixels, d.size, p.x, p.y);
    if (rgb) setTouch({ x: locationX, y: locationY, rgb });
  };

  const commit = () => {
    const t = touchRef.current;
    if (t) onPickRef.current(slotRef.current, t.rgb);
    setTouch(null);
  };

  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: sample,
      onPanResponderMove: sample,
      onPanResponderRelease: commit,
      onPanResponderTerminate: () => setTouch(null),
    }),
  );

  const onLayout = (e: LayoutChangeEvent) =>
    setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });

  const rect = box && data ? containRect(box, data.size) : null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Text variant="body" weight="semibold" color={Colors.accent}>
            Cancelar
          </Text>
        </TouchableOpacity>
        <Text variant="small" color={Colors.textSecondary}>
          Arrastra sobre la foto y suelta
        </Text>
      </View>

      <View style={styles.photoArea} onLayout={onLayout} {...responder.panHandlers}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image source={{ uri: thumbnailUri }} style={styles.photo} resizeMode="contain" />
        </View>
        {loadFailed && (
          <Text variant="small" color={Colors.error} style={styles.error}>
            No se pudo leer la foto.
          </Text>
        )}
        {touch && rect && <Loupe uri={thumbnailUri} rect={rect} touch={touch} />}
      </View>

      <View style={styles.slots}>
        <Text variant="caption" color={Colors.textSecondary}>
          Color a reemplazar
        </Text>
        <View style={styles.slotRow}>
          {colors.map((c, i) => (
            <TouchableOpacity
              key={`${c.hex}-${i}`}
              accessibilityLabel={`Reemplazar color ${i + 1}`}
              onPress={() => setSlot(i)}
              style={[styles.slot, { backgroundColor: c.hex }, i === slot && styles.slotActive]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function Loupe({
  uri,
  rect,
  touch,
}: {
  uri: string;
  rect: { left: number; top: number; width: number; height: number };
  touch: Touch;
}) {
  // The photo drawn LOUPE_ZOOM× larger, shifted so the touched point sits at the loupe's centre.
  const zoomedW = rect.width * LOUPE_ZOOM;
  const zoomedH = rect.height * LOUPE_ZOOM;
  const offsetX = LOUPE_SIZE / 2 - (touch.x - rect.left) * LOUPE_ZOOM;
  const offsetY = LOUPE_SIZE / 2 - (touch.y - rect.top) * LOUPE_ZOOM;
  const hex = rgbToHex(...touch.rgb);
  return (
    <View
      pointerEvents="none"
      style={[
        styles.loupe,
        {
          left: touch.x - LOUPE_SIZE / 2,
          top: touch.y - LOUPE_LIFT - LOUPE_SIZE / 2,
          borderColor: hex,
        },
      ]}
    >
      <Image
        source={{ uri }}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          width: zoomedW,
          height: zoomedH,
          left: offsetX,
          top: offsetY,
        }}
      />
      <View style={styles.crosshair} />
      <View style={styles.hexTag}>
        <Text variant="caption" color={Colors.textInverse}>
          {hex}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgInverse },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  photoArea: { flex: 1 },
  photo: { width: '100%', height: '100%' },
  error: { position: 'absolute', alignSelf: 'center', top: Spacing.lg },
  slots: { padding: Spacing.md, gap: Spacing.sm },
  slotRow: { flexDirection: 'row', gap: Spacing.sm },
  slot: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  slotActive: { borderColor: Colors.accentForeground },
  loupe: {
    position: 'absolute',
    width: LOUPE_SIZE,
    height: LOUPE_SIZE,
    borderRadius: LOUPE_SIZE / 2,
    borderWidth: 4,
    overflow: 'hidden',
    backgroundColor: Colors.bgInverse,
  },
  crosshair: {
    position: 'absolute',
    left: LOUPE_SIZE / 2 - 6,
    top: LOUPE_SIZE / 2 - 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.accentForeground,
  },
  hexTag: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
});
