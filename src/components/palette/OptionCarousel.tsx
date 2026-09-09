import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { isOptionLocked } from '@/lib/subscription/optionLock';
import { Colors, Radius, Spacing } from '@/lib/tokens';

export interface CarouselOption<T extends string | number> {
  key: T;
  label: string;
  premium?: boolean;
}

interface Props<T extends string | number> {
  options: CarouselOption<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
  onLockedPress?: (key: T) => void;
}

export function OptionCarousel<T extends string | number>({
  options,
  activeKey,
  onSelect,
  onLockedPress,
}: Props<T>) {
  const subscriptionStatus = useSettingsStore((s) => s.subscriptionStatus);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      {options.map((option) => {
        const active = option.key === activeKey;
        const locked = isOptionLocked(option.premium, subscriptionStatus);
        return (
          <TouchableOpacity
            key={String(option.key)}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => (locked ? onLockedPress?.(option.key) : onSelect(option.key))}
          >
            <Text
              variant="small"
              weight={active ? 'semibold' : 'regular'}
              color={active ? Colors.accentForeground : Colors.textPrimary}
            >
              {option.label}
              {locked ? ' 🔒' : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -Spacing.md, paddingHorizontal: Spacing.md },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
    marginRight: Spacing.sm,
  },
  pillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
});
