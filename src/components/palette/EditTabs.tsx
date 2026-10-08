// src/components/palette/EditTabs.tsx
import { useState } from 'react';

import { ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';

import { PILL_CORNER_RADIUS } from '@/components/compose/archetypes/shared';
import { CornerControl } from '@/components/palette/CornerControl';
import { CropTab } from '@/components/palette/CropTab';
import { FontPicker } from '@/components/palette/FontPicker';
import { OptionCarousel } from '@/components/palette/OptionCarousel';
import { PaletteSizeControl } from '@/components/palette/PaletteSizeControl';
import { ValueSlider } from '@/components/palette/ValueSlider';
import { Text } from '@/components/ui/Text';
import { ARCHETYPES } from '@/data/archetypes';
import { trackEvent } from '@/lib/analytics/events';
import { Colors, Spacing } from '@/lib/tokens';
import type {
  ArchetypeId,
  CardStyle,
  ExtractedColor,
  LabelAlign,
  LabelOrder,
  LabelPosition,
  LayoutConfig,
} from '@/types/palette';

type TabKey = 'crop' | 'archetype' | 'colors' | 'cards' | 'font' | 'text';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'crop', label: 'Recorte' },
  { key: 'archetype', label: 'Arquetipo' },
  { key: 'colors', label: 'Colores' },
  { key: 'cards', label: 'Tarjetas' },
  { key: 'font', label: 'Fuente' },
  { key: 'text', label: 'Texto' },
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

const POSITION_OPTIONS: { key: LabelPosition; label: string }[] = [
  { key: 'top', label: 'Arriba' },
  { key: 'center', label: 'Centro' },
  { key: 'bottom', label: 'Abajo' },
  { key: 'split', label: 'Dividido' },
];

const ORDER_OPTIONS: { key: LabelOrder; label: string }[] = [
  { key: 'name-first', label: 'Nombre primero' },
  { key: 'hex-first', label: 'Hex primero' },
];

const ALIGN_OPTIONS: { key: LabelAlign; label: string }[] = [
  { key: 'left', label: 'Izquierda' },
  { key: 'center', label: 'Centro' },
  { key: 'right', label: 'Derecha' },
  { key: 'diagonal', label: 'Diagonal' },
];

const LABEL_TOGGLES: { key: 'showHex' | 'showName' | 'showRGB'; label: string }[] = [
  { key: 'showHex', label: 'Mostrar hex' },
  { key: 'showName', label: 'Mostrar nombre' },
  { key: 'showRGB', label: 'Mostrar RGB' },
];

export type ScaleKey = 'cardWidthScale' | 'cardHeightScale' | 'gapScale';

