import { useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as Sharing from 'expo-sharing';

import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { trackEvent } from '@/lib/analytics/events';
import { exportPalette } from '@/lib/export/exportPalette';
import { listCollections } from '@/lib/db/collections';
import { deletePalette, duplicatePalette, setPaletteCollection, toggleFavorite } from '@/lib/db/palettes';
import { Colors, Radius, Shadow, Spacing } from '@/lib/tokens';
import { formatDateEs } from '@/lib/utils/dateUtils';
import type { Collection, Palette } from '@/types/palette';

interface Props {
  palette: Palette;
  onPress: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onDuplicated: (palette: Palette) => void;
  onDeleted: (id: string) => void;
}

export function PaletteCard({ palette, onPress, onToggleFavorite, onDuplicated, onDeleted }: Props) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [collectionSheetVisible, setCollectionSheetVisible] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);

  function closeSheet() {
    setSheetVisible(false);
    setConfirmingDelete(false);
  }

  async function handleFavoriteTap() {
    onToggleFavorite(palette.id);
    try {
      await toggleFavorite(palette.id);
    } catch (err) {
      onToggleFavorite(palette.id); // revert optimistic update
      Sentry.captureException(err);
    }
  }

  async function handleDuplicate() {
    setBusy(true);
    try {
      const duplicate = await duplicatePalette(palette.id);
      onDuplicated(duplicate);
      closeSheet();
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setBusy(false);
    }
  }

  async function openCollectionSheet() {
    try {
      const list = await listCollections();
      setCollections(list);
      setCollectionSheetVisible(true);
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  async function handleAssignCollection(collectionId: string | null) {
    setBusy(true);
    try {
      await setPaletteCollection(palette.id, collectionId);
      setCollectionSheetVisible(false);
      closeSheet();
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    setBusy(true);
    try {
      const uri = await exportPalette(palette, palette.layoutConfig, '2x');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      }
      closeSheet();
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deletePalette(palette.id);
      trackEvent('palette_deleted', { palette_id: palette.id, source: 'grid' });
      onDeleted(palette.id);
      closeSheet();
    } catch (err) {
      Sentry.captureException(err);
      setBusy(false);
    }
  }

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={() => onPress(palette.id)}
        onLongPress={() => setSheetVisible(true)}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: palette.thumbnailUri }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        <TouchableOpacity style={styles.favoriteButton} onPress={handleFavoriteTap} hitSlop={8}>
          <Icon
            name={palette.isFavorite ? 'favorite' : 'favorite-border'}
            size={18}
            color={palette.isFavorite ? Colors.error : Colors.textInverse}
          />
        </TouchableOpacity>
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

      <Sheet visible={sheetVisible} onClose={closeSheet}>
        {confirmingDelete ? (
          <View>
            <Text variant="body" style={styles.sheetText}>
              ¿Eliminar esta paleta? Esta acción no se puede deshacer.
            </Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity style={styles.sheetAction} onPress={closeSheet} disabled={busy}>
                <Text variant="body">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetAction} onPress={handleDelete} disabled={busy}>
                <Text variant="body" color={Colors.error} weight="semibold">Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            <TouchableOpacity style={styles.sheetRow} onPress={handleFavoriteTap} disabled={busy}>
              <Icon name={palette.isFavorite ? 'favorite' : 'favorite-border'} size={20} />
              <Text variant="body">
                {palette.isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetRow} onPress={handleDuplicate} disabled={busy}>
              <Icon name="content-copy" size={20} />
              <Text variant="body">Duplicar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetRow} onPress={handleShare} disabled={busy}>
              <Icon name="share" size={20} />
              <Text variant="body">Compartir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetRow} onPress={openCollectionSheet} disabled={busy}>
              <Icon name="folder" size={20} />
              <Text variant="body">Mover a carpeta</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => setConfirmingDelete(true)}
              disabled={busy}
            >
              <Icon name="delete" size={20} color={Colors.error} />
              <Text variant="body" color={Colors.error}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}
      </Sheet>

      <Sheet visible={collectionSheetVisible} onClose={() => setCollectionSheetVisible(false)}>
        <TouchableOpacity
          style={styles.sheetRow}
          onPress={() => handleAssignCollection(null)}
          disabled={busy}
        >
          <Text variant="body">Sin carpeta</Text>
        </TouchableOpacity>
        {collections.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={styles.sheetRow}
            onPress={() => handleAssignCollection(c.id)}
            disabled={busy}
          >
            <Text variant="body" weight={palette.collectionId === c.id ? 'semibold' : 'regular'}>
              {c.name}
            </Text>
          </TouchableOpacity>
        ))}
      </Sheet>
    </>
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
  favoriteButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
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
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
});
