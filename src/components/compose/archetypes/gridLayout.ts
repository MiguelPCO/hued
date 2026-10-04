// Pure cell geometry for GridArchetype: image occupies the top 50%, the
// remaining colors fill a 2-column grid below it, with a trailing
// full-width row when the count is odd. Generalizes the archetype's
// original hardcoded 5-color layout (2x2 grid + 1 full-width row) to any
// palette size in the supported 3-8 range.

export interface GridCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

const IMAGE_HEIGHT_FRACTION = 0.5;

export function computeGridCells(n: number, width: number, height: number): GridCell[] {
  const imageH = height * IMAGE_HEIGHT_FRACTION;
  const pairCount = Math.floor(n / 2);
  const hasOddCell = n % 2 === 1;
  const totalRows = pairCount + (hasOddCell ? 1 : 0);
  const cellH = (height - imageH) / totalRows;
  const cellW = width / 2;

  return Array.from({ length: n }, (_, i) => {
    if (i < pairCount * 2) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      return { x: col * cellW, y: imageH + row * cellH, width: cellW, height: cellH };
    }
    return { x: 0, y: imageH + pairCount * cellH, width, height: cellH };
  });
}
