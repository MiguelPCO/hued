import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

import { optimize, thumbnail } from '../image';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

const mockManipulate = ImageManipulator.manipulateAsync as jest.MockedFunction<
  typeof ImageManipulator.manipulateAsync
>;

describe('optimize', () => {
  let getSizeSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    getSizeSpy = jest.spyOn(Image, 'getSize');
  });

  afterEach(() => {
    getSizeSpy.mockRestore();
  });

  it('returns original URI when longest edge ≤ 2048', async () => {
    getSizeSpy.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(1200, 800)
    );

    const result = await optimize('file:///test.jpg');

    expect(result).toBe('file:///test.jpg');
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('resizes when longest edge > 2048', async () => {
    getSizeSpy.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(4096, 3072)
    );
    mockManipulate.mockResolvedValue({ uri: 'file:///optimized.jpg', width: 2048, height: 1536 });

    const result = await optimize('file:///large.jpg');

    expect(mockManipulate).toHaveBeenCalledWith(
      'file:///large.jpg',
      [{ resize: { width: 2048, height: 1536 } }],
      { compress: 0.85, format: 'jpeg' }
    );
    expect(result).toBe('file:///optimized.jpg');
  });
});

describe('thumbnail', () => {
  let getSizeSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    getSizeSpy = jest.spyOn(Image, 'getSize');
  });

  afterEach(() => {
    getSizeSpy.mockRestore();
  });

  it('center-crops to square then resizes to 200×200 (landscape)', async () => {
    getSizeSpy.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(400, 300)
    );
    mockManipulate.mockResolvedValue({ uri: 'file:///thumb.jpg', width: 200, height: 200 });

    const result = await thumbnail('file:///source.jpg');

    expect(mockManipulate).toHaveBeenCalledWith(
      'file:///source.jpg',
      [
        { crop: { originX: 50, originY: 0, width: 300, height: 300 } },
        { resize: { width: 200, height: 200 } },
      ],
      { compress: 0.7, format: 'jpeg' }
    );
    expect(result).toBe('file:///thumb.jpg');
  });

  it('center-crops to square then resizes to 200×200 (portrait)', async () => {
    getSizeSpy.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(300, 400)
    );
    mockManipulate.mockResolvedValue({ uri: 'file:///thumb.jpg', width: 200, height: 200 });

    await thumbnail('file:///portrait.jpg');

    expect(mockManipulate).toHaveBeenCalledWith(
      'file:///portrait.jpg',
      [
        { crop: { originX: 0, originY: 50, width: 300, height: 300 } },
        { resize: { width: 200, height: 200 } },
      ],
      { compress: 0.7, format: 'jpeg' }
    );
  });
});
