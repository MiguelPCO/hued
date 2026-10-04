import { ARCHETYPES } from '@/data/archetypes';
import { DEFAULT_LAYOUT_CONFIG } from '../palette';

describe('DEFAULT_LAYOUT_CONFIG', () => {
  it('starts on an archetype that exists in the registry', () => {
    expect(Object.keys(ARCHETYPES)).toContain(DEFAULT_LAYOUT_CONFIG.archetypeId);
  });

  it('gives a publication-ready look without any adjustment (editorial defaults)', () => {
    expect(DEFAULT_LAYOUT_CONFIG).toMatchObject({
      showHex: true,
      showName: true,
      showRGB: false,
      fontFamily: 'sans',
      cornerRadius: 16,
      cardStyle: 'filled',
    });
  });

  it('leaves the watermark preference off (the free-tier gate decides, not the default)', () => {
    expect(DEFAULT_LAYOUT_CONFIG.watermarkVisible).toBe(false);
  });

  it('defaults to a supported palette size', () => {
    expect(DEFAULT_LAYOUT_CONFIG.paletteSize).toBe(5);
    expect(DEFAULT_LAYOUT_CONFIG.paletteSize).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_LAYOUT_CONFIG.paletteSize).toBeLessThanOrEqual(8);
  });

  it('has no Libre swatches until the Libre archetype generates them', () => {
    expect(DEFAULT_LAYOUT_CONFIG.freeformSwatches).toEqual([]);
  });
});
