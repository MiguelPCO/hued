import { colorFamily } from '../colorMath';

describe('colorFamily', () => {
  it.each([
    [[10, 10, 10], 'negro'],
    [[250, 250, 250], 'blanco'],
    [[128, 128, 128], 'gris'],
    [[200, 30, 30], 'rojo'],
    [[250, 180, 200], 'rosa'],
    [[240, 120, 20], 'naranja'],
    [[110, 70, 40], 'marrón'],
    [[240, 220, 40], 'amarillo'],
    [[40, 160, 60], 'verde'],
    [[30, 90, 200], 'azul'],
    [[130, 50, 200], 'morado'],
  ])('%j is %s', (rgb, family) => {
    expect(colorFamily(rgb[0], rgb[1], rgb[2])).toBe(family);
  });
});
