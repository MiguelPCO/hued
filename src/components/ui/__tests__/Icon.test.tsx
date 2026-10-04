import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { Colors } from '@/lib/tokens';
import { findAll } from '@test/skiaTree';
import { Icon } from '../Icon';

function iconProps(element: ReactElement) {
  const view = render(element);
  return findAll(view.toJSON(), 'MaterialIcons')[0].props;
}

describe('Icon', () => {
  it('renders the requested glyph at 24px in the primary ink color by default', () => {
    expect(iconProps(<Icon name="home" />)).toMatchObject({ name: 'home', size: 24, color: Colors.textPrimary });
  });

  it('accepts a custom size and color', () => {
    expect(iconProps(<Icon name="delete" size={18} color="#FF0000" />)).toMatchObject({
      name: 'delete',
      size: 18,
      color: '#FF0000',
    });
  });
});
