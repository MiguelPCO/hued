import * as Sentry from '@sentry/react-native';
import { act, render } from '@testing-library/react-native';

import { processCapture } from '@/lib/capture/processCapture';
import CaptureScreen from '@app/(tabs)/capture';
import { makePalette } from '@test/factories';
import { resetRouterMocks, routerMock } from '@test/router';

interface CameraProps {
  onCapture: (uri: string) => Promise<void>;
  onCancel: () => void;
}

let mockCamera!: CameraProps;

jest.mock('@/components/capture/CameraView', () => ({
  CameraView: (props: CameraProps) => {
    mockCamera = props;
    return null;
  },
}));
jest.mock('@/lib/capture/processCapture', () => ({ processCapture: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  resetRouterMocks();
  render(<CaptureScreen />);
});

describe('CaptureScreen', () => {
  it('turns a captured photo into a palette and opens it in the editor', async () => {
    (processCapture as jest.Mock).mockResolvedValue(makePalette({ id: 'new-1' }));

    await act(async () => { await mockCamera.onCapture('file:///shot.jpg'); });

    expect(processCapture).toHaveBeenCalledWith('file:///shot.jpg', 'camera');
    expect(routerMock.replace).toHaveBeenCalledWith({ pathname: '/palette/[id]', params: { id: 'new-1' } });
  });

  it('goes back to the home tab with a failure flag when processing fails', async () => {
    (processCapture as jest.Mock).mockRejectedValue(new Error('disk full'));

    await act(async () => { await mockCamera.onCapture('file:///shot.jpg'); });

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).toHaveBeenCalledWith({ pathname: '/(tabs)', params: { captureFailed: '1' } });
  });

  it('returns to the home tab on cancel', () => {
    mockCamera.onCancel();

    expect(routerMock.replace).toHaveBeenCalledWith('/(tabs)');
  });
});