interface Props {
  paletteId: string;
  imageUri: string;
  config: LayoutConfig;
  updateConfig: (partial: Partial<LayoutConfig>) => void;
  onSelectArchetype: (archetypeId: ArchetypeId) => void;
  onScaleChange: (key: ScaleKey, value: number) => void;
  onImageUpdated: (updates: {
    imageUri: string;
    thumbnailUri: string;
    colors: ExtractedColor[];
  }) => void;
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
  onSelectArchetype,
  onScaleChange,
  onImageUpdated,
  onPaletteSizeChange,
  onResetLibreLayout,
  paletteSizeChanging,
  onLockedPress,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('archetype');
  const isLibre = config.archetypeId === 'libre';

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
                onSelectArchetype(archetypeId);
                trackEvent('archetype_selected', { archetype_id: archetypeId });
              }}
              onLockedPress={onLockedPress}
            />
            {isLibre && (
              <TouchableOpacity
                style={styles.resetLayoutBtn}
                onPress={onResetLibreLayout}
                hitSlop={8}
              >
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

        {activeTab === 'cards' && (
          <ScrollView style={styles.panelScroll} nestedScrollEnabled>
            <Text variant="caption" style={styles.caption}>
              Esquinas
            </Text>
            <CornerControl
              presets={CORNER_OPTIONS}
              value={config.cornerRadius}
              onChange={(cornerRadius) => {
                updateConfig({ cornerRadius });
                trackEvent('config_changed', { config_key: 'cornerRadius' });
              }}
              onLockedPress={onLockedPress}
            />

            <Text variant="caption" style={styles.caption}>
              Estilo
            </Text>
            <OptionCarousel
              options={CARD_STYLE_OPTIONS.filter(
                (opt) => opt.key !== 'blur' || ARCHETYPES[config.archetypeId].supportsBlur,
              )}
              activeKey={config.cardStyle}
              onSelect={(cardStyle) => {
                updateConfig({ cardStyle });
                trackEvent('config_changed', { config_key: 'cardStyle' });
              }}
              onLockedPress={onLockedPress}
            />

            <View style={styles.sliders}>
              <ValueSlider
                label="Opacidad"
                value={config.cardOpacity}
                min={30}
                max={100}
                step={5}
                unit="%"
                onChange={(cardOpacity) => {
                  updateConfig({ cardOpacity });
                  trackEvent('config_changed', { config_key: 'cardOpacity' });
                }}
              />
              <ValueSlider
                label="Ancho"
                value={config.cardWidthScale}
                min={50}
                max={150}
                step={5}
                unit="%"
                onChange={(value) => onScaleChange('cardWidthScale', value)}
              />
              <ValueSlider
                label="Alto"
                value={config.cardHeightScale}
                min={50}
                max={150}
                step={5}
                unit="%"
                onChange={(value) => onScaleChange('cardHeightScale', value)}
              />
              <ValueSlider
                label="Separación"
                value={config.gapScale}
                min={50}
                max={150}
                step={5}
                unit="%"
                disabled={isLibre}
                onChange={(value) => onScaleChange('gapScale', value)}
              />
            </View>
          </ScrollView>
        )}

        {activeTab === 'font' && (
          <FontPicker
            value={config.fontFamily}
            onChange={(fontFamily) => {
              updateConfig({ fontFamily });
              trackEvent('config_changed', { config_key: 'fontFamily' });
            }}
          />
        )}

        {activeTab === 'text' && (
          <ScrollView style={styles.panelScroll} nestedScrollEnabled>
            <ValueSlider
              label="Tamaño"
              value={config.fontSize}
              min={6}
              max={24}
              unit="px"
              stepper
              onChange={(fontSize) => {
                updateConfig({ fontSize });
                trackEvent('config_changed', { config_key: 'fontSize' });
              }}
            />

            <Text variant="caption" style={styles.caption}>
              Posición
            </Text>
            <OptionCarousel
              options={POSITION_OPTIONS}
              activeKey={config.labelPosition}
              onSelect={(labelPosition) => {
                // Diagonal only makes sense with the split position.
                updateConfig({
                  labelPosition,
                  ...(labelPosition !== 'split' && config.labelAlign === 'diagonal'
                    ? { labelAlign: 'left' as const }
                    : {}),
                });
                trackEvent('config_changed', { config_key: 'labelPosition' });
              }}
            />

            <Text variant="caption" style={styles.caption}>
              Orden
            </Text>
            <OptionCarousel
              options={ORDER_OPTIONS}
              activeKey={config.labelOrder}
              onSelect={(labelOrder) => {
                updateConfig({ labelOrder });
                trackEvent('config_changed', { config_key: 'labelOrder' });
              }}
            />

            <Text variant="caption" style={styles.caption}>
              Alineación
            </Text>
            <OptionCarousel
              options={ALIGN_OPTIONS.filter(
                (opt) => opt.key !== 'diagonal' || config.labelPosition === 'split',
              )}
              activeKey={config.labelAlign}
              onSelect={(labelAlign) => {
                updateConfig({ labelAlign });
                trackEvent('config_changed', { config_key: 'labelAlign' });
              }}
            />

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
          </ScrollView>
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
  tabUnderline: {
    marginTop: Spacing.xs,
    height: 2,
    width: '100%',
    backgroundColor: Colors.accent,
  },
  carouselRow: { paddingVertical: Spacing.sm, minHeight: 56 },
  panelScroll: { maxHeight: 200 },
  caption: { paddingHorizontal: Spacing.md, paddingTop: Spacing.xs },
  sliders: { paddingTop: Spacing.sm },
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
