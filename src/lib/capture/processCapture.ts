import { ARCHETYPES } from '@/data/archetypes';
import { savePalette } from '@/lib/db/palettes';
import { trackEvent } from '@/lib/analytics/events';
import { optimize, thumbnail } from '@/lib/utils/image';
import { DEFAULT_LAYOUT_CONFIG } from '@/types/palette';
import type { CaptureSource, Palette } from '@/types/palette';

export async function processCapture(uri: string, source: CaptureSource): Promise<Palette> {
  const start = Date.now();
  const [optimizedUri, thumbUri] = await Promise.all([optimize(uri), thumbnail(uri)]);

  const palette = await savePalette({
    imageUri: optimizedUri,
    thumbnailUri: thumbUri,
    colors: [],
    layoutConfig: {
      ...DEFAULT_LAYOUT_CONFIG,
      ...ARCHETYPES[DEFAULT_LAYOUT_CONFIG.archetypeId].defaultConfig,
    },
    meta: {
      capturedAt: Date.now(),
      source,
      aspectRatio: 'original',
    },
  });

  trackEvent('capture_completed', { source, duration_ms: Date.now() - start });
  return palette;
}
