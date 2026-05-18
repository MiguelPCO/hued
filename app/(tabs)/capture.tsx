import { router } from 'expo-router';

import { CameraView } from '@/components/capture/CameraView';

export default function CaptureScreen() {
  function handleCapture(uri: string) {
    router.push({ pathname: '/crop', params: { uri, source: 'camera' } });
  }

  function handleCancel() {
    router.replace('/(tabs)');
  }

  return <CameraView onCapture={handleCapture} onCancel={handleCancel} />;
}
