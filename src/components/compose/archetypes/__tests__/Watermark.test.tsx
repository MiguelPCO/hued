import { render } from '@testing-library/react-native';

import { findAll } from '@test/skiaTree';
import { getWatermarkTapRegion, Watermark } from '../Watermark';

function marks(width = 360, height = 450, cornerRadius = 16) {
  const view = render(<Watermark width={width} height={height} cornerRadius={cornerRadius} />);
  return findAll(view.toJSON(), 'SkText');
}

describe('Watermark', () => {
  it('draws a white "hued" wordmark with a soft shadow behind it', () => {
    const [shadow, mark] = marks();

    expect(shadow.props.text).toBe('hued');
    expect(mark.props.text).toBe('hued');
    expect(mark.props.color).toBe('rgba(255,255,255,0.6)');
    expect(shadow.props.color).toBe('rgba(0,0,0,0.35)');
    expect(shadow.props.x).toBeCloseTo((mark.props.x as number) + 0.75, 5);
    expect(shadow.props.y).toBeCloseTo((mark.props.y as number) + 0.75, 5);
  });

  it('sits inset from the right edge, slightly below the vertical center', () => {
    const [, mark] = marks(360, 450);

    expect(mark.props.x).toBeCloseTo(313.6, 5); // 360 - 20 margen - 26.4 ancho aprox.
    expect(mark.props.y).toBe(235); // 450/2 + 10
  });

  it('scales with the canvas it is given', () => {
    const [, mark] = marks(720, 900);

    expect(mark.props.x).toBeCloseTo(673.6, 5);
    expect(mark.props.y).toBe(460);
  });

  it('keeps the same placement for every corner radius (always inside the clip)', () => {
    const [, sharp] = marks(360, 450, 0);
    const [, pill] = marks(360, 450, 9999);

    expect(pill.props.x).toBe(sharp.props.x);
    expect(pill.props.y).toBe(sharp.props.y);
  });
});

describe('getWatermarkTapRegion', () => {
  it('is a 64x44 target centered on the mark', () => {
    const region = getWatermarkTapRegion(360, 450);

    expect(region.width).toBe(64);
    expect(region.height).toBe(44);
    expect(region.x + region.width / 2).toBeCloseTo(326.8, 5);
    expect(region.y + region.height / 2).toBe(235);
  });

  it('stays inside the canvas', () => {
    const region = getWatermarkTapRegion(360, 450);

    expect(region.x).toBeGreaterThanOrEqual(0);
    expect(region.y).toBeGreaterThanOrEqual(0);
    expect(region.x + region.width).toBeLessThanOrEqual(360);
    expect(region.y + region.height).toBeLessThanOrEqual(450);
  });

  it('contains the origin of the rendered text', () => {
    const [, mark] = marks(360, 450);
    const region = getWatermarkTapRegion(360, 450);

    expect(mark.props.x as number).toBeGreaterThanOrEqual(region.x);
    expect(mark.props.x as number).toBeLessThanOrEqual(region.x + region.width);
    expect(mark.props.y as number).toBeGreaterThanOrEqual(region.y);
    expect(mark.props.y as number).toBeLessThanOrEqual(region.y + region.height);
  });
});
