import { rgbToLab } from './colorMath';

interface NamedColor {
  name: string;
  rgb: [number, number, number];
}

const NAMED_COLORS: NamedColor[] = [
  { name: 'Rojo', rgb: [255, 0, 0] },
  { name: 'Rojo oscuro', rgb: [139, 0, 0] },
  { name: 'Carmesí', rgb: [220, 20, 60] },
  { name: 'Granate', rgb: [128, 0, 0] },
  { name: 'Burdeos', rgb: [128, 0, 32] },
  { name: 'Coral', rgb: [255, 127, 80] },
  { name: 'Salmón', rgb: [250, 128, 114] },
  { name: 'Rosa', rgb: [255, 192, 203] },
  { name: 'Magenta', rgb: [255, 0, 255] },
  { name: 'Naranja', rgb: [255, 165, 0] },
  { name: 'Naranja rojizo', rgb: [255, 69, 0] },
  { name: 'Terracota', rgb: [226, 114, 91] },
  { name: 'Durazno', rgb: [255, 218, 185] },
  { name: 'Melocotón', rgb: [255, 204, 153] },
  { name: 'Amarillo', rgb: [255, 255, 0] },
  { name: 'Dorado', rgb: [255, 215, 0] },
  { name: 'Mostaza', rgb: [255, 219, 88] },
  { name: 'Ocre', rgb: [204, 119, 34] },
  { name: 'Canela', rgb: [210, 105, 30] },
  { name: 'Siena', rgb: [160, 82, 45] },
  { name: 'Marrón', rgb: [165, 42, 42] },
  { name: 'Lima', rgb: [0, 255, 0] },
  { name: 'Verde', rgb: [0, 128, 0] },
  { name: 'Verde oliva', rgb: [107, 142, 35] },
  { name: 'Oliva', rgb: [128, 128, 0] },
  { name: 'Verde menta', rgb: [144, 238, 144] },
  { name: 'Menta', rgb: [152, 255, 152] },
  { name: 'Esmeralda', rgb: [80, 200, 120] },
  { name: 'Verde bosque', rgb: [34, 139, 34] },
  { name: 'Verde azulado', rgb: [0, 128, 128] },
  { name: 'Turquesa', rgb: [64, 224, 208] },
  { name: 'Cian', rgb: [0, 255, 255] },
  { name: 'Celeste', rgb: [178, 255, 255] },
  { name: 'Azul cielo', rgb: [135, 206, 235] },
  { name: 'Azul claro', rgb: [173, 216, 230] },
  { name: 'Azul acero', rgb: [70, 130, 180] },
  { name: 'Azul', rgb: [0, 0, 255] },
  { name: 'Marino', rgb: [0, 0, 128] },
  { name: 'Índigo', rgb: [75, 0, 130] },
  { name: 'Zafiro', rgb: [15, 82, 186] },
  { name: 'Añil', rgb: [75, 0, 130] },
  { name: 'Morado', rgb: [128, 0, 128] },
  { name: 'Violeta', rgb: [238, 130, 238] },
  { name: 'Lavanda', rgb: [230, 230, 250] },
  { name: 'Lila', rgb: [200, 162, 200] },
  { name: 'Vino', rgb: [114, 47, 55] },
  { name: 'Blanco', rgb: [255, 255, 255] },
  { name: 'Crema', rgb: [255, 253, 208] },
  { name: 'Beige', rgb: [245, 245, 220] },
  { name: 'Gris claro', rgb: [211, 211, 211] },
  { name: 'Plateado', rgb: [192, 192, 192] },
  { name: 'Gris', rgb: [128, 128, 128] },
  { name: 'Pizarra', rgb: [112, 128, 144] },
  { name: 'Gris oscuro', rgb: [64, 64, 64] },
  { name: 'Negro', rgb: [0, 0, 0] },
];

let _cache: Array<{ name: string; lab: [number, number, number] }> | null = null;

function getCache() {
  if (!_cache) {
    _cache = NAMED_COLORS.map(({ name, rgb }) => ({
      name,
      lab: rgbToLab(rgb[0], rgb[1], rgb[2]),
    }));
  }
  return _cache;
}

export function findColorName(lab: [number, number, number]): string {
  const cache = getCache();
  let minDist = Infinity;
  let result = 'Desconocido';
  for (const entry of cache) {
    const dist = Math.sqrt(
      (lab[0] - entry.lab[0]) ** 2 +
      (lab[1] - entry.lab[1]) ** 2 +
      (lab[2] - entry.lab[2]) ** 2
    );
    if (dist < minDist) {
      minDist = dist;
      result = entry.name;
    }
  }
  return result;
}
