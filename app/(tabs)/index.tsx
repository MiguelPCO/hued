import * as Sentry from '@sentry/react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { launchGalleryPicker } from '@/components/capture/GalleryPicker';
import { PaletteGrid } from '@/components/palette/PaletteGrid';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { StripeBar } from '@/components/ui/StripeBar';
import { Text } from '@/components/ui/Text';
import { createCollection, deleteCollection, listCollections, renameCollection } from '@/lib/db/collections';
import { listPalettes } from '@/lib/db/palettes';
import { Colors, Radius, Spacing } from '@/lib/tokens';
import type { Collection } from '@/types/palette';

type Filter = 'all' | 'favorites' | string;

export default function HomeScreen() {
  const [hasPalettes, setHasPalettes] = useState<boolean | null>(null);
  const [picking, setPicking] = useState(false);
  const [galleryDenied, setGalleryDenied] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [manageSheetCollection, setManageSheetCollection] = useState<Collection | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [confirmingDeleteCollection, setConfirmingDeleteCollection] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listPalettes().then((p) => setHasPalettes(p.length > 0)).catch(Sentry.captureException);
      listCollections().then(setCollections).catch(Sentry.captureException);
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

  function openCreateSheet() {
    setNameDraft('');
    setCreateSheetVisible(true);
  }

  async function handleCreateCollection() {
    const trimmed = nameDraft.trim();
    if (trimmed.length === 0) return;
    try {
      const created = await createCollection(trimmed);
      setCollections((prev) => [...prev, created]);
      setCreateSheetVisible(false);
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  function openManageSheet(collection: Collection) {
    setNameDraft(collection.name);
    setManageSheetCollection(collection);
    setRenaming(false);
    setConfirmingDeleteCollection(false);
  }

  async function handleRenameCollection() {
    if (!manageSheetCollection) return;
    const trimmed = nameDraft.trim();
    if (trimmed.length === 0) return;
    try {
      await renameCollection(manageSheetCollection.id, trimmed);
      setCollections((prev) =>
        prev.map((c) => (c.id === manageSheetCollection.id ? { ...c, name: trimmed } : c))
      );
      setManageSheetCollection(null);
      setRenaming(false);
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  async function handleDeleteCollection() {
    if (!manageSheetCollection) return;
    const id = manageSheetCollection.id;
    try {
      await deleteCollection(id);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (filter === id) setFilter('all');
      setManageSheetCollection(null);
    } catch (err) {
      Sentry.captureException(err);
    }
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
      <StripeBar />
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
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
                {collections.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.pill, filter === c.id && styles.pillActive]}
                    onPress={() => setFilter(c.id)}
                    onLongPress={() => openManageSheet(c)}
                  >
                    <Text
                      variant="small"
                      weight={filter === c.id ? 'semibold' : 'regular'}
                      color={filter === c.id ? Colors.accentForeground : Colors.textPrimary}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.pill} onPress={openCreateSheet}>
                  <Text variant="small" color={Colors.textPrimary}>+ Nueva</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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

      <Sheet visible={createSheetVisible} onClose={() => setCreateSheetVisible(false)}>
        <Text variant="label" color={Colors.textSecondary} style={styles.sheetLabel}>NUEVA CARPETA</Text>
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="Nombre de la carpeta"
          placeholderTextColor={Colors.textPlaceholder}
          style={styles.sheetInput}
          autoFocus
          maxLength={40}
        />
        <Button
          label="Crear"
          onPress={handleCreateCollection}
          variant="primary"
          fullWidth
          disabled={nameDraft.trim().length === 0}
        />
      </Sheet>

      <Sheet visible={manageSheetCollection !== null} onClose={() => setManageSheetCollection(null)}>
        {renaming ? (
          <>
            <Text variant="label" color={Colors.textSecondary} style={styles.sheetLabel}>
              RENOMBRAR CARPETA
            </Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholderTextColor={Colors.textPlaceholder}
              style={styles.sheetInput}
              autoFocus
              maxLength={40}
            />
            <Button
              label="Guardar"
              onPress={handleRenameCollection}
              variant="primary"
              fullWidth
              disabled={nameDraft.trim().length === 0}
            />
          </>
        ) : confirmingDeleteCollection ? (
          <View>
            <Text variant="body" style={styles.sheetText}>
              {`¿Eliminar "${manageSheetCollection?.name}"? Las paletas dentro quedarán sin carpeta.`}
            </Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={styles.sheetAction}
                onPress={() => setConfirmingDeleteCollection(false)}
              >
                <Text variant="body">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetAction} onPress={handleDeleteCollection}>
                <Text variant="body" color={Colors.error} weight="semibold">Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.sheetRow} onPress={() => setRenaming(true)}>
              <Text variant="body">Renombrar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => setConfirmingDeleteCollection(true)}
            >
              <Text variant="body" color={Colors.error}>Eliminar</Text>
            </TouchableOpacity>
          </>
        )}
      </Sheet>
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
  pillScroll: { flexGrow: 0 },
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
  sheetLabel: { marginBottom: Spacing.sm },
  sheetInput: {
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  sheetRow: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  sheetText: {
    marginBottom: Spacing.md,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.lg,
  },
  sheetAction: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
});
