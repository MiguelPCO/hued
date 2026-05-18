import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { PaletteCard } from './PaletteCard';
import { Colors, Radius, Spacing } from '@/lib/tokens';
import { listPalettes } from '@/lib/db/palettes';
import type { Palette } from '@/types/palette';

interface Props {
  onPressPalette: (id: string) => void;
}

function SkeletonCard() {
  return <View style={styles.skeleton} />;
}

export function PaletteGrid({ onPressPalette }: Props) {
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await listPalettes();
    setPalettes(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.grid}>
        {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
      </View>
    );
  }

  return (
    <FlatList
      data={palettes}
      keyExtractor={(p) => p.id}
      numColumns={2}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <PaletteCard palette={item} onPress={onPressPalette} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.xs },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.xs,
  },
  skeleton: {
    flex: 1,
    margin: Spacing.xs,
    aspectRatio: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgSecondary,
  },
});
