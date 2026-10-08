// Font catalog for the labels drawn on the palette. The five system fonts are resolved by the
// platform (see FONT_FAMILIES in shared.tsx); the rest are bundled Google Fonts (one regular weight
// each) whose files live in src/lib/fonts/fontModules.ts.

export type SystemFontKey = 'sans' | 'serif' | 'mono' | 'condensed' | 'display';

export type BundledFontKey =
  | 'poppins'
  | 'dm-sans'
  | 'montserrat'
  | 'raleway'
  | 'nunito'
  | 'playfair-display'
  | 'lora'
  | 'cormorant-garamond'
  | 'space-mono'
  | 'jetbrains-mono'
  | 'bebas-neue'
  | 'oswald'
  | 'archivo-black'
  | 'space-grotesk'
  | 'caveat'
  | 'pacifico';

export type FontKey = SystemFontKey | BundledFontKey;

export type FontGroup = 'Sistema' | 'Sans' | 'Serif' | 'Mono' | 'Display' | 'Manuscrita';

export interface FontOption {
  key: FontKey;
  label: string;
  group: FontGroup;
}

export const FONT_OPTIONS: FontOption[] = [
  { key: 'sans', label: 'Moderna', group: 'Sistema' },
  { key: 'serif', label: 'Clásica', group: 'Sistema' },
  { key: 'mono', label: 'Técnica', group: 'Sistema' },
  { key: 'condensed', label: 'Condensada', group: 'Sistema' },
  { key: 'display', label: 'Display', group: 'Sistema' },
  { key: 'poppins', label: 'Poppins', group: 'Sans' },
  { key: 'dm-sans', label: 'DM Sans', group: 'Sans' },
  { key: 'montserrat', label: 'Montserrat', group: 'Sans' },
  { key: 'raleway', label: 'Raleway', group: 'Sans' },
  { key: 'nunito', label: 'Nunito', group: 'Sans' },
  { key: 'playfair-display', label: 'Playfair Display', group: 'Serif' },
  { key: 'lora', label: 'Lora', group: 'Serif' },
  { key: 'cormorant-garamond', label: 'Cormorant Garamond', group: 'Serif' },
  { key: 'space-mono', label: 'Space Mono', group: 'Mono' },
  { key: 'jetbrains-mono', label: 'JetBrains Mono', group: 'Mono' },
  { key: 'bebas-neue', label: 'Bebas Neue', group: 'Display' },
  { key: 'oswald', label: 'Oswald', group: 'Display' },
  { key: 'archivo-black', label: 'Archivo Black', group: 'Display' },
  { key: 'space-grotesk', label: 'Space Grotesk', group: 'Display' },
  { key: 'caveat', label: 'Caveat', group: 'Manuscrita' },
  { key: 'pacifico', label: 'Pacifico', group: 'Manuscrita' },
];

export const FONT_GROUPS: FontGroup[] = [
  'Sistema',
  'Sans',
  'Serif',
  'Mono',
  'Display',
  'Manuscrita',
];

const SYSTEM_FONT_KEYS: readonly string[] = ['sans', 'serif', 'mono', 'condensed', 'display'];

export function isSystemFont(key: string): key is SystemFontKey {
  return SYSTEM_FONT_KEYS.includes(key);
}
