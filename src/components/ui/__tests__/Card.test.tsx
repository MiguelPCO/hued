import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { Colors, Radius, Spacing } from '@/lib/tokens';
import { Card } from '../Card';

function cardStyle(): Record<string, unknown> {
  return StyleSheet.flatten(screen.getByTestId('card').props.style) as Record<string, unknown>;
}

describe('Card', () => {
  it('renders its children', () => {
    render(
      <Card testID="card">
        <Text>dentro</Text>
      </Card>
    );

    expect(screen.getByText('dentro')).toBeOnTheScreen();
  });

  it('is an elevated, padded, rounded card by default', () => {
    render(<Card testID="card" />);

    expect(cardStyle()).toMatchObject({
      borderRadius: Radius.xl,
      backgroundColor: Colors.bgElevated,
      overflow: 'hidden',
      padding: Spacing.md,
      shadowOpacity: 0.08,
    });
  });

  it('outlined has a border and no shadow', () => {
    render(<Card testID="card" variant="outlined" />);

    expect(cardStyle()).toMatchObject({ borderWidth: 1, borderColor: Colors.borderDefault });
    expect(cardStyle().shadowOpacity).toBeUndefined();
  });

  it('flat uses the secondary background', () => {
    render(<Card testID="card" variant="flat" />);

    expect(cardStyle().backgroundColor).toBe(Colors.bgSecondary);
  });

  it('padding={false} removes the inner padding', () => {
    render(<Card testID="card" padding={false} />);

    expect(cardStyle().padding).toBeUndefined();
  });

  it('lets the caller override styles last and forwards view props', () => {
    render(<Card testID="card" style={{ padding: 2 }} accessibilityLabel="Tarjeta" />);

    expect(cardStyle().padding).toBe(2);
    expect(screen.getByLabelText('Tarjeta')).toBeOnTheScreen();
  });
});
