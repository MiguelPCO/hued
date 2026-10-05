import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useImage } from '@shopify/react-native-skia';
import { Dimensions, Pressable, StyleSheet } from 'react-native';

import { LibreEditOverlay } from '@/components/compose/LibreEditOverlay';
import { useSettingsStore } from '@/lib/store/settingsStore';
import type { ArchetypeId, LayoutConfig } from '@/types/palette';
import { makeColors, makeLayoutConfig, makePalette } from '@test/factories';
import { findAll, findTexts } from '@test/skiaTree';
import { getWatermarkTapRegion } from '../archetypes/Watermark';
import { generateScatterLayout } from '../archetypes/freeformLayout';
import { ArchetypeCanvas, CANVAS_H, CANVAS_W } from '../ArchetypeCanvas';

// RN 0.86 exports Pressable as React.memo: the instances in the tree match its inner `.type`.
const PressableInner = (Pressable as unknown as { type: typeof Pressable }).type;

const palette = makePalette({ colors: makeColors(5) });

function setWindow(width: number) {
  act(() => {
    Dimensions.set({
      window: { width, height: 800, scale: 1, fontScale: 1 },
      screen: { width, height: 800, scale: 1, fontScale: 1 },
    });
  });
}

function mount(config: Partial<LayoutConfig> = {}, props: Record<string, unknown> = {}) {
  const full = makeLayoutConfig(config);
  const view = render(<ArchetypeCanvas palette={palette} config={full} {...props} />);
  return { view, json: view.toJSON(), config: full };
}

const styleOf = (node: { props: Record<string, unknown> }) =>
  StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

beforeEach(() => {
  useSettingsStore.setState({ subscriptionStatus: 'free' });
  setWindow(360);
});

describe('ArchetypeCanvas — sizing', () => {
  it('exposes the 360x450 design canvas', () => {
    expect([CANVAS_W, CANVAS_H]).toEqual([360, 450]);
  });

  it('scales to the screen width', () => {
    setWindow(720);
    const { json } = mount();

    const [outer] = findAll(json, 'View');
    expect(styleOf(outer)).toMatchObject({ width: 720, height: 900 });
    expect(findAll(json, 'SkGroup')[0].props.transform).toEqual([{ scale: 2 }]);
  });

  it('never exceeds maxHeight: the smaller scale wins', () => {
    setWindow(720);
    const { json } = mount({}, { maxHeight: 450 });

    const [outer] = findAll(json, 'View');
    expect(styleOf(outer)).toMatchObject({ width: 360, height: 450 });
    expect(findAll(json, 'SkGroup')[0].props.transform).toEqual([{ scale: 1 }]);
  });

  it('keeps the width scale when maxHeight is generous', () => {
    setWindow(360);
    const { json } = mount({}, { maxHeight: 2000 });

    expect(findAll(json, 'SkGroup')[0].props.transform).toEqual([{ scale: 1 }]);
  });
});

describe('ArchetypeCanvas — content', () => {
  it('loads the photo from the palette image uri', () => {
    (useImage as jest.Mock).mockClear(); // module-level mock is not auto-cleared
    mount();

    expect(useImage).toHaveBeenCalledWith(palette.imageUri);
  });

  it('draws the loaded photo through the archetype', () => {
    (useImage as jest.Mock).mockReturnValueOnce({});
    const { json } = mount({ archetypeId: 'strip' });

    expect(findAll(json, 'SkImage')).toHaveLength(1);
  });

  it.each([
    ['strip', 315],
    ['side', 450],
  ] as [ArchetypeId, number][])('dispatches to the %s archetype by id', (archetypeId, photoHeight) => {
    const { json } = mount({ archetypeId });

    const photo = findAll(json, 'SkRect').find((r) => r.props.color === '#E5E5E5')!;
    expect(photo.props.height).toBe(photoHeight);
  });

  it('clips the card with the configured corner radius', () => {
    const { json } = mount({ cornerRadius: 24 });

    const clipped = findAll(json, 'SkGroup').find((g) => g.props.clip)!;
    expect(clipped.props.clip).toEqual({ rect: { x: 0, y: 0, width: 360, height: 450 }, rx: 24, ry: 24 });
  });

  it('draws an inset 2px white outline for the outlined card style', () => {
    const { json } = mount({ archetypeId: 'strip', cardStyle: 'outlined', cornerRadius: 12 });

    const outline = findAll(json, 'SkRoundedRect')[0];
    expect(outline.props).toMatchObject({
      x: 1, y: 1, width: 358, height: 448, r: 12, strokeWidth: 2, style: 'stroke', color: '#FFFFFF',
    });
  });

  it('draws no outline for the filled card style', () => {
    const { json } = mount({ archetypeId: 'strip', cardStyle: 'filled' });

    expect(findAll(json, 'SkRoundedRect')).toHaveLength(0);
  });
});

