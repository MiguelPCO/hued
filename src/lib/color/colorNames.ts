import namedColors from '@/data/named-colors.json';

interface NamedColor {
  name: string;
  rgb: [number, number, number];
  lab: [number, number, number];
}

const NAMED_COLORS = namedColors as NamedColor[];

export function findColorName(lab: [number, number, number]): string {
  let minDist = Infinity;
  let result = 'Desconocido';
  for (const entry of NAMED_COLORS) {
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
