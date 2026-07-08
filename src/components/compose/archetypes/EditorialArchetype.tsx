import {
  Circle,
  Group,
  Image,
  LinearGradient,
  Rect,
  Text,
  vec,
} from '@shopify/react-native-skia';
import type { ArchetypeProps } from './types';
import { useArchetypeFonts, wrapMetadataInBlur } from './shared';

const DOT_R = 14;
const DOT_SPACING = 8;
const SPACING_MD = 16;

export function EditorialArchetype({ palette, config, width, height, image }: ArchetypeProps) {
  const gradientStart = height * 0.55;
  const dotY = height * 0.82;
  const totalDotsW = palette.colors.length * (DOT_R * 2) + (palette.colors.length - 1) * DOT_SPACING;
  const dotStartX = (width - totalDotsW) / 2 + DOT_R;

  const { hexFont, nameFont } = useArchetypeFonts(config.fontFamily, 9, 11);

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
            {config.showHex && wrapMetadataInBlur(
              config,
              <Text
                x={cx - 14}
                y={dotY + DOT_R + 14}
                text={color.hex}
                font={hexFont}
                color="#FFFFFF"
              />,
              // Width intentionally wider than the dot itself (DOT_R * 2): `BackdropBlur`'s
              // `clip` bounds its Group entirely, so it clips `children` (the hex text) too,
              // not just the blurred backdrop. The text anchors at `cx - 14` (left edge), so
              // a region right edge at only `cx + 18` (36px wide) leaves just 32px of text
              // width before clipping — not enough for a 7-char "#RRGGBB" in the `mono` font
              // option (~38px at this font size). 46px (right edge at cx + 28) gives ~40px
              // of room from the anchor, clearing mono with margin. The resulting overlap
              // with the neighboring dot's region (dots are spaced 36px apart) is harmless —
              // later dots draw on top, so the overlap only blurs empty background between
              // dots, never another dot's own swatch/text.
              { x: cx - 18, y: dotY - DOT_R, width: 46, height: DOT_R * 2 + 28 }
            )}
          </Group>
        );
      })}

      {config.showName && palette.colors[0] && wrapMetadataInBlur(
        config,
        <Text
          x={SPACING_MD}
          y={dotY - DOT_R - 12}
          text={palette.colors[0].name}
          font={nameFont}
          color="#FFFFFF"
        />,
        {
          x: SPACING_MD - 4,
          y: dotY - DOT_R - 12 - 16,
          width: palette.colors[0].name.length * 7 + 16,
          height: 24,
        }
      )}
    </Group>
  );
}
