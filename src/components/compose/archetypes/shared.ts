import { useMemo } from 'react';
import { matchFont } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

import { Primitive } from '@/lib/tokens';

export const FONT_FAMILY = Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto';

export function getContrastTextColor(hslLightness: number): string {
  return hslLightness > 0.5 ? Primitive.black : Primitive.white;
}

export function useArchetypeFonts(hexSize: number, nameSize: number) {
  const hexFont = useMemo(() => matchFont({ fontFamily: FONT_FAMILY, fontSize: hexSize }), [hexSize]);
  const nameFont = useMemo(() => matchFont({ fontFamily: FONT_FAMILY, fontSize: nameSize }), [nameSize]);
  return { hexFont, nameFont };
}
