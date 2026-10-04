import type { ArchetypeId } from '@/types/palette';
import { ARCHETYPES } from '../archetypes';

const IDS: ArchetypeId[] = ['strip', 'editorial', 'grid', 'banner', 'side', 'libre'];
const FONTS = ['sans', 'serif', 'mono', 'condensed', 'display'];

describe('ARCHETYPES registry', () => {
  it('registers exactly the six archetypes', () => {
    expect(Object.keys(ARCHETYPES).sort()).toEqual([...IDS].sort());
  });

  it.each(IDS)('%s has a complete definition', (id) => {
    const def = ARCHETYPES[id];

    expect(def.id).toBe(id);
    expect(def.displayName.length).toBeGreaterThan(0);
    expect(def.description.length).toBeGreaterThan(20);
    expect(typeof def.Component).toBe('function');
    expect(FONTS).toContain(def.defaultConfig.fontFamily);
  });

  it('display names are unique (they label the carousel pills)', () => {
    const names = IDS.map((id) => ARCHETYPES[id].displayName);

    expect(new Set(names).size).toBe(names.length);
  });

  it('only editorial and banner show a visible blur effect', () => {
    expect(IDS.filter((id) => ARCHETYPES[id].supportsBlur).sort()).toEqual(['banner', 'editorial']);
  });

  it('only libre has an interactive edit overlay', () => {
    expect(IDS.filter((id) => ARCHETYPES[id].EditOverlay)).toEqual(['libre']);
  });

  it('the paywall hook is unset everywhere today', () => {
    IDS.forEach((id) => expect(ARCHETYPES[id].premium).toBeUndefined());
  });
});
