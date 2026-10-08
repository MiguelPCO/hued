import { PhotoSwatches } from './PhotoSwatches';
import { getBaseLayout, resolveRects } from './cardLayouts';
import type { ArchetypeProps } from './types';

// Swatches placed anywhere the user dragged them (`config.freeformSwatches`,
// design-space 360x450, array order = z-order). A stale/empty/mismatched array
// (first time entering libre, or right after a paletteSize change per ADR-0001)
// falls back to the base layout libre came from — this is a pure render-time safety net;
// the actual reset is persisted by the edit screen so the fallback here is
// rarely hit in practice.
export function LibreArchetype(props: ArchetypeProps) {
  const { palette, config } = props;
  const base = getBaseLayout(config.libreSource, palette.colors.length);
  const rects =
    config.freeformSwatches.length === palette.colors.length
      ? config.freeformSwatches
      : resolveRects(base.rects, config);

  return <PhotoSwatches {...props} rects={rects} pad={base.pad} />;
}
