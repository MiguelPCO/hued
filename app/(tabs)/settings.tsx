import { router } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { StripeBar } from '@/components/ui/StripeBar';
import { Text } from '@/components/ui/Text';
import { pickAvatarFromCamera, pickAvatarFromGallery, saveAvatar } from '@/lib/profile/avatar';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { Colors, Radius, Spacing } from '@/lib/tokens';

function formatExpiration(expiresAt: number | null): string {
  if (expiresAt === null) return 'De por vida';
  return new Date(expiresAt).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function SettingsScreen() {
  const subscriptionStatus = useSettingsStore((s) => s.subscriptionStatus);
  const subscriptionExpiresAt = useSettingsStore((s) => s.subscriptionExpiresAt);
  const profileName = useSettingsStore((s) => s.profileName);
  const profilePhotoUri = useSettingsStore((s) => s.profilePhotoUri);
  const setProfileName = useSettingsStore((s) => s.setProfileName);
  const setProfilePhotoUri = useSettingsStore((s) => s.setProfilePhotoUri);

  const [photoSheetVisible, setPhotoSheetVisible] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [nameSheetVisible, setNameSheetVisible] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  async function handlePickAvatar(source: 'camera' | 'gallery') {
    setPhotoSheetVisible(false);
    setAvatarBusy(true);
    try {
      const result = source === 'camera' ? await pickAvatarFromCamera() : await pickAvatarFromGallery();
      if (result.type === 'picked') {
        const uri = await saveAvatar(result.uri);
        setProfilePhotoUri(uri);
      }
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setAvatarBusy(false);
    }
  }

  function openNameEditor() {
    setNameDraft(profileName ?? '');
    setNameSheetVisible(true);
  }

  function handleSaveName() {
    const trimmed = nameDraft.trim();
    setProfileName(trimmed.length > 0 ? trimmed : null);
    setNameSheetVisible(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StripeBar />
      <View style={styles.header}>
        <Text variant="h1">Ajustes</Text>
      </View>

      <View style={styles.profileRow}>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => setPhotoSheetVisible(true)}
          disabled={avatarBusy}
        >
          {avatarBusy ? (
            <ActivityIndicator color={Colors.textSecondary} />
          ) : profilePhotoUri ? (
            <Image source={{ uri: profilePhotoUri }} style={styles.avatarImage} />
          ) : (
            <Icon name="image" size={28} color={Colors.textTertiary} />
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={openNameEditor} style={styles.nameTouch}>
          <Text variant="h3" color={profileName ? Colors.textPrimary : Colors.textTertiary}>
            {profileName ?? 'Añadir nombre'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        {subscriptionStatus === 'premium' ? (
          <View style={styles.proCard}>
            <Text variant="label" color={Colors.textPrimary}>HUED PRO</Text>
            <Text variant="body" color={Colors.textPrimary}>
              {formatExpiration(subscriptionExpiresAt)}
            </Text>
          </View>
        ) : (
          <Button
            label="Mejorar a Pro"
            onPress={() => router.push({ pathname: '/paywall', params: { trigger: 'settings' } })}
            variant="primary"
            fullWidth
          />
        )}
      </View>

      <Sheet visible={photoSheetVisible} onClose={() => setPhotoSheetVisible(false)}>
        <TouchableOpacity style={styles.sheetRow} onPress={() => handlePickAvatar('camera')}>
          <Icon name="camera-alt" size={20} />
          <Text variant="body">Cámara</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetRow} onPress={() => handlePickAvatar('gallery')}>
          <Icon name="image" size={20} />
          <Text variant="body">Galería</Text>
        </TouchableOpacity>
      </Sheet>

      <Sheet visible={nameSheetVisible} onClose={() => setNameSheetVisible(false)}>
        <Text variant="label" color={Colors.textSecondary} style={styles.nameLabel}>NOMBRE</Text>
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="Tu nombre"
          placeholderTextColor={Colors.textPlaceholder}
          style={styles.nameInput}
          autoFocus
          maxLength={40}
        />
        <Button label="Guardar" onPress={handleSaveName} variant="primary" fullWidth />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  nameTouch: { flex: 1 },
  section: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  proCard: {
    backgroundColor: Colors.accentSubtle,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  nameLabel: { marginBottom: Spacing.sm },
  nameInput: {
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
});
