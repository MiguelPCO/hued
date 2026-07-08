import { findColorName } from '../colorNames';
import { rgbToLab } from '../colorMath';

describe('findColorName', () => {
  const cases: Array<{ label: string; rgb: [number, number, number]; expected: string }> = [
    { label: 'pure red', rgb: [255, 0, 0], expected: 'Candy Apple Red' },
    { label: 'pure green', rgb: [0, 255, 0], expected: 'Acid' },
    { label: 'pure blue', rgb: [0, 0, 255], expected: 'Blue' },
    { label: 'black', rgb: [0, 0, 0], expected: 'Asphalt' },
    { label: 'white', rgb: [255, 255, 255], expected: 'Heart of Ice' },
    { label: 'yellow', rgb: [255, 255, 0], expected: 'Banana King' },
    { label: 'cyan', rgb: [0, 255, 255], expected: 'Aggressive Aqua' },
    { label: 'magenta', rgb: [255, 0, 255], expected: 'Magenta' },
    { label: 'orange', rgb: [255, 165, 0], expected: 'Beer' },
    { label: 'purple', rgb: [128, 0, 128], expected: 'Purple' },
    { label: 'pink', rgb: [255, 192, 203], expected: 'Cotton Candy Comet' },
    { label: 'brown', rgb: [139, 69, 19], expected: 'Otterly Brown' },
    { label: 'gray', rgb: [128, 128, 128], expected: 'Aluminium' },
    { label: 'navy', rgb: [0, 0, 128], expected: 'Galactic Cruise' },
    { label: 'teal', rgb: [0, 128, 128], expected: 'Dark Cyan' },
    { label: 'olive', rgb: [128, 128, 0], expected: 'Olive' },
    { label: 'maroon', rgb: [128, 0, 0], expected: 'Maroon' },
    { label: 'lavender', rgb: [230, 230, 250], expected: 'Cloud Break' },
    { label: 'peach', rgb: [255, 218, 185], expected: 'Pandora’s Box' },
    { label: 'mint', rgb: [152, 255, 152], expected: 'Mint to Be' },
  ];

  it.each(cases)('resolves $label ($rgb) to "$expected"', ({ rgb, expected }) => {
    const lab = rgbToLab(rgb[0], rgb[1], rgb[2]);
    expect(findColorName(lab)).toBe(expected);
  });

  it('never falls back to Desconocido for in-gamut colors', () => {
    for (const { rgb } of cases) {
      const lab = rgbToLab(rgb[0], rgb[1], rgb[2]);
      expect(findColorName(lab)).not.toBe('Desconocido');
    }
  });
});
