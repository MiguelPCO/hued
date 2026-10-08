// src/components/palette/FontPicker.tsx
import { Text as RNText, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { FONT_GROUPS, FONT_OPTIONS, isSystemFont } from '@/data/fonts';
import type { FontKey } from '@/data/fonts';
import { Colors, Radius, Spacing } from '@/lib/tokens';

interface Props {
  value: FontKey;
  onChange: (key: FontKey) => void;
}

// Scrolling list grouped by family type; every name is written in its own font. The bundled fonts
// are registered with expo-font under their catalog key (app/_layout.tsx); the system ones keep the
// default face.
export function FontPicker({ value, onChange }: Props) {
  return (
    <ScrollView style={styles.scroll} nestedScrollEnabled showsVerticalScrollIndicator>
      {FONT_GROUPS.map((group) => (
        <View key={group}>
          <Text variant="caption" color={Colors.textSecondary} style={styles.groupTitle}>
            {group}
          </Text>
          {FONT_OPTIONS.filter((font) => font.group === group).map((font) => {
            const active = font.key === value;
            return (
              <TouchableOpacity
                key={font.key}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => onChange(font.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <RNText
                  style={[
                    styles.sample,
                    !isSystemFont(font.key) && { fontFamily: font.key },
                    active && styles.sampleActive,
                  ]}
                >
                  {font.label}
                </RNText>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 180 },
  groupTitle: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  row: {
    marginHorizontal: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  rowActive: { backgroundColor: Colors.accent },
  sample: { fontSize: 18, color: Colors.textPrimary },
  sampleActive: { color: Colors.accentForeground },
});
