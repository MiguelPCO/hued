// src/components/palette/ColorModePanel.tsx
import { useState } from 'react';

import { ScrollView, StyleSheet, View } from 'react-native';

import { OptionCarousel } from '@/components/palette/OptionCarousel';
import { PaletteSizeControl } from '@/components/palette/PaletteSizeControl';
import { Text } from '@/components/ui/Text';
import { MODE_OPTIONS, type ColorFilter, type ColorMode, type ColorOption } from '@/lib/color/colorModes';
import { Colors, Spacing } from '@/lib/tokens';

const MODES: { key: ColorMode; label: string }[] = [
  { key: 'auto', label: 'Auto' },
  { key: 'temperature', label: 'Temperatura' },
  { key: 'properties', label: 'Propiedades' },
  { key: 'families', label: 'Familias' },
];

interface Props {
  filter: ColorFilter;
  onFilterChange: (filter: ColorFilter) => void;
  paletteSize: number;
  onPaletteSizeChange: (paletteSize: number) => void;
  /** An extraction (size or filter) is in flight — block further changes until it lands. */
  busy?: boolean;
  /** Why the last filter didn't apply, shown under the chips until another option is picked. */
  notice?: string | null;
}

export function ColorModePanel({ filter, onFilterChange, paletteSize, onPaletteSizeChange, busy, notice }: Props) {
  // The mode row can show a mode whose option hasn't been picked yet (nothing is extracted until then).
  const [shownMode, setShownMode] = useState<ColorMode>(filter.mode);
  const options = shownMode === 'auto' ? null : MODE_OPTIONS[shownMode];

  return (
    <ScrollView style={styles.panelScroll} nestedScrollEnabled>
      <OptionCarousel
        options={MODES}
        activeKey={shownMode}
        disabled={busy}
        onSelect={(mode) => {
          setShownMode(mode);
          if (mode === 'auto' && filter.mode !== 'auto') onFilterChange({ mode: 'auto', option: null });
        }}
      />

      {options && (
        <View style={styles.chips}>
          <OptionCarousel
            options={options}
            activeKey={(filter.mode === shownMode ? filter.option : null) as ColorOption}
            disabled={busy}
            onSelect={(option) => onFilterChange({ mode: shownMode, option })}
          />
        </View>
      )}

      {notice ? (
        <Text variant="small" color={Colors.error} style={styles.notice}>
          {notice}
        </Text>
      ) : null}

      <View style={styles.size}>
        <PaletteSizeControl value={paletteSize} onChange={onPaletteSizeChange} disabled={busy} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  panelScroll: { maxHeight: 200 },
  chips: { paddingTop: Spacing.sm },
  notice: { paddingHorizontal: Spacing.md, paddingTop: Spacing.xs },
  size: { paddingTop: Spacing.sm },
});
