import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Colors, FontFamily, FontSize } from '@/lib/tokens';
import { Text } from '../Text';

function textStyle(label = 'hola'): Record<string, unknown> {
  return StyleSheet.flatten(screen.getByText(label).props.style) as Record<string, unknown>;
}

describe('Text', () => {
  it('defaults to the body variant in the primary ink color', () => {
    render(<Text>hola</Text>);

    expect(textStyle()).toMatchObject({
      fontSize: FontSize.md,
      color: Colors.textPrimary,
      fontFamily: FontFamily.sans,
    });
  });

  it.each([
    ['display', FontSize['4xl'], FontFamily.display],
    ['h1', FontSize['2xl'], FontFamily.display],
    ['h2', FontSize.xl, FontFamily.sans],
    ['h3', FontSize.lg, FontFamily.sans],
    ['body', FontSize.md, FontFamily.sans],
    ['small', FontSize.sm, FontFamily.sans],
    ['caption', FontSize.xs, FontFamily.sans],
    ['label', FontSize.sm, FontFamily.sans],
  ] as const)('%s variant has the right size and family', (variant, size, family) => {
    render(<Text variant={variant}>hola</Text>);

    expect(textStyle()).toMatchObject({ fontSize: size, fontFamily: family });
  });

  it('caption is secondary-colored unless overridden', () => {
    render(<Text variant="caption">hola</Text>);

    expect(textStyle().color).toBe(Colors.textSecondary);
  });

  it('the weight prop overrides the variant weight', () => {
    render(<Text variant="h2" weight="bold">hola</Text>);

    expect(textStyle().fontWeight).toBe('700');
  });

  it('the color prop overrides the default color', () => {
    render(<Text color="#123456">hola</Text>);

    expect(textStyle().color).toBe('#123456');
  });

  it('the style prop wins over everything else', () => {
    render(<Text color="#123456" style={{ color: '#ABCDEF' }}>hola</Text>);

    expect(textStyle().color).toBe('#ABCDEF');
  });

  it('forwards native text props', () => {
    render(<Text numberOfLines={1}>hola</Text>);

    expect(screen.getByText('hola').props.numberOfLines).toBe(1);
  });
});
