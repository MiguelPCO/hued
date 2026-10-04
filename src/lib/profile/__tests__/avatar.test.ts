import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { pickAvatarFromCamera, pickAvatarFromGallery, saveAvatar } from '../avatar';

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const fs = FileSystem as jest.Mocked<typeof FileSystem>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('pickAvatarFromCamera', () => {
  it('returns denied without opening the camera when permission is refused', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);

    await expect(pickAvatarFromCamera()).resolves.toEqual({ type: 'denied' });
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('returns cancelled when the user closes the camera', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null } as never);

    await expect(pickAvatarFromCamera()).resolves.toEqual({ type: 'cancelled' });
  });

  it('returns the captured uri without editing and with 0.8 quality', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cam.jpg' }] } as never);

    await expect(pickAvatarFromCamera()).resolves.toEqual({ type: 'picked', uri: 'file:///cam.jpg' });
    expect(picker.launchCameraAsync).toHaveBeenCalledWith({ allowsEditing: false, quality: 0.8 });
  });
});

describe('pickAvatarFromGallery', () => {
  it('returns denied without opening the library when permission is refused', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);

    await expect(pickAvatarFromGallery()).resolves.toEqual({ type: 'denied' });
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('returns cancelled when the user leaves the library', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);

    await expect(pickAvatarFromGallery()).resolves.toEqual({ type: 'cancelled' });
  });

  it('returns only images, unedited, with 0.8 quality', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///pic.jpg' }] } as never);

    await expect(pickAvatarFromGallery()).resolves.toEqual({ type: 'picked', uri: 'file:///pic.jpg' });
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
  });
});

describe('saveAvatar', () => {
  const dest = 'file:///documents/profile/avatar.jpg';

  it('copies into the profile folder and cache-busts the returned uri', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1234);
    fs.getInfoAsync.mockResolvedValueOnce({ exists: false } as never);

    const uri = await saveAvatar('file:///tmp/new.jpg');

    expect(fs.makeDirectoryAsync).toHaveBeenCalledWith('file:///documents/profile/', { intermediates: true });
    expect(fs.copyAsync).toHaveBeenCalledWith({ from: 'file:///tmp/new.jpg', to: dest });
    expect(uri).toBe(`${dest}?t=1234`);
    expect(fs.deleteAsync).not.toHaveBeenCalled();
  });

  it('deletes the previous avatar first because copyAsync does not overwrite', async () => {
    fs.getInfoAsync.mockResolvedValueOnce({ exists: true } as never);

    await saveAvatar('file:///tmp/new.jpg');

    expect(fs.deleteAsync).toHaveBeenCalledWith(dest);
    expect(fs.deleteAsync.mock.invocationCallOrder[0]).toBeLessThan(fs.copyAsync.mock.invocationCallOrder[0]);
  });

  it('produces a different uri on every save so <Image> refreshes', async () => {
    const now = jest.spyOn(Date, 'now');
    fs.getInfoAsync.mockResolvedValue({ exists: false } as never);

    now.mockReturnValueOnce(1);
    const first = await saveAvatar('file:///a.jpg');
    now.mockReturnValueOnce(2);
    const second = await saveAvatar('file:///a.jpg');

    expect(first).not.toBe(second);
  });

  it('propagates a failed copy so the caller can report it', async () => {
    fs.getInfoAsync.mockResolvedValueOnce({ exists: false } as never);
    fs.copyAsync.mockRejectedValueOnce(new Error('no space'));

    await expect(saveAvatar('file:///a.jpg')).rejects.toThrow('no space');
  });

  it('throws when the document directory is unavailable', async () => {
    // The module under test already holds the global mock, and jest's mock registry
    // wins over a doMock factory until it is reset; reload avatar against a null dir.
    jest.resetModules();
    jest.doMock('expo-file-system/legacy', () => ({ documentDirectory: null }));
    const { saveAvatar: saveWithoutDir } = require('../avatar');

    await expect(saveWithoutDir('file:///a.jpg')).rejects.toThrow('FileSystem.documentDirectory is null');

    jest.dontMock('expo-file-system/legacy');
  });
});
