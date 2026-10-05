import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { Switch } from 'react-native';

import { PILL_CORNER_RADIUS } from '@/components/compose/archetypes/shared';
import { ARCHETYPES } from '@/data/archetypes';
import { trackEvent } from '@/lib/analytics/events';
import { useSettingsStore } from '@/lib/store/settingsStore';
import type { ArchetypeId } from '@/types/palette';
import { makeLayoutConfig } from '@test/factories';
import { EditTabs } from '../EditTabs';

jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('../CropTab', () => {
  const { createElement } = require('react');
  const { Text } = require('react-native');
  return {
    CropTab: (p: { paletteId: string; paletteSize: number }) =>
      createElement(Text, null, `CropTab:${p.paletteId}:${p.paletteSize}`),
  };
});

type Props = ComponentProps<typeof EditTabs>;

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    paletteId: 'p1',
    imageUri: 'file:///full.jpg',
    config: makeLayoutConfig(),
    updateConfig: jest.fn(),
    onImageUpdated: jest.fn(),
    onPaletteSizeChange: jest.fn(),
    onResetLibreLayout: jest.fn(),
    onLockedPress: jest.fn(),
    ...overrides,
  };
  render(<EditTabs {...props} />);
  return props;
}

const openTab = (label: string) => fireEvent.press(screen.getByText(label));

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ subscriptionStatus: 'free' });
});

describe('EditTabs — navigation', () => {
  it('shows the seven tabs and starts on Arquetipo', () => {
    setup();

    ['Recorte', 'Arquetipo', 'Colores', 'Tipografía', 'Esquinas', 'Estilo', 'Etiquetas'].forEach((tab) => {
      expect(screen.getByText(tab)).toBeOnTheScreen();
    });
    expect(screen.getByText('Franja')).toBeOnTheScreen();
  });

  it('shows only the active tab content', () => {
    setup();

    openTab('Tipografía');

    expect(screen.queryByText('Franja')).toBeNull();
    expect(screen.getByText('Clásica')).toBeOnTheScreen();
  });
});

describe('EditTabs — Arquetipo', () => {
  it('lists the six archetypes', () => {
    setup();

    ['Franja', 'Editorial', 'Cuadrícula', 'Banner', 'Lateral', 'Libre'].forEach((name) => {
      expect(screen.getByText(name)).toBeOnTheScreen();
    });
  });

  it('selecting one updates the config and records the event', () => {
    const props = setup();

    fireEvent.press(screen.getByText('Cuadrícula'));

    expect(props.updateConfig).toHaveBeenCalledWith({ archetypeId: 'grid' });
    expect(trackEvent).toHaveBeenCalledWith('archetype_selected', { archetype_id: 'grid' });
  });

  it('offers "Restablecer layout" only for Libre', () => {
    const props = setup({ config: makeLayoutConfig({ archetypeId: 'libre' }) });

    fireEvent.press(screen.getByText('Restablecer layout'));

    expect(props.onResetLibreLayout).toHaveBeenCalledTimes(1);
  });

  it('hides "Restablecer layout" for the fixed archetypes', () => {
    setup({ config: makeLayoutConfig({ archetypeId: 'strip' }) });

    expect(screen.queryByText('Restablecer layout')).toBeNull();
  });
});

describe('EditTabs — locked (premium) archetypes', () => {
  afterEach(() => {
    delete ARCHETYPES.strip.premium;
  });

  it('sends free users to the paywall instead of selecting', () => {
    ARCHETYPES.strip.premium = true;
    const props = setup({ config: makeLayoutConfig({ archetypeId: 'grid' }) });

    fireEvent.press(screen.getByText('Franja 🔒'));

    expect(props.onLockedPress).toHaveBeenCalledTimes(1);
    expect(props.updateConfig).not.toHaveBeenCalled();
  });

  it('lets premium users select it', () => {
    ARCHETYPES.strip.premium = true;
    useSettingsStore.setState({ subscriptionStatus: 'premium' });
    const props = setup({ config: makeLayoutConfig({ archetypeId: 'grid' }) });

    fireEvent.press(screen.getByText('Franja'));

    expect(props.updateConfig).toHaveBeenCalledWith({ archetypeId: 'strip' });
  });
});

