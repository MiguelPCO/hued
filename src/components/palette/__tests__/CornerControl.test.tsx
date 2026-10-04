import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { capturePanResponders, gesture, touch } from '@test/panResponder';
import { CornerControl } from '../CornerControl';

const PRESETS = [
  { key: 0, label: 'Recta' },
  { key: 16, label: 'Redonda' },
  { key: 9999, label: 'Píldora' },
];

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

function layoutTrack(width: number) {
  const track = screen.UNSAFE_root.findAll((n) => (n.type as unknown) === 'View' && typeof n.props.onLayout === 'function')[0];
  fireEvent(track, 'layout', { nativeEvent: { layout: { width } } });
}

const input = () => screen.UNSAFE_getByType(TextInput);

describe('CornerControl — presets and numeric field', () => {
  it('shows the presets and the current radius in px', () => {
    render(<CornerControl presets={PRESETS} value={16} onChange={jest.fn()} />);

    expect(screen.getByText('Recta')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('16')).toBeOnTheScreen();
  });

  it('selecting a preset reports its radius', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);

    fireEvent.press(screen.getByText('Píldora'));

    expect(onChange).toHaveBeenCalledWith(9999);
  });

  it('commits a typed value on blur', () => {
    const onChange = jest.fn();
    const { rerender } = render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);

    fireEvent(input(), 'focus');
    fireEvent.changeText(input(), '42');
    fireEvent(input(), 'blur');

    expect(onChange).toHaveBeenLastCalledWith(42);

    // controlled: the field shows the parent's value once editing ends
    rerender(<CornerControl presets={PRESETS} value={42} onChange={onChange} />);
    expect(screen.getByDisplayValue('42')).toBeOnTheScreen();
  });

  it('reverts to the current value when the text is not a number', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);

    fireEvent(input(), 'focus');
    fireEvent.changeText(input(), 'abc');
    fireEvent(input(), 'blur');

    expect(onChange).toHaveBeenLastCalledWith(16);
    expect(screen.getByDisplayValue('16')).toBeOnTheScreen();
  });

  it('never commits a negative radius', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);

    fireEvent(input(), 'focus');
    fireEvent.changeText(input(), '-5');
    fireEvent(input(), 'blur');

    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('limits the field to 4 digits and uses a numeric keypad', () => {
    render(<CornerControl presets={PRESETS} value={16} onChange={jest.fn()} />);

    expect(input().props.maxLength).toBe(4);
    expect(input().props.keyboardType).toBe('number-pad');
  });

  it('follows the value prop while the field is not being edited', () => {
    const { rerender } = render(<CornerControl presets={PRESETS} value={16} onChange={jest.fn()} />);

    rerender(<CornerControl presets={PRESETS} value={30} onChange={jest.fn()} />);

    expect(screen.getByDisplayValue('30')).toBeOnTheScreen();
  });

  it('does not overwrite what the user is typing when the prop changes', () => {
    const { rerender } = render(<CornerControl presets={PRESETS} value={16} onChange={jest.fn()} />);

    fireEvent(input(), 'focus');
    fireEvent.changeText(input(), '7');
    rerender(<CornerControl presets={PRESETS} value={99} onChange={jest.fn()} />);

    expect(screen.getByDisplayValue('7')).toBeOnTheScreen();
  });
});

describe('CornerControl — slider', () => {
  it('maps the first touch to a radius proportional to the track width', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);
    layoutTrack(180);

    act(() => { pan.configs[0].onPanResponderGrant?.(touch(90), gesture()); });
    frame();

    expect(onChange).toHaveBeenCalledWith(90);
  });

  it('drives the rest of the drag from the horizontal delta', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);
    layoutTrack(180);

    act(() => {
      pan.configs[0].onPanResponderGrant?.(touch(90), gesture());
      pan.configs[0].onPanResponderMove?.({} as never, gesture(45));
    });
    frame();

    expect(onChange).toHaveBeenLastCalledWith(135);
  });

  it('clamps the radius between 0 and 180', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);
    layoutTrack(180);
    act(() => { pan.configs[0].onPanResponderGrant?.(touch(90), gesture()); });
    frame();

    act(() => { pan.configs[0].onPanResponderMove?.({} as never, gesture(1000)); });
    frame();
    expect(onChange).toHaveBeenLastCalledWith(180);

    act(() => { pan.configs[0].onPanResponderMove?.({} as never, gesture(-1000)); });
    frame();
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('coalesces many touch ticks into one onChange per animation frame', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);
    layoutTrack(180);

    act(() => {
      pan.configs[0].onPanResponderGrant?.(touch(0), gesture());
      pan.configs[0].onPanResponderMove?.({} as never, gesture(18));
      pan.configs[0].onPanResponderMove?.({} as never, gesture(36));
    });
    frame();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(36);
  });

  it('ignores touches before the track has been measured', () => {
    const onChange = jest.fn();
    render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);

    act(() => { pan.configs[0].onPanResponderGrant?.(touch(50), gesture()); });
    frame();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('drops a pending frame when unmounted', () => {
    const onChange = jest.fn();
    const { unmount } = render(<CornerControl presets={PRESETS} value={16} onChange={onChange} />);
    layoutTrack(180);

    act(() => { pan.configs[0].onPanResponderGrant?.(touch(90), gesture()); });
    unmount();
    frame();

    expect(onChange).not.toHaveBeenCalled();
  });

  // H-09: `useRef(PanResponder.create({...}))` conserva los handlers del primer render;
  // un `onChange` nuevo (props que cambian) nunca se usa durante el arrastre.
  it.failing('reports slider changes to the latest onChange prop (H-09)', () => {
    const first = jest.fn();
    const latest = jest.fn();
    const { rerender } = render(<CornerControl presets={PRESETS} value={16} onChange={first} />);
    layoutTrack(180);
    rerender(<CornerControl presets={PRESETS} value={16} onChange={latest} />);

    act(() => { pan.configs[0].onPanResponderGrant?.(touch(90), gesture()); });
    frame();

    expect(latest).toHaveBeenCalledWith(90);
    expect(first).not.toHaveBeenCalled();
  });
});
