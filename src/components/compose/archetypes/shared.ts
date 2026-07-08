import { useMemo } from 'react';
import { matchFont } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

import { Primitive } from '@/lib/tokens';

const FONT_FAMILIES: Record<'sans' | 'serif' | 'mono', { ios: string; android: string }> = {
  sans: { ios: 'Helvetica Neue', android: 'Roboto' },
  serif: { ios: 'Georgia', android: 'serif' },
  mono: { ios: 'Courier', android: 'monospace' },
};

export function getContrastTextColor(hslLightness: number): string {
  return hslLightness > 0.5 ? Primitive.black : Primitive.white;
}

export function useArchetypeFonts(fontKey: 'sans' | 'serif' | 'mono', hexSize: number, nameSize: number) {
  const fontFamily = Platform.OS === 'ios' ? FONT_FAMILIES[fontKey].ios : FONT_FAMILIES[fontKey].android;
  const hexFont = useMemo(() => matchFont({ fontFamily, fontSize: hexSize }), [fontFamily, hexSize]);
  const nameFont = useMemo(() => matchFont({ fontFamily, fontSize: nameSize }), [fontFamily, nameSize]);
  return { hexFont, nameFont };
}