describe('ArchetypeCanvas — watermark', () => {
  it.each([
    ['free', false, true],
    ['free', true, true],
    ['premium', false, false],
    ['premium', true, true],
  ] as const)('%s user with watermarkVisible=%s: shown=%s', (status, preference, shown) => {
    useSettingsStore.setState({ subscriptionStatus: status });
    const { json } = mount({ watermarkVisible: preference });

    expect(findTexts(json).includes('hued')).toBe(shown);
  });

  it('makes the watermark tappable for free users and reports the tap', () => {
    const onWatermarkPress = jest.fn();
    mount({}, { onWatermarkPress });

    const target = screen.UNSAFE_getByType(PressableInner);
    fireEvent.press(target);

    expect(onWatermarkPress).toHaveBeenCalledTimes(1);
  });

  it('positions the tap target over the mark, in screen scale', () => {
    setWindow(720);
    mount({}, { onWatermarkPress: jest.fn() });

    const region = getWatermarkTapRegion(360, 450);
    const style = StyleSheet.flatten(screen.UNSAFE_getByType(PressableInner).props.style);

    expect(style).toMatchObject({
      left: region.x * 2, top: region.y * 2, width: region.width * 2, height: region.height * 2,
    });
  });

  it('has no tap target for premium users, even with the watermark on', () => {
    useSettingsStore.setState({ subscriptionStatus: 'premium' });
    mount({ watermarkVisible: true }, { onWatermarkPress: jest.fn() });

    expect(screen.UNSAFE_queryByType(PressableInner)).toBeNull();
  });

  it('has no tap target when no handler is given (read-only render)', () => {
    mount();

    expect(screen.UNSAFE_queryByType(PressableInner)).toBeNull();
  });
});

describe('ArchetypeCanvas — libre edit overlay', () => {
  const scatter = generateScatterLayout(5, 360, 450);

  it('shows the drag handles on the edit screen (handler present, swatches generated)', () => {
    mount({ archetypeId: 'libre', freeformSwatches: scatter }, { onLibreSwatchesChange: jest.fn() });

    expect(screen.UNSAFE_queryByType(LibreEditOverlay)).not.toBeNull();
  });

  it('hides the handlers in read-only renders (no handler)', () => {
    mount({ archetypeId: 'libre', freeformSwatches: scatter });

    expect(screen.UNSAFE_queryByType(LibreEditOverlay)).toBeNull();
  });

  it('hides the handlers until the swatches match the colors (just after a palette-size change)', () => {
    mount({ archetypeId: 'libre', freeformSwatches: [] }, { onLibreSwatchesChange: jest.fn() });

    expect(screen.UNSAFE_queryByType(LibreEditOverlay)).toBeNull();
  });

  it('never shows handles for the other archetypes', () => {
    mount({ archetypeId: 'grid', freeformSwatches: scatter }, { onLibreSwatchesChange: jest.fn() });

    expect(screen.UNSAFE_queryByType(LibreEditOverlay)).toBeNull();
  });
});
