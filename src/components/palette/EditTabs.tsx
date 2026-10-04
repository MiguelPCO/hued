// src/components/palette/EditTabs.tsx
import { ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';

import { CornerControl } from '@/components/palette/CornerControl';
import { CropTab } from '@/components/palette/CropTab';
import { OptionCarousel } from '@/components/palette/OptionCarousel';
import { PaletteSizeControl } from '@/components/palette/PaletteSizeControl';
import { PILL_CORNER_RADIUS } from '@/components/compose/archetypes/shared';
import { Text } from '@/components/ui/Text';
import { ARCHETYPES } from '@/data/archetypes';
import { trackEvent } from '@/lib/analytics/events';
import { Colors, Spacing } from '@/lib/tokens';
import type { CardStyle, ExtractedColor, LayoutConfig } from '@/types/palette';
import { useState } from 'react';

type TabKey = 'crop' | 'archetype' | 'colors' | 'font' | 'corners' | 'cardStyle' | 'labels';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'crop', label: 'Recorte' },
  { key: 'archetype', label: 'Arquetipo' },
  { key: 'colors', label: 'Colores' },
  { key: 'font', label: 'Tipografía' },
  { key: 'corners', label: 'Esquinas' },
  { key: 'cardStyle', label: 'Estilo' },
  { key: 'labels', label: 'Etiquetas' },
];

const FONT_OPTIONS: { key: LayoutConfig['fontFamily']; label: string; premium?: boolean }[] = [
  { key: 'sans', label: 'Moderna' },
  { key: 'serif', label: 'Clásica' },
  { key: 'mono', label: 'Técnica' },
  { key: 'condensed', label: 'Condensada' },
  { key: 'display', label: 'Display' },
];

const CORNER_OPTIONS: { key: number; label: string; premium?: boolean }[] = [
  { key: 0, label: 'Recta' },
  { key: 16, label: 'Redonda' },
  { key: PILL_CORNER_RADIUS, label: 'Píldora' },
];

// "Difuminado" (blur) is filtered out per-archetype below (see
// ArchetypeDefinition.supportsBlur in src/data/archetypes.ts) — it's a
// visual no-op on strip/grid/side, where the blurred backdrop is just the
// same flat swatch color already drawn underneath it.
const CARD_STYLE_OPTIONS: { key: CardStyle; label: string; premium?: boolean }[] = [
  { key: 'filled', label: 'Sólido' },
  { key: 'outlined', label: 'Contorno' },
  { key: 'blur', label: 'Difuminado' },
];

const LABEL_TOGGLES: { key: 'showHex' | 'showName' | 'showRGB'; label: string }[] = [
  { key: 'showHex', label: 'Mostrar hex' },
  { key: 'showName', label: 'Mostrar nombre' },
  { key: 'showRGB', label: 'Mostrar RGB' },
];

interface Props {
  paletteId: string;
  imageUri: string;
  config: LayoutConfig;
  updateConfig: (partial: Partial<LayoutConfig>) => void;
  onImageUpdated: (updates: { imageUri: string; thumbnailUri: string; colors: ExtractedColor[] }) => void;
  onPaletteSizeChange: (paletteSize: number) => void;
  onResetLibreLayout: () => void;
  paletteSizeChanging?: boolean;
  onLockedPress: () => void;
}

export function EditTabs({
  paletteId,
  imageUri,
  config,
  updateConfig,
  onImageUpdated,
  onPaletteSizeChange,
  onResetLibreLayout,
  paletteSizeChanging,
  onLockedPress,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('archetype');

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBarRow}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={styles.tabItem}
              hitSlop={8}
            >
              <Text
                variant="small"
                weight={active ? 'semibold' : 'regular'}
                color={active ? Colors.accent : Colors.textSecondary}
              >
                {tab.label}
              </Text>
              {active && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.carouselRow}>
        {activeTab === 'crop' && (
          <CropTab
            paletteId={paletteId}
            imageUri={imageUri}
            paletteSize={config.paletteSize}
            onImageUpdated={onImageUpdated}
          />
        )}

        {activeTab === 'archetype' && (
          <View>
            <OptionCarousel
              options={Object.values(ARCHETYPES).map((a) => ({
                key: a.id,
                label: a.displayName,
                premium: a.premium,
              }))}
              activeKey={config.archetypeId}
              onSelect={(archetypeId) => {
                updateConfig({ archetypeId });
                trackEvent('archetype_selected', { archetype_id: archetypeId });
              }}
              onLockedPress={onLockedPress}
            />
            {config.archetypeId === 'libre' && (
              <TouchableOpacity style={styles.resetLayoutBtn} onPress={onResetLibreLayout} hitSlop={8}>
                <Text variant="small" weight="semibold" color={Colors.accent}>
                  Restablecer layout
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {activeTab === 'colors' && (
          <PaletteSizeControl
            value={config.paletteSize ?? 5}
            onChange={onPaletteSizeChange}
            disabled={paletteSizeChanging}
          />
        )}

        {activeTab === 'font' && (
          <OptionCarousel
            options={FONT_OPTIONS}
            activeKey={config.fontFamily}
            onSelect={(fontFamily) => {
              updateConfig({ fontFamily });
              trackEvent('config_changed', { config_key: 'fontFamily' });
            }}
            onLockedPress={onLockedPress}
          />
        )}

        {activeTab === 'corners' && (
          <CornerControl
            presets={CORNER_OPTIONS}
            value={config.cornerRadius}
            onChange={(cornerRadius) => {
              updateConfig({ cornerRadius });
              trackEvent('config_changed', { config_key: 'cornerRadius' });
            }}
            onLockedPress={onLockedPress}
          />
        )}

        {activeTab === 'cardStyle' && (
          <OptionCarousel
            options={CARD_STYLE_OPTIONS.filter(
              (opt) => opt.key !== 'blur' || ARCHETYPES[config.archetypeId].supportsBlur
            )}
            activeKey={config.cardStyle}
            onSelect={(cardStyle) => {
              updateConfig({ cardStyle });
              trackEvent('config_changed', { config_key: 'cardStyle' });
            }}
            onLockedPress={onLockedPress}
          />
        )}

        {activeTab === 'labels' && (
          <View style={styles.togglesCol}>
            {LABEL_TOGGLES.map(({ label, key }) => (
              <View key={key} style={styles.toggleRow}>
                <Text variant="body">{label}</Text>
                <Switch
                  value={config[key]}
                  onValueChange={(val) => {
                    updateConfig({ [key]: val });
                    trackEvent('config_changed', { config_key: key });
                  }}
                  trackColor={{ true: Colors.accent }}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, borderTopColor: Colors.borderDefault },
  resetLayoutBtn: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  tabBarRow: { paddingTop: Spacing.sm },
  tabBarContent: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.lg,
  },
  tabItem: { alignItems: 'center', paddingBottom: Spacing.xs },
  tabUnderline: { marginTop: Spacing.xs, height: 2, width: '100%', backgroundColor: Colors.accent },
  carouselRow: { paddingVertical: Spacing.sm, minHeight: 56 },
  togglesCol: { paddingHorizontal: Spacing.md },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
});
