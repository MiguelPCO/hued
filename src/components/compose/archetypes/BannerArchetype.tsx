import {
  Group,
  Image,
  Rect,
  useImage,
} from '@shopify/react-native-skia';
import type { ArchetypeProps } from './types';

const STRIP_H = 48;

export function BannerArchetype({ palette, width, height }: ArchetypeProps) {
  const image = useImage(palette.imageUri);
  const barW = width / 5;
  const stripY = height - STRIP_H;

  return (
    <Group>
      {image && (
        <Image image={image} x={0} y={0} width={width} height={height} fit="cover" />
      )}
      {!image && <Rect x={0} y={0} width={width} height={height} color="#E5E5E5" />}

      <Rect x={0} y={stripY} width={width} height={STRIP_H} color="rgba(0,0,0,0.35)" />

      {palette.colors.map((color, i) => (
        <Rect
          key={i}
          x={i * barW}
          y={stripY}
          width={barW}
          height={STRIP_H}
          color={color.hex + 'CC'}
        />
      ))}
    </Group>
  );
}
