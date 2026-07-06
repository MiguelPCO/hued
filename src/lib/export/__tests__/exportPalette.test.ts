import * as FileSystem from 'expo-file-system/legacy';
import { drawAsImage } from '@shopify/react-native-skia';

import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import type { Palette } from '@/types/palette';
import { exportPalette, RESOLUTIONS } from '../exportPalette';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@shopify/react-native-skia', () => ({
  drawAsImage: jest.fn().mockResolvedValue({ encodeToBase64: jest.fn().mockReturnValue('base64-png-data') }),
  ImageFormat: { PNG: 4 },
  Group: 'Group',
  RoundedRect: 'RoundedRect',
  rrect: jest.fn(),
  rect: jest.fn(),
}));

const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;
const mockDrawAsImage = drawAsImage as jest.Mock;

const palette: Palette = {
  id: 'p1',
  imageUri: 'file:///documents/palettes/p1/full.jpg',
  thumbnailUri: 'file:///documents/palettes/p1/thumb.jpg',
  colors: [],
  layoutConfig: DEFAULT_LAYOUT_CONFIG,
  meta: { capturedAt: 1000, source: 'camera', aspectRatio: 'original' },
  createdAt: 1000,
  updatedAt: 1000,
  isFavorite: false,
  exportCount: 0,
};

beforeEach(() => jest.clearAllMocks());

describe('RESOLUTIONS', () => {
  it('defines the three export sizes at 4:5 aspect ratio', () => {
    expect(RESOLUTIONS['1x']).toEqual({ width: 1080, height: 1350 });
    expect(RESOLUTIONS['2x']).toEqual({ width: 2160, height: 2700 });
    expect(RESOLUTIONS['4x']).toEqual({ width: 4320, height: 5400 });
  });
});

describe('exportPalette', () => {
  it('calls drawAsImage with the resolution matching the requested size', async () => {
    await exportPalette(palette, DEFAULT_LAYOUT_CONFIG, '2x');
    expect(mockDrawAsImage).toHaveBeenCalledWith(
      expect.anything(),
      { width: 2160, height: 2700 }
    );
  });

  it('writes the encoded base64 PNG to a cache file and returns its URI', async () => {
    const uri = await exportPalette(palette, DEFAULT_LAYOUT_CONFIG, '1x');

    expect(mockFs.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('file:///cache/'),
      'base64-png-data',
      { encoding: 'base64' }
    );
    expect(uri).toEqual(expect.stringContaining('file:///cache/'));
    expect(uri).toMatch(/\.png$/);
  });

  it('throws if cacheDirectory is unavailable', async () => {
    Object.defineProperty(mockFs, 'cacheDirectory', {
      value: null,
      writable: true,
      configurable: true,
    });
    await expect(exportPalette(palette, DEFAULT_LAYOUT_CONFIG, '1x')).rejects.toThrow(
      'FileSystem.cacheDirectory is null'
    );
    Object.defineProperty(mockFs, 'cacheDirectory', {
      value: 'file:///cache/',
      writable: true,
      configurable: true,
    });
  });
});
