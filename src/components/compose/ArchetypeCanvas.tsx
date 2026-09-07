import { Canvas, Group, useImage } from '@shopify/react-native-skia';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { getCardFrame, shouldRenderWatermark } from '@/components/compose/archetypes/shared';
import { getWatermarkTapRegion, Watermark } from '@/components/compose/archetypes/Watermark';
import { ARCHETYPES } from '@/data/archetypes';
import { useSettingsStore } from '@/lib/store/settingsStore';
import type { Palette, LayoutConfig } from '@/types/palette';

interface Props {
  palette: Palette;
  config: LayoutConfig;
  onWatermarkPress?: () => void;
}

const CANVAS_W = 360;
const CANVAS_H = 450;

export function ArchetypeCanvas({ palette, config, onWatermarkPress }: Props) {
  const { width: screenW } = useWindowDimensions();
  const scale = screenW / CANVAS_W;
  const displayH = CANVAS_H * scale;
  const image = useImage(palette.imageUri);
  const subscriptionStatus = useSettingsStore((s) => s.subscriptionStatus);

  const archetypeProps = { palette, config, width: CANVAS_W, height: CANVAS_H, image };
  const { clip, overlay } = getCardFrame(config, CANVAS_W, CANVAS_H);
  const { Component } = ARCHETYPES[config.archetypeId];

  const watermarkShown = shouldRenderWatermark(config.watermarkVisible, subscriptionStatus);
  const tapRegion = getWatermarkTapRegion(CANVAS_W, CANVAS_H);

  return (
    <View style={{ width: screenW, height: displayH }}>
      <Canvas style={{ width: screenW, height: displayH }}>
        <Group transform={[{ scale }]}>
          <Group clip={clip}>
            <Component {...archetypeProps} />
          </Group>

          {overlay}
          {watermarkShown && (
            <Watermark width={CANVAS_W} height={CANVAS_H} cornerRadius={config.cornerRadius} />
          )}
        </Group>
      </Canvas>

      {watermarkShown && subscriptionStatus === 'free' && onWatermarkPress && (
        <Pressable
          onPress={onWatermarkPress}
          style={{
            position: 'absolute',
            left: tapRegion.x * scale,
            top: tapRegion.y * scale,
            width: tapRegion.width * scale,
            height: tapRegion.height * scale,
          }}
        />
      )}
    </View>
  );
}
