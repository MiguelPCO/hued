import { fitText, layoutLabelLines } from '../labelLayout';
import type { LabelOptions } from '../labelLayout';

// 5 design px per character per 10 px of font size.
const measure = (text: string, size: number) => text.length * size * 0.5;

const card = { x: 100, y: 200, width: 80, height: 100 };
const base: LabelOptions = {
  position: 'top',
  align: 'left',
  fontSize: 10,
  padX: 10,
  padY: 8,
  lineGap: 4,
};

describe('fitText', () => {
  it('leaves text that fits alone', () => {
    expect(fitText('Pino', 10, 100, measure)).toEqual({ text: 'Pino', size: 10 });
  });

  it('shrinks text that does not fit, down to 6 px', () => {
    // "#264414" is 7 chars: 35 px at size 10, 21 px at size 6.
    expect(fitText('#264414', 10, 28, measure).size).toBeLessThan(10);
    expect(fitText('#264414', 10, 28, measure).size).toBeGreaterThanOrEqual(6);
    expect(fitText('#264414', 10, 28, measure).text).toBe('#264414');
  });

  it('cuts with an ellipsis once 6 px still does not fit', () => {
    const fitted = fitText('Rosa pálido', 10, 24, measure);

    expect(fitted.size).toBe(6);
    expect(fitted.text.endsWith('…')).toBe(true);
    expect(measure(fitted.text, fitted.size)).toBeLessThanOrEqual(24);
  });

  it('never grows a size the user chose below 6 px', () => {
    expect(fitText('Pino', 5, 100, measure)).toEqual({ text: 'Pino', size: 5 });
  });
});

describe('layoutLabelLines', () => {
  it('stacks the lines from the top, left aligned inside the padding', () => {
    const [first, second] = layoutLabelLines(card, ['Pino', '#264414'], base, measure);

    expect(first.x).toBe(110);
    expect(second.x).toBe(110);
    expect(second.y - first.y).toBe(14);
    expect(first.y).toBeGreaterThan(card.y + 8);
    expect(first.y).toBeLessThan(card.y + 8 + 10);
  });

  it('puts a stack at the bottom or the center', () => {
    const [bottom] = layoutLabelLines(card, ['Pino'], { ...base, position: 'bottom' }, measure);
    const [center] = layoutLabelLines(card, ['Pino'], { ...base, position: 'center' }, measure);

    expect(bottom.y).toBeGreaterThan(card.y + 100 - 8 - 10);
    expect(center.y).toBeGreaterThan(card.y + 45);
    expect(center.y).toBeLessThan(card.y + 55 + 10);
  });

  it('splits the first line to the top and the last to the bottom', () => {
    const [first, last] = layoutLabelLines(
      card,
      ['Pino', '#264414'],
      { ...base, position: 'split' },
      measure,
    );

    expect(first.y).toBeLessThan(card.y + 20);
    expect(last.y).toBeGreaterThan(card.y + 80);
  });

  it('puts a single line of a split at the top', () => {
    const [only] = layoutLabelLines(card, ['Pino'], { ...base, position: 'split' }, measure);

    expect(only.y).toBeLessThan(card.y + 20);
  });

  it('centers and right-aligns using the text width', () => {
    const [centered] = layoutLabelLines(card, ['Pino'], { ...base, align: 'center' }, measure);
    const [right] = layoutLabelLines(card, ['Pino'], { ...base, align: 'right' }, measure);
    const width = measure('Pino', 10);

    expect(centered.x).toBe(card.x + (card.width - width) / 2);
    expect(right.x).toBe(card.x + card.width - 10 - width);
  });

  it('puts the first line left and the last right when diagonal', () => {
    const [first, last] = layoutLabelLines(
      card,
      ['#264414', 'Pino'],
      { ...base, position: 'split', align: 'diagonal' },
      measure,
    );

    expect(first.x).toBe(card.x + 10);
    expect(last.x).toBe(card.x + card.width - 10 - measure('Pino', 10));
  });

  it('shrinks a line that is wider than the card', () => {
    const [line] = layoutLabelLines({ ...card, width: 50 }, ['#264414'], base, measure);

    expect(line.size).toBeLessThan(10);
  });

  it('returns nothing for no lines', () => {
    expect(layoutLabelLines(card, [], base, measure)).toEqual([]);
  });
});
