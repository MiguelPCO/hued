import {
  Group,
  Image,
  Rect,
  RoundedRect,
  Text,
} from '@shopify/react-native-skia';
import type { ArchetypeProps } from './types';
import { generateScatterLayout, shouldShowLabel } from './freeformLayout';
import { formatRGB, getContrastTextColor, useArchetypeFonts, wrapMetadataInBlur } from './shared';

// Full-bleed photo, swatches placed anywhere the user dragged them
// (`config.freeformSwatches`, design-space 360x450, array order = z-order).
// A stale/empty/mismatched array (first time entering libre, or right after
// a paletteSize change per ADR-0001) falls back to a fresh scatter layout —
// this is a pure render-time safety net; the actual reset is persisted by
// the edit screen so the fallback here is rarely hit in practice.
export function LibreArchetype({ palette, config, width, height, image }: ArchetypeProps) {
  const { hexFont, nameFont } = useArchetypeFonts(config.fontFamily, 10, 9);

  const swatchRects =
    config.freeformSwatches.length === palette.colors.length
      ? config.freeformSwatches
      : generateScatterLayout(palette.colors.length, width, height);

  return (
    <Group>
      {image && <Image image={image} x={0} y={0} width={width} height={height} fit="cover" />}
      {!image && <Rect x={0} y={0} width={width} height={height} color="#E5E5E5" />}

      {swatchRects.map((rect) => {
        const { x, y, width: swatchW, height: swatchH, colorIndex } = rect;
        const color = palette.colors[colorIndex];
        if (!color) return null;
        const textColor = getContrastTextColor(color.hslLightness);
        const showLabel = shouldShowLabel(swatchH) && (config.showHex || config.showName || config.showRGB);
        const [hexY, nameY, rgbY] = config.showRGB
          ? [y + swatchH * 0.32, y + swatchH * 0.58, y + swatchH * 0.84]
          : [y + swatchH * 0.45, y + swatchH * 0.72, y + swatchH * 0.72];
        const metadataNode = showLabel && (
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
          <Group key={colorIndex}>
            <RoundedRect x={x} y={y} width={swatchW} height={swatchH} r={config.cornerRadius} color={color.hex} />
            {showLabel &&
              wrapMetadataInBlur(config, metadataNode, { x, y, width: swatchW, height: swatchH })}
          </Group>
        );
      })}
    </Group>
  );
}
