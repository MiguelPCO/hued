import { useMemo } from 'react';
import {
  Circle,
  Group,
  Image,
  LinearGradient,
  matchFont,
  Rect,
  Text,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import type { ArchetypeProps } from './types';

const FONT_FAMILY = Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto';
const DOT_R = 14;
const DOT_SPACING = 8;
const SPACING_MD = 16;

export function EditorialArchetype({ palette, config, width, height }: ArchetypeProps) {
  const image = useImage(palette.imageUri);
  const gradientStart = height * 0.55;
  const dotY = height * 0.82;
  const totalDotsW = palette.colors.length * (DOT_R * 2) + (palette.colors.length - 1) * DOT_SPACING;
  const dotStartX = (width - totalDotsW) / 2 + DOT_R;

  const nameFont = useMemo(() => matchFont({ fontFamily: FONT_FAMILY, fontSize: 11 }), []);
  const hexFont = useMemo(() => matchFont({ fontFamily: FONT_FAMILY, fontSize: 9 }), []);

  return (
    <Group>
      {image && (
        <Image image={image} x={0} y={0} width={width} height={height} fit="cover" />
      )}
      {!image && <Rect x={0} y={0} width={width} height={height} color="#E5E5E5" />}

      <Rect x={0} y={gradientStart} width={width} height={height - gradientStart} color="transparent">
        <LinearGradient
          start={vec(0, gradientStart)}
          end={vec(0, height)}
          colors={['transparent', 'rgba(0,0,0,0.82)']}
        />
      </Rect>

      {palette.colors.map((color, i) => {
        const cx = dotStartX + i * (DOT_R * 2 + DOT_SPACING);
        return (
          <Group key={i}>
            <Circle cx={cx} cy={dotY} r={DOT_R} color={color.hex} />
            {config.showHex && (
              <Text
                x={cx - 14}
                y={dotY + DOT_R + 14}
                text={color.hex}
                font={hexFont}
                color="#FFFFFF"
              />
            )}
          </Group>
        );
      })}

      {config.showName && palette.colors[0] && (
        <Text
          x={SPACING_MD}
          y={dotY - DOT_R - 12}
          text={palette.colors[0].name}
          font={nameFont}
          color="#FFFFFF"
        />
      )}
    </Group>
  );
}
