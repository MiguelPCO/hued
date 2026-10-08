import type { ComponentProps } from 'react';

import { Switch } from 'react-native';

import { makeLayoutConfig } from '@test/factories';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { PILL_CORNER_RADIUS } from '@/components/compose/archetypes/shared';
import { ARCHETYPES } from '@/data/archetypes';
import { trackEvent } from '@/lib/analytics/events';
import { useSettingsStore } from '@/lib/store/settingsStore';
import type { ArchetypeId } from '@/types/palette';

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
    onSelectArchetype: jest.fn(),
    onScaleChange: jest.fn(),
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

/** Types a number into a ValueSlider's field and commits it on blur. */
function typeValue(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent(input, 'focus');
  fireEvent.changeText(input, value);
  fireEvent(input, 'blur');
}

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ subscriptionStatus: 'free' });
});

describe('EditTabs — navigation', () => {
  it('shows the six tabs and starts on Arquetipo', () => {
    setup();

    ['Recorte', 'Arquetipo', 'Colores', 'Tarjetas', 'Fuente', 'Texto'].forEach((tab) => {
      expect(screen.getByText(tab)).toBeOnTheScreen();
    });
    expect(screen.getByText('Pila')).toBeOnTheScreen();
  });

  it('shows only the active tab content', () => {
    setup();

    openTab('Fuente');

    expect(screen.queryByText('Pila')).toBeNull();
    expect(screen.getByText('Clásica')).toBeOnTheScreen();
  });
});

describe('EditTabs — Arquetipo', () => {
  it('lists the five archetypes', () => {
    setup();

    ['Pila', 'Mosaico', 'Escalonado', 'Columnas', 'Libre'].forEach((name) => {
      expect(screen.getByText(name)).toBeOnTheScreen();
    });
  });

  it('selecting one hands it to the screen (which applies its base look) and records the event', () => {
    const props = setup();

    fireEvent.press(screen.getByText('Mosaico'));

    expect(props.onSelectArchetype).toHaveBeenCalledWith('mosaico');
    expect(props.updateConfig).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('archetype_selected', { archetype_id: 'mosaico' });
  });

  it('offers "Restablecer layout" only for Libre', () => {
    const props = setup({ config: makeLayoutConfig({ archetypeId: 'libre' }) });

    fireEvent.press(screen.getByText('Restablecer layout'));

    expect(props.onResetLibreLayout).toHaveBeenCalledTimes(1);
  });

  it('hides "Restablecer layout" for the fixed archetypes', () => {
    setup({ config: makeLayoutConfig({ archetypeId: 'pila' }) });

    expect(screen.queryByText('Restablecer layout')).toBeNull();
  });
});

