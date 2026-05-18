// Design tokens — OKLCH-based, three layers: Primitive → Semantic → Component
// React Native uses hex/rgb; OKLCH values documented in comments for reference

// ─── Primitive ────────────────────────────────────────────────────────────────

export const Primitive = {
  // Neutrals (oklch chroma=0, perceptually uniform grays)
  white: '#FFFFFF',      // oklch(1 0 0)
  black: '#000000',      // oklch(0 0 0)
  gray50: '#FAFAFA',     // oklch(0.985 0 0)
  gray100: '#F5F5F5',    // oklch(0.967 0 0)
  gray200: '#EBEBEB',    // oklch(0.922 0 0)
  gray300: '#D4D4D4',    // oklch(0.86 0 0)
  gray400: '#A3A3A3',    // oklch(0.72 0 0)
  gray500: '#737373',    // oklch(0.556 0 0)
  gray600: '#525252',    // oklch(0.44 0 0)
  gray700: '#404040',    // oklch(0.35 0 0)
  gray800: '#262626',    // oklch(0.269 0 0)
  gray900: '#171717',    // oklch(0.205 0 0)
  gray950: '#0A0A0A',    // oklch(0.145 0 0)

  // Accent — editorial deep ink blue
  accent100: '#E8ECF0',  // oklch(0.94 0.02 252)
  accent200: '#C5D0DC',  // oklch(0.85 0.04 252)
  accent500: '#4A6FA5',  // oklch(0.52 0.09 252)
  accent700: '#2A4A7F',  // oklch(0.38 0.10 252)
  accent900: '#1A2E50',  // oklch(0.25 0.07 252)

  // Status
  red500: '#EF4444',
  green500: '#22C55E',
} as const;

// ─── Semantic ─────────────────────────────────────────────────────────────────

export const Colors = {
  bgPrimary: Primitive.gray50,
  bgSecondary: Primitive.gray100,
  bgElevated: Primitive.white,
  bgInverse: Primitive.gray950,

  textPrimary: Primitive.gray950,
  textSecondary: Primitive.gray600,
  textTertiary: Primitive.gray400,
  textInverse: Primitive.white,
  textPlaceholder: Primitive.gray400,

  borderDefault: Primitive.gray200,
  borderStrong: Primitive.gray300,

  accent: Primitive.accent700,
  accentForeground: Primitive.white,
  accentSubtle: Primitive.accent100,

  error: Primitive.red500,
  errorBg: '#FEF2F2',
  success: Primitive.green500,

  // Palette canvas background — pure white so photos pop
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
  display: 'InstrumentSerif',
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
    shadowColor: Primitive.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: Primitive.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: Primitive.black,
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
