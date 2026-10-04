import {
  Group,
  Image,
  Rect,
  Text,
} from '@shopify/react-native-skia';
import type { ArchetypeProps } from './types';
import { computeGridCells } from './gridLayout';
import { formatRGB, getContrastTextColor, useArchetypeFonts, wrapMetadataInBlur } from './shared';

export function GridArchetype({ palette, config, width, height, image }: ArchetypeProps) {
  const imageH = height * 0.5;
  const cells = computeGridCells(palette.colors.length, width, height);

  const { hexFont, nameFont } = useArchetypeFonts(config.fontFamily, 10, 9);

  return (
    <Group>
      {image && (
        <Image image={image} x={0} y={0} width={width} height={imageH} fit="cover" />
      )}
      {!image && <Rect x={0} y={0} width={width} height={imageH} color="#E5E5E5" />}

      {palette.colors.map((color, i) => {
        const { x, y, width: cellW, height: cellH } = cells[i];
        const textColor = getContrastTextColor(color.hslLightness);
        const hasMetadata = config.showHex || config.showName || config.showRGB;
        const [hexY, nameY, rgbY] = config.showRGB
          ? [y + cellH * 0.32, y + cellH * 0.58, y + cellH * 0.84]
          : [y + cellH * 0.45, y + cellH * 0.72, y + cellH * 0.72];
        const metadataNode = hasMetadata && (
          <Group>
            {config.showHex && (
              <Text x={x + 6} y={hexY} text={color.hex} font={hexFont} color={textColor} />
            )}
            {config.showName && (
              <Text x={x + 6} y={nameY} text={color.name} font={nameFont} color={textColor} />
            )}
            {config.showRGB && (
              <Text x={x + 6} y={rgbY} text={formatRGB(color.rgb)} font={hexFont} color={textColor} />
            )}
          </Group>
        );
        return (
          <Group key={i}>
            <Rect x={x} y={y} width={cellW} height={cellH} color={color.hex} />
            {hasMetadata &&
              wrapMetadataInBlur(config, metadataNode, { x, y, width: cellW, height: cellH })}
          </Group>
        );
      })}
    </Group>
  );
}