describe('EditTabs — Recorte', () => {
  it('renders the crop tab with the palette id and size', () => {
    setup({ config: makeLayoutConfig({ paletteSize: 7 }) });

    openTab('Recorte');

    expect(screen.getByText('CropTab:p1:7')).toBeOnTheScreen();
  });
});

describe('EditTabs — Colores', () => {
  it('shows the palette size', () => {
    setup({ config: makeLayoutConfig({ paletteSize: 8 }) });

    openTab('Colores');

    expect(screen.getByText('8 colores')).toBeOnTheScreen();
  });

  it('falls back to 5 for rows saved before paletteSize existed', () => {
    setup({ config: { ...makeLayoutConfig(), paletteSize: undefined as unknown as number } });

    openTab('Colores');

    expect(screen.getByText('5 colores')).toBeOnTheScreen();
  });

  it('forwards a preset to onPaletteSizeChange', () => {
    const props = setup();
    openTab('Colores');

    fireEvent.press(screen.getByText('8'));

    expect(props.onPaletteSizeChange).toHaveBeenCalledWith(8);
  });

  it('blocks presets while a re-extraction runs', () => {
    const props = setup({ paletteSizeChanging: true });
    openTab('Colores');

    fireEvent.press(screen.getByText('8'));

    expect(props.onPaletteSizeChange).not.toHaveBeenCalled();
  });
});

describe('EditTabs — Tipografía, Esquinas, Estilo', () => {
  it('lists the five fonts and applies the chosen one', () => {
    const props = setup();
    openTab('Tipografía');

    ['Moderna', 'Clásica', 'Técnica', 'Condensada', 'Display'].forEach((f) => {
      expect(screen.getByText(f)).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByText('Clásica'));

    expect(props.updateConfig).toHaveBeenCalledWith({ fontFamily: 'serif' });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'fontFamily' });
  });

  it('applies the Píldora corner preset using the shared pill sentinel', () => {
    const props = setup();
    openTab('Esquinas');

    fireEvent.press(screen.getByText('Píldora'));

    expect(props.updateConfig).toHaveBeenCalledWith({ cornerRadius: PILL_CORNER_RADIUS });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'cornerRadius' });
  });

  it('applies a card style', () => {
    const props = setup();
    openTab('Estilo');

    fireEvent.press(screen.getByText('Contorno'));

    expect(props.updateConfig).toHaveBeenCalledWith({ cardStyle: 'outlined' });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'cardStyle' });
  });

  it.each([
    ['strip', false],
    ['editorial', true],
    ['grid', false],
    ['banner', true],
    ['side', false],
    ['libre', false],
  ] as [ArchetypeId, boolean][])('%s: "Difuminado" available = %s', (archetypeId, available) => {
    setup({ config: makeLayoutConfig({ archetypeId }) });
    openTab('Estilo');

    expect(screen.queryByText('Difuminado') !== null).toBe(available);
  });
});

describe('EditTabs — Etiquetas', () => {
  it('reflects the label toggles of the config', () => {
    setup({ config: makeLayoutConfig({ showHex: true, showName: false, showRGB: true }) });
    openTab('Etiquetas');

    expect(screen.UNSAFE_getAllByType(Switch).map((s) => s.props.value)).toEqual([true, false, true]);
  });

  it.each([
    [0, 'showHex'],
    [1, 'showName'],
    [2, 'showRGB'],
  ] as const)('switch %i toggles %s and records the event', (index, key) => {
    const props = setup({ config: makeLayoutConfig({ showHex: true, showName: true, showRGB: true }) });
    openTab('Etiquetas');

    fireEvent(screen.UNSAFE_getAllByType(Switch)[index], 'valueChange', false);

    expect(props.updateConfig).toHaveBeenCalledWith({ [key]: false });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: key });
  });
});
