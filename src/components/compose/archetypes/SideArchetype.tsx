import {
  Group,
  Image,
  Rect,
  Text,
  useImage,
} from '@shopify/react-native-skia';
import type { ArchetypeProps } from './types';
import { getContrastTextColor, useArchetypeFonts } from './shared';

export function SideArchetype({ palette, config, width, height }: ArchetypeProps) {
  const image = useImage(palette.imageUri);
  const imageW = width * 0.6;
  const sideW = width - imageW;
  const rowH = height / 5;

  const { hexFont, nameFont } = useArchetypeFonts(8, 7);

  return (
    <Group>
      {image && (
        <Image image={image} x={0} y={0} width={imageW} height={height} fit="cover" />
      )}
      {!image && <Rect x={0} y={0} width={imageW} height={height} color="#E5E5E5" />}

      {palette.colors.map((color, i) => {
        const y = i * rowH;
        const textColor = getContrastTextColor(color.hslLightness);
        return (
          <Group key={i}>
            <Rect x={imageW} y={y} width={sideW} height={rowH} color={color.hex} />
            {config.showHex && (
              <Text
                x={imageW + 6}
                y={y + rowH * 0.44}
                text={color.hex}
                font={hexFont}
                color={textColor}
              />
            )}
            {config.showName && (
              <Text
                x={imageW + 6}
                y={y + rowH * 0.72}
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
