import type { ArchetypeId } from '@/types/palette';
import { ARCHETYPES } from '../archetypes';

const IDS: ArchetypeId[] = ['pila', 'mosaico', 'escalonado', 'columnas', 'libre'];

describe('ARCHETYPES registry', () => {
  it('registers exactly the five archetypes', () => {
    expect(Object.keys(ARCHETYPES).sort()).toEqual([...IDS].sort());
  });

  it.each(IDS)('%s has a complete definition', (id) => {
    const def = ARCHETYPES[id];

    expect(def.id).toBe(id);
    expect(def.displayName.length).toBeGreaterThan(0);
    expect(def.description.length).toBeGreaterThan(20);
    expect(typeof def.Component).toBe('function');
  });

  it('display names are unique (they label the carousel pills)', () => {
    const names = IDS.map((id) => ARCHETYPES[id].displayName);

    expect(new Set(names).size).toBe(names.length);
  });

  it('blur is a no-op on every archetype (the backdrop is the flat card itself)', () => {
    expect(IDS.filter((id) => ARCHETYPES[id].supportsBlur)).toEqual([]);
  });

  it('only libre has an interactive edit overlay', () => {
    expect(IDS.filter((id) => ARCHETYPES[id].EditOverlay)).toEqual(['libre']);
  });

  it('the paywall hook is unset everywhere today', () => {
    IDS.forEach((id) => expect(ARCHETYPES[id].premium).toBeUndefined());
  });
});
