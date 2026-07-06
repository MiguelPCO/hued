import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { PaletteCard } from './PaletteCard';
import { Colors, Radius, Spacing } from '@/lib/tokens';
import { listPalettes } from '@/lib/db/palettes';
import { paletteMatchesQuery } from '@/lib/search/normalize';
import type { Palette } from '@/types/palette';

interface Props {
  onPressPalette: (id: string) => void;
  filter: 'all' | 'favorites';
  query: string;
}

function SkeletonCard() {
  return <View style={styles.skeleton} />;
}

export function PaletteGrid({ onPressPalette, filter, query }: Props) {
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await listPalettes();
    setPalettes(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggleFavorite = useCallback((id: string) => {
    setPalettes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isFavorite: !p.isFavorite } : p))
    );
  }, []);

  const handleDuplicated = useCallback((duplicate: Palette) => {
    setPalettes((prev) => [duplicate, ...prev]);
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setPalettes((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const visible = useMemo(() => {
    return palettes
      .filter((p) => filter === 'all' || p.isFavorite)
      .filter((p) => paletteMatchesQuery(p.colors.map((c) => c.name), query));
  }, [palettes, filter, query]);

  if (loading) {
    return (
      <View style={styles.grid}>
        {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
      </View>
    );
  }

  return (
    <FlatList
      data={visible}
      keyExtractor={(p) => p.id}
      numColumns={2}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <PaletteCard
          palette={item}
          onPress={onPressPalette}
          onToggleFavorite={handleToggleFavorite}
          onDuplicated={handleDuplicated}
          onDeleted={handleDeleted}
        />
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
