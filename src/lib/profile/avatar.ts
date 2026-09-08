// expo-file-system v19 (SDK 54) moved the imperative API to /legacy — same
// convention as src/lib/db/palettes.ts.
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

export type AvatarPickResult =
  | { type: 'picked'; uri: string }
  | { type: 'denied' }
  | { type: 'cancelled' };

export async function pickAvatarFromCamera(): Promise<AvatarPickResult> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return { type: 'denied' };

  const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
  if (result.canceled) return { type: 'cancelled' };
  return { type: 'picked', uri: result.assets[0].uri };
}

export async function pickAvatarFromGallery(): Promise<AvatarPickResult> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return { type: 'denied' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.8,
  });
  if (result.canceled) return { type: 'cancelled' };
  return { type: 'picked', uri: result.assets[0].uri };
}

/**
 * Copies the picked/captured image into app storage (same durability
 * convention as palettes.ts — picker/camera cache URIs aren't guaranteed to
 * survive) and returns a cache-busted URI so <Image> doesn't keep showing
 * the previous avatar from the same fixed filename.
 */
export async function saveAvatar(sourceUri: string): Promise<string> {
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) throw new Error('FileSystem.documentDirectory is null');
  const dir = `${baseDir}profile/`;
  const dest = `${dir}avatar.jpg`;

  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  // Overwriting requires the old file gone first — copyAsync doesn't
  // truncate an existing destination on this platform.
  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) await FileSystem.deleteAsync(dest);
  await FileSystem.copyAsync({ from: sourceUri, to: dest });

  return `${dest}?t=${Date.now()}`;
}
