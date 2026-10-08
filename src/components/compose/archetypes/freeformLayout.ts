// Pure geometry helpers for the "libre" archetype's freeform swatches.
// Design-space units (the fixed 360x450 canvas ArchetypeCanvas.tsx renders
// into before scaling for display) — no Skia/React Native imports, so these
// are plain functions of data.

export interface SwatchRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A generated swatch also tags which color (by index into `palette.colors`) it belongs to. */
export interface GeneratedSwatch extends SwatchRect {
  colorIndex: number;
}

const LABEL_MIN_HEIGHT = 32;

export function clampSwatch<T extends SwatchRect>(rect: T, canvasW: number, canvasH: number): T {
  const width = Math.min(rect.width, canvasW);
  const height = Math.min(rect.height, canvasH);
  const x = Math.min(Math.max(rect.x, 0), canvasW - width);
  const y = Math.min(Math.max(rect.y, 0), canvasH - height);
  return { ...rect, x, y, width, height };
}

/**
 * Clamps a resize (dragging the bottom-right handle): the top-left corner
 * (x, y) is the anchor the user isn't touching and must never move — only
 * width/height cap to whatever space remains from that fixed corner.
 * Distinct from `clampSwatch`, which is for the move/drag case (x, y move,
 * width/height fixed) and would otherwise slide x/y backward here to make
 * an oversized rect fit, visibly dragging the anchored corner too.
 */
export function clampResizeSwatch<T extends SwatchRect>(rect: T, canvasW: number, canvasH: number): T {
  const width = Math.max(0, Math.min(rect.width, canvasW - rect.x));
  const height = Math.max(0, Math.min(rect.height, canvasH - rect.y));
  return { ...rect, width, height };
}

export function bringToFront<T>(swatches: T[], index: number): T[] {
  const next = swatches.slice();
  const [touched] = next.splice(index, 1);
  next.push(touched);
  return next;
}

export function shouldShowLabel(swatchHeight: number): boolean {
  return swatchHeight >= LABEL_MIN_HEIGHT;
}

/** A snapped-to line, in design-space coordinates, for the overlay to draw. */
export interface AlignmentGuide {
  axis: 'x' | 'y';
  position: number;
}

export interface PositionSnapResult {
  x: number;
  y: number;
  guides: AlignmentGuide[];
}

// See docs/adr/0002-libre-alignment-guides.md for why this threshold and
// priority order (canvas center > group center > other swatches).
const ALIGNMENT_THRESHOLD = 6;

type XEdge = 'left' | 'center' | 'right';
type YEdge = 'top' | 'center' | 'bottom';

interface AxisCandidate<Edge extends string> {
  value: number;
  edge: Edge;
  /** Lower wins ties at equal distance: canvas center (0) > group center (1) > other swatches (2). */
  priority: number;
}

function referenceX(dragged: SwatchRect, edge: XEdge): number {
  if (edge === 'left') return dragged.x;
  if (edge === 'right') return dragged.x + dragged.width;
  return dragged.x + dragged.width / 2;
}

function referenceY(dragged: SwatchRect, edge: YEdge): number {
  if (edge === 'top') return dragged.y;
  if (edge === 'bottom') return dragged.y + dragged.height;
  return dragged.y + dragged.height / 2;
}

function offsetForEdge(edge: XEdge | YEdge, size: number): number {
  if (edge === 'left' || edge === 'top') return 0;
  if (edge === 'right' || edge === 'bottom') return size;
  return size / 2;
}

function pickBestCandidate<Edge extends string>(
  candidates: AxisCandidate<Edge>[],
  referenceFor: (edge: Edge) => number
): AxisCandidate<Edge> | null {
  let best: AxisCandidate<Edge> | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = Math.abs(referenceFor(candidate.edge) - candidate.value);
    if (distance > ALIGNMENT_THRESHOLD) continue;
    if (distance < bestDistance || (distance === bestDistance && best !== null && candidate.priority < best.priority)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

export function snapPosition(
  dragged: SwatchRect,
  others: readonly GeneratedSwatch[],
  canvasW: number,
  canvasH: number
): PositionSnapResult {
  const guides: AlignmentGuide[] = [];
  let x = dragged.x;
  let y = dragged.y;

  const xCandidates: AxisCandidate<XEdge>[] = [{ value: canvasW / 2, edge: 'center', priority: 0 }];
  const yCandidates: AxisCandidate<YEdge>[] = [{ value: canvasH / 2, edge: 'center', priority: 0 }];

  if (others.length > 0) {
    const minX = Math.min(...others.map((o) => o.x));
    const maxX = Math.max(...others.map((o) => o.x + o.width));
    const minY = Math.min(...others.map((o) => o.y));
    const maxY = Math.max(...others.map((o) => o.y + o.height));
    xCandidates.push({ value: (minX + maxX) / 2, edge: 'center', priority: 1 });
    yCandidates.push({ value: (minY + maxY) / 2, edge: 'center', priority: 1 });

    for (const other of others) {
      xCandidates.push(
        { value: other.x, edge: 'left', priority: 2 },
        { value: other.x + other.width / 2, edge: 'center', priority: 2 },
        { value: other.x + other.width, edge: 'right', priority: 2 }
      );
      yCandidates.push(
        { value: other.y, edge: 'top', priority: 2 },
        { value: other.y + other.height / 2, edge: 'center', priority: 2 },
        { value: other.y + other.height, edge: 'bottom', priority: 2 }
      );
    }
  }

  const xBest = pickBestCandidate(xCandidates, (edge) => referenceX(dragged, edge));
  if (xBest) {
    x = xBest.value - offsetForEdge(xBest.edge, dragged.width);
    guides.push({ axis: 'x', position: xBest.value });
  }

  const yBest = pickBestCandidate(yCandidates, (edge) => referenceY(dragged, edge));
  if (yBest) {
    y = yBest.value - offsetForEdge(yBest.edge, dragged.height);
    guides.push({ axis: 'y', position: yBest.value });
  }

  return { x, y, guides };
}

export interface SizeSnapResult {
  width: number;
  height: number;
  matchedColorIndexes: number[];
}

function closestMatch(
  reference: number,
  others: readonly GeneratedSwatch[],
  dimension: 'width' | 'height'
): GeneratedSwatch | null {
  let best: GeneratedSwatch | null = null;
  let bestDistance = Infinity;
  for (const other of others) {
    const distance = Math.abs(reference - other[dimension]);
    if (distance > ALIGNMENT_THRESHOLD) continue;
    if (distance < bestDistance) {
      best = other;
      bestDistance = distance;
    }
  }
  return best;
}

export function snapSize(dragged: SwatchRect, others: readonly GeneratedSwatch[]): SizeSnapResult {
  const matchedColorIndexes: number[] = [];

  const widthMatch = closestMatch(dragged.width, others, 'width');
  const width = widthMatch ? widthMatch.width : dragged.width;
  if (widthMatch) matchedColorIndexes.push(widthMatch.colorIndex);

  const heightMatch = closestMatch(dragged.height, others, 'height');
  const height = heightMatch ? heightMatch.height : dragged.height;
  if (heightMatch && !matchedColorIndexes.includes(heightMatch.colorIndex)) {
    matchedColorIndexes.push(heightMatch.colorIndex);
  }

  return { width, height, matchedColorIndexes };
}
