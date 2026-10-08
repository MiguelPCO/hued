import { Platform } from 'react-native';

import { Skia, matchFont } from '@shopify/react-native-skia';
import { renderHook } from '@testing-library/react-native';

import { getBundledTypeface } from '@/lib/fonts/skiaTypefaces';

import { makeFont, useFontFactory } from '../shared';

jest.mock('@/lib/fonts/skiaTypefaces', () => ({ getBundledTypeface: jest.fn(() => null) }));

const bundled = getBundledTypeface as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  bundled.mockReturnValue(null);
});

describe('makeFont', () => {
  it('resolves a system font through the platform font manager', () => {
    makeFont('mono', 12);

    expect(matchFont).toHaveBeenCalledWith({
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      fontSize: 12,
    });
  });

  it('builds a bundled font from its decoded typeface', () => {
    const typeface = { __typeface: 'poppins' };
    bundled.mockReturnValue(typeface);

    makeFont('poppins', 14);

    expect(Skia.Font).toHaveBeenCalledWith(typeface, 14);
    expect(matchFont).not.toHaveBeenCalled();
  });

  it('falls back to the sans system font when a bundled font did not load', () => {
    makeFont('pacifico', 9);

    expect(matchFont).toHaveBeenCalledWith({
      fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
      fontSize: 9,
    });
  });
});

describe('useFontFactory', () => {
  it('makes a font of the requested size for its family', () => {
    const { result } = renderHook(() => useFontFactory('serif'));

    result.current(12);

    expect(matchFont).toHaveBeenCalledWith({
      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
      fontSize: 12,
    });
  });

  it('keeps the same function until the family changes', () => {
    const { result, rerender } = renderHook(
      ({ key }: { key: 'sans' | 'serif' }) => useFontFactory(key),
      {
        initialProps: { key: 'sans' },
      },
    );
    const sans = result.current;

    rerender({ key: 'sans' });
    expect(result.current).toBe(sans);

    rerender({ key: 'serif' });
    expect(result.current).not.toBe(sans);
  });
});
