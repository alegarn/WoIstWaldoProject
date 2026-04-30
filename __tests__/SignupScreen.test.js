const mockAuthContent = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);

jest.mock('../components/Auth/AuthContent', () => {
  return function MockAuthContent(props) {
    mockAuthContent(props);
    return null;
  };
});

jest.mock('../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../utils/auth', () => ({
  createUser: jest.fn(),
  getScoreId: jest.fn(),
  login: jest.fn(),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';

import SignupScreen from '../screens/AuthScreens/SignupScreen';
import { AuthContext } from '../store/auth-context';
import { createUser, getScoreId, login } from '../utils/auth';

describe('SignupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  async function renderScreen(contextValue) {
    await act(async () => {
      create(
        <AuthContext.Provider value={contextValue}>
          <SignupScreen navigation={{ navigate: jest.fn() }} />
        </AuthContext.Provider>
      );
    });
  }

  function getAuthContentProps() {
    return mockAuthContent.mock.calls[mockAuthContent.mock.calls.length - 1][0];
  }

  it('creates the user, logs them in, and stores the returned score id', async () => {
    const authenticate = jest.fn();
    const saveScoreId = jest.fn();

    createUser.mockResolvedValue({ status: 200 });
    login.mockResolvedValue({
      status: 200,
      headers: {
        authorization: 'Bearer token',
        expiry: '123',
        'access-token': 'access',
        uid: 'new@example.com',
        client: 'client',
      },
      data: {
        data: {
          id: '42',
          email: 'new@example.com',
          username: 'new-user',
        },
      },
    });
    getScoreId.mockResolvedValue({ status: 200, data: { score_id: 'score-1' } });

    await renderScreen({ authenticate, saveScoreId });

    await act(async () => {
      await getAuthContentProps().onAuthenticate({
        email: 'new@example.com',
        password: 'secret',
        confirmPassword: 'secret',
        username: 'new-user',
      });
    });

    expect(createUser).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secret',
      confirmPassword: 'secret',
      username: 'new-user',
    });
    expect(login).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secret',
    });
    expect(authenticate).toHaveBeenCalledWith({
      token: 'Bearer token',
      expiry: '123',
      access_token: 'access',
      uid: 'new@example.com',
      client: 'client',
      userId: '42',
      email: 'new@example.com',
      username: 'new-user',
    });
    expect(saveScoreId).toHaveBeenCalledWith('score-1');
  });

  it('shows a duplicate-user alert when signup fails with 422', async () => {
    createUser.mockResolvedValue({ status: 422 });

    await renderScreen({ authenticate: jest.fn(), saveScoreId: jest.fn() });

    await act(async () => {
      await getAuthContentProps().onAuthenticate({
        email: 'new@example.com',
        password: 'secret',
        confirmPassword: 'secret',
        username: 'new-user',
      });
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'User creation failed',
      '422: Please choose an other email.'
    );
  });

  it('renders the loading overlay while the signup pipeline is still pending', async () => {
    let resolveCreateUser;

    createUser.mockReturnValue(
      new Promise((resolve) => {
        resolveCreateUser = resolve;
      })
    );

    await renderScreen({ authenticate: jest.fn(), saveScoreId: jest.fn() });

    await act(async () => {
      getAuthContentProps().onAuthenticate({
        email: 'new@example.com',
        password: 'secret',
        confirmPassword: 'secret',
        username: 'new-user',
      });
      await Promise.resolve();
    });

    expect(mockLoadingOverlay).toHaveBeenCalledWith({ message: 'Creating user...' });

    await act(async () => {
      resolveCreateUser({ status: 500 });
      await Promise.resolve();
    });
  });
});