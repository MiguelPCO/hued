import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Sentry from '@sentry/react-native';
import ImageCropPicker from 'react-native-image-crop-picker';

import { trackEvent } from '@/lib/analytics/events';
import { extractColors, ExtractError } from '@/lib/color/extract';
import { updatePaletteColors, updatePaletteImage } from '@/lib/db/palettes';
import { optimize, thumbnail } from '@/lib/utils/image';
import { makeColors } from '@test/factories';
import { CropTab } from '../CropTab';

jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/utils/image', () => ({ optimize: jest.fn(), thumbnail: jest.fn() }));
jest.mock('@/lib/db/palettes', () => ({ updatePaletteImage: jest.fn(), updatePaletteColors: jest.fn() }));
jest.mock('@/lib/color/extract', () => ({
  ...jest.requireActual('@/lib/color/extract'),
  extractColors: jest.fn(),
}));

const openCropper = ImageCropPicker.openCropper as jest.Mock;
const COLORS = makeColors(5);

function setup(overrides: Record<string, unknown> = {}) {
  const onImageUpdated = jest.fn();
  render(
    <CropTab paletteId="p1" imageUri="file:///full.jpg" paletteSize={5} onImageUpdated={onImageUpdated} {...overrides} />
  );
  return { onImageUpdated };
}

const press = (ratio: string) => fireEvent.press(screen.getByText(ratio));
const idle = () => waitFor(() => expect(screen.queryByText('...')).toBeNull());

beforeEach(() => {
  jest.clearAllMocks();
  openCropper.mockResolvedValue({ path: 'file:///crop.jpg' });
  (optimize as jest.Mock).mockResolvedValue('file:///opt.jpg');
  (thumbnail as jest.Mock).mockResolvedValue('file:///thumb.jpg');
  (updatePaletteImage as jest.Mock).mockResolvedValue({
    imageUri: 'file:///documents/new-full.jpg',
    thumbnailUri: 'file:///documents/new-thumb.jpg',
  });
  (updatePaletteColors as jest.Mock).mockResolvedValue(undefined);
  (extractColors as jest.Mock).mockResolvedValue(COLORS);
});

describe('CropTab', () => {
  it('offers the four aspect ratios', () => {
    setup();

    ['1:1', '4:5', '9:16', 'original'].forEach((r) => expect(screen.getByText(r)).toBeOnTheScreen());
  });

  it('opens the native cropper with the fixed output size and Spanish copy', async () => {
    const { onImageUpdated } = setup();

    press('1:1');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    expect(openCropper).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'file:///full.jpg',
        width: 1080,
        height: 1080,
        mediaType: 'photo',
        includeExif: false,
        compressImageQuality: 1,
        cropperToolbarTitle: 'Recortar',
        cropperChooseText: 'Confirmar',
        cropperCancelText: 'Cancelar',
      })
    );
  });

  it('"original" crops freely, without a fixed size', async () => {
    const { onImageUpdated } = setup();

    press('original');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    const options = openCropper.mock.calls[0][0];
    expect(options.freeStyleCropEnabled).toBe(true);
    expect(options.width).toBeUndefined();
  });

  it('optimizes, stores the new image, re-extracts and reports the result', async () => {
    const { onImageUpdated } = setup();

    press('4:5');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    expect(optimize).toHaveBeenCalledWith('file:///crop.jpg');
    expect(thumbnail).toHaveBeenCalledWith('file:///crop.jpg');
    expect(updatePaletteImage).toHaveBeenCalledWith('p1', 'file:///opt.jpg', 'file:///thumb.jpg');
    expect(extractColors).toHaveBeenCalledWith('file:///documents/new-thumb.jpg', 5);
    expect(updatePaletteColors).toHaveBeenCalledWith('p1', COLORS);
    expect(onImageUpdated).toHaveBeenCalledWith({
      imageUri: 'file:///documents/new-full.jpg',
      thumbnailUri: 'file:///documents/new-thumb.jpg',
      colors: COLORS,
    });
    expect(trackEvent).toHaveBeenCalledWith('config_changed', { config_key: 'crop_ratio' });
  });

  it('re-extracts with the palette size it was given', async () => {
    const { onImageUpdated } = setup({ paletteSize: 8 });

    press('1:1');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    expect(extractColors).toHaveBeenCalledWith(expect.any(String), 8);
  });

  it('shows "..." on the active ratio and ignores other presses while cropping', async () => {
    let finish!: (v: { path: string }) => void;
    openCropper.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const { onImageUpdated } = setup();

    press('1:1');
    expect(screen.getByText('...')).toBeOnTheScreen();
    press('4:5');
    expect(openCropper).toHaveBeenCalledTimes(1);

    finish({ path: 'file:///crop.jpg' });
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());
    await idle();
  });
});

