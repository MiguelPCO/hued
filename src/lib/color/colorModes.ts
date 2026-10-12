import { rgbToHsl } from './colorMath';

export type RGB = [number, number, number];

/** `manual` = a swatch was replaced with the eyedropper; it filters nothing and the next extraction returns to auto. */
export type ColorMode = 'auto' | 'manual' | 'temperature' | 'properties' | 'families';

export type ColorOption =
  | 'warm' | 'cold' | 'neutral'
  | 'vivid' | 'light' | 'dark' | 'muted'
  | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'pastel' | 'earth';

export const MODE_OPTIONS: Record<Exclude<ColorMode, 'auto' | 'manual'>, { key: ColorOption; label: string }[]> = {
  temperature: [
    { key: 'warm', label: 'Cálidos' },
    { key: 'cold', label: 'Fríos' },
    { key: 'neutral', label: 'Neutros' },
  ],
  properties: [
    { key: 'vivid', label: 'Más vivos' },
    { key: 'light', label: 'Más claros' },
    { key: 'dark', label: 'Más oscuros' },
    { key: 'muted', label: 'Apagados' },
  ],
  families: [
    { key: 'red', label: 'Rojos' },
    { key: 'orange', label: 'Naranjas' },
    { key: 'yellow', label: 'Amarillos' },
    { key: 'green', label: 'Verdes' },
    { key: 'blue', label: 'Azules' },
    { key: 'violet', label: 'Violetas' },
    { key: 'pastel', label: 'Pasteles' },
    { key: 'earth', label: 'Tierra' },
    { key: 'neutral', label: 'Neutros' },
  ],
};

export interface ColorFilter {
  mode: ColorMode;
  option: ColorOption | null;
}

// First-pass thresholds, tuned by eye — hue in degrees, saturation/lightness 0-1 (HSL). Adjust here
// after trying real photos; nothing else hardcodes these numbers.
export const T = {
  // A pixel is "neutral" (grey/white/black) when it barely has a hue, or is so dark/bright that hue is noise.
  neutralSatMax: 0.12,
  neutralLightMin: 0.08,
  neutralLightMax: 0.95,

  warmHueMax: 70,
  warmHueMin: 330,
  coldHueMin: 150,
  coldHueMax: 270,

  vividSatMin: 0.6,
  vividLightMin: 0.25,
  vividLightMax: 0.75,
  lightMin: 0.75,
  darkMax: 0.25,
  mutedSatMax: 0.4,
  mutedLightMin: 0.2,
  mutedLightMax: 0.8,

  // Hue bands for the six families, [from, to) in degrees. Red wraps around 0.
  redFrom: 345, redTo: 15,
  orangeTo: 45,
  yellowTo: 70,
  greenTo: 165,
  blueTo: 260,
  // violet: blueTo .. redFrom (includes magentas and pinks)

  pastelLightMin: 0.7,
  earthHueMin: 10, earthHueMax: 50, earthSatMin: 0.2, earthSatMax: 0.75, earthLightMin: 0.1, earthLightMax: 0.6,
  oliveHueMin: 50, oliveHueMax: 100, oliveSatMin: 0.15, oliveSatMax: 0.6, oliveLightMin: 0.12, oliveLightMax: 0.5,

  /** Fewer matching samples than this share of the photo → the photo "doesn't have" that colour. */
  minMatchFraction: 0.02,
  /** Layouts need at least this many swatches. */
  minSwatches: 3,
} as const;

const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;

function isNeutral(s: number, l: number): boolean {
  return s < T.neutralSatMax || l < T.neutralLightMin || l > T.neutralLightMax;
}

const MATCHERS: Record<ColorOption, (h: number, s: number, l: number) => boolean> = {
  neutral: (_h, s, l) => isNeutral(s, l),
  warm: (h, s, l) => !isNeutral(s, l) && (h <= T.warmHueMax || h >= T.warmHueMin),
  cold: (h, s, l) => !isNeutral(s, l) && between(h, T.coldHueMin, T.coldHueMax),

  vivid: (_h, s, l) => s >= T.vividSatMin && between(l, T.vividLightMin, T.vividLightMax),
  light: (_h, _s, l) => l >= T.lightMin,
  dark: (_h, _s, l) => l <= T.darkMax,
  muted: (_h, s, l) => between(s, T.neutralSatMax, T.mutedSatMax) && between(l, T.mutedLightMin, T.mutedLightMax),

  red: (h, s, l) => !isNeutral(s, l) && (h >= T.redFrom || h < T.redTo),
  orange: (h, s, l) => !isNeutral(s, l) && h >= T.redTo && h < T.orangeTo,
  yellow: (h, s, l) => !isNeutral(s, l) && h >= T.orangeTo && h < T.yellowTo,
  green: (h, s, l) => !isNeutral(s, l) && h >= T.yellowTo && h < T.greenTo,
  blue: (h, s, l) => !isNeutral(s, l) && h >= T.greenTo && h < T.blueTo,
  violet: (h, s, l) => !isNeutral(s, l) && h >= T.blueTo && h < T.redFrom,
  pastel: (_h, s, l) => !isNeutral(s, l) && l >= T.pastelLightMin,
  earth: (h, s, l) =>
    (between(h, T.earthHueMin, T.earthHueMax) && between(s, T.earthSatMin, T.earthSatMax) && between(l, T.earthLightMin, T.earthLightMax)) ||
    (between(h, T.oliveHueMin, T.oliveHueMax) && between(s, T.oliveSatMin, T.oliveSatMax) && between(l, T.oliveLightMin, T.oliveLightMax)),
};

export function matchesFilter([r, g, b]: RGB, { mode, option }: ColorFilter): boolean {
  if (mode === 'auto' || mode === 'manual' || !option) return true;
  const [h, s, l] = rgbToHsl(r, g, b);
  return MATCHERS[option](h, s, l);
}

/**
 * Keeps only the samples that fit the filter. Returns null when the photo doesn't really contain
 * that kind of colour (too few matches), so callers can leave the palette alone and say so.
 */
export function filterSamples(samples: RGB[], filter: ColorFilter, k: number): RGB[] | null {
  if (filter.mode === 'auto' || filter.mode === 'manual' || !filter.option) return samples;
  const kept = samples.filter((rgb) => matchesFilter(rgb, filter));
  if (kept.length < Math.max(k, T.minSwatches, Math.ceil(samples.length * T.minMatchFraction))) return null;
  return kept;
}

/** How many swatches a filtered pool can honestly fill: never more than its distinct colours. */
export function distinctCount(samples: RGB[], cap: number): number {
  const seen = new Set<number>();
  for (const [r, g, b] of samples) {
    seen.add((r << 16) | (g << 8) | b);
    if (seen.size >= cap) return cap;
  }
  return seen.size;
}

export function optionLabel(mode: ColorMode, option: ColorOption | null): string {
  if (mode === 'auto' || mode === 'manual' || !option) return mode === 'manual' ? 'Manual' : 'Auto';
  return MODE_OPTIONS[mode].find((o) => o.key === option)?.label ?? option;
}
