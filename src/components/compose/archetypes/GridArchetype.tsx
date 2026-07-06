import {
  Group,
  Image,
  Rect,
  Text,
  useImage,
} from '@shopify/react-native-skia';
import type { ArchetypeProps } from './types';
import { getContrastTextColor, useArchetypeFonts } from './shared';

export function GridArchetype({ palette, config, width, height }: ArchetypeProps) {
  const image = useImage(palette.imageUri);
  const imageH = height * 0.5;
  const cellH = (height - imageH) / 3;
  const cellW = width / 2;

  const { hexFont, nameFont } = useArchetypeFonts(10, 9);

  return (
    <Group>
      {image && (
        <Image image={image} x={0} y={0} width={width} height={imageH} fit="cover" />
      )}
      {!image && <Rect x={0} y={0} width={width} height={imageH} color="#E5E5E5" />}

      {palette.colors.slice(0, 4).map((color, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = col * cellW;
        const y = imageH + row * cellH;
        const textColor = getContrastTextColor(color.hslLightness);
        return (
          <Group key={i}>
            <Rect x={x} y={y} width={cellW} height={cellH} color={color.hex} />
            {config.showHex && (
              <Text x={x + 6} y={y + cellH * 0.45} text={color.hex} font={hexFont} color={textColor} />
            )}
            {config.showName && (
              <Text x={x + 6} y={y + cellH * 0.72} text={color.name} font={nameFont} color={textColor} />
            )}
          </Group>
        );
      })}

      {palette.colors[4] && (() => {
        const color = palette.colors[4];
        const y = imageH + 2 * cellH;
        const textColor = getContrastTextColor(color.hslLightness);
        return (
          <Group>
            <Rect x={0} y={y} width={width} height={cellH} color={color.hex} />
            {config.showHex && (
              <Text x={6} y={y + cellH * 0.45} text={color.hex} font={hexFont} color={textColor} />
            )}
            {config.showName && (
              <Text x={6} y={y + cellH * 0.72} text={color.name} font={nameFont} color={textColor} />
            )}
          </Group>
        );
      })()}
    </Group>
  );
}
