import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { PaletteCard } from './PaletteCard';
import { Text } from '@/components/ui/Text';
import { Colors, Radius, Spacing } from '@/lib/tokens';
import { listPalettes } from '@/lib/db/palettes';
import { paletteMatchesQuery } from '@/lib/search/normalize';
import type { Palette } from '@/types/palette';

interface Props {
  onPressPalette: (id: string) => void;
  filter: 'all' | 'favorites';
  query: string;
  onPalettesChange?: (count: number) => void;
}

function SkeletonCard() {
  return <View style={styles.skeleton} />;
}

export function PaletteGrid({ onPressPalette, filter, query, onPalettesChange }: Props) {
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await listPalettes();
    setPalettes(data);
    setLoading(false);
    onPalettesChange?.(data.length);
  }, [onPalettesChange]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggleFavorite = useCallback((id: string) => {
    setPalettes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isFavorite: !p.isFavorite } : p))
    );
  }, []);

  const handleDuplicated = useCallback((duplicate: Palette) => {
    setPalettes((prev) => {
      const next = [duplicate, ...prev];
      onPalettesChange?.(next.length);
      return next;
    });
  }, [onPalettesChange]);

  const handleDeleted = useCallback((id: string) => {
    setPalettes((prev) => {
      const next = prev.filter((p) => p.id !== id);
      onPalettesChange?.(next.length);
      return next;
    });
  }, [onPalettesChange]);

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
      ListEmptyComponent={
        palettes.length > 0 ? (
          <View style={styles.emptyState}>
            <Text variant="body" color={Colors.textSecondary} style={styles.centered}>
              Sin resultados para tu búsqueda
            </Text>
          </View>
        ) : null
      }
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    minHeight: 200,
  },
  centered: { textAlign: 'center' },
});
