import {
  Group,
  Image,
  Rect,
  Text,
} from '@shopify/react-native-skia';
import type { ArchetypeProps } from './types';
import { formatRGB, getContrastTextColor, useArchetypeFonts, wrapMetadataInBlur } from './shared';

const STRIP_H = 48;

export function BannerArchetype({ palette, config, width, height, image }: ArchetypeProps) {
  const barW = width / 5;
  const stripY = height - STRIP_H;

  const { hexFont, nameFont } = useArchetypeFonts(config.fontFamily, 9, 8);

  return (
    <Group>
      {image && (
        <Image image={image} x={0} y={0} width={width} height={height} fit="cover" />
      )}
      {!image && <Rect x={0} y={0} width={width} height={height} color="#E5E5E5" />}

      <Rect x={0} y={stripY} width={width} height={STRIP_H} color="rgba(0,0,0,0.35)" />

      {palette.colors.map((color, i) => {
        const x = i * barW;
        const textColor = getContrastTextColor(color.hslLightness);
        const hasMetadata = config.showHex || config.showName || config.showRGB;
        const [hexY, nameY, rgbY] = config.showRGB
          ? [stripY + STRIP_H * 0.28, stripY + STRIP_H * 0.52, stripY + STRIP_H * 0.76]
          : [stripY + STRIP_H * 0.4, stripY + STRIP_H * 0.7, stripY + STRIP_H * 0.7];
        const metadataNode = hasMetadata && (
          <Group>
            {config.showHex && (
              <Text
                x={x + 6}
                y={hexY}
                text={color.hex}
                font={hexFont}
                color={textColor}
              />
            )}
            {config.showName && (
              <Text
                x={x + 6}
                y={nameY}
                text={color.name}
                font={nameFont}
                color={textColor}
              />
            )}
            {config.showRGB && (
              <Text
                x={x + 6}
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
            <Rect x={x} y={stripY} width={barW} height={STRIP_H} color={color.hex + 'CC'} />
            {hasMetadata &&
              wrapMetadataInBlur(config, metadataNode, { x, y: stripY, width: barW, height: STRIP_H })}
          </Group>
        );
      })}
    </Group>
  );
}
