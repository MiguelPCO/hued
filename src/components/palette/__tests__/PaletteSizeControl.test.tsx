import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { capturePanResponders, gesture, touch } from '@test/panResponder';
import { PaletteSizeControl } from '../PaletteSizeControl';

let pan: ReturnType<typeof capturePanResponders>;

beforeEach(() => {
  pan = capturePanResponders();
});

afterEach(() => pan.restore());

function layoutTrack(width: number) {
  const track = screen.UNSAFE_root.findAll((n) => (n.type as unknown) === 'View' && typeof n.props.onLayout === 'function')[0];
  fireEvent(track, 'layout', { nativeEvent: { layout: { width } } });
}

const grant = (x: number) => act(() => { pan.live().onPanResponderGrant?.(touch(x), gesture()); });
const move = (dx: number) => act(() => { pan.live().onPanResponderMove?.({} as never, gesture(dx)); });
const release = () => act(() => { pan.live().onPanResponderRelease?.({} as never, gesture()); });

describe('PaletteSizeControl — presets and label', () => {
  it('shows the presets and the current count', () => {
    render(<PaletteSizeControl value={5} onChange={jest.fn()} />);

    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('8')).toBeOnTheScreen();
    expect(screen.getByText('5 colores')).toBeOnTheScreen();
  });

  it('clamps an out-of-range value into 3–8', () => {
    const { rerender } = render(<PaletteSizeControl value={12} onChange={jest.fn()} />);
    expect(screen.getByText('8 colores')).toBeOnTheScreen();

    rerender(<PaletteSizeControl value={1} onChange={jest.fn()} />);
    expect(screen.getByText('3 colores')).toBeOnTheScreen();
  });

  it('selecting a preset reports it immediately', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={5} onChange={onChange} />);

    fireEvent.press(screen.getByText('8'));

    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('blocks presets while a re-extraction is running', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={5} onChange={onChange} disabled />);

    fireEvent.press(screen.getByText('8'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('follows the value prop when idle', () => {
    const { rerender } = render(<PaletteSizeControl value={5} onChange={jest.fn()} />);

    rerender(<PaletteSizeControl value={3} onChange={jest.fn()} />);

    expect(screen.getByText('3 colores')).toBeOnTheScreen();
  });
});

describe('PaletteSizeControl — slider', () => {
  it('previews the dragged size live but only commits on release', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={3} onChange={onChange} />);
    layoutTrack(200);

    grant(100); // 3 + round(100/200 * 5) = 6

    expect(screen.getByText('6 colores')).toBeOnTheScreen();
    expect(onChange).not.toHaveBeenCalled();

    release();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('continues the drag from the horizontal delta', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={3} onChange={onChange} />);
    layoutTrack(200);

    grant(100);
    move(40); // +1 colour
    release();

    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('clamps the dragged size between 3 and 8', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={5} onChange={onChange} />);
    layoutTrack(200);

    grant(100);
    move(1000);
    expect(screen.getByText('8 colores')).toBeOnTheScreen();
    move(-1000);
    expect(screen.getByText('3 colores')).toBeOnTheScreen();
  });

  it('commits when the gesture is terminated by the system', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={3} onChange={onChange} />);
    layoutTrack(200);

    grant(100);
    act(() => { pan.live().onPanResponderTerminate?.({} as never, gesture()); });

    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('ignores touches before the track is measured', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={3} onChange={onChange} />);

    grant(100);
    release();

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('3 colores')).toBeOnTheScreen();
  });

  it('a release without a preceding grant commits nothing', () => {
    const onChange = jest.fn();
    render(<PaletteSizeControl value={3} onChange={onChange} />);
    layoutTrack(200);

    release();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not let the parent value jump the thumb mid-drag', () => {
    const { rerender } = render(<PaletteSizeControl value={3} onChange={jest.fn()} />);
    layoutTrack(200);
    grant(100);

    rerender(<PaletteSizeControl value={4} onChange={jest.fn()} />);

    expect(screen.getByText('6 colores')).toBeOnTheScreen();
  });

  it('snaps back to the real value when the re-extraction fails', () => {
    const { rerender } = render(<PaletteSizeControl value={3} onChange={jest.fn()} />);
    layoutTrack(200);
    grant(140); // 3 + round(3.5) = 7
    release();
    expect(screen.getByText('7 colores')).toBeOnTheScreen();

    rerender(<PaletteSizeControl value={3} onChange={jest.fn()} disabled />); // extrayendo
    rerender(<PaletteSizeControl value={3} onChange={jest.fn()} disabled={false} />); // falló: value no cambió

    expect(screen.getByText('3 colores')).toBeOnTheScreen();
  });

  // H-09: el responder se crea con `useRef` en el primer render y conserva su `onChange`.
  // El padre (`handlePaletteSizeChange`) depende de `palette`: tras la primera extracción
  // el `onChange` vigente es otro, pero el arrastre sigue llamando al antiguo.
  it.failing('reports the release to the latest onChange prop (H-09)', () => {
    const first = jest.fn();
    const latest = jest.fn();
    const { rerender } = render(<PaletteSizeControl value={3} onChange={first} />);
    layoutTrack(200);
    rerender(<PaletteSizeControl value={3} onChange={latest} />);

    grant(100);
    release();

    expect(latest).toHaveBeenCalledWith(6);
    expect(first).not.toHaveBeenCalled();
  });

  it.failing('ignores a drag that starts while a re-extraction is running (H-09)', () => {
    const onChange = jest.fn();
    const { rerender } = render(<PaletteSizeControl value={3} onChange={onChange} />);
    layoutTrack(200);
    rerender(<PaletteSizeControl value={3} onChange={onChange} disabled />);

    grant(100);
    release();

    expect(screen.getByText('3 colores')).toBeOnTheScreen();
    expect(onChange).not.toHaveBeenCalled();
  });
});