describe('EditTabs — locked (premium) archetypes', () => {
  afterEach(() => {
    delete ARCHETYPES.pila.premium;
  });

  it('sends free users to the paywall instead of selecting', () => {
    ARCHETYPES.pila.premium = true;
    const props = setup({ config: makeLayoutConfig({ archetypeId: 'mosaico' }) });

    fireEvent.press(screen.getByText('Pila 🔒'));

    expect(props.onLockedPress).toHaveBeenCalledTimes(1);
    expect(props.onSelectArchetype).not.toHaveBeenCalled();
  });

  it('lets premium users select it', () => {
    ARCHETYPES.pila.premium = true;
    useSettingsStore.setState({ subscriptionStatus: 'premium' });
    const props = setup({ config: makeLayoutConfig({ archetypeId: 'mosaico' }) });

    fireEvent.press(screen.getByText('Pila'));

    expect(props.onSelectArchetype).toHaveBeenCalledWith('pila');
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

describe('EditTabs — Tarjetas', () => {
  it('applies the Píldora corner preset using the shared pill sentinel', () => {
    const props = setup();
    openTab('Tarjetas');

    fireEvent.press(screen.getByText('Píldora'));

    expect(props.updateConfig).toHaveBeenCalledWith({ cornerRadius: PILL_CORNER_RADIUS });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'cornerRadius' });
  });

  it('applies a card style', () => {
    const props = setup();
    openTab('Tarjetas');

    fireEvent.press(screen.getByText('Contorno'));

    expect(props.updateConfig).toHaveBeenCalledWith({ cardStyle: 'outlined' });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'cardStyle' });
  });

  it.each([
    ['pila', false],
    ['mosaico', false],
    ['escalonado', false],
    ['columnas', false],
    ['libre', false],
  ] as [ArchetypeId, boolean][])('%s: "Difuminado" available = %s', (archetypeId, available) => {
    setup({ config: makeLayoutConfig({ archetypeId }) });
    openTab('Tarjetas');

    expect(screen.queryByText('Difuminado') !== null).toBe(available);
  });

  it('shows the current opacity, size and spacing', () => {
    setup({
      config: makeLayoutConfig({
        cardOpacity: 65,
        cardWidthScale: 80,
        cardHeightScale: 120,
        gapScale: 140,
      }),
    });
    openTab('Tarjetas');

    expect(screen.getByLabelText('Opacidad').props.value).toBe('65');
    expect(screen.getByLabelText('Ancho').props.value).toBe('80');
    expect(screen.getByLabelText('Alto').props.value).toBe('120');
    expect(screen.getByLabelText('Separación').props.value).toBe('140');
  });

  it('applies a typed opacity, snapped to its 5 % step and clamped to 30-100', () => {
    const props = setup();
    openTab('Tarjetas');

    typeValue('Opacidad', '72');
    expect(props.updateConfig).toHaveBeenLastCalledWith({ cardOpacity: 70 });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'cardOpacity' });

    typeValue('Opacidad', '5');
    expect(props.updateConfig).toHaveBeenLastCalledWith({ cardOpacity: 30 });
  });

  it.each([
    ['Ancho', 'cardWidthScale'],
    ['Alto', 'cardHeightScale'],
    ['Separación', 'gapScale'],
  ] as const)('sends %s to onScaleChange, clamped to 50-150', (label, key) => {
    const props = setup();
    openTab('Tarjetas');

    typeValue(label, '120');
    expect(props.onScaleChange).toHaveBeenLastCalledWith(key, 120);

    typeValue(label, '400');
    expect(props.onScaleChange).toHaveBeenLastCalledWith(key, 150);
    expect(props.updateConfig).not.toHaveBeenCalled();
  });

  it('keeps the entered text out of the way: a non-number leaves the value unchanged', () => {
    const props = setup({ config: makeLayoutConfig({ cardWidthScale: 90 }) });
    openTab('Tarjetas');

    typeValue('Ancho', 'abc');

    expect(props.onScaleChange).toHaveBeenLastCalledWith('cardWidthScale', 90);
  });

  it('disables the spacing in Libre (the cards are placed by hand)', () => {
    setup({ config: makeLayoutConfig({ archetypeId: 'libre' }) });
    openTab('Tarjetas');

    expect(screen.getByLabelText('Separación').props.editable).toBe(false);
    expect(screen.getByLabelText('Ancho').props.editable).toBe(true);
  });
});

describe('EditTabs — Fuente', () => {
  it('lists the system fonts and the bundled ones, grouped, and applies the chosen one', () => {
    const props = setup();
    openTab('Fuente');

    ['Sistema', 'Sans', 'Serif', 'Mono', 'Display', 'Manuscrita'].forEach((group) => {
      // 'Display' is both a group and a system font name
      expect(screen.getAllByText(group).length).toBeGreaterThan(0);
    });
    [
      'Moderna',
      'Clásica',
      'Técnica',
      'Condensada',
      'Poppins',
      'Playfair Display',
      'Pacifico',
    ].forEach((f) => {
      expect(screen.getByText(f)).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByText('Clásica'));

    expect(props.updateConfig).toHaveBeenCalledWith({ fontFamily: 'serif' });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'fontFamily' });
  });

  it('applies a bundled font by its catalog key', () => {
    const props = setup();
    openTab('Fuente');

    fireEvent.press(screen.getByText('Space Mono'));

    expect(props.updateConfig).toHaveBeenCalledWith({ fontFamily: 'space-mono' });
  });
});

