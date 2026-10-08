// Skia reemplazado por elementos host con prefijo `Sk` para poder inspeccionar
// el árbol que producen los arquetipos sin cargar CanvasKit (WASM).
// Los nombres no chocan con los de React Native (`Text`, `Image`).
// A font whose text width is a fixed fraction of its size, so label fitting is deterministic.
const mockFont = (size: number) => ({
  __font: true,
  size,
  getTextWidth: (text: string) => text.length * size * 0.5,
});

export const skiaMock = {
  Canvas: 'SkCanvas',
  Group: 'SkGroup',
  Rect: 'SkRect',
  RoundedRect: 'SkRoundedRect',
  Circle: 'SkCircle',
  Text: 'SkText',
  Image: 'SkImage',
  BackdropBlur: 'SkBackdropBlur',
  LinearGradient: 'SkLinearGradient',
  vec: jest.fn((x: number, y: number) => ({ x, y })),
  rect: jest.fn((x: number, y: number, width: number, height: number) => ({ x, y, width, height })),
  rrect: jest.fn((r: unknown, rx: number, ry: number) => ({ rect: r, rx, ry })),
  matchFont: jest.fn((style?: { fontSize?: number }) => mockFont(style?.fontSize ?? 14)),
  useImage: jest.fn(() => null),
  drawAsImage: jest.fn(() => Promise.resolve({ encodeToBase64: jest.fn(() => 'base64-png') })),
  ImageFormat: { PNG: 4 },
  ColorType: { RGBA_8888: 4 },
  AlphaType: { Unpremul: 2 },
  Skia: {
    Data: {
      fromURI: jest.fn(() => Promise.resolve({})),
      fromBytes: jest.fn((bytes: Uint8Array) => ({ _bytes: bytes })),
    },
    Image: { MakeImageFromEncoded: jest.fn(() => null) },
    Font: jest.fn((_typeface: unknown, size: number) => mockFont(size)),
    Typeface: { MakeFreeTypeFaceFromData: jest.fn(() => ({ __typeface: true })) },
  },
};
