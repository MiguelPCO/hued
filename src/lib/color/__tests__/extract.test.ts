import { Skia } from '@shopify/react-native-skia';
import { extractColors, ExtractError, NoMatchError } from '../extract';

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
  it('returns exactly 5 colors by default', async () => {
    const pixels = solidPixels(200, 50, 50, 100);
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(pixels));
    const colors = await extractColors('file:///thumb.jpg');
    expect(colors).toHaveLength(5);
  });

  it('returns paletteSize colors when specified', async () => {
    const pixels = solidPixels(200, 50, 50, 100);
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(pixels));
    const colors3 = await extractColors('file:///thumb.jpg', 3);
    expect(colors3).toHaveLength(3);
    const colors8 = await extractColors('file:///thumb.jpg', 8);
    expect(colors8).toHaveLength(8);
  });

  it('colors are sorted by L-channel descending (light to dark)', async () => {
    const pixels = solidPixels(200, 50, 50, 100);
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(pixels));
    const colors = await extractColors('file:///thumb.jpg');
    for (let i = 0; i < colors.length - 1; i++) {
      expect(colors[i].lab[0]).toBeGreaterThanOrEqual(colors[i + 1].lab[0]);
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

function mixedPixels(parts: [number, number, number, number][]): Uint8Array {
  const total = parts.reduce((n, p) => n + p[3], 0);
  const buf = new Uint8Array(total * 4);
  let o = 0;
  for (const [r, g, b, count] of parts) {
    for (let i = 0; i < count; i++, o += 4) {
      buf[o] = r + (i % 7); buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255;
    }
  }
  return buf;
}

describe('extractColors determinism and filters', () => {
  // Spread of reds, blues and greys, large enough for k-means to have real choices.
  const photo = () => mixedPixels([
    [200, 30, 30, 400], [230, 60, 40, 300], [30, 60, 200, 400], [60, 90, 230, 300], [128, 128, 128, 300],
  ]);

  it('gives the same palette for the same photo every time', async () => {
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(photo(), 40, 50));
    const a = await extractColors('file:///thumb.jpg', 5);
    const b = await extractColors('file:///thumb.jpg', 5);
    expect(a.map((c) => c.hex)).toEqual(b.map((c) => c.hex));
  });

  it('a temperature filter only returns colours from matching pixels', async () => {
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(photo(), 40, 50));
    const colors = await extractColors('file:///thumb.jpg', 3, { mode: 'temperature', option: 'warm' });
    expect(colors.length).toBeGreaterThanOrEqual(3);
    for (const c of colors) expect(c.rgb[0]).toBeGreaterThan(c.rgb[2]); // reds, never the blues
  });

  it('throws NoMatchError when the photo has none of the requested colour', async () => {
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(photo(), 40, 50));
    await expect(
      extractColors('file:///thumb.jpg', 5, { mode: 'families', option: 'green' }),
    ).rejects.toBeInstanceOf(NoMatchError);
  });

  it('fills fewer swatches when the filtered pool has few distinct colours', async () => {
    const px = mixedPixels([[200, 30, 30, 5000], [30, 60, 200, 100]]); // reds vary by 7 shades only
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(makeMockImage(px, 100, 51));
    const colors = await extractColors('file:///thumb.jpg', 8, { mode: 'temperature', option: 'warm' });
    expect(colors.length).toBeLessThan(8);
    expect(colors.length).toBeGreaterThanOrEqual(3);
  });
});
