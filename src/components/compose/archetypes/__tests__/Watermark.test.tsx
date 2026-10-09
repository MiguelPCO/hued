import { render } from '@testing-library/react-native';

import { findAll } from '@test/skiaTree';
import { getWatermarkTapRegion, Watermark } from '../Watermark';

function parts(width = 360, height = 450, cornerRadius = 16) {
  const view = render(<Watermark width={width} height={height} cornerRadius={cornerRadius} />);
  const json = view.toJSON();
  return { pill: findAll(json, 'SkRoundedRect')[0], mark: findAll(json, 'SkText')[0] };
}

describe('Watermark', () => {
  it('draws a white "hued" wordmark on a dark pill so it reads over any card', () => {
    const { pill, mark } = parts();

    expect(mark.props.text).toBe('hued');
    expect(mark.props.color).toBe('rgba(255,255,255,0.95)');
    expect(pill.props.color).toBe('rgba(0,0,0,0.55)');
    expect(pill.props.r).toBe((pill.props.height as number) / 2);
  });

  it('is larger than the old 11pt mark', () => {
    const { pill } = parts();

    expect(pill.props.width).toBeCloseTo(60.8, 5); // 4 letras * 17 * 0.6 + 2 * 10 de relleno
    expect(pill.props.height).toBe(29);
  });

  it('sits inset from the right edge, slightly below the vertical center', () => {
    const { pill, mark } = parts(360, 450);

    expect((pill.props.x as number) + (pill.props.width as number)).toBeCloseTo(346, 5); // 360 - 14 de margen
    expect((pill.props.y as number) + (pill.props.height as number) / 2).toBe(235); // 450/2 + 10
    expect(mark.props.x).toBeCloseTo((pill.props.x as number) + 10, 5);
  });

  it('scales with the canvas it is given', () => {
    const { pill } = parts(720, 900);

    expect((pill.props.x as number) + (pill.props.width as number)).toBeCloseTo(706, 5);
    expect((pill.props.y as number) + (pill.props.height as number) / 2).toBe(460);
  });

  it('keeps the same placement for every corner radius (always inside the clip)', () => {
    const sharp = parts(360, 450, 0);
    const round = parts(360, 450, 9999);

    expect(round.pill.props.x).toBe(sharp.pill.props.x);
    expect(round.pill.props.y).toBe(sharp.pill.props.y);
  });
});

describe('getWatermarkTapRegion', () => {
  it('is a 64x44 target centered on the pill', () => {
    const region = getWatermarkTapRegion(360, 450);

    expect(region.width).toBe(64);
    expect(region.height).toBe(44);
    expect(region.x + region.width / 2).toBeCloseTo(315.6, 5);
    expect(region.y + region.height / 2).toBe(235);
  });

  it('stays inside the canvas', () => {
    const region = getWatermarkTapRegion(360, 450);

    expect(region.x).toBeGreaterThanOrEqual(0);
    expect(region.y).toBeGreaterThanOrEqual(0);
    expect(region.x + region.width).toBeLessThanOrEqual(360);
    expect(region.y + region.height).toBeLessThanOrEqual(450);
  });

  it('covers the whole rendered pill', () => {
    const { pill } = parts(360, 450);
    const region = getWatermarkTapRegion(360, 450);
    const px = pill.props.x as number;
    const py = pill.props.y as number;

    expect(px).toBeGreaterThanOrEqual(region.x);
    expect(px + (pill.props.width as number)).toBeLessThanOrEqual(region.x + region.width);
    expect(py).toBeGreaterThanOrEqual(region.y);
    expect(py + (pill.props.height as number)).toBeLessThanOrEqual(region.y + region.height);
  });
});
