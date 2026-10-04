import {
  generateScatterLayout,
  clampSwatch,
  clampResizeSwatch,
  bringToFront,
  shouldShowLabel,
  snapPosition,
  snapSize,
} from '../freeformLayout';

describe('generateScatterLayout', () => {
  it('returns one rect per requested count', () => {
    const layout = generateScatterLayout(5, 360, 450);
    expect(layout).toHaveLength(5);
  });

  it('all rects are the same size', () => {
    const layout = generateScatterLayout(6, 360, 450);
    const [first] = layout;
    for (const rect of layout) {
      expect(rect.width).toBe(first.width);
      expect(rect.height).toBe(first.height);
    }
  });

  it('all rects are fully within canvas bounds', () => {
    const layout = generateScatterLayout(8, 360, 450);
    for (const rect of layout) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(360);
      expect(rect.y + rect.height).toBeLessThanOrEqual(450);
    }
  });

  it('no two rects overlap', () => {
    const layout = generateScatterLayout(8, 360, 450);
    function overlaps(a: typeof layout[0], b: typeof layout[0]) {
      return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    }
    for (let i = 0; i < layout.length; i++) {
      for (let j = i + 1; j < layout.length; j++) {
        expect(overlaps(layout[i], layout[j])).toBe(false);
      }
    }
  });
});

describe('clampSwatch', () => {
  it('leaves an in-bounds rect unchanged', () => {
    const rect = { x: 50, y: 50, width: 80, height: 60 };
    expect(clampSwatch(rect, 360, 450)).toEqual(rect);
  });

  it('pulls a rect back inside when dragged past the right/bottom edge', () => {
    const rect = { x: 350, y: 440, width: 80, height: 60 };
    const clamped = clampSwatch(rect, 360, 450);
    expect(clamped.x + clamped.width).toBeLessThanOrEqual(360);
    expect(clamped.y + clamped.height).toBeLessThanOrEqual(450);
  });

  it('pulls a rect back inside when dragged past the left/top edge', () => {
    const rect = { x: -30, y: -20, width: 80, height: 60 };
    const clamped = clampSwatch(rect, 360, 450);
    expect(clamped.x).toBeGreaterThanOrEqual(0);
    expect(clamped.y).toBeGreaterThanOrEqual(0);
  });

  it('clamps a resize that would grow past the canvas edge', () => {
    const rect = { x: 300, y: 400, width: 120, height: 120 };
    const clamped = clampSwatch(rect, 360, 450);
    expect(clamped.x + clamped.width).toBeLessThanOrEqual(360);
    expect(clamped.y + clamped.height).toBeLessThanOrEqual(450);
  });
});

describe('clampResizeSwatch', () => {
  it('leaves an in-bounds resize unchanged', () => {
    const rect = { x: 50, y: 50, width: 80, height: 60 };
    expect(clampResizeSwatch(rect, 360, 450)).toEqual(rect);
  });

  it('caps width/height to the space available from the fixed top-left corner, without moving x/y', () => {
    // Anchored top-left at (300, 400) — dragging the bottom-right handle so
    // width/height would overflow the canvas must cap the size, not slide
    // the anchored corner backward to compensate.
    const rect = { x: 300, y: 400, width: 120, height: 120 };
    const clamped = clampResizeSwatch(rect, 360, 450);
    expect(clamped.x).toBe(300);
    expect(clamped.y).toBe(400);
    expect(clamped.width).toBe(60);
    expect(clamped.height).toBe(50);
  });
});

