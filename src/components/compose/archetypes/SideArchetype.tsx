import {
  Group,
  Image,
  Rect,
  Text,
} from '@shopify/react-native-skia';
import type { ArchetypeProps } from './types';
import { formatRGB, getContrastTextColor, useArchetypeFonts, wrapMetadataInBlur } from './shared';

export function SideArchetype({ palette, config, width, height, image }: ArchetypeProps) {
  const imageW = width * 0.6;
  const sideW = width - imageW;
  const rowH = height / 5;

  const { hexFont, nameFont } = useArchetypeFonts(config.fontFamily, 8, 7);

  return (
    <Group>
      {image && (
        <Image image={image} x={0} y={0} width={imageW} height={height} fit="cover" />
      )}
      {!image && <Rect x={0} y={0} width={imageW} height={height} color="#E5E5E5" />}

      {palette.colors.map((color, i) => {
        const y = i * rowH;
        const textColor = getContrastTextColor(color.hslLightness);
        const hasMetadata = config.showHex || config.showName || config.showRGB;
        const [hexY, nameY, rgbY] = config.showRGB
          ? [y + rowH * 0.30, y + rowH * 0.55, y + rowH * 0.80]
          : [y + rowH * 0.44, y + rowH * 0.72, y + rowH * 0.72];
        const metadataNode = hasMetadata && (
          <Group>
            {config.showHex && (
              <Text
                x={imageW + 6}
                y={hexY}
                text={color.hex}
                font={hexFont}
                color={textColor}
              />
            )}
            {config.showName && (
              <Text
                x={imageW + 6}
                y={nameY}
                text={color.name}
                font={nameFont}
                color={textColor}
              />
            )}
            {config.showRGB && (
              <Text
                x={imageW + 6}
                y={rgbY}
                text={formatRGB(color.rgb)}
                font={hexFont}
                color={textColor}
              />
            )}
          </Group>
        );
        return (
          <Group key={i}>
            <Rect x={imageW} y={y} width={sideW} height={rowH} color={color.hex} />
            {hasMetadata &&
              wrapMetadataInBlur(config, metadataNode, { x: imageW, y, width: sideW, height: rowH })}
          </Group>
        );
      })}
    </Group>
  );
}
