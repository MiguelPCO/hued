import * as ImagePicker from 'expo-image-picker';

import { trackEvent } from '@/lib/analytics/events';

export type PickResult =
  | { type: 'picked'; uri: string }
  | { type: 'denied' }
  | { type: 'cancelled' };

export async function launchGalleryPicker(): Promise<PickResult> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status !== 'granted') {
    return { type: 'denied' };
  }

  trackEvent('capture_started', { source: 'gallery' });

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled) {
    trackEvent('capture_cancelled', { source: 'gallery', stage: 'pick' });
    return { type: 'cancelled' };
  }

  trackEvent('capture_completed', { source: 'gallery', duration_ms: 0 });
  return { type: 'picked', uri: result.assets[0].uri };
}
