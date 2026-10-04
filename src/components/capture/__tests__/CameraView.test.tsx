import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Sentry from '@sentry/react-native';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { trackEvent } from '@/lib/analytics/events';
import { takePictureAsync, useCameraPermissions } from '@test/mocks/expoCamera';
import { CameraView } from '../CameraView';

jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }));

const permissions = useCameraPermissions as jest.Mock;
const takePicture = takePictureAsync as jest.Mock;

function setup(overrides: { onCapture?: jest.Mock; onCancel?: jest.Mock } = {}) {
  const onCapture = overrides.onCapture ?? jest.fn();
  const onCancel = overrides.onCancel ?? jest.fn();
  render(<CameraView onCapture={onCapture} onCancel={onCancel} />);
  return { onCapture, onCancel };
}

const shutter = () =>
  screen.UNSAFE_getAllByType(TouchableOpacity).find((t) => StyleSheet.flatten(t.props.style)?.borderWidth === 4)!;

const cameraProps = () => screen.UNSAFE_root.findAll((n) => (n.type as unknown) === 'ExpoCameraView')[0].props;

const flush = () => act(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  permissions.mockReturnValue([{ granted: true, canAskAgain: true }, jest.fn()]);
  takePicture.mockResolvedValue({ uri: 'file:///shot.jpg' });
});

describe('CameraView — permissions', () => {
  it('renders an empty screen while the permission state is loading', () => {
    permissions.mockReturnValue([null, jest.fn()]);
    setup();

    expect(screen.queryByText('Cancelar')).toBeNull();
    expect(screen.queryByText('Permitir acceso')).toBeNull();
  });

  it('asks for access and lets the user cancel when permission is not granted yet', () => {
    const request = jest.fn();
    permissions.mockReturnValue([{ granted: false, canAskAgain: true }, request]);
    const { onCancel } = setup();

    fireEvent.press(screen.getByText('Permitir acceso'));
    fireEvent.press(screen.getByText('Cancelar'));

    expect(request).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('points to the device settings when permission was denied permanently', () => {
    permissions.mockReturnValue([{ granted: false, canAskAgain: false }, jest.fn()]);
    setup();

    expect(screen.getByText('Activa el permiso en Ajustes del dispositivo.')).toBeOnTheScreen();
    expect(screen.queryByText('Permitir acceso')).toBeNull();
  });
});

describe('CameraView — capture', () => {
  it('takes a low-quality photo without EXIF, records the funnel and hands over the uri', async () => {
    const { onCapture } = setup();

    fireEvent.press(shutter());

    await flush();
    expect(onCapture).toHaveBeenCalledWith('file:///shot.jpg');
    expect(takePicture).toHaveBeenCalledWith({ quality: 0.3, exif: false });
    expect(trackEvent).toHaveBeenNthCalledWith(1, 'capture_started', { source: 'camera' });
    expect(trackEvent).toHaveBeenNthCalledWith(2, 'capture_completed', {
      source: 'camera',
      duration_ms: expect.any(Number),
    });
  });

  it('shows an error and reports to Sentry when the camera fails', async () => {
    takePicture.mockRejectedValueOnce(new Error('camera busy'));
    const { onCapture } = setup();

    fireEvent.press(shutter());

    await flush();
    expect(screen.getByText('No se pudo tomar la foto. Intentalo de nuevo.')).toBeOnTheScreen();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('shows the same error when processing the photo fails downstream', async () => {
    const onCapture = jest.fn().mockRejectedValue(new Error('processCapture'));
    setup({ onCapture });

    fireEvent.press(shutter());

    await flush();
    expect(screen.getByText('No se pudo tomar la foto. Intentalo de nuevo.')).toBeOnTheScreen();
  });

  it('clears the error on the next attempt', async () => {
    takePicture.mockRejectedValueOnce(new Error('camera busy'));
    const { onCapture } = setup();
    fireEvent.press(shutter());
    await flush();
    expect(screen.getByText(/No se pudo tomar la foto/)).toBeOnTheScreen();

    fireEvent.press(shutter());

    await flush();
    expect(onCapture).toHaveBeenCalled();
    expect(screen.queryByText(/No se pudo tomar la foto/)).toBeNull();
  });

  it('ignores a second tap while a capture is in flight', async () => {
    let finish!: (v: { uri: string }) => void;
    takePicture.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const { onCapture } = setup();

    fireEvent.press(shutter());
    fireEvent.press(shutter());
    expect(takePicture).toHaveBeenCalledTimes(1);

    finish({ uri: 'file:///shot.jpg' });
    await flush();
    expect(onCapture).toHaveBeenCalledTimes(1);
  });
});

describe('CameraView — controls', () => {
  it('cycles the flash auto → on → off → auto', () => {
    setup();

    fireEvent.press(screen.getByText('A'));
    expect(cameraProps().flash).toBe('on');
    fireEvent.press(screen.getByText('On'));
    expect(cameraProps().flash).toBe('off');
    fireEvent.press(screen.getByText('Off'));
    expect(cameraProps().flash).toBe('auto');
  });

  it('toggles the rule-of-thirds grid', () => {
    setup();

    fireEvent.press(screen.getByText('Grid'));

    expect(screen.getByText('Grid On')).toBeOnTheScreen();
  });

  it('flips between the back and front cameras', () => {
    setup();
    expect(cameraProps().facing).toBe('back');

    fireEvent.press(screen.getByText('Flip'));
    expect(cameraProps().facing).toBe('front');

    fireEvent.press(screen.getByText('Flip'));
    expect(cameraProps().facing).toBe('back');
  });

  it('closes with the X button', () => {
    const { onCancel } = setup();

    fireEvent.press(screen.getByText('X'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
