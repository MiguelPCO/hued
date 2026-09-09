import * as Sentry from '@sentry/react-native';
import { router } from 'expo-router';

import { CameraView } from '@/components/capture/CameraView';
import { processCapture } from '@/lib/capture/processCapture';

export default function CaptureScreen() {
  async function handleCapture(uri: string) {
    try {
      const palette = await processCapture(uri, 'camera');
      router.replace({ pathname: '/palette/[id]', params: { id: palette.id } });
    } catch (err) {
      Sentry.captureException(err);
      router.replace({ pathname: '/(tabs)', params: { captureFailed: '1' } });
    }
  }

  function handleCancel() {
    router.replace('/(tabs)');
  }

  return <CameraView onCapture={handleCapture} onCancel={handleCancel} />;
}
