import { normalize, paletteMatchesQuery } from '../normalize';

describe('normalize', () => {
  it('lowercases text', () => {
    expect(normalize('ROJO')).toBe('rojo');
  });

  it('strips diacritics', () => {
    expect(normalize('Índigo')).toBe('indigo');
    expect(normalize('Añil')).toBe('anil');
  });
});

describe('paletteMatchesQuery', () => {
  const colorNames = ['Índigo Profundo', 'Coral Suave', 'Azul Marino'];

  it('matches when a color name contains the query, case/accent-insensitive', () => {
    expect(paletteMatchesQuery(colorNames, 'indigo')).toBe(true);
    expect(paletteMatchesQuery(colorNames, 'INDIGO')).toBe(true);
    expect(paletteMatchesQuery(colorNames, 'profundo')).toBe(true);
  });

  it('returns false when no color name contains the query', () => {
    expect(paletteMatchesQuery(colorNames, 'verde')).toBe(false);
  });

  it('returns true for an empty or whitespace-only query', () => {
    expect(paletteMatchesQuery(colorNames, '')).toBe(true);
    expect(paletteMatchesQuery(colorNames, '   ')).toBe(true);
  });

  it('returns false for an empty color list with a non-empty query', () => {
    expect(paletteMatchesQuery([], 'rojo')).toBe(false);
  });
});