describe('bringToFront', () => {
  it('moves the touched index to the end of the array', () => {
    const swatches = ['a', 'b', 'c', 'd'];
    expect(bringToFront(swatches, 1)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('is a no-op when the touched swatch is already at the front', () => {
    const swatches = ['a', 'b', 'c'];
    expect(bringToFront(swatches, 2)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const swatches = ['a', 'b', 'c'];
    bringToFront(swatches, 0);
    expect(swatches).toEqual(['a', 'b', 'c']);
  });
});

describe('shouldShowLabel', () => {
  it('hides the label below the ~32px design-space threshold', () => {
    expect(shouldShowLabel(20)).toBe(false);
  });

  it('shows the label at or above the threshold', () => {
    expect(shouldShowLabel(40)).toBe(true);
  });
});

describe('snapPosition', () => {
  it('leaves position unchanged when nothing is within the threshold', () => {
    const dragged = { x: 40, y: 60, width: 50, height: 50 };
    const others = [{ x: 200, y: 300, width: 50, height: 50, colorIndex: 1 }];
    const result = snapPosition(dragged, others, 360, 450);
    expect(result).toEqual({ x: 40, y: 60, guides: [] });
  });

  it('snaps its own center to the canvas horizontal center within the threshold', () => {
    // canvas center x = 180; dragged center x = (152 + 50/2) = 177, 3px off (within the 6px threshold)
    const dragged = { x: 152, y: 60, width: 50, height: 50 };
    const result = snapPosition(dragged, [], 360, 450);
    expect(result.x).toBe(155); // shifted so its center lands exactly on 180
    expect(result.guides).toEqual([{ axis: 'x', position: 180 }]);
  });

  it('snaps to the group bounding-box center (excluding itself), away from the canvas center', () => {
    // Two other swatches far from the canvas center: bbox is x:[20,120], so
    // group center x = 70. Dragged sits 2px off that on the x axis; canvas
    // center (180) is much further away, so the group center wins.
    const others = [
      { x: 20, y: 20, width: 40, height: 40, colorIndex: 1 },
      { x: 80, y: 20, width: 40, height: 40, colorIndex: 2 },
    ];
    const dragged = { x: 43, y: 300, width: 50, height: 50 }; // center x = 68, center y far from any y candidate
    const result = snapPosition(dragged, others, 360, 450);
    expect(result.x).toBe(45); // shifted so its center lands exactly on 70
    expect(result.guides).toEqual([{ axis: 'x', position: 70 }]);
  });

  it("snaps its left edge to another swatch's left edge", () => {
    // Other swatch's left edge is at x=100; well outside the threshold for
    // canvas/group center on either axis, so only the edge match applies.
    const others = [{ x: 100, y: 20, width: 40, height: 40, colorIndex: 1 }];
    const dragged = { x: 104, y: 300, width: 50, height: 50 };
    const result = snapPosition(dragged, others, 360, 450);
    expect(result.x).toBe(100);
    expect(result.guides).toEqual([{ axis: 'x', position: 100 }]);
  });

  it('prefers the canvas center over an other-swatch center at an equal distance', () => {
    // Dragged center x = 182. Canvas center (180) and the other swatch's
    // center (184) are both exactly 2px away — canvas wins the tie.
    const others = [{ x: 164, y: 20, width: 40, height: 40, colorIndex: 1 }];
    const dragged = { x: 157, y: 300, width: 50, height: 50 };
    const result = snapPosition(dragged, others, 360, 450);
    expect(result.x).toBe(155); // centered on canvas center (180), not the swatch center (184)
    expect(result.guides).toEqual([{ axis: 'x', position: 180 }]);
  });
});

describe('snapSize', () => {
  it('leaves size unchanged when nothing is within the threshold', () => {
    const dragged = { x: 0, y: 0, width: 60, height: 60 };
    const others = [{ x: 200, y: 200, width: 100, height: 100, colorIndex: 1 }];
    const result = snapSize(dragged, others);
    expect(result).toEqual({ width: 60, height: 60, matchedColorIndexes: [] });
  });

  it('snaps width to another swatch of near-equal width', () => {
    const dragged = { x: 0, y: 0, width: 64, height: 90 }; // 4px off other's width
    const others = [{ x: 200, y: 200, width: 60, height: 200, colorIndex: 3 }];
    const result = snapSize(dragged, others);
    expect(result).toEqual({ width: 60, height: 90, matchedColorIndexes: [3] });
  });

  it('snaps width and height independently, each to a different swatch', () => {
    const dragged = { x: 0, y: 0, width: 64, height: 118 };
    const others = [
      { x: 200, y: 0, width: 60, height: 300, colorIndex: 3 }, // matches width only
      { x: 200, y: 300, width: 300, height: 120, colorIndex: 5 }, // matches height only
    ];
    const result = snapSize(dragged, others);
    expect(result).toEqual({ width: 60, height: 120, matchedColorIndexes: [3, 5] });
  });

  it('dedupes matchedColorIndexes when the same swatch matches both dimensions', () => {
    const dragged = { x: 0, y: 0, width: 64, height: 118 };
    const others = [{ x: 200, y: 200, width: 60, height: 120, colorIndex: 4 }];
    const result = snapSize(dragged, others);
    expect(result).toEqual({ width: 60, height: 120, matchedColorIndexes: [4] });
  });
});
