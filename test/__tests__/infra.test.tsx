import { render } from '@testing-library/react-native';
import { Group, Rect, Text as SkText } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';

import { makeColors, makePalette } from '@test/factories';
import { capturePanResponders, gesture } from '@test/panResponder';
import { resetRouterMocks, routerMock, searchParamsMock } from '@test/router';
import { findAll, findTexts, treeSignature } from '@test/skiaTree';

describe('test infrastructure', () => {
  it('factories build a complete, internally consistent palette', () => {
    const palette = makePalette();

    expect(palette.colors).toHaveLength(5);
    expect(palette.layoutConfig.paletteSize).toBe(5);
    expect(palette.thumbnailUri).toContain('thumb.jpg');
  });

  it('makeColors returns distinct colors ordered light to dark', () => {
    const colors = makeColors(8);

    expect(new Set(colors.map((c) => c.hex)).size).toBe(8);
    for (let i = 0; i < colors.length - 1; i++) {
      expect(colors[i].hslLightness).toBeGreaterThan(colors[i + 1].hslLightness);
    }
  });

  it('Skia is mocked as inspectable host elements', () => {
    const view = render(
      <Group>
        <Rect x={0} y={0} width={10} height={10} color="#FF0000" />
        <SkText x={1} y={2} text="hola" font={null} color="#000000" />
      </Group>
    );

    expect(findAll(view.toJSON(), 'SkRect')).toHaveLength(1);
    expect(findTexts(view.toJSON())).toEqual(['hola']);
  });

  it('treeSignature ignores the transform prop only', () => {
    const a = { type: 'SkGroup', props: { transform: [{ scale: 1 }], x: 1 }, children: null };
    const b = { type: 'SkGroup', props: { transform: [{ scale: 3 }], x: 1 }, children: null };
    const c = { type: 'SkGroup', props: { transform: [{ scale: 1 }], x: 2 }, children: null };

    expect(treeSignature(a)).toBe(treeSignature(b));
    expect(treeSignature(a)).not.toBe(treeSignature(c));
  });

  it('expo-router is mocked and resettable', () => {
    routerMock.push('/x');
    searchParamsMock.mockReturnValue({ id: 'a' });

    resetRouterMocks();

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(searchParamsMock()).toEqual({});
    expect(routerMock.canDismiss()).toBe(false);
  });

  it('PanResponder.create is captured so handlers can be called directly', () => {
    const { PanResponder } = require('react-native');
    const { configs, restore } = capturePanResponders();
    const onMove = jest.fn();

    PanResponder.create({ onPanResponderMove: onMove });
    configs[0].onPanResponderMove?.({} as never, gesture(5, 7));
    restore();

    expect(onMove).toHaveBeenCalledWith({}, { dx: 5, dy: 7 });
  });

  it('runs in the Europe/Madrid time zone', () => {
    // 22:30 UTC del 4-oct es ya el 5-oct en Madrid (UTC+2)
    expect(new Date('2026-10-04T22:30:00Z').getDate()).toBe(5);
  });

  it('the file system mock exposes both app directories', () => {
    expect(FileSystem.documentDirectory).toBe('file:///documents/');
    expect(FileSystem.cacheDirectory).toBe('file:///cache/');
  });

  it('MMKV memory is shared across module registries and cleared after each test', () => {
    let first!: { set: (k: string, v: string) => void };
    let second!: { getString: (k: string) => string | undefined };
    jest.isolateModules(() => {
      first = require('react-native-mmkv').createMMKV({ id: 'a' });
    });
    jest.isolateModules(() => {
      second = require('react-native-mmkv').createMMKV({ id: 'b' });
    });

    first.set('k', 'v');

    expect(second.getString('k')).toBe('v');
  });

  it('starts each test with an empty MMKV memory', () => {
    expect(globalThis.__HUED_MMKV__?.size ?? 0).toBe(0);
  });
});
