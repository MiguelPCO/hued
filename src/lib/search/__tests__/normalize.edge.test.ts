import { normalize, paletteMatchesQuery } from '../normalize';

describe('normalize — edge cases', () => {
  it('strips every Spanish diacritic', () => {
    expect(normalize('ÁÉÍÓÚ áéíóú Ññ Üü')).toBe('aeiou aeiou nn uu');
  });

  it('is idempotent', () => {
    const once = normalize('Índigo Añil');

    expect(normalize(once)).toBe(once);
  });

  it('keeps spaces and punctuation untouched', () => {
    expect(normalize('  Verde-Oliva  ')).toBe('  verde-oliva  ');
  });

  it('handles the empty string', () => {
    expect(normalize('')).toBe('');
  });
});

describe('paletteMatchesQuery — edge cases', () => {
  const names = ['Índigo Profundo', 'Coral Suave'];

  it('matches partial prefixes and accented queries against unaccented names', () => {
    expect(paletteMatchesQuery(names, 'ind')).toBe(true);
    expect(paletteMatchesQuery(['Indigo'], 'ÍNDIGO')).toBe(true);
  });

  it('trims the query but compares names as they are', () => {
    expect(paletteMatchesQuery(names, '  coral  ')).toBe(true);
  });

  it('matches a multi-word query only inside a single color name', () => {
    expect(paletteMatchesQuery(names, 'indigo prof')).toBe(true);
    expect(paletteMatchesQuery(names, 'indigo coral')).toBe(false);
  });

  it('treats an empty palette with an empty query as a match', () => {
    expect(paletteMatchesQuery([], '')).toBe(true);
  });
});
