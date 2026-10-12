import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { readThumbnailPixels } from '@/lib/color/extract';
import { makeColors } from '@test/factories';
import { capturePanResponders, gesture } from '@test/panResponder';
import { EyedropperOverlay } from '../EyedropperOverlay';

jest.mock('@/lib/color/extract', () => ({ readThumbnailPixels: jest.fn() }));

let pan: ReturnType<typeof capturePanResponders>;

/** 10x10 solid [200, 30, 30]. */
function solidRed() {
  const pixels = new Uint8Array(10 * 10 * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([200, 30, 30, 255], i);
  return { pixels, width: 10, height: 10 };
}

const touchAt = (x: number, y: number) => ({ nativeEvent: { locationX: x, locationY: y } }) as never;

async function mount(props: Partial<React.ComponentProps<typeof EyedropperOverlay>> = {}) {
  (readThumbnailPixels as jest.Mock).mockResolvedValue(solidRed());
  const onPick = jest.fn();
  const onClose = jest.fn();
  render(
    <EyedropperOverlay visible thumbnailUri="file:///t.jpg" colors={makeColors(5)} onPick={onPick} onClose={onClose} {...props} />,
  );
  await act(async () => {}); // let the pixels load
  const photoArea = screen.UNSAFE_root.findAll((n) => (n.type as unknown) === 'View' && n.props.__config)[0];
  act(() => {
    fireEvent(photoArea, 'layout', { nativeEvent: { layout: { width: 100, height: 100 } } });
  });
  return { onPick, onClose };
}

beforeEach(() => {
  pan = capturePanResponders();
});

afterEach(() => pan.restore());

describe('EyedropperOverlay', () => {
  it('renders nothing while closed', () => {
    render(<EyedropperOverlay visible={false} thumbnailUri="x" colors={makeColors(3)} onPick={jest.fn()} onClose={jest.fn()} />);
    expect(screen.queryByText('Cancelar')).toBeNull();
  });

  it('shows the colour under the finger and picks it for the first swatch on release', async () => {
    const { onPick } = await mount();

    act(() => pan.live(0).onPanResponderGrant?.(touchAt(50, 50), gesture()));
    expect(screen.getByText('#C81E1E')).toBeOnTheScreen();

    act(() => pan.live(0).onPanResponderRelease?.(touchAt(50, 50), gesture()));
    expect(onPick).toHaveBeenCalledWith(0, [200, 30, 30]);
    expect(screen.queryByText('#C81E1E')).toBeNull();
  });

  it('replaces the swatch that was chosen', async () => {
    const { onPick } = await mount();

    fireEvent.press(screen.getByLabelText('Reemplazar color 3'));
    act(() => pan.live(0).onPanResponderGrant?.(touchAt(10, 10), gesture()));
    act(() => pan.live(0).onPanResponderRelease?.(touchAt(10, 10), gesture()));

    expect(onPick).toHaveBeenCalledWith(2, [200, 30, 30]);
  });

  it('ignores the finger while the photo has not loaded', async () => {
    (readThumbnailPixels as jest.Mock).mockReturnValue(new Promise(() => {}));
    const onPick = jest.fn();
    render(<EyedropperOverlay visible thumbnailUri="x" colors={makeColors(3)} onPick={onPick} onClose={jest.fn()} />);

    act(() => pan.live(0).onPanResponderGrant?.(touchAt(5, 5), gesture()));
    act(() => pan.live(0).onPanResponderRelease?.(touchAt(5, 5), gesture()));

    expect(onPick).not.toHaveBeenCalled();
  });

  it('cancels without picking', async () => {
    const { onPick, onClose } = await mount();

    fireEvent.press(screen.getByText('Cancelar'));

    expect(onClose).toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('says so when the photo cannot be read', async () => {
    (readThumbnailPixels as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<EyedropperOverlay visible thumbnailUri="x" colors={makeColors(3)} onPick={jest.fn()} onClose={jest.fn()} />);
    await act(async () => {});

    expect(screen.getByText('No se pudo leer la foto.')).toBeOnTheScreen();
  });
});
