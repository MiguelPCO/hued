import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import { shouldRenderWatermark, wrapMetadataInBlur } from '../shared';

jest.mock('@shopify/react-native-skia', () => ({
  BackdropBlur: 'BackdropBlur',
  matchFont: jest.fn(),
  RoundedRect: 'RoundedRect',
  rect: jest.fn((x: number, y: number, width: number, height: number) => ({ x, y, width, height })),
  rrect: jest.fn((r: unknown) => r),
}));

describe('wrapMetadataInBlur', () => {
  const region = { x: 10, y: 20, width: 30, height: 40 };

  it('returns the node unchanged when cardStyle is not "blur"', () => {
    const node = 'metadata-node';

    expect(wrapMetadataInBlur({ ...DEFAULT_LAYOUT_CONFIG, cardStyle: 'filled' }, node, region)).toBe(
      node
    );
    expect(wrapMetadataInBlur({ ...DEFAULT_LAYOUT_CONFIG, cardStyle: 'outlined' }, node, region)).toBe(
      node
    );
  });

  it('wraps the node in a BackdropBlur clipped to the given region when cardStyle is "blur"', () => {
    const node = 'metadata-node';

    const result = wrapMetadataInBlur({ ...DEFAULT_LAYOUT_CONFIG, cardStyle: 'blur' }, node, region);

    expect(result).not.toBe(node);
    expect((result as React.ReactElement).type).toBe('BackdropBlur');
    expect((result as React.ReactElement).props).toMatchObject({
      blur: 12,
      children: node,
    });
  });

  it('passes null/false nodes through untouched so callers can guard rendering', () => {
    expect(wrapMetadataInBlur({ ...DEFAULT_LAYOUT_CONFIG, cardStyle: 'filled' }, null, region)).toBeNull();
  });
});

describe('shouldRenderWatermark', () => {
  it('shows the watermark for free-tier users even when the config has it off', () => {
    expect(shouldRenderWatermark(false, 'free')).toBe(true);
  });

  it('respects the config for premium users', () => {
    expect(shouldRenderWatermark(false, 'premium')).toBe(false);
    expect(shouldRenderWatermark(true, 'premium')).toBe(true);
  });

  it('shows the watermark for free-tier users when the config already has it on', () => {
    expect(shouldRenderWatermark(true, 'free')).toBe(true);
  });
});
