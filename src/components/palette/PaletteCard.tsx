import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Colors, Radius, Shadow, Spacing } from '@/lib/tokens';
import { formatDateEs } from '@/lib/utils/dateUtils';
import type { Palette } from '@/types/palette';

interface Props {
  palette: Palette;
  onPress: (id: string) => void;
}

export function PaletteCard({ palette, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(palette.id)}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri: palette.thumbnailUri }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      <View style={styles.colorStrip}>
        {palette.colors.slice(0, 5).map((color, i) => (
          <View key={i} style={[styles.swatch, { backgroundColor: color.hex }]} />
        ))}
        {palette.colors.length === 0 && (
          <View style={[styles.swatch, styles.swatchEmpty]} />
        )}
      </View>
      <View style={styles.footer}>
        <Text variant="small" color={Colors.textSecondary} numberOfLines={1}>
          {formatDateEs(palette.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: Spacing.xs,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 1,
  },
  colorStrip: {
    flexDirection: 'row',
    height: 20,
  },
  swatch: {
    flex: 1,
  },
  swatchEmpty: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  footer: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
});
