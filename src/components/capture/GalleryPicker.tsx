import * as ImagePicker from 'expo-image-picker';

import { trackEvent } from '@/lib/analytics/events';

interface PickResult {
  uri: string;
}

export async function launchGalleryPicker(): Promise<PickResult | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status !== 'granted') {
    return null;
  }

  trackEvent('capture_started', { source: 'gallery' });

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled) {
    trackEvent('capture_cancelled', { source: 'gallery', stage: 'pick' });
    return null;
  }

  trackEvent('capture_completed', { source: 'gallery', duration_ms: 0 });
  return { uri: result.assets[0].uri };
}
