// Pure placement of the label lines (name / hex / RGB) inside a card. No Skia: the caller passes a
// `measure` function, so this is testable with plain numbers. Design-space units.
import type { LabelAlign, LabelPosition } from '@/types/palette';

import type { SwatchRect } from './freeformLayout';

// Skia draws text from the baseline; this puts the glyphs where a CSS box of line-height 1 would.
const BASELINE_RATIO = 0.85;
// Text that doesn't fit shrinks down to this size, then gets cut with an ellipsis.
const MIN_FIT_SIZE = 6;
const ELLIPSIS = '…';

export type Measure = (text: string, size: number) => number;

export interface LabelLine {
  text: string;
  x: number;
  y: number;
  size: number;
}

export interface LabelOptions {
  position: LabelPosition;
  align: LabelAlign;
  fontSize: number;
  padX: number;
  padY: number;
  lineGap: number;
}

export function fitText(
  text: string,
  size: number,
  maxWidth: number,
  measure: Measure,
): { text: string; size: number } {
  const minSize = Math.min(MIN_FIT_SIZE, size);
  let fitted = size;
  while (fitted > minSize && measure(text, fitted) > maxWidth)
    fitted = Math.max(minSize, fitted - 0.5);
  if (measure(text, fitted) <= maxWidth) return { text, size: fitted };

  let cut = text;
  while (cut.length > 0 && measure(cut + ELLIPSIS, fitted) > maxWidth) cut = cut.slice(0, -1);
  return { text: cut + ELLIPSIS, size: fitted };
}

function lineTops(card: SwatchRect, count: number, o: LabelOptions): number[] {
  if (o.position === 'split') {
    if (count === 1) return [o.padY];
    const last = card.height - o.padY - o.fontSize;
    return Array.from({ length: count }, (_, i) =>
      i === 0 ? o.padY : i === count - 1 ? last : (o.padY + last) / 2,
    );
  }
  const stack = count * o.fontSize + (count - 1) * o.lineGap;
  const start =
    o.position === 'top'
      ? o.padY
      : o.position === 'bottom'
        ? card.height - o.padY - stack
        : (card.height - stack) / 2;
  return Array.from({ length: count }, (_, i) => start + i * (o.fontSize + o.lineGap));
}

function lineAlign(align: LabelAlign, index: number, count: number): 'left' | 'center' | 'right' {
  if (align !== 'diagonal') return align;
  if (index === 0) return 'left';
  return index === count - 1 ? 'right' : 'center';
}

/** Lines are given top to bottom; the result has each one's text (possibly shortened), baseline position and size. */
export function layoutLabelLines(
  card: SwatchRect,
  lines: string[],
  o: LabelOptions,
  measure: Measure,
): LabelLine[] {
  const tops = lineTops(card, lines.length, o);
  const maxWidth = Math.max(0, card.width - 2 * o.padX);

  return lines.map((line, i) => {
    const fit = fitText(line, o.fontSize, maxWidth, measure);
    const width = measure(fit.text, fit.size);
    const align = lineAlign(o.align, i, lines.length);
    const x =
      align === 'left'
        ? card.x + o.padX
        : align === 'right'
          ? card.x + card.width - o.padX - width
          : card.x + (card.width - width) / 2;
    return { text: fit.text, x, y: card.y + tops[i] + fit.size * BASELINE_RATIO, size: fit.size };
  });
}
