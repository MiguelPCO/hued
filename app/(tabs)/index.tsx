import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { Colors, Spacing } from '@/lib/tokens';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text variant="h1">Hued</Text>
        <Text variant="small" color={Colors.textSecondary}>
          Tus paletas
        </Text>
      </View>
      {/* Sprint 4: PaletteGrid goes here */}
      <View style={styles.emptyState}>
        <Text variant="body" color={Colors.textSecondary}>
          Captura tu primera paleta
        </Text>
      </View>
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
    gap: Spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
