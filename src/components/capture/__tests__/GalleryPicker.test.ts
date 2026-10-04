import * as ImagePicker from 'expo-image-picker';

import { trackEvent } from '@/lib/analytics/events';
import { launchGalleryPicker } from '../GalleryPicker';

jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const track = trackEvent as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('launchGalleryPicker', () => {
  it('returns denied and records nothing when permission is refused', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);

    await expect(launchGalleryPicker()).resolves.toEqual({ type: 'denied' });

    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('opens an images-only, unedited, full-quality picker and reports start + completion', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///g.jpg' }] } as never);

    await expect(launchGalleryPicker()).resolves.toEqual({ type: 'picked', uri: 'file:///g.jpg' });

    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    expect(track).toHaveBeenNthCalledWith(1, 'capture_started', { source: 'gallery' });
    expect(track).toHaveBeenNthCalledWith(2, 'capture_completed', { source: 'gallery', duration_ms: 0 });
  });

  it('reports a cancelled pick and returns cancelled', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);

    await expect(launchGalleryPicker()).resolves.toEqual({ type: 'cancelled' });

    expect(track).toHaveBeenCalledWith('capture_cancelled', { source: 'gallery', stage: 'pick' });
    expect(track).not.toHaveBeenCalledWith('capture_completed', expect.anything());
  });
});
