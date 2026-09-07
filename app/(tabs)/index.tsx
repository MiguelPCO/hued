import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { launchGalleryPicker } from '@/components/capture/GalleryPicker';
import { PaletteGrid } from '@/components/palette/PaletteGrid';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { listPalettes } from '@/lib/db/palettes';
import { Colors, Radius, Spacing } from '@/lib/tokens';

type Filter = 'all' | 'favorites';

export default function HomeScreen() {
  const [hasPalettes, setHasPalettes] = useState<boolean | null>(null);
  const [picking, setPicking] = useState(false);
  const [galleryDenied, setGalleryDenied] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      listPalettes().then((p) => setHasPalettes(p.length > 0));
    }, [])
  );

  const handlePressPalette = useCallback((id: string) => {
    router.push({ pathname: '/palette/[id]', params: { id } });
  }, []);

  const handlePalettesChange = useCallback((count: number) => setHasPalettes(count > 0), []);

  async function handleGallery() {
    if (picking) return;
    setPicking(true);
    setGalleryDenied(false);
    try {
      const result = await launchGalleryPicker();
      if (result.type === 'picked') {
        router.push({ pathname: '/crop', params: { uri: result.uri, source: 'gallery' } });
      } else if (result.type === 'denied') {
        setGalleryDenied(true);
      }
    } finally {
      setPicking(false);
    }
  }

  function handleCamera() {
    router.push('/(tabs)/capture');
  }

  if (hasPalettes === null) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingBox]}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text variant="h1">Hued</Text>
        <Text variant="small" color={Colors.textSecondary}>Tus paletas</Text>
      </View>

      {hasPalettes ? (
        <>
          <View style={styles.toolbar}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por color..."
              placeholderTextColor={Colors.textPlaceholder}
              style={styles.searchInput}
            />
            <View style={styles.pillRow}>
              {(['all', 'favorites'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.pill, filter === f && styles.pillActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text
                    variant="small"
                    weight={filter === f ? 'semibold' : 'regular'}
                    color={filter === f ? Colors.accentForeground : Colors.textPrimary}
                  >
                    {f === 'all' ? 'Todas' : 'Favoritas'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <PaletteGrid
            onPressPalette={handlePressPalette}
            filter={filter}
            query={query}
            onPalettesChange={handlePalettesChange}
          />
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text variant="h3" style={styles.centered}>Sin paletas todavía</Text>
          <Text variant="body" color={Colors.textSecondary} style={styles.centered}>
            Captura una foto o elige de tu galería para crear tu primera paleta.
          </Text>
          <View style={styles.emptyActions}>
            <View style={styles.actionItem}>
              <Button label="Cámara" onPress={handleCamera} variant="primary" fullWidth />
            </View>
            <View style={styles.actionItem}>
              {picking ? (
                <View style={styles.loadingBtn}>
                  <ActivityIndicator size="small" color={Colors.accent} />
                  <Text variant="small" color={Colors.textSecondary}>Abriendo...</Text>
                </View>
              ) : (
                <Button label="Galería" onPress={handleGallery} variant="secondary" fullWidth />
              )}
            </View>
          </View>
          {galleryDenied && (
            <Text variant="small" color={Colors.textSecondary} style={styles.centered}>
              Activa el permiso de galería en Ajustes del dispositivo.
            </Text>
          )}
        </View>
      )}

      {hasPalettes && (
        <TouchableOpacity
          style={styles.galleryFab}
          onPress={handleGallery}
          activeOpacity={0.85}
          disabled={picking}
        >
          {picking ? (
            <ActivityIndicator size="small" color={Colors.textPrimary} />
          ) : (
            <Icon name="image" size={22} color={Colors.textPrimary} />
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.fab} onPress={handleCamera} activeOpacity={0.85}>
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  loadingBox: { alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  toolbar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    height: 40,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
  },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
  },
  pillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  centered: { textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  actionItem: { flex: 1 },
  loadingBtn: {
    height: 48,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabPlus: {
    color: Colors.accentForeground,
    fontSize: 28,
    lineHeight: 32,
  },
  galleryFab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg + 56 + Spacing.sm,
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
