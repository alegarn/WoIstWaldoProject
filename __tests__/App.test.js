const mockLoadingOverlay = jest.fn(() => null);
const mockIconButton = jest.fn(() => null);
const recordedScreens = [];

jest.mock('expo-dev-client', () => ({}));

jest.mock('expo-navigation-bar', () => ({
  setPositionAsync: jest.fn(),
  setVisibilityAsync: jest.fn(),
  setBehaviorAsync: jest.fn(),
}));

jest.mock('expo-status-bar', () => ({
  setStatusBarHidden: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }) => children,
}));

jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');

  return {
    createNativeStackNavigator: jest.fn(() => ({
      Navigator: ({ children }) => <>{children}</>,
      Screen: (props) => {
        recordedScreens.push(props);
        return null;
      },
    })),
  };
});

jest.mock('../components/UI/IconButton', () => {
  return function MockIconButton(props) {
    mockIconButton(props);
    return null;
  };
});

jest.mock('../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../screens/AuthScreens/LoginScreen', () => 'LoginScreen');
jest.mock('../screens/AuthScreens/SignupScreen', () => 'SignupScreen');
jest.mock('../screens/HomeScreen', () => 'HomeScreen');
jest.mock('../screens/HideScreens/HidingPathScreen', () => 'HidingPathScreen');
jest.mock('../screens/HideScreens/HideScreen', () => 'HideScreen');
jest.mock('../screens/GuessScreens/GuessPathScreen', () => 'GuessPathScreen');
jest.mock('../screens/GuessScreens/GuessScreen', () => 'GuessScreen');
jest.mock('../screens/GuessScreens/AdScreen', () => 'AdScreen');
jest.mock('../screens/GuessScreens/ResultScreen', () => 'ResultScreen');
jest.mock('../screens/SetInstructionScreen', () => 'SetInstructionScreen');
jest.mock('../screens/RankingScreen', () => 'RankingScreen');
jest.mock('../screens/SettingsScreen', () => 'SettingsScreen');

jest.mock('../store/auth-context', () => {
  const React = require('react');
  const AuthContext = React.createContext({});

  return {
    __esModule: true,
    AuthContext,
    default: ({ children }) => children,
  };
});

jest.mock('../utils/auth', () => ({
  bootstrapStoredAuthSession: jest.fn(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import { Root } from '../App';
import { AuthContext } from '../store/auth-context';
import { bootstrapStoredAuthSession } from '../utils/auth';

describe('App Root', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recordedScreens.length = 0;
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
  }

  async function renderRoot(contextValue) {
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue}>
          <Root />
        </AuthContext.Provider>
      );

      await flushEffects();
    });

    return renderer;
  }

  it('shows the login loading gate and then renders the auth stack when no session is restored', async () => {
    let resolveBootstrap;

    bootstrapStoredAuthSession.mockReturnValue(
      new Promise((resolve) => {
        resolveBootstrap = resolve;
      })
    );

    const contextValue = {
      IsAuthenticated: false,
      isAuthenticated: false,
      restoreSession: jest.fn(),
      logout: jest.fn(),
    };

    await renderRoot(contextValue);

    expect(mockLoadingOverlay).toHaveBeenCalledWith({ message: 'Logging in...' });

    await act(async () => {
      resolveBootstrap(false);
      await flushEffects();
    });

    expect(bootstrapStoredAuthSession).toHaveBeenCalledWith(contextValue.restoreSession);
    expect(recordedScreens.map(({ name }) => name)).toEqual(expect.arrayContaining(['Login', 'Signup']));
  });

  it('renders the authenticated stack and wires the header actions for settings and logout', async () => {
    bootstrapStoredAuthSession.mockResolvedValue(true);

    const contextValue = {
      IsAuthenticated: true,
      isAuthenticated: true,
      restoreSession: jest.fn(),
      logout: jest.fn(),
    };
    const navigation = {
      navigate: jest.fn(),
      goBack: jest.fn(),
    };

    await renderRoot(contextValue);

    expect(recordedScreens.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'HomeScreen',
        'SettingsScreen',
        'HidingPathScreen',
        'GuessPathScreen',
        'GuessScreen',
        'AdScreen',
        'ResultScreen',
        'RankingScreen',
      ])
    );

    const homeScreen = recordedScreens.find(({ name }) => name === 'HomeScreen');

    await act(async () => {
      const headerRight = homeScreen.options({ navigation }).headerRight;
      create(headerRight({ tintColor: 'white' }));
    });

    const settingsButton = mockIconButton.mock.calls.find(([props]) => props.testID === 'home.header.settings')[0];
    const logoutButton = mockIconButton.mock.calls.find(([props]) => props.testID === 'home.header.logout')[0];

    await act(async () => {
      settingsButton.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('SettingsScreen');

    await act(async () => {
      logoutButton.onPress();
    });

    expect(contextValue.logout).toHaveBeenCalledTimes(1);
    expect(mockLoadingOverlay).toHaveBeenCalledWith({ message: 'Disconnecting...' });
  });
});