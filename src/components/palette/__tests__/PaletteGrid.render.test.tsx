import { act, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { listPalettes } from '@/lib/db/palettes';
import { makeColor, makePalette } from '@test/factories';
import { PaletteGrid } from '../PaletteGrid';

jest.mock('@/lib/db/palettes', () => ({ listPalettes: jest.fn() }));

let mockCards: Array<Record<string, any>> = [];
jest.mock('../PaletteCard', () => {
  const { createElement } = require('react');
  const { Text } = require('react-native');
  return {
    PaletteCard: (props: Record<string, any>) => {
      mockCards.push(props);
      return createElement(Text, null, `card:${props.palette.id}`);
    },
  };
});

const latest = (id: string) => mockCards.filter((c) => c.palette.id === id).at(-1)!;

const A = makePalette({ id: 'a', colors: [makeColor({ name: 'Rojo' })] });
const B = makePalette({ id: 'b', colors: [makeColor({ name: 'Azul' })], isFavorite: true });

type GridProps = ComponentProps<typeof PaletteGrid>;

function setup(props: Partial<GridProps> = {}) {
  const onPalettesChange = jest.fn();
  const base: GridProps = { onPressPalette: jest.fn(), filter: 'all', query: '', onPalettesChange };
  const view = render(<PaletteGrid {...base} {...props} />);
  const rerenderWith = (next: Partial<GridProps>) => view.rerender(<PaletteGrid {...base} {...props} {...next} />);
  return { onPalettesChange, rerenderWith };
}

beforeEach(() => {
  mockCards = [];
  (listPalettes as jest.Mock).mockReset();
  (listPalettes as jest.Mock).mockResolvedValue([A, B]);
});

describe('PaletteGrid', () => {
  it('shows no cards until the palettes load, then lists them', async () => {
    setup();
    expect(screen.queryByText('card:a')).toBeNull();

    expect(await screen.findByText('card:a')).toBeOnTheScreen();
    expect(screen.getByText('card:b')).toBeOnTheScreen();
  });

  it('loads once on mount and reports the count', async () => {
    const { onPalettesChange } = setup();
    await screen.findByText('card:a');

    expect(listPalettes).toHaveBeenCalledTimes(1);
    expect(onPalettesChange).toHaveBeenCalledWith(2);
  });

  it('filters by the favorites filter', async () => {
    setup({ filter: 'favorites' });

    expect(await screen.findByText('card:b')).toBeOnTheScreen();
    expect(screen.queryByText('card:a')).toBeNull();
  });

  it('filters by the search query over color names', async () => {
    setup({ query: 'rojo' });

    expect(await screen.findByText('card:a')).toBeOnTheScreen();
    expect(screen.queryByText('card:b')).toBeNull();
  });

  it('says so when the filters hide every palette', async () => {
    setup({ query: 'zzz' });

    expect(await screen.findByText('Sin resultados para tu búsqueda')).toBeOnTheScreen();
  });

  it('shows no empty message when there are no palettes at all', async () => {
    (listPalettes as jest.Mock).mockResolvedValue([]);
    const { onPalettesChange } = setup();

    await act(async () => {});

    expect(onPalettesChange).toHaveBeenCalledWith(0);
    expect(screen.queryByText('Sin resultados para tu búsqueda')).toBeNull();
  });

  it('applies a favorite toggle coming from a card', async () => {
    const { rerenderWith } = setup();
    await screen.findByText('card:a');

    act(() => latest('a').onToggleFavorite('a'));
    rerenderWith({ filter: 'favorites' });

    expect(screen.getByText('card:a')).toBeOnTheScreen();
    expect(screen.getByText('card:b')).toBeOnTheScreen();
  });

  it('adds a duplicated palette at the top and reports the new count', async () => {
    const { onPalettesChange } = setup();
    await screen.findByText('card:a');

    act(() => latest('a').onDuplicated(makePalette({ id: 'dup' })));

    expect(await screen.findByText('card:dup')).toBeOnTheScreen();
    expect(onPalettesChange).toHaveBeenLastCalledWith(3);
  });

  it('removes a deleted palette and reports the new count', async () => {
    const { onPalettesChange } = setup();
    await screen.findByText('card:a');

    act(() => latest('a').onDeleted('a'));

    expect(screen.queryByText('card:a')).toBeNull();
    expect(onPalettesChange).toHaveBeenLastCalledWith(1);
  });

  it('moves a palette into a folder filter when its collection changes', async () => {
    const { rerenderWith } = setup();
    await screen.findByText('card:a');
    const onCollectionChanged = latest('a').onCollectionChanged;

    rerenderWith({ filter: 'c1' });
    expect(screen.queryByText('card:a')).toBeNull();

    act(() => onCollectionChanged('a', 'c1'));

    expect(screen.getByText('card:a')).toBeOnTheScreen();
  });
});
