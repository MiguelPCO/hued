import {
  Group,
  Image,
  Rect,
  Text,
  useImage,
} from '@shopify/react-native-skia';
import type { ArchetypeProps } from './types';
import { getContrastTextColor, useArchetypeFonts } from './shared';

export function StripArchetype({ palette, config, width, height }: ArchetypeProps) {
  const image = useImage(palette.imageUri);
  const imageH = height * 0.7;
  const stripH = height * 0.3;
  const barW = width / 5;

  const { hexFont, nameFont } = useArchetypeFonts(9, 8);

  return (
    <Group>
      {image && (
        <Image image={image} x={0} y={0} width={width} height={imageH} fit="cover" />
      )}
      {!image && <Rect x={0} y={0} width={width} height={imageH} color="#E5E5E5" />}

      {palette.colors.map((color, i) => {
        const x = i * barW;
        const textColor = getContrastTextColor(color.hslLightness);
        return (
          <Group key={i}>
            <Rect x={x} y={imageH} width={barW} height={stripH} color={color.hex} />
            {config.showHex && (
              <Text
                x={x + barW / 2 - 16}
                y={imageH + stripH * 0.38}
                text={color.hex}
                font={hexFont}
                color={textColor}
              />
            )}
            {config.showName && (
              <Text
                x={Math.max(x + 2, x + barW / 2 - (color.name.length * 2.5))}
                y={imageH + stripH * 0.62}
                text={color.name}
                font={nameFont}
                color={textColor}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}
