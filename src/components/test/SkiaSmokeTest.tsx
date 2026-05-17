import { Canvas, Circle, Fill, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const W = 300;
const H = 300;

export function SkiaSmokeTest() {
  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        <Fill>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(W, H)}
            colors={['#2A4A7F', '#A8B5C8']}
          />
        </Fill>
        <Circle cx={W / 2} cy={100} r={60} color="rgba(255,255,255,0.3)" />
        <Rect x={60} y={190} width={W - 120} height={80} color="rgba(255,255,255,0.2)" />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 16 },
  canvas: { width: W, height: H },
});
