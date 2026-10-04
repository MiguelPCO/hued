import { Skia } from '@shopify/react-native-skia';

import { extractColors, ExtractError } from '../extract';

const makeImage = (pixels: Uint8Array) => ({
  width: () => 10,
  height: () => 10,
  readPixels: jest.fn().mockReturnValue(pixels),
});

function solid(r: number, g: number, b: number, count: number, alpha = 255): Uint8Array {
  const buf = new Uint8Array(count * 4);
  for (let i = 0; i < count * 4; i += 4) {
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = alpha;
  }
  return buf;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  parts.forEach((p) => {
    out.set(p, offset);
    offset += p.length;
  });
  return out;
}

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;
const decode = Skia.Image.MakeImageFromEncoded as jest.Mock;

function useImage(pixels: Uint8Array) {
  decode.mockReturnValue(makeImage(pixels));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)) });
});

describe('extractColors — images with real structure', () => {
  it('separates a two-tone image into its two colors with equal weight', async () => {
    useImage(concat(solid(255, 0, 0, 400), solid(0, 0, 255, 400)));

    const colors = await extractColors('file:///t.jpg', 2);

    expect(colors.map((c) => c.hex)).toEqual(['#FF0000', '#0000FF']); // claro → oscuro
    colors.forEach((c) => expect(c.weight).toBeCloseTo(0.5, 5));
  });

  it('ignores transparent pixels', async () => {
    useImage(concat(solid(10, 200, 30, 400), solid(255, 0, 0, 400, 0)));

    const colors = await extractColors('file:///t.jpg', 2);

    colors.forEach((c) => expect(c.hex).toBe('#0AC81E'));
  });

  it('reads the thumbnail it was given', async () => {
    useImage(solid(1, 2, 3, 400));

    await extractColors('file:///the-thumb.jpg', 3);

    expect(mockFetch).toHaveBeenCalledWith('file:///the-thumb.jpg');
  });
});

describe('extractColors — degenerate inputs', () => {
  it('rejects a fully transparent image with an ExtractError', async () => {
    useImage(solid(0, 0, 0, 400, 0));

    await expect(extractColors('file:///t.jpg')).rejects.toThrow(ExtractError);
    await expect(extractColors('file:///t.jpg')).rejects.toThrow('Too few opaque pixels: 0');
  });

  it('rejects an image with fewer sampled pixels than colors requested', async () => {
    useImage(solid(1, 2, 3, 4)); // 4 píxeles → 1 muestra (se muestrea 1 de cada 4)

    await expect(extractColors('file:///t.jpg', 5)).rejects.toThrow('Too few opaque pixels: 1');
  });

  it('still returns paletteSize entries when the image has fewer distinct colors', async () => {
    useImage(concat(solid(255, 0, 0, 400), solid(0, 255, 0, 400), solid(0, 0, 255, 400)));

    const colors = await extractColors('file:///t.jpg', 8);

    expect(colors).toHaveLength(8);
    expect(colors.reduce((sum, c) => sum + c.weight, 0)).toBeCloseTo(1, 5);
  });
});

describe('extractColors — output consistency', () => {
  it('every hex matches its own rgb', async () => {
    useImage(concat(solid(200, 30, 90, 400), solid(20, 180, 220, 400)));

    const colors = await extractColors('file:///t.jpg', 5);

    colors.forEach((c) => {
      expect(parseInt(c.hex.slice(1), 16)).toBe((c.rgb[0] << 16) | (c.rgb[1] << 8) | c.rgb[2]);
    });
  });

  it('weights are never negative and never exceed 1', async () => {
    useImage(concat(solid(200, 30, 90, 600), solid(20, 180, 220, 200)));

    const colors = await extractColors('file:///t.jpg', 4);

    colors.forEach((c) => {
      expect(c.weight).toBeGreaterThanOrEqual(0);
      expect(c.weight).toBeLessThanOrEqual(1);
    });
  });
});