describe('EditTabs — Texto', () => {
  it('steps the font size with − and +, and types it', () => {
    const props = setup({ config: makeLayoutConfig({ fontSize: 10 }) });
    openTab('Texto');

    fireEvent.press(screen.getByLabelText('Tamaño más'));
    expect(props.updateConfig).toHaveBeenLastCalledWith({ fontSize: 11 });

    fireEvent.press(screen.getByLabelText('Tamaño menos'));
    expect(props.updateConfig).toHaveBeenLastCalledWith({ fontSize: 9 });

    typeValue('Tamaño', '40');
    expect(props.updateConfig).toHaveBeenLastCalledWith({ fontSize: 24 });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'fontSize' });
  });

  it('stops the stepper at 6 and 24 px', () => {
    setup({ config: makeLayoutConfig({ fontSize: 6 }) });
    openTab('Texto');

    expect(screen.getByLabelText('Tamaño menos')).toBeDisabled();
    expect(screen.getByLabelText('Tamaño más')).toBeEnabled();
  });

  it('applies the label position, order and alignment', () => {
    const props = setup();
    openTab('Texto');

    fireEvent.press(screen.getByText('Abajo'));
    expect(props.updateConfig).toHaveBeenLastCalledWith({ labelPosition: 'bottom' });

    fireEvent.press(screen.getByText('Hex primero'));
    expect(props.updateConfig).toHaveBeenLastCalledWith({ labelOrder: 'hex-first' });

    fireEvent.press(screen.getByText('Derecha'));
    expect(props.updateConfig).toHaveBeenLastCalledWith({ labelAlign: 'right' });
  });

  it('offers the diagonal alignment only with the split position', () => {
    setup({ config: makeLayoutConfig({ labelPosition: 'split' }) });
    openTab('Texto');
    expect(screen.getByText('Diagonal')).toBeOnTheScreen();
  });

  it('hides the diagonal alignment for the other positions', () => {
    setup({ config: makeLayoutConfig({ labelPosition: 'top' }) });
    openTab('Texto');
    expect(screen.queryByText('Diagonal')).toBeNull();
  });

  it('falls back to left alignment when leaving split while diagonal', () => {
    const props = setup({
      config: makeLayoutConfig({ labelPosition: 'split', labelAlign: 'diagonal' }),
    });
    openTab('Texto');

    fireEvent.press(screen.getByText('Arriba'));

    expect(props.updateConfig).toHaveBeenCalledWith({ labelPosition: 'top', labelAlign: 'left' });
  });

  it('keeps the alignment when leaving split without diagonal', () => {
    const props = setup({
      config: makeLayoutConfig({ labelPosition: 'split', labelAlign: 'center' }),
    });
    openTab('Texto');

    fireEvent.press(screen.getByText('Arriba'));

    expect(props.updateConfig).toHaveBeenCalledWith({ labelPosition: 'top' });
  });

  it('reflects the label toggles of the config', () => {
    setup({ config: makeLayoutConfig({ showHex: true, showName: false, showRGB: true }) });
    openTab('Texto');

    expect(screen.UNSAFE_getAllByType(Switch).map((s) => s.props.value)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it.each([
    [0, 'showHex'],
    [1, 'showName'],
    [2, 'showRGB'],
  ] as const)('switch %i toggles %s and records the event', (index, key) => {
    const props = setup({
      config: makeLayoutConfig({ showHex: true, showName: true, showRGB: true }),
    });
    openTab('Texto');

    fireEvent(screen.UNSAFE_getAllByType(Switch)[index], 'valueChange', false);

    expect(props.updateConfig).toHaveBeenCalledWith({ [key]: false });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: key });
  });
});
