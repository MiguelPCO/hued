import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_FULL_SIZE = 2048;
const THUMB_SIZE = 200;

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export async function optimize(uri: string): Promise<string> {
  const { width, height } = await getImageSize(uri);
  const longest = Math.max(width, height);
  if (longest <= MAX_FULL_SIZE) return uri;

  const ratio = MAX_FULL_SIZE / longest;
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: Math.round(width * ratio), height: Math.round(height * ratio) } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function thumbnail(uri: string): Promise<string> {
  const { width, height } = await getImageSize(uri);
  const side = Math.min(width, height);
  const originX = (width - side) / 2;
  const originY = (height - side) / 2;

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [
      { crop: { originX, originY, width: side, height: side } },
      { resize: { width: THUMB_SIZE, height: THUMB_SIZE } },
    ],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}
