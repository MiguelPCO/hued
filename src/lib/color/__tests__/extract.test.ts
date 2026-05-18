import { Skia, ColorType, AlphaType } from '@shopify/react-native-skia';
import { extractColors, ExtractError } from '../extract';

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: { fromBytes: jest.fn((b: Uint8Array) => ({ _bytes: b })) },
    Image: { MakeImageFromEncoded: jest.fn() },
  },
  ColorType: { RGBA_8888: 4 },
  AlphaType: { Unpremul: 2 },
}));

function makeMockImage(pixels: Uint8Array, w = 10, h = 10) {
  return {
    width: () => w,
    height: () => h,
    readPixels: jest.fn().mockReturnValue(pixels),
  };
}

function solidPixels(r: number, g: number, b: number, count: number): Uint8Array {
  const buf = new Uint8Array(count * 4);
  for (let i = 0; i < count * 4; i += 4) {
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
  }
  return buf;
}

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)) });
});

describe('extractColors', () => {
  it('returns exactly 5 colors', async () => {
    const pixels = solidPixels(200, 50, 50, 100);
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(pixels));
    const colors = await extractColors('file:///thumb.jpg');
    expect(colors).toHaveLength(5);
  });

  it('colors are sorted by weight descending', async () => {
    const pixels = solidPixels(200, 50, 50, 100);
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(pixels));
    const colors = await extractColors('file:///thumb.jpg');
    for (let i = 0; i < colors.length - 1; i++) {
      expect(colors[i].weight).toBeGreaterThanOrEqual(colors[i + 1].weight);
    }
  });

  it('all colors have valid hex format', async () => {
    const pixels = solidPixels(100, 150, 200, 100);
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(pixels));
    const colors = await extractColors('file:///thumb.jpg');
    for (const c of colors) {
      expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('weights sum to approximately 1', async () => {
    const pixels = solidPixels(80, 120, 200, 100);
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(pixels));
    const colors = await extractColors('file:///thumb.jpg');
    const total = colors.reduce((s, c) => s + c.weight, 0);
    expect(total).toBeCloseTo(1, 1);
  });

  it('throws ExtractError when Skia cannot decode image', async () => {
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(null);
    await expect(extractColors('file:///bad.jpg')).rejects.toThrow(ExtractError);
  });

  it('throws ExtractError when readPixels returns null', async () => {
    const mockImage = { width: () => 10, height: () => 10, readPixels: jest.fn().mockReturnValue(null) };
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(mockImage);
    await expect(extractColors('file:///bad.jpg')).rejects.toThrow(ExtractError);
  });

  it('each color has rgb, lab, name, hslLightness fields', async () => {
    const pixels = solidPixels(200, 100, 50, 100);
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(pixels));
    const colors = await extractColors('file:///thumb.jpg');
    for (const c of colors) {
      expect(c.rgb).toHaveLength(3);
      expect(c.lab).toHaveLength(3);
      expect(typeof c.name).toBe('string');
      expect(c.hslLightness).toBeGreaterThanOrEqual(0);
      expect(c.hslLightness).toBeLessThanOrEqual(1);
    }
  });
});
