import * as Sentry from '@sentry/react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ActivityIndicator, Linking, Switch, TouchableOpacity } from 'react-native';

import { PRIVACY_URL } from '@/lib/legal';
import { pickAvatarFromCamera, pickAvatarFromGallery, saveAvatar } from '@/lib/profile/avatar';
import { useSettingsStore } from '@/lib/store/settingsStore';
import SettingsScreen from '@app/(tabs)/settings';
import { resetRouterMocks, routerMock } from '@test/router';

let mockPosthog: {
  optIn: jest.Mock; optOut: jest.Mock; ready: jest.Mock; optedOut: boolean;
} | null = null;
jest.mock('@/lib/analytics/posthog', () => ({
  get posthog() {
    return mockPosthog;
  },
}));
jest.mock('@/lib/profile/avatar', () => ({
  pickAvatarFromCamera: jest.fn(),
  pickAvatarFromGallery: jest.fn(),
  saveAvatar: jest.fn(),
}));

const avatarButton = () => screen.UNSAFE_getAllByType(TouchableOpacity)[0];

function fakePosthog(optedOut: boolean) {
  return { optIn: jest.fn(), optOut: jest.fn(), ready: jest.fn(() => Promise.resolve()), optedOut };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetRouterMocks();
  mockPosthog = null;
  useSettingsStore.setState({
    profileName: null, profilePhotoUri: null, subscriptionStatus: 'free', subscriptionExpiresAt: null,
  });
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => jest.restoreAllMocks());

describe('SettingsScreen — subscription', () => {
  it('invites free users to upgrade and opens the paywall tagged as "settings"', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('Mejorar a Pro'));

    expect(routerMock.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { trigger: 'settings' } });
  });

  it('shows premium users their expiry date', () => {
    useSettingsStore.setState({ subscriptionStatus: 'premium', subscriptionExpiresAt: Date.UTC(2027, 0, 15, 12) });
    render(<SettingsScreen />);

    expect(screen.getByText('HUED PRO')).toBeOnTheScreen();
    expect(screen.getByText('15 de enero de 2027')).toBeOnTheScreen();
    expect(screen.queryByText('Mejorar a Pro')).toBeNull();
  });

  it('shows "De por vida" for a lifetime purchase', () => {
    useSettingsStore.setState({ subscriptionStatus: 'premium', subscriptionExpiresAt: null });
    render(<SettingsScreen />);

    expect(screen.getByText('De por vida')).toBeOnTheScreen();
  });
});

describe('SettingsScreen — profile name', () => {
  it('prompts for a name when there is none', () => {
    render(<SettingsScreen />);

    expect(screen.getByText('Añadir nombre')).toBeOnTheScreen();
  });

  it('shows the saved name', () => {
    useSettingsStore.setState({ profileName: 'Luz' });
    render(<SettingsScreen />);

    expect(screen.getByText('Luz')).toBeOnTheScreen();
  });

  it('saves a trimmed name', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Añadir nombre'));

    fireEvent.changeText(screen.getByPlaceholderText('Tu nombre'), '  Ana  ');
    fireEvent.press(screen.getByText('Guardar'));

    expect(useSettingsStore.getState().profileName).toBe('Ana');
  });

  it('clears the name when saved empty', () => {
    useSettingsStore.setState({ profileName: 'Luz' });
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Luz'));

    fireEvent.changeText(screen.getByPlaceholderText('Tu nombre'), '   ');
    fireEvent.press(screen.getByText('Guardar'));

    expect(useSettingsStore.getState().profileName).toBeNull();
  });

  it('opens the editor prefilled with the current name and limits it to 40 characters', () => {
    useSettingsStore.setState({ profileName: 'Luz' });
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('Luz'));

    expect(screen.getByDisplayValue('Luz')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Tu nombre').props.maxLength).toBe(40);
  });
});

describe('SettingsScreen — avatar', () => {
  it('saves a photo picked from the gallery', async () => {
    (pickAvatarFromGallery as jest.Mock).mockResolvedValue({ type: 'picked', uri: 'file:///picked.jpg' });
    (saveAvatar as jest.Mock).mockResolvedValue('file:///documents/profile/avatar.jpg?t=1');
    render(<SettingsScreen />);

    fireEvent.press(avatarButton());
    await act(async () => { fireEvent.press(screen.getByText('Galería')); });

    expect(useSettingsStore.getState().profilePhotoUri).toBe('file:///documents/profile/avatar.jpg?t=1');
    expect(saveAvatar).toHaveBeenCalledWith('file:///picked.jpg');
  });

  it('saves a photo taken with the camera', async () => {
    (pickAvatarFromCamera as jest.Mock).mockResolvedValue({ type: 'picked', uri: 'file:///cam.jpg' });
    (saveAvatar as jest.Mock).mockResolvedValue('file:///documents/profile/avatar.jpg?t=2');
    render(<SettingsScreen />);

    fireEvent.press(avatarButton());
    await act(async () => { fireEvent.press(screen.getByText('Cámara')); });

    expect(saveAvatar).toHaveBeenCalledWith('file:///cam.jpg');
    expect(useSettingsStore.getState().profilePhotoUri).toBe('file:///documents/profile/avatar.jpg?t=2');
  });

  it.each([{ type: 'denied' }, { type: 'cancelled' }])('does not save anything when the pick is %o', async (result) => {
    (pickAvatarFromGallery as jest.Mock).mockResolvedValue(result);
    render(<SettingsScreen />);

    fireEvent.press(avatarButton());
    await act(async () => { fireEvent.press(screen.getByText('Galería')); });

    expect(pickAvatarFromGallery).toHaveBeenCalledTimes(1);
    expect(saveAvatar).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().profilePhotoUri).toBeNull();
  });

  it('shows a spinner while the photo is being picked and recovers after a failure', async () => {
    let fail!: (e: Error) => void;
    (pickAvatarFromGallery as jest.Mock).mockReturnValue(new Promise((_, reject) => { fail = reject; }));
    render(<SettingsScreen />);

    fireEvent.press(avatarButton());
    fireEvent.press(screen.getByText('Galería'));
    expect(screen.UNSAFE_queryByType(ActivityIndicator)).not.toBeNull();

    await act(async () => { fail(new Error('picker crashed')); });

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
  });
});

describe('SettingsScreen — privacy and analytics', () => {
  it('opens the privacy policy link', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('Política de privacidad'));

    expect(Linking.openURL).toHaveBeenCalledWith(PRIVACY_URL);
  });

  it('hides the analytics switch when PostHog is not configured', () => {
    render(<SettingsScreen />);

    expect(screen.queryByText('Estadísticas de uso')).toBeNull();
    expect(screen.UNSAFE_queryByType(Switch)).toBeNull();
  });

  it('shows the switch off when the user opted out', async () => {
    mockPosthog = fakePosthog(true);
    render(<SettingsScreen />);
    await act(async () => {});

    expect(mockPosthog!.ready).toHaveBeenCalledTimes(1);
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(false);
  });

  it('shows the switch on when the user opted in', async () => {
    mockPosthog = fakePosthog(false);
    render(<SettingsScreen />);
    await act(async () => {});

    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(true);
  });

  it('opts in and out as the switch is toggled', async () => {
    mockPosthog = fakePosthog(true);
    render(<SettingsScreen />);
    await act(async () => {});

    fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', true);
    expect(mockPosthog!.optIn).toHaveBeenCalledTimes(1);
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(true);

    fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', false);
    expect(mockPosthog!.optOut).toHaveBeenCalledTimes(1);
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(false);
  });
});
