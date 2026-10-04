import { computeGridCells } from '../gridLayout';

describe('computeGridCells', () => {
  it('matches the original hardcoded 2-col + full-width-row layout for n=5', () => {
    const cells = computeGridCells(5, 360, 450);
    expect(cells).toEqual([
      { x: 0, y: 225, width: 180, height: 75 },
      { x: 180, y: 225, width: 180, height: 75 },
      { x: 0, y: 300, width: 180, height: 75 },
      { x: 180, y: 300, width: 180, height: 75 },
      { x: 0, y: 375, width: 360, height: 75 },
    ]);
  });

  it('returns a plain 2-column grid with no full-width row for an even count', () => {
    const cells = computeGridCells(4, 360, 450);
    expect(cells).toHaveLength(4);
    const widths = new Set(cells.map((c) => c.width));
    expect(widths).toEqual(new Set([180]));
  });

  it('returns n cells, all within bounds, for every supported palette size', () => {
    for (let n = 3; n <= 8; n++) {
      const cells = computeGridCells(n, 360, 450);
      expect(cells).toHaveLength(n);
      for (const c of cells) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeGreaterThanOrEqual(225); // image occupies top 50%
        expect(c.x + c.width).toBeLessThanOrEqual(360);
        expect(c.y + c.height).toBeLessThanOrEqual(450);
      }
    }
  });

  it('no two cells overlap, for every supported palette size', () => {
    function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
      return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    }
    for (let n = 3; n <= 8; n++) {
      const cells = computeGridCells(n, 360, 450);
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          expect(overlaps(cells[i], cells[j])).toBe(false);
        }
      }
    }
  });
});
