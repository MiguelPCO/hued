// Metro asset ids of the bundled fonts. Each family is imported from its own regular-weight subpath
// so the other weights stay out of the bundle.
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black/400Regular';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue/400Regular';
import { Caveat_400Regular } from '@expo-google-fonts/caveat/400Regular';
import { CormorantGaramond_400Regular } from '@expo-google-fonts/cormorant-garamond/400Regular';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { Lora_400Regular } from '@expo-google-fonts/lora/400Regular';
import { Montserrat_400Regular } from '@expo-google-fonts/montserrat/400Regular';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Oswald_400Regular } from '@expo-google-fonts/oswald/400Regular';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico/400Regular';
import { PlayfairDisplay_400Regular } from '@expo-google-fonts/playfair-display/400Regular';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Raleway_400Regular } from '@expo-google-fonts/raleway/400Regular';
import { SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk/400Regular';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono/400Regular';

import type { BundledFontKey } from '@/data/fonts';

export const FONT_MODULES: Record<BundledFontKey, number> = {
  poppins: Poppins_400Regular,
  'dm-sans': DMSans_400Regular,
  montserrat: Montserrat_400Regular,
  raleway: Raleway_400Regular,
  nunito: Nunito_400Regular,
  'playfair-display': PlayfairDisplay_400Regular,
  lora: Lora_400Regular,
  'cormorant-garamond': CormorantGaramond_400Regular,
  'space-mono': SpaceMono_400Regular,
  'jetbrains-mono': JetBrainsMono_400Regular,
  'bebas-neue': BebasNeue_400Regular,
  oswald: Oswald_400Regular,
  'archivo-black': ArchivoBlack_400Regular,
  'space-grotesk': SpaceGrotesk_400Regular,
  caveat: Caveat_400Regular,
  pacifico: Pacifico_400Regular,
};
