import { Group, Image, Rect, RoundedRect, Text } from '@shopify/react-native-skia';

import type { LabelPad } from '@/data/baseLayouts';
import type { CardArchetypeId } from '@/types/palette';

import { getBaseLayout, resolveRects } from './cardLayouts';
import { shouldShowLabel } from './freeformLayout';
import type { GeneratedSwatch } from './freeformLayout';
import { layoutLabelLines } from './labelLayout';
import type { LabelText } from './labelLayout';
import { formatRGB, getContrastTextColor, useFontFactory, wrapMetadataInBlur } from './shared';
import type { ArchetypeProps } from './types';

// Full-bleed photo with one card per color floating on top. No archetype crops the photo into a
// panel; they only differ in where the cards go and in the look their base layout comes with.
export function PhotoSwatches({
  palette,
  config,
  width,
  height,
  image,
  rects,
  pad,
}: ArchetypeProps & { rects: GeneratedSwatch[]; pad: LabelPad }) {
  const fontAt = useFontFactory(config.fontFamily);
  const measure = (text: string, size: number) => fontAt(size).getTextWidth(text);

  return (
    <Group>
      {image && <Image image={image} x={0} y={0} width={width} height={height} fit="cover" />}
      {!image && <Rect x={0} y={0} width={width} height={height} color="#E5E5E5" />}

      {rects.map((rect) => {
        const { x, y, width: swatchW, height: swatchH, colorIndex } = rect;
        const color = palette.colors[colorIndex];
        if (!color) return null;
        const textColor = getContrastTextColor(color.hslLightness);

        const name = config.showName ? { text: color.name, wrap: true as const } : null;
        const hex = config.showHex ? color.hex : null;
        const lines = (config.labelOrder === 'name-first' ? [name, hex] : [hex, name]).filter(
          (line): line is LabelText => line !== null,
        );
        if (config.showRGB) lines.push(formatRGB(color.rgb));

        const showLabel = shouldShowLabel(swatchH) && lines.length > 0;
        const labels = showLabel
          ? layoutLabelLines(
              rect,
              lines,
              {
                position: config.labelPosition,
                align: config.labelAlign,
                fontSize: config.fontSize,
                padX: pad.x,
                padY: pad.y,
                lineGap: pad.lineGap,
              },
              measure,
            )
          : [];
        const metadataNode = showLabel && (
          <Group>
            {labels.map((label, i) => (
              <Text
                key={i}
                x={label.x}
                y={label.y}
                text={label.text}
                font={fontAt(label.size)}
                color={textColor}
              />
            ))}
          </Group>
        );
        return (
          <Group key={colorIndex}>
            <RoundedRect
              x={x}
              y={y}
              width={swatchW}
              height={swatchH}
              r={config.cornerRadius}
              color={color.hex}
              opacity={config.cardOpacity / 100}
            />
            {showLabel &&
              wrapMetadataInBlur(config, metadataNode, { x, y, width: swatchW, height: swatchH })}
          </Group>
        );
      })}
    </Group>
  );
}

export function cardsArchetype(id: CardArchetypeId) {
  return function CardsArchetype(props: ArchetypeProps) {
    const { rects, pad } = getBaseLayout(id, props.palette.colors.length);
    return <PhotoSwatches {...props} rects={resolveRects(rects, props.config)} pad={pad} />;
  };
}
