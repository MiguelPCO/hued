import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

import { processCapture } from '../processCapture';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/db/client');

import { getDb } from '@/lib/db/client';

const mockManipulate = ImageManipulator.manipulateAsync as jest.MockedFunction<
  typeof ImageManipulator.manipulateAsync
>;
const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;
const mockDb = {
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
};

describe('processCapture', () => {
  let getSizeSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    (getDb as jest.Mock).mockResolvedValue(mockDb);
    getSizeSpy = jest
      .spyOn(Image, 'getSize')
      .mockImplementation((_uri: string, success: (w: number, h: number) => void) => success(1200, 800));
    mockManipulate.mockResolvedValue({ uri: 'file:///thumb-tmp.jpg', width: 200, height: 200 });
  });

  afterEach(() => getSizeSpy.mockRestore());

  it('saves a palette with empty colors and the default layout config', async () => {
    const palette = await processCapture('file:///raw.jpg', 'camera');

    expect(palette.colors).toEqual([]);
    expect(palette.layoutConfig.archetypeId).toBe('pila');
    expect(palette.layoutConfig.fontFamily).toBe('sans');
  });

  it('starts with the look of the Pila base layout for 5 colors', async () => {
    const palette = await processCapture('file:///raw.jpg', 'camera');

    expect(palette.layoutConfig).toMatchObject({
      paletteSize: 5,
      cornerRadius: 16,
      cardOpacity: 100,
      cardWidthScale: 100,
      cardHeightScale: 100,
      gapScale: 100,
      fontSize: 10,
      labelPosition: 'split',
      labelOrder: 'name-first',
      labelAlign: 'left',
      libreSource: 'pila',
    });
  });

  it('records the given source and "original" aspect ratio on the returned palette meta', async () => {
    const palette = await processCapture('file:///raw.jpg', 'gallery');

    expect(palette.meta).toEqual({
      capturedAt: expect.any(Number),
      source: 'gallery',
      aspectRatio: 'original',
    });
  });

  it('copies the (unresized) source image and the generated thumbnail into the palette dir', async () => {
    await processCapture('file:///raw.jpg', 'camera');

    expect(mockFs.copyAsync).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'file:///raw.jpg' })
    );
    expect(mockFs.copyAsync).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'file:///thumb-tmp.jpg' })
    );
  });
});
