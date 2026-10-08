import { Asset } from 'expo-asset';

import * as Sentry from '@sentry/react-native';
import { Skia } from '@shopify/react-native-skia';
import type { SkTypeface } from '@shopify/react-native-skia';

import type { FontKey } from '@/data/fonts';
import { FONT_MODULES } from '@/lib/fonts/fontModules';

// Skia's system FontMgr only knows the platform's own fonts, and expo-font registers fonts for React
// Native text only. The bundled fonts are decoded into Skia typefaces here, once at startup, and kept
// in a plain map so the preview and the export (which runs outside React) read the same typeface.
const typefaces = new Map<string, SkTypeface>();

export async function loadSkiaTypefaces(): Promise<void> {
  await Promise.all(
    Object.entries(FONT_MODULES).map(async ([key, module]) => {
      try {
        const asset = Asset.fromModule(module);
        await asset.downloadAsync();
        const data = await Skia.Data.fromURI(asset.localUri ?? asset.uri);
        const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
        if (typeface) typefaces.set(key, typeface);
      } catch (err) {
        // A font that fails to load falls back to the sans system font; the app stays usable.
        Sentry.captureException(err);
      }
    }),
  );
}

export function getBundledTypeface(key: FontKey): SkTypeface | null {
  return typefaces.get(key) ?? null;
}
