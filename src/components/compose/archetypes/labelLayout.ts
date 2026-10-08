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

/** A label line; `wrap` lets it break onto a second line when it doesn't fit (colour names). */
export type LabelText = string | { text: string; wrap: true };

/** Breaks `text` in two at the space that leaves the shorter widest half; unchanged if it fits or has no space. */
export function wrapLine(text: string, size: number, maxWidth: number, measure: Measure): string[] {
  if (measure(text, size) <= maxWidth) return [text];
  let best: string[] = [text];
  let bestWidth = Infinity;
  for (let at = text.indexOf(' '); at !== -1; at = text.indexOf(' ', at + 1)) {
    const parts = [text.slice(0, at), text.slice(at + 1)];
    const widest = Math.max(measure(parts[0], size), measure(parts[1], size));
    if (widest < bestWidth) {
      best = parts;
      bestWidth = widest;
    }
  }
  return best;
}

const blockHeight = (lines: number, o: LabelOptions) => lines * o.fontSize + (lines - 1) * o.lineGap;

// Top of each block (a block is one label line, or two when a name wrapped).
function blockTops(card: SwatchRect, sizes: number[], o: LabelOptions): number[] {
  const count = sizes.length;
  const heights = sizes.map((n) => blockHeight(n, o));
  if (o.position === 'split') {
    if (count === 1) return [o.padY];
    const last = card.height - o.padY - heights[count - 1];
    return heights.map((_, i) =>
      i === 0 ? o.padY : i === count - 1 ? last : (o.padY + last) / 2,
    );
  }
  const stack = heights.reduce((sum, h) => sum + h, 0) + (count - 1) * o.lineGap;
  const start =
    o.position === 'top'
      ? o.padY
      : o.position === 'bottom'
        ? card.height - o.padY - stack
        : (card.height - stack) / 2;
  let top = start;
  return heights.map((h) => {
    const at = top;
    top += h + o.lineGap;
    return at;
  });
}

function lineAlign(align: LabelAlign, index: number, count: number): 'left' | 'center' | 'right' {
  if (align !== 'diagonal') return align;
  if (index === 0) return 'left';
  return index === count - 1 ? 'right' : 'center';
}

function blocksFor(lines: LabelText[], o: LabelOptions, maxWidth: number, measure: Measure) {
  return lines.map((line) =>
    typeof line === 'string' ? [line] : wrapLine(line.text, o.fontSize, maxWidth, measure),
  );
}

/**
 * Lines are given top to bottom; the result has each one's text (possibly shortened), baseline position and size.
 * A `wrap` line that is too wide goes on two lines when the card has room for the extra one.
 */
export function layoutLabelLines(
  card: SwatchRect,
  lines: LabelText[],
  o: LabelOptions,
  measure: Measure,
): LabelLine[] {
  const maxWidth = Math.max(0, card.width - 2 * o.padX);
  let blocks = blocksFor(lines, o, maxWidth, measure);
  const stack = blocks.reduce((sum, b) => sum + blockHeight(b.length, o), 0) + (blocks.length - 1) * o.lineGap;
  if (stack > card.height - 2 * o.padY)
    blocks = lines.map((line) => [typeof line === 'string' ? line : line.text]);

  const tops = blockTops(card, blocks.map((b) => b.length), o);
  return blocks.flatMap((block, bi) =>
    block.map((line, j) => {
      const fit = fitText(line, o.fontSize, maxWidth, measure);
      const width = measure(fit.text, fit.size);
      const align = lineAlign(o.align, bi, blocks.length);
      const x =
        align === 'left'
          ? card.x + o.padX
          : align === 'right'
            ? card.x + card.width - o.padX - width
            : card.x + (card.width - width) / 2;
      const top = tops[bi] + j * (o.fontSize + o.lineGap);
      return { text: fit.text, x, y: card.y + top + fit.size * BASELINE_RATIO, size: fit.size };
    }),
  );
}
