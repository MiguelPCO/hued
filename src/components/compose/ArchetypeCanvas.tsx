import { Canvas, Group, rrect, rect, RoundedRect } from '@shopify/react-native-skia';
import { useWindowDimensions } from 'react-native';

import { BannerArchetype } from './archetypes/BannerArchetype';
import { EditorialArchetype } from './archetypes/EditorialArchetype';
import { GridArchetype } from './archetypes/GridArchetype';
import { SideArchetype } from './archetypes/SideArchetype';
import { StripArchetype } from './archetypes/StripArchetype';
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

  const archetypeProps = { palette, config, width: CANVAS_W, height: CANVAS_H };
  const clip = rrect(rect(0, 0, CANVAS_W, CANVAS_H), config.cornerRadius, config.cornerRadius);

  return (
    <Canvas style={{ width: screenW, height: displayH }}>
      <Group transform={[{ scale }]}>
        <Group clip={clip}>
          {config.archetypeId === 'strip' && <StripArchetype {...archetypeProps} />}
          {config.archetypeId === 'editorial' && <EditorialArchetype {...archetypeProps} />}
          {config.archetypeId === 'grid' && <GridArchetype {...archetypeProps} />}
          {config.archetypeId === 'banner' && <BannerArchetype {...archetypeProps} />}
          {config.archetypeId === 'side' && <SideArchetype {...archetypeProps} />}
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
