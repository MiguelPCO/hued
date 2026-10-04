import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Colors } from '@/lib/tokens';
import type { FreeformSwatch } from '@/types/palette';
import { makeColors, makeLayoutConfig, makePalette } from '@test/factories';
import { capturePanResponders, gesture, touch } from '@test/panResponder';
import { LibreEditOverlay } from '../LibreEditOverlay';

const SCALE = 2;
const sw = (colorIndex: number, x: number, y: number, width: number, height: number): FreeformSwatch => ({
  x, y, width, height, colorIndex,
});

const SOLO = [sw(0, 10, 10, 100, 100)];
const PAIR = [sw(0, 10, 10, 100, 100), sw(1, 150, 10, 80, 80)];
const THREE = [sw(0, 10, 10, 100, 100), sw(1, 150, 10, 100, 100), sw(2, 10, 200, 60, 80)];

let pan: ReturnType<typeof capturePanResponders>;

beforeEach(() => {
  jest.useFakeTimers();
  pan = capturePanResponders();
});

afterEach(() => {
  pan.restore();
  jest.useRealTimers();
});

const frame = () => act(() => { jest.advanceTimersByTime(20); });

function mount(swatches: FreeformSwatch[], colorCount = 3) {
  const palette = makePalette({ colors: makeColors(colorCount) });
  const config = makeLayoutConfig({ archetypeId: 'libre', freeformSwatches: swatches });
  const onChange = jest.fn();
  const view = render(
    <LibreEditOverlay
      palette={palette}
      config={config}
      scale={SCALE}
      canvasW={360}
      canvasH={450}
      onFreeformSwatchesChange={onChange}
    />
  );
  return { view, onChange };
}

const mover = (i: number) => pan.configs[i * 2];
const resizer = (i: number) => pan.configs[i * 2 + 1];

const grant = (cfg: (typeof pan.configs)[number]) => act(() => { cfg.onPanResponderGrant?.(touch(0), gesture()); });
const move = (cfg: (typeof pan.configs)[number], dx: number, dy: number) =>
  act(() => { cfg.onPanResponderMove?.({} as never, gesture(dx, dy)); });

function lastUpdate(onChange: jest.Mock, prev: FreeformSwatch[]): FreeformSwatch[] {
  const updater = onChange.mock.calls.at(-1)![0] as (p: FreeformSwatch[]) => FreeformSwatch[];
  return updater(prev);
}

