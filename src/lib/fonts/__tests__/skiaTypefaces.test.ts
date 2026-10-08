import { Asset } from 'expo-asset';

import * as Sentry from '@sentry/react-native';
import { Skia } from '@shopify/react-native-skia';

import { getBundledTypeface, loadSkiaTypefaces } from '../skiaTypefaces';

jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn() } }));
jest.mock('../fontModules', () => ({ FONT_MODULES: { poppins: 1, lora: 2, caveat: 3 } }));

const fromModule = Asset.fromModule as jest.Mock;
const fromURI = Skia.Data.fromURI as jest.Mock;
const makeTypeface = Skia.Typeface.MakeFreeTypeFaceFromData as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  fromModule.mockImplementation((module: number) => ({
    downloadAsync: jest.fn(() => Promise.resolve()),
    localUri: `file:///cache/font-${module}.ttf`,
    uri: `http://metro/font-${module}.ttf`,
  }));
  fromURI.mockImplementation((uri: string) => Promise.resolve({ uri }));
  makeTypeface.mockImplementation((data: { uri: string }) => ({ __typeface: data.uri }));
});

describe('loadSkiaTypefaces', () => {
  it('decodes every bundled font from its downloaded file into a typeface', async () => {
    await loadSkiaTypefaces();

    expect(fromURI).toHaveBeenCalledWith('file:///cache/font-1.ttf');
    expect(getBundledTypeface('poppins')).toEqual({ __typeface: 'file:///cache/font-1.ttf' });
    expect(getBundledTypeface('lora')).toEqual({ __typeface: 'file:///cache/font-2.ttf' });
    expect(getBundledTypeface('caveat')).toEqual({ __typeface: 'file:///cache/font-3.ttf' });
  });

  it('falls back to the asset uri when it has no local copy', async () => {
    fromModule.mockImplementation((module: number) => ({
      downloadAsync: jest.fn(() => Promise.resolve()),
      localUri: null,
      uri: `http://metro/font-${module}.ttf`,
    }));

    await loadSkiaTypefaces();

    expect(fromURI).toHaveBeenCalledWith('http://metro/font-1.ttf');
  });

  it('keeps loading the others, and reports it, when one font fails', async () => {
    fromURI.mockImplementation((uri: string) =>
      uri.endsWith('font-2.ttf')
        ? Promise.reject(new Error('unreadable'))
        : Promise.resolve({ uri }),
    );

    await expect(loadSkiaTypefaces()).resolves.toBeUndefined();

    expect(Sentry.captureException).toHaveBeenCalledWith(new Error('unreadable'));
    expect(getBundledTypeface('poppins')).not.toBeNull();
    expect(getBundledTypeface('caveat')).not.toBeNull();
  });

  it('does not register a font Skia could not decode', async () => {
    // The typeface map lives in the module, so use a fresh copy of it (and of its mocks).
    let fresh!: typeof import('../skiaTypefaces');
    jest.isolateModules(() => {
      fresh = require('../skiaTypefaces');
      require('expo-asset').Asset.fromModule.mockImplementation(() => ({
        downloadAsync: jest.fn(() => Promise.resolve()),
        localUri: 'file:///cache/font.ttf',
      }));
      require('@shopify/react-native-skia').Skia.Typeface.MakeFreeTypeFaceFromData.mockReturnValue(
        null,
      );
    });

    await fresh.loadSkiaTypefaces();

    expect(fresh.getBundledTypeface('poppins')).toBeNull();
  });
});

describe('getBundledTypeface', () => {
  it('returns null for a font that is not bundled', () => {
    expect(getBundledTypeface('sans')).toBeNull();
  });
});
