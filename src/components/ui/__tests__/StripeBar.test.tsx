import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Primitive } from '@/lib/tokens';
import { StripeBar } from '../StripeBar';

describe('StripeBar', () => {
  it('draws the four Kodak-stripe bands in order', () => {
    const json = render(<StripeBar />).toJSON() as unknown as { props: { style: unknown }; children: { props: { style: unknown } }[] };

    const colors = json.children.map((band) => (StyleSheet.flatten(band.props.style as never) as Record<string, unknown>).backgroundColor);

    expect(colors).toEqual([Primitive.brown800, Primitive.red500, Primitive.orange500, Primitive.amber400]);
  });

  it('is a 4px-high horizontal row', () => {
    const json = render(<StripeBar />).toJSON() as unknown as { props: { style: unknown } };

    expect(StyleSheet.flatten(json.props.style as never)).toMatchObject({ flexDirection: 'row', height: 4 });
  });
});
