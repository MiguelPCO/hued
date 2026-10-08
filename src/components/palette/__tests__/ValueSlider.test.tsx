import { capturePanResponders, gesture, touch } from '@test/panResponder';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ValueSlider } from '../ValueSlider';

let pan: ReturnType<typeof capturePanResponders>;

beforeEach(() => {
  jest.useFakeTimers();
  pan = capturePanResponders();
});

afterEach(() => {
  pan.restore();
  jest.useRealTimers();
});

const frame = () =>
  act(() => {
    jest.advanceTimersByTime(20);
  });
const field = (label: string) => screen.getByLabelText(label);

function layoutTrack(width: number) {
  const track = screen.UNSAFE_root.findAll(
    (n) => (n.type as unknown) === 'View' && typeof n.props.onLayout === 'function',
  )[0];
  fireEvent(track, 'layout', { nativeEvent: { layout: { width } } });
}

function type(label: string, value: string) {
  fireEvent(field(label), 'focus');
  fireEvent.changeText(field(label), value);
  fireEvent(field(label), 'blur');
}

describe('ValueSlider — slider', () => {
  it('shows the label, the value and its unit', () => {
    render(
      <ValueSlider
        label="Ancho"
        value={80}
        min={50}
        max={150}
        step={5}
        unit="%"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText('Ancho')).toBeOnTheScreen();
    expect(field('Ancho').props.value).toBe('80');
    expect(screen.getByText('%')).toBeOnTheScreen();
  });

  it('maps the first touch to a value proportional to the track, snapped to the step', () => {
    const onChange = jest.fn();
    render(
      <ValueSlider label="Ancho" value={100} min={50} max={150} step={5} onChange={onChange} />,
    );
    layoutTrack(200);

    act(() => {
      pan.live().onPanResponderGrant?.(touch(100), gesture());
    });
    frame();
    expect(onChange).toHaveBeenLastCalledWith(100);

    act(() => {
      pan.live().onPanResponderGrant?.(touch(153), gesture());
    });
    frame();
    expect(onChange).toHaveBeenLastCalledWith(125);
  });

  it('drives the rest of the drag from the horizontal delta and clamps to the range', () => {
    const onChange = jest.fn();
    render(
      <ValueSlider label="Ancho" value={100} min={50} max={150} step={5} onChange={onChange} />,
    );
    layoutTrack(200);

    act(() => {
      pan.live().onPanResponderGrant?.(touch(100), gesture());
      pan.live().onPanResponderMove?.({} as never, gesture(40));
    });
    frame();
    expect(onChange).toHaveBeenLastCalledWith(120);

    act(() => {
      pan.live().onPanResponderMove?.({} as never, gesture(900));
    });
    frame();
    expect(onChange).toHaveBeenLastCalledWith(150);
  });

  it('commits at most one change per frame while dragging', () => {
    const onChange = jest.fn();
    render(
      <ValueSlider label="Ancho" value={100} min={50} max={150} step={5} onChange={onChange} />,
    );
    layoutTrack(200);

    act(() => {
      pan.live().onPanResponderGrant?.(touch(100), gesture());
      pan.live().onPanResponderMove?.({} as never, gesture(10));
      pan.live().onPanResponderMove?.({} as never, gesture(20));
    });
    frame();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(110);
  });

  it('ignores the touch when disabled', () => {
    const onChange = jest.fn();
    render(
      <ValueSlider label="Ancho" value={100} min={50} max={150} disabled onChange={onChange} />,
    );
    layoutTrack(200);

    act(() => {
      pan.live().onPanResponderGrant?.(touch(10), gesture());
    });
    frame();

    expect(onChange).not.toHaveBeenCalled();
    expect(field('Ancho').props.editable).toBe(false);
  });

  it('commits a typed value on blur, snapped and clamped', () => {
    const onChange = jest.fn();
    render(
      <ValueSlider label="Ancho" value={100} min={50} max={150} step={5} onChange={onChange} />,
    );

    type('Ancho', '67');
    expect(onChange).toHaveBeenLastCalledWith(65);

    type('Ancho', '999');
    expect(onChange).toHaveBeenLastCalledWith(150);

    type('Ancho', '1');
    expect(onChange).toHaveBeenLastCalledWith(50);
  });

  it('reverts to the current value when the text is not a number', () => {
    const onChange = jest.fn();
    render(<ValueSlider label="Ancho" value={100} min={50} max={150} onChange={onChange} />);

    type('Ancho', 'abc');

    expect(onChange).toHaveBeenLastCalledWith(100);
  });

  it('does not overwrite what the user is typing when the prop changes', () => {
    const { rerender } = render(
      <ValueSlider label="Ancho" value={100} min={50} max={150} onChange={jest.fn()} />,
    );

    fireEvent(field('Ancho'), 'focus');
    fireEvent.changeText(field('Ancho'), '7');
    rerender(<ValueSlider label="Ancho" value={120} min={50} max={150} onChange={jest.fn()} />);

    expect(field('Ancho').props.value).toBe('7');
  });
});

describe('ValueSlider — stepper', () => {
  it('steps down and up by the step', () => {
    const onChange = jest.fn();
    render(
      <ValueSlider
        label="Tamaño"
        value={10}
        min={6}
        max={24}
        unit="px"
        stepper
        onChange={onChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Tamaño más'));
    expect(onChange).toHaveBeenLastCalledWith(11);

    fireEvent.press(screen.getByLabelText('Tamaño menos'));
    expect(onChange).toHaveBeenLastCalledWith(9);
  });

  it('disables the button that would leave the range', () => {
    const { rerender } = render(
      <ValueSlider label="Tamaño" value={6} min={6} max={24} stepper onChange={jest.fn()} />,
    );
    expect(screen.getByLabelText('Tamaño menos')).toBeDisabled();

    rerender(
      <ValueSlider label="Tamaño" value={24} min={6} max={24} stepper onChange={jest.fn()} />,
    );
    expect(screen.getByLabelText('Tamaño más')).toBeDisabled();
  });

  it('has no draggable track', () => {
    render(<ValueSlider label="Tamaño" value={10} min={6} max={24} stepper onChange={jest.fn()} />);

    expect(screen.UNSAFE_root.findAll((n) => typeof n.props.onLayout === 'function')).toHaveLength(
      0,
    );
  });
});
