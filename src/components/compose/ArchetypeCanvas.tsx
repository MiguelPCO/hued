import { Canvas, Group, useImage } from '@shopify/react-native-skia';
import { useWindowDimensions } from 'react-native';

import { getCardFrame } from '@/components/compose/archetypes/shared';
import { Watermark } from '@/components/compose/archetypes/Watermark';
import { ARCHETYPES } from '@/data/archetypes';
import type { Palette, LayoutConfig } from '@/types/palette';

interface Props {
  palette: Palette;
  config: LayoutConfig;
}

const CANVAS_W = 360;
const CANVAS_H = 450;

export function ArchetypeCanvas({ palette, config }: Props) {
  const { width: screenW } = useWindowDimensions();
  const scale = screenW / CANVAS_W;
  const displayH = CANVAS_H * scale;
  const image = useImage(palette.imageUri);

  const archetypeProps = { palette, config, width: CANVAS_W, height: CANVAS_H, image };
  const { clip, overlay } = getCardFrame(config, CANVAS_W, CANVAS_H);
  const { Component } = ARCHETYPES[config.archetypeId];

  return (
    <Canvas style={{ width: screenW, height: displayH }}>
      <Group transform={[{ scale }]}>
        <Group clip={clip}>
          <Component {...archetypeProps} />
        </Group>

        {overlay}
        {config.watermarkVisible && (
          <Watermark width={CANVAS_W} height={CANVAS_H} cornerRadius={config.cornerRadius} />
        )}
      </Group>
    </Canvas>
  );
}
