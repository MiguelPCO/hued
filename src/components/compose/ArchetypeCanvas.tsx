import { Canvas, Group, rrect, rect, RoundedRect, useImage } from '@shopify/react-native-skia';
import { useWindowDimensions } from 'react-native';

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
  const clip = rrect(rect(0, 0, CANVAS_W, CANVAS_H), config.cornerRadius, config.cornerRadius);
  const { Component } = ARCHETYPES[config.archetypeId];

  return (
    <Canvas style={{ width: screenW, height: displayH }}>
      <Group transform={[{ scale }]}>
        <Group clip={clip}>
          <Component {...archetypeProps} />
        </Group>

        {config.cardStyle === 'outlined' && (
          <RoundedRect
            x={1}
            y={1}
            width={CANVAS_W - 2}
            height={CANVAS_H - 2}
            r={config.cornerRadius}
            color="transparent"
            strokeWidth={2}
            style="stroke"
          />
        )}
      </Group>
    </Canvas>
  );
}
