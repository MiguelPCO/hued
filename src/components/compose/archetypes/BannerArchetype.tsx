import {
  Group,
  Image,
  Rect,
  Text,
} from '@shopify/react-native-skia';
import type { ArchetypeProps } from './types';
import { getContrastTextColor, useArchetypeFonts, wrapMetadataInBlur } from './shared';

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
        const metadataNode = (config.showHex || config.showName) && (
          <Group>
            {config.showHex && (
              <Text
                x={x + 6}
                y={stripY + STRIP_H * 0.4}
                text={color.hex}
                font={hexFont}
                color={textColor}
              />
            )}
            {config.showName && (
              <Text
                x={x + 6}
                y={stripY + STRIP_H * 0.7}
                text={color.name}
                font={nameFont}
                color={textColor}
              />
            )}
          </Group>
        );
        return (
          <Group key={i}>
            <Rect x={x} y={stripY} width={barW} height={STRIP_H} color={color.hex + 'CC'} />
            {(config.showHex || config.showName) &&
              wrapMetadataInBlur(config, metadataNode, { x, y: stripY, width: barW, height: STRIP_H })}
          </Group>
        );
      })}
    </Group>
  );
}
