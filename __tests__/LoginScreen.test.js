jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
  }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import React from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import LoginScreen from '../screens/AuthScreens/LoginScreen';
import { AuthContext } from '../store/auth-context';

const CREDENTIALS = { email: 'waldo@example.com', password: 'secret' };

function loginResponse(status, user) {
  return {
    status,
    headers: user
      ? { authorization: `Bearer ${user.token}` }
      : undefined,
    data: user ? { data: user } : undefined,
  };
}

function renderLoginScreen(contextOverrides = {}) {
  const contextValue = {
    authenticate: jest.fn(),
    ...contextOverrides,
  };

  const screen = render(
    <AuthContext.Provider value={contextValue}>
      <LoginScreen />
    </AuthContext.Provider>
  );

  return { ...screen, contextValue };
}

function submitCredentials(screen, credentials = CREDENTIALS) {
  fireEvent.changeText(screen.getByTestId('auth.input.email'), credentials.email);
  fireEvent.changeText(screen.getByTestId('auth.input.password'), credentials.password);
  fireEvent.press(screen.getByTestId('auth.button.login-submit'));
}

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  it('logs the user in with the submitted credentials', async () => {
    axios.post.mockResolvedValue(
      loginResponse(200, {
        token: 'token',
        id: '42',
        email: 'waldo@example.com',
        username: 'waldo',
        finished_tutorial: true,
        score_id: 'score-1',
        is_paid: false,
        paid_tier: 0,
        paid_expires_at: null,
        is_group_owner: false,
        active_group_id: null,
      })
    );

    const screen = renderLoginScreen();
    submitCredentials(screen, CREDENTIALS);

    await waitFor(() => expect(screen.contextValue.authenticate).toHaveBeenCalledTimes(1));

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('auth/sign_in'),
      { email: 'waldo@example.com', password: 'secret' },
      expect.anything()
    );
    expect(screen.contextValue.authenticate).toHaveBeenCalledWith({
      token: 'Bearer token',
      userId: '42',
      email: 'waldo@example.com',
      username: 'waldo',
      isTutorialFinished: true,
      scoreId: 'score-1',
      isPaid: false,
      paidTier: 0,
      paidExpiresAt: null,
      isGroupOwner: false,
      activeGroupId: null,
    });
  });

  it('keeps the paid and group entitlements after a successful login', async () => {
    axios.post.mockResolvedValue(
      loginResponse(200, {
        token: 'premium-token',
        id: '42',
        email: 'waldo@example.com',
        username: 'waldo',
        finished_tutorial: true,
        score_id: 'score-1',
        is_paid: true,
        paid_tier: 2,
        paid_expires_at: '2099-01-01T00:00:00Z',
        is_group_owner: true,
        active_group_id: 'group-7',
      })
    );

    const screen = renderLoginScreen();
    submitCredentials(screen, CREDENTIALS);

    await waitFor(() => expect(screen.contextValue.authenticate).toHaveBeenCalledTimes(1));

    expect(screen.contextValue.authenticate).toHaveBeenCalledWith({
      token: 'Bearer premium-token',
      userId: '42',
      email: 'waldo@example.com',
      username: 'waldo',
      isTutorialFinished: true,
      scoreId: 'score-1',
      isPaid: true,
      paidTier: 2,
      paidExpiresAt: '2099-01-01T00:00:00Z',
      isGroupOwner: true,
      activeGroupId: 'group-7',
    });
  });

  it('warns about invalid credentials when the backend rejects the login', async () => {
    axios.post.mockResolvedValue(loginResponse(401));

    const screen = renderLoginScreen();
    submitCredentials(screen, CREDENTIALS);

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(1));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Invalid credentials, please retry',
      expect.stringContaining('Change your email or password before retrying')
    );
    expect(screen.contextValue.authenticate).not.toHaveBeenCalled();
  });

  it('shows an authenticating overlay while the login request is in flight', async () => {
    let resolveLogin;
    axios.post.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );

    const screen = renderLoginScreen();
    submitCredentials(screen, CREDENTIALS);

    expect(screen.getByText('Authenticating...')).toBeTruthy();

    await act(async () => {
      resolveLogin(loginResponse(500));
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.queryByText('Authenticating...')).toBeNull());
    expect(Alert.alert).toHaveBeenCalledWith(
      'Server error, please retry later',
      expect.stringContaining('Server problem on our side')
    );
  });
});
