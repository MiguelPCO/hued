import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkiaSmokeTest } from '@/components/test/SkiaSmokeTest';
import { Text } from '@/components/ui/Text';
import { Colors, Spacing } from '@/lib/tokens';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <View style={styles.header}>
          <Text variant="h1">Hued</Text>
          <Text variant="small" color={Colors.textSecondary}>
            Tus paletas
          </Text>
        </View>
        {/* Sprint 0 Day 3: Skia smoke test — remove when Sprint 4 PaletteGrid lands */}
        <SkiaSmokeTest />
      </ScrollView>
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
