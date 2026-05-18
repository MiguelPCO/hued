import * as Sentry from '@sentry/react-native';
import {
  CameraView as ExpoCameraView,
  CameraType,
  FlashMode,
  useCameraPermissions,
} from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { trackEvent } from '@/lib/analytics/events';
import { Colors, Radius, Spacing } from '@/lib/tokens';

interface Props {
  onCapture: (uri: string) => void;
  onCancel: () => void;
}

export function CameraView({ onCapture, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('auto');
  const [showGrid, setShowGrid] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<ExpoCameraView>(null);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <Text variant="h2" style={styles.centered}>Acceso a la camara</Text>
          <Text variant="body" color={Colors.textSecondary} style={styles.centered}>
            Hued necesita la camara para capturar fotos y crear paletas de colores.
          </Text>
          {permission.canAskAgain ? (
            <Button label="Permitir acceso" onPress={requestPermission} fullWidth />
          ) : (
            <Text variant="small" color={Colors.textSecondary} style={styles.centered}>
              Activa el permiso en Ajustes del dispositivo.
            </Text>
          )}
          <Button label="Cancelar" variant="ghost" onPress={onCancel} fullWidth />
        </View>
      </SafeAreaView>
    );
  }

  async function handleCapture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    trackEvent('capture_started', { source: 'camera' });
    const start = Date.now();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, exif: false });
      trackEvent('capture_completed', { source: 'camera', duration_ms: Date.now() - start });
      onCapture(photo.uri);
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setCapturing(false);
    }
  }

  const FLASH_CYCLE: Record<FlashMode, FlashMode> = { auto: 'on', on: 'off', off: 'auto' };
  const FLASH_LABEL: Record<FlashMode, string> = { auto: 'A', on: 'On', off: 'Off' };

  return (
    <View style={styles.container}>
      <ExpoCameraView ref={cameraRef} style={styles.camera} facing={facing} flash={flash}>
        {showGrid && <GridOverlay />}

        <SafeAreaView style={styles.topBar} edges={['top']}>
          <TouchableOpacity style={styles.iconBtn} onPress={onCancel}>
            <Text style={styles.iconTxt}>X</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setFlash(FLASH_CYCLE[flash])}>
            <Text style={styles.iconTxt}>{FLASH_LABEL[flash]}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowGrid((g) => !g)}>
            <Text style={styles.iconTxt}>{showGrid ? 'Grid On' : 'Grid'}</Text>
          </TouchableOpacity>
        </SafeAreaView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          >
            <Text style={styles.iconTxt}>Flip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shutterRing, capturing && styles.shutterDisabled]}
            onPress={handleCapture}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator color={Colors.bgPrimary} />
            ) : (
              <View style={styles.shutterDot} />
            )}
          </TouchableOpacity>

          <View style={styles.iconBtn} />
        </View>
      </ExpoCameraView>
    </View>
  );
}

function GridOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Horizontal lines at 1/3 and 2/3 */}
      <View style={{ flex: 1, flexDirection: 'column' }}>
        <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)' }} />
        <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)' }} />
        <View style={{ flex: 1 }} />
      </View>
      {/* Vertical lines at 1/3 and 2/3 */}
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
        <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.3)' }} />
        <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.3)' }} />
        <View style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgInverse },
  camera: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { color: Colors.textInverse, fontSize: 18 },
  shutterRing: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    borderWidth: 4,
    borderColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: { opacity: 0.6 },
  shutterDot: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bgElevated,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  centered: { textAlign: 'center' },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.3)' },
  gridH: { left: 0, right: 0, height: 1 },
  gridV: { top: 0, bottom: 0, width: 1 },
});