describe('CropTab — failures', () => {
  it.each(['User cancelled image selection', 'User did not grant library permission'])(
    'treats "%s" as a silent cancel',
    async (message) => {
      openCropper.mockRejectedValueOnce(new Error(message));
      const { onImageUpdated } = setup();

      // act() flushes the rejection and the finally-block state update at once;
      // polling with waitFor here stalls ~0.5s (flaky near its 1s timeout under load).
      await act(async () => {
        press('1:1');
      });

      expect(openCropper).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('...')).toBeNull();
      expect(screen.queryByText(/No se pudo recortar/)).toBeNull();
      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(onImageUpdated).not.toHaveBeenCalled();
    }
  );

  it('reports an unexpected cropper error to the user and to Sentry', async () => {
    openCropper.mockRejectedValueOnce(new Error('boom'));
    const { onImageUpdated } = setup();

    press('1:1');

    expect(await screen.findByText('No se pudo recortar la foto. Intentalo de nuevo.')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(onImageUpdated).not.toHaveBeenCalled();
  });

  it('clears the error banner on the next attempt', async () => {
    openCropper.mockRejectedValueOnce(new Error('boom'));
    const { onImageUpdated } = setup();
    press('1:1');
    await screen.findByText(/No se pudo recortar/);

    press('1:1');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    expect(screen.queryByText(/No se pudo recortar/)).toBeNull();
  });

  it('stops before extraction when the new image cannot be stored', async () => {
    (updatePaletteImage as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    const { onImageUpdated } = setup();

    press('1:1');

    expect(await screen.findByText(/No se pudo recortar/)).toBeOnTheScreen();
    expect(extractColors).not.toHaveBeenCalled();
    expect(onImageUpdated).not.toHaveBeenCalled();
  });

  it('keeps the new photo with an empty palette when extraction fails', async () => {
    (extractColors as jest.Mock).mockRejectedValueOnce(new ExtractError('Skia could not decode image'));
    const { onImageUpdated } = setup();

    press('1:1');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    expect(updatePaletteColors).toHaveBeenCalledWith('p1', []);
    expect(trackEvent).toHaveBeenCalledWith('extract_failed', { reason: 'Skia could not decode image' });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(onImageUpdated).toHaveBeenCalledWith(expect.objectContaining({ colors: [] }));
  });

  it('reports "unknown" when extraction fails with a non-ExtractError', async () => {
    (extractColors as jest.Mock).mockRejectedValueOnce(new Error('weird'));
    const { onImageUpdated } = setup();

    press('1:1');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    expect(trackEvent).toHaveBeenCalledWith('extract_failed', { reason: 'unknown' });
  });

  it('still reports the new photo when persisting the colors also fails', async () => {
    (updatePaletteColors as jest.Mock).mockRejectedValue(new Error('db locked'));
    const { onImageUpdated } = setup();

    press('1:1');
    await waitFor(() => expect(onImageUpdated).toHaveBeenCalled());

    expect(onImageUpdated).toHaveBeenCalledWith(expect.objectContaining({ colors: [] }));
  });
});
