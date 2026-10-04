import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { Animated, Modal, Pressable, Text } from 'react-native';

import { Sheet } from '../Sheet';

// RN 0.86: `Pressable` es un `memo`; el fiber lleva el componente interno (`.type`).
const PressableType = (Pressable as unknown as { type: ComponentType }).type;

let parallel: jest.SpyInstance;

beforeEach(() => {
  parallel = jest.spyOn(Animated, 'parallel').mockReturnValue({ start: jest.fn() } as never);
});

afterEach(() => jest.restoreAllMocks());

describe('Sheet', () => {
  it('shows its children when visible', () => {
    render(<Sheet visible onClose={jest.fn()}><Text>contenido</Text></Sheet>);

    expect(screen.getByText('contenido')).toBeOnTheScreen();
  });

  it('renders nothing when hidden', () => {
    render(<Sheet visible={false} onClose={jest.fn()}><Text>contenido</Text></Sheet>);

    expect(screen.queryByText('contenido')).toBeNull();
  });

  it('appears and disappears as `visible` changes', () => {
    const { rerender } = render(<Sheet visible={false} onClose={jest.fn()}><Text>contenido</Text></Sheet>);

    rerender(<Sheet visible onClose={jest.fn()}><Text>contenido</Text></Sheet>);
    expect(screen.getByText('contenido')).toBeOnTheScreen();

    rerender(<Sheet visible={false} onClose={jest.fn()}><Text>contenido</Text></Sheet>);
    expect(screen.queryByText('contenido')).toBeNull();
  });

  it('closes when the backdrop is tapped', () => {
    const onClose = jest.fn();
    render(<Sheet visible onClose={onClose}><Text>contenido</Text></Sheet>);

    fireEvent.press(screen.UNSAFE_getAllByType(PressableType)[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on the Android back button', () => {
    const onClose = jest.fn();
    render(<Sheet visible onClose={onClose}><Text>contenido</Text></Sheet>);

    screen.UNSAFE_getByType(Modal).props.onRequestClose();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('animates in when shown and out when hidden', () => {
    const { rerender } = render(<Sheet visible onClose={jest.fn()}><Text>x</Text></Sheet>);
    expect(parallel).toHaveBeenCalledTimes(1);

    rerender(<Sheet visible={false} onClose={jest.fn()}><Text>x</Text></Sheet>);
    expect(parallel).toHaveBeenCalledTimes(2);
  });

  it('forwards view props and extra styles to the sheet container', () => {
    render(
      <Sheet visible onClose={jest.fn()} testID="sheet" style={{ paddingBottom: 99 }}>
        <Text>x</Text>
      </Sheet>
    );

    expect(screen.getByTestId('sheet')).toBeOnTheScreen();
  });
});
