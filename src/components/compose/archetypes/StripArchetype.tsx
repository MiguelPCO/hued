import { useMemo } from 'react';
import {
  Group,
  Image,
  matchFont,
  Rect,
  Text,
  useImage,
} from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import type { ArchetypeProps } from './types';

const FONT_FAMILY = Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto';

export function StripArchetype({ palette, config, width, height }: ArchetypeProps) {
  const image = useImage(palette.imageUri);
  const imageH = height * 0.7;
  const stripH = height * 0.3;
  const barW = width / 5;

  const hexFont = useMemo(() => matchFont({ fontFamily: FONT_FAMILY, fontSize: 9 }), []);
  const nameFont = useMemo(() => matchFont({ fontFamily: FONT_FAMILY, fontSize: 8 }), []);

  return (
    <Group>
      {image && (
        <Image image={image} x={0} y={0} width={width} height={imageH} fit="cover" />
      )}
      {!image && <Rect x={0} y={0} width={width} height={imageH} color="#E5E5E5" />}

      {palette.colors.map((color, i) => {
        const x = i * barW;
        const textColor = color.hslLightness > 0.5 ? '#000000' : '#FFFFFF';
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
                x={x + barW / 2 - (color.name.length * 2.5)}
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
