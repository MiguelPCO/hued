import {
  Group,
  Image,
  Rect,
  Text,
} from '@shopify/react-native-skia';
import type { ArchetypeProps } from './types';
import { formatRGB, getContrastTextColor, useArchetypeFonts, wrapMetadataInBlur } from './shared';

export function StripArchetype({ palette, config, width, height, image }: ArchetypeProps) {
  const imageH = height * 0.7;
  const stripH = height * 0.3;
  const barW = width / 5;

  const { hexFont, nameFont } = useArchetypeFonts(config.fontFamily, 9, 8);

  return (
    <Group>
      {image && (
        <Image image={image} x={0} y={0} width={width} height={imageH} fit="cover" />
      )}
      {!image && <Rect x={0} y={0} width={width} height={imageH} color="#E5E5E5" />}

      {palette.colors.map((color, i) => {
        const x = i * barW;
        const textColor = getContrastTextColor(color.hslLightness);
        const hasMetadata = config.showHex || config.showName || config.showRGB;
        // RGB is a new third line: when it's on, hex/name shift up from their
        // original 2-line fractions to fit three rows; those original
        // fractions stay untouched when showRGB is off (the default, and
        // every layout that shipped before this field existed).
        const [hexY, nameY, rgbY] = config.showRGB
          ? [imageH + stripH * 0.28, imageH + stripH * 0.52, imageH + stripH * 0.76]
          : [imageH + stripH * 0.38, imageH + stripH * 0.62, imageH + stripH * 0.62];
        const metadataNode = hasMetadata && (
          <Group>
            {config.showHex && (
              <Text
                x={x + barW / 2 - 16}
                y={hexY}
                text={color.hex}
                font={hexFont}
                color={textColor}
              />
            )}
            {config.showName && (
              <Text
                x={Math.max(x + 2, x + barW / 2 - (color.name.length * 2.5))}
                y={nameY}
                text={color.name}
                font={nameFont}
                color={textColor}
              />
            )}
            {config.showRGB && (
              <Text
                x={Math.max(x + 2, x + barW / 2 - 22)}
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
            <Rect x={x} y={imageH} width={barW} height={stripH} color={color.hex} />
            {hasMetadata &&
              wrapMetadataInBlur(config, metadataNode, { x, y: imageH, width: barW, height: stripH })}
          </Group>
        );
      })}
    </Group>
  );
}
