import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import { wrapMetadataInBlur } from '../shared';

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
