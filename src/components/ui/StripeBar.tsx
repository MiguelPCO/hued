import { StyleSheet, View } from 'react-native';

import { Primitive } from '@/lib/tokens';

const BANDS = [Primitive.brown800, Primitive.red500, Primitive.orange500, Primitive.amber400];

export function StripeBar() {
  return (
    <View style={styles.row}>
      {BANDS.map((color) => (
        <View key={color} style={[styles.band, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', height: 4 },
  band: { flex: 1 },
});
