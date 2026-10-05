import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Colors } from '@/lib/tokens';
import { Button } from '../Button';

// RN 0.86: `Pressable` es un `memo`; el fiber lleva el componente interno (`.type`).
const PressableType = (Pressable as unknown as { type: ComponentType }).type;

type StyleFn = (state: { pressed: boolean }) => unknown;

function pressableStyle(pressed = false): Record<string, unknown> {
  const { style } = screen.UNSAFE_getByType(PressableType).props as { style: StyleFn };
  return StyleSheet.flatten(style({ pressed }) as never) as Record<string, unknown>;
}

function labelStyle(label: string): Record<string, unknown> {
  return StyleSheet.flatten(screen.getByText(label).props.style) as Record<string, unknown>;
}

describe('Button', () => {
  it('renders its label and fires onPress', () => {
    const onPress = jest.fn();
    render(<Button label="Guardar" onPress={onPress} />);

    fireEvent.press(screen.getByText('Guardar'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    render(<Button label="Guardar" onPress={onPress} disabled />);

    fireEvent.press(screen.getByText('Guardar'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a spinner instead of the label while loading and blocks presses', () => {
    const onPress = jest.fn();
    render(<Button label="Guardar" onPress={onPress} loading />);

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(screen.queryByText('Guardar')).toBeNull();
    fireEvent.press(screen.UNSAFE_getByType(ActivityIndicator));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders an optional icon next to the label', () => {
    const { Text } = require('react-native');
    render(<Button label="Compartir" icon={<Text>ICON</Text>} />);

    expect(screen.getByText('ICON')).toBeOnTheScreen();
    expect(screen.getByText('Compartir')).toBeOnTheScreen();
  });

  it.each([
    ['primary', Colors.accent],
    ['secondary', Colors.bgSecondary],
    ['ghost', 'transparent'],
    ['destructive', Colors.error],
  ] as const)('%s variant uses its background', (variant, background) => {
    render(<Button label="x" variant={variant} />);

    expect(pressableStyle().backgroundColor).toBe(background);
  });

  it('secondary has a hairline border', () => {
    render(<Button label="x" variant="secondary" />);

    expect(pressableStyle()).toMatchObject({ borderWidth: 1, borderColor: Colors.borderDefault });
  });

  it.each([
    ['sm', 36],
    ['md', 48],
    ['lg', 56],
  ] as const)('%s size keeps a %i px minimum touch height', (size, minHeight) => {
    render(<Button label="x" size={size} />);

    expect(pressableStyle().minHeight).toBe(minHeight);
  });

  it('fullWidth stretches to 100%', () => {
    render(<Button label="x" fullWidth />);

    expect(pressableStyle().width).toBe('100%');
  });

  it('dims while pressed and more while disabled', () => {
    render(<Button label="x" disabled />);

    expect(pressableStyle(true).opacity).toBe(0.4); // disabled gana sobre pressed
    expect(pressableStyle(false).opacity).toBe(0.4);
  });

  it('dims slightly while pressed', () => {
    render(<Button label="x" />);

    expect(pressableStyle(true).opacity).toBe(0.8);
    expect(pressableStyle(false).opacity).toBeUndefined();
  });

  it('colors the label per variant', () => {
    const { rerender } = render(<Button label="x" variant="primary" />);
    expect(labelStyle('x').color).toBe(Colors.accentForeground);

    rerender(<Button label="x" variant="ghost" />);
    expect(labelStyle('x').color).toBe(Colors.accent);

    rerender(<Button label="x" variant="secondary" />);
    expect(labelStyle('x').color).toBe(Colors.textPrimary);
  });

  // H-01 (corregido): `style` se extraía de las props pero nunca se aplicaba al Pressable.
  it('applies the style prop passed by the caller (H-01)', () => {
    render(<Button label="x" style={{ marginTop: 12 }} />);

    expect(pressableStyle().marginTop).toBe(12);
  });

  it('lets the caller override the built-in style, and accepts a style function', () => {
    render(<Button label="x" style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })} />);

    expect(pressableStyle(true).opacity).toBe(0.5);
    expect(pressableStyle(false).opacity).toBe(1);
    expect(pressableStyle().minHeight).toBe(48);
  });
});