const flat = (node: { props: Record<string, unknown> }) =>
  (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;

function handles() {
  return screen.UNSAFE_root.findAll(
    (n) =>
      (n.type as unknown) === 'View' &&
      n.props.pointerEvents !== 'none' &&
      flat(n).position === 'absolute' &&
      flat(n).left !== undefined &&
      flat(n).width !== undefined
  );
}

function guides() {
  return screen.UNSAFE_root.findAll((n) => (n.type as unknown) === 'View' && n.props.pointerEvents === 'none');
}

describe('LibreEditOverlay — layout', () => {
  it('renders one handle per swatch at its on-screen position and size', () => {
    mount(THREE);

    const boxes = handles().map((h) => {
      const { left, top, width, height } = flat(h);
      return { left, top, width, height };
    });

    expect(boxes).toEqual([
      { left: 20, top: 20, width: 200, height: 200 },
      { left: 300, top: 20, width: 200, height: 200 },
      { left: 20, top: 400, width: 120, height: 160 },
    ]);
  });

  it('skips swatches whose color no longer exists', () => {
    mount(THREE, 2);

    expect(handles()).toHaveLength(2);
  });

  it('renders no handles for an empty layout', () => {
    mount([]);

    expect(handles()).toHaveLength(0);
  });
});

describe('LibreEditOverlay — moving', () => {
  it('brings the touched swatch to the front on grant', () => {
    const { onChange } = mount(THREE);

    grant(mover(0));

    expect(lastUpdate(onChange, THREE).map((s) => s.colorIndex)).toEqual([1, 2, 0]);
  });

  it('moves by the gesture delta converted back to design units', () => {
    const { onChange } = mount(SOLO);

    grant(mover(0));
    move(mover(0), 40, 20);
    frame();

    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ x: 30, y: 20, width: 100, height: 100, colorIndex: 0 });
  });

  it('keeps the swatch inside the canvas', () => {
    const { onChange } = mount(SOLO);
    grant(mover(0));

    move(mover(0), 10000, 10000);
    frame();
    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ x: 260, y: 350 });

    move(mover(0), -10000, -10000);
    frame();
    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('only the touched handle changes its swatch', () => {
    const { onChange } = mount(THREE);

    grant(mover(1));
    move(mover(1), 40, 0);
    frame();
    const result = lastUpdate(onChange, THREE);

    expect(result[1].x).toBe(170);
    expect(result[0]).toBe(THREE[0]);
    expect(result[2]).toBe(THREE[2]);
  });

  it('coalesces many touch ticks into one commit per animation frame', () => {
    const { onChange } = mount(SOLO);

    grant(mover(0));
    move(mover(0), 10, 10);
    move(mover(0), 20, 20);
    frame();

    expect(onChange).toHaveBeenCalledTimes(2); // bring-to-front + un solo commit de posición
    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ x: 20, y: 20 });
  });

  it('drops the pending frame when unmounted', () => {
    const { view, onChange } = mount(SOLO);

    grant(mover(0));
    move(mover(0), 10, 10);
    view.unmount();
    frame();

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('LibreEditOverlay — alignment guides (ADR-0002)', () => {
  it('snaps the swatch center to the canvas center and draws both guides', () => {
    const { onChange } = mount(SOLO);

    grant(mover(0));
    move(mover(0), 236, 326); // x bruta 128 → centro 178; y bruta 173 → centro 223
    frame();

    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ x: 130, y: 175 });
    const lines = guides().map(flat);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ left: 360, height: 900, width: 1 }); // x = 180 * escala
    expect(lines[1]).toMatchObject({ top: 450, width: 720, height: 1 }); // y = 225 * escala
  });

  it.each(['onPanResponderRelease', 'onPanResponderTerminate'] as const)('%s clears the guides', (handler) => {
    mount(SOLO);
    grant(mover(0));
    move(mover(0), 236, 326);
    frame();
    expect(guides()).toHaveLength(2);

    act(() => { mover(0)[handler]?.({} as never, gesture()); });

    expect(guides()).toHaveLength(0);
  });
});

describe('LibreEditOverlay — resizing', () => {
  it('does not reorder swatches when a resize starts', () => {
    const { onChange } = mount(SOLO);

    grant(resizer(0));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('grows from the fixed top-left corner by the converted delta', () => {
    const { onChange } = mount(SOLO);

    grant(resizer(0));
    move(resizer(0), 40, 20);
    frame();

    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ x: 10, y: 10, width: 120, height: 110 });
  });

  it('never shrinks below 24px', () => {
    const { onChange } = mount(SOLO);

    grant(resizer(0));
    move(resizer(0), -1000, -1000);
    frame();

    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ width: 24, height: 24 });
  });

  it('never grows past the canvas edge, without moving the anchored corner', () => {
    const { onChange } = mount(SOLO);

    grant(resizer(0));
    move(resizer(0), 10000, 10000);
    frame();

    expect(lastUpdate(onChange, SOLO)[0]).toMatchObject({ x: 10, y: 10, width: 350, height: 440 });
  });

  it('snaps to the size of a similar swatch and highlights both', () => {
    const { onChange } = mount(PAIR, 2);

    grant(resizer(0));
    move(resizer(0), -36, -34); // 82x83 bruto → encaja con 80x80 del otro
    frame();

    expect(lastUpdate(onChange, PAIR)[0]).toMatchObject({ width: 80, height: 80 });
    const highlighted = handles().filter((h) => flat(h).borderWidth === 2);
    expect(highlighted).toHaveLength(2);
    highlighted.forEach((h) => expect(flat(h).borderColor).toBe(Colors.accent));

    act(() => { resizer(0).onPanResponderRelease?.({} as never, gesture()); });
    expect(handles().filter((h) => flat(h).borderWidth === 2)).toHaveLength(0);
  });
});
