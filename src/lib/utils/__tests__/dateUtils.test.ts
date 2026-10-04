import { formatDateEs } from '../dateUtils';

describe('formatDateEs', () => {
  it('formats a timestamp as day, short month and year in Spanish', () => {
    expect(formatDateEs(Date.UTC(2026, 9, 4, 12))).toBe('4 oct 2026');
  });

  it('does not zero-pad the day', () => {
    expect(formatDateEs(Date.UTC(2026, 0, 5, 12))).toBe('5 ene 2026');
  });

  it('uses the local calendar day, not the UTC one', () => {
    // 23:30 UTC del 4-oct ya es 5-oct en Madrid
    expect(formatDateEs(Date.UTC(2026, 9, 4, 23, 30))).toBe('5 oct 2026');
  });
});
