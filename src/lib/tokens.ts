// Design tokens — OKLCH-based, three layers: Primitive → Semantic → Component
// React Native uses hex/rgb; OKLCH values documented in comments for reference

// ─── Primitive ────────────────────────────────────────────────────────────────

export const Primitive = {
  // Neutrals — warm cream scale (Modern Nostalgia / Kodak Stripe), not chroma-0 grays
  white: '#FFFFFF',
  black: '#000000',
  cream50: '#FFFDF8',    // near-white, warmest tint
  cream100: '#FFF6E8',   // elevated surfaces (cards, sheets)
  cream200: '#FDDCA9',   // base background — reference palette
  cream300: '#F0DDBE',   // borders/dividers on cream
  cream400: '#D8B48A',   // muted text on dark surfaces
  brown500: '#8A6F5C',   // tertiary text, tab bar inactive
  brown700: '#6B4E3D',   // secondary text
  brown800: '#562717',   // primary ink — reference palette
  brown900: '#3A1A0F',   // inverse background (dark surfaces)
  brown950: '#241109',   // deepest surface (bottom sheets on dark)

  // Accent — Kodak Stripe trio, reference palette
  red500: '#C21717',     // primary CTA
  orange500: '#E76219',  // secondary accent, icons, large text only (AA fails <18px)
  amber400: '#FEA712',   // highlight chips/badges (pair with brown800 text)

  // Status (kept distinct from brand accents to avoid semantic collision)
  error500: '#DC2626',
  success500: '#16A34A',
} as const;

// ─── Semantic ─────────────────────────────────────────────────────────────────

export const Colors = {
  bgPrimary: Primitive.cream200,
  bgSecondary: Primitive.cream100,
  bgElevated: Primitive.cream50,
  bgInverse: Primitive.brown900,

  textPrimary: Primitive.brown800,     // 9.42:1 on bgPrimary (AAA)
  textSecondary: Primitive.brown700,
  textTertiary: Primitive.brown500,
  textInverse: Primitive.cream200,
  textPlaceholder: Primitive.brown500,

  borderDefault: Primitive.cream300,
  borderStrong: Primitive.cream400,

  accent: Primitive.red500,            // 6.12:1 white-on-accent (AA)
  accentForeground: Primitive.white,
  accentSubtle: Primitive.amber400,    // pair with textPrimary only — 6.34:1

  // orange500 is decorative/icon accent only: 3.41:1 w/white, 3.63:1 w/brown800 —
  // fails AA for text under ~18.7px bold / 24px regular, fine for large type or fills
  accentSecondary: Primitive.orange500,

  error: Primitive.error500,
  errorBg: '#FEF2F2',
  success: Primitive.success500,

  // Palette canvas background — pure white so photos pop (unchanged, non-negotiable)
  canvasBg: Primitive.white,
} as const;

// ─── Spacing (4pt grid) ───────────────────────────────────────────────────────

export const Spacing = {
  px: 1,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
  '4xl': 96,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const FontFamily = {
  sans: 'Outfit',
  display: 'Fraunces',
  displayItalic: 'Fraunces-Italic',
  mono: 'JetBrainsMono',
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

export const LineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// ─── Radius ───────────────────────────────────────────────────────────────────

export const Radius = {
  sharp: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  pill: 999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const Shadow = {
  sm: {
    shadowColor: Primitive.brown800,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: Primitive.brown800,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: Primitive.brown800,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// ─── Animation ────────────────────────────────────────────────────────────────

export const Duration = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;
