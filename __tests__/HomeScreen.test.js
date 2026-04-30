jest.mock('@react-navigation/native', () => {
  const React = require('react');

  return {
    useFocusEffect: (callback) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('../utils/auth', () => ({
  getScoreId: jest.fn(),
}));

jest.mock('../utils/orientation', () => ({
  handleOrientation: jest.fn(),
}));

jest.mock('../utils/tutorialHandler', () => ({
  isTutorialFinished: jest.fn(),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

jest.mock('../components/UI/BigButton', () => 'BigButton');
jest.mock('../components/UI/CenteredModal', () => 'CenteredModal');
jest.mock('../components/UI/TutorialOverlay', () => 'TutorialOverlay');
jest.mock('../components/UI/IconButton', () => 'IconButton');

import React from 'react';
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';

import HomeScreen from '../screens/HomeScreen';
import { AuthContext } from '../store/auth-context';
import { getScoreId } from '../utils/auth';

describe('HomeScreen post-launch session validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  it('validates the persisted session on focus when verifyIsLoggedIn resolves false', async () => {
    getScoreId.mockResolvedValue({ status: 401 });

    const contextValue = {
      verifyIsLoggedIn: jest.fn().mockResolvedValue(false),
      logout: jest.fn(),
      token: 'Bearer persisted-token',
      isTutorialFinished: {},
    };

    await act(async () => {
      create(
        <AuthContext.Provider value={contextValue}>
          <HomeScreen navigation={{ navigate: jest.fn(), replace: jest.fn(), reset: jest.fn() }} route={{ params: {} }} />
        </AuthContext.Provider>
      );

      await Promise.resolve();
      await Promise.resolve();
    });

    expect(contextValue.verifyIsLoggedIn).toHaveBeenCalledTimes(1);
    expect(getScoreId).toHaveBeenCalledWith(contextValue);
    expect(contextValue.logout).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error, your session has expired',
      'Any upload will not be possible. \nPlease re-log in first'
    );
  });
});