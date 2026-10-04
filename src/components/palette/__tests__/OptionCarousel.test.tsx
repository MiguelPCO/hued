import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { useSettingsStore } from '@/lib/store/settingsStore';
import { Colors } from '@/lib/tokens';
import { OptionCarousel } from '../OptionCarousel';

const OPTIONS = [
  { key: 'a', label: 'Alfa' },
  { key: 'b', label: 'Beta', premium: true },
  { key: 'c', label: 'Gamma' },
];

beforeEach(() => useSettingsStore.setState({ subscriptionStatus: 'free' }));

describe('OptionCarousel', () => {
  it('renders every option label', () => {
    render(<OptionCarousel options={OPTIONS} activeKey="a" onSelect={jest.fn()} />);

    expect(screen.getByText('Alfa')).toBeOnTheScreen();
    expect(screen.getByText('Gamma')).toBeOnTheScreen();
  });

  it('selects a free option', () => {
    const onSelect = jest.fn();
    render(<OptionCarousel options={OPTIONS} activeKey="a" onSelect={onSelect} />);

    fireEvent.press(screen.getByText('Gamma'));

    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('highlights only the active option', () => {
    render(<OptionCarousel options={OPTIONS} activeKey="c" onSelect={jest.fn()} />);

    const backgrounds = screen
      .UNSAFE_getAllByType(TouchableOpacity)
      .map((pill) => StyleSheet.flatten(pill.props.style).backgroundColor);

    expect(backgrounds).toEqual([Colors.bgElevated, Colors.bgElevated, Colors.accent]);
  });

  it('locks premium options for free users and routes the tap to onLockedPress', () => {
    const onSelect = jest.fn();
    const onLockedPress = jest.fn();
    render(<OptionCarousel options={OPTIONS} activeKey="a" onSelect={onSelect} onLockedPress={onLockedPress} />);

    fireEvent.press(screen.getByText('Beta 🔒'));

    expect(onLockedPress).toHaveBeenCalledWith('b');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not throw when a locked option is tapped without an onLockedPress handler', () => {
    render(<OptionCarousel options={OPTIONS} activeKey="a" onSelect={jest.fn()} />);

    expect(() => fireEvent.press(screen.getByText('Beta 🔒'))).not.toThrow();
  });

  it('unlocks premium options for premium users', () => {
    useSettingsStore.setState({ subscriptionStatus: 'premium' });
    const onSelect = jest.fn();
    render(<OptionCarousel options={OPTIONS} activeKey="a" onSelect={onSelect} />);

    fireEvent.press(screen.getByText('Beta'));

    expect(onSelect).toHaveBeenCalledWith('b');
    expect(screen.queryByText(/🔒/)).toBeNull();
  });

  it('blocks every selection while disabled', () => {
    const onSelect = jest.fn();
    const onLockedPress = jest.fn();
    render(<OptionCarousel options={OPTIONS} activeKey="a" onSelect={onSelect} onLockedPress={onLockedPress} disabled />);

    fireEvent.press(screen.getByText('Gamma'));
    fireEvent.press(screen.getByText('Beta 🔒'));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onLockedPress).not.toHaveBeenCalled();
  });

  it('supports numeric keys', () => {
    const onSelect = jest.fn();
    render(
      <OptionCarousel options={[{ key: 0, label: 'Recta' }, { key: 16, label: 'Redonda' }]} activeKey={0} onSelect={onSelect} />
    );

    fireEvent.press(screen.getByText('Redonda'));

    expect(onSelect).toHaveBeenCalledWith(16);
  });
});
