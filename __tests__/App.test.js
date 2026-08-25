const mockLoadingOverlay = jest.fn(() => null);
const mockIconButton = jest.fn(() => null);
const recordedScreens = [];

jest.mock('expo-dev-client', () => ({}));

jest.mock('expo-navigation-bar', () => ({
  NavigationBar: () => null,
  setHidden: jest.fn(),
  setStyle: jest.fn(),
  setVisibilityAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-status-bar', () => ({
  setStatusBarHidden: jest.fn(),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: jest.fn((payload) => ({ type: 'RESET', payload })),
  },
  DefaultTheme: {
    colors: {
      background: '#fff',
    },
  },
  NavigationContainer: ({ children }) => children,
  useFocusEffect: jest.fn(),
  useNavigationContainerRef: jest.fn(() => ({
    isReady: jest.fn(() => false),
    getCurrentRoute: jest.fn(() => ({ name: 'Login' })),
    dispatch: jest.fn(),
  })),
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
jest.mock('../screens/GuessScreens/GuessFeedScreen', () => 'GuessFeedScreen');
jest.mock('../screens/GuessScreens/GuessScreen', () => 'GuessScreen');
jest.mock('../screens/GuessScreens/ResultScreen', () => 'ResultScreen');
jest.mock('../screens/LanguageOnboardingScreen', () => 'LanguageOnboardingScreen');
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
  validateStoredSession: jest.fn(),
}));

jest.mock('../utils/e2eMode', () => ({
  ensureE2EOnboardingBypass: jest.fn(),
  isE2EMode: jest.fn(),
}));

jest.mock('../utils/storageDatum', () => ({
  getOnboardingCompleted: jest.fn(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import { Root } from '../App';
import { AuthContext } from '../store/auth-context';
import { bootstrapStoredAuthSession, validateStoredSession } from '../utils/auth';
import { ensureE2EOnboardingBypass, isE2EMode } from '../utils/e2eMode';
import { getOnboardingCompleted } from '../utils/storageDatum';

describe('App Root', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recordedScreens.length = 0;
    ensureE2EOnboardingBypass.mockResolvedValue(undefined);
    getOnboardingCompleted.mockResolvedValue(true);
    isE2EMode.mockReturnValue(false);
    bootstrapStoredAuthSession.mockResolvedValue(false);
    validateStoredSession.mockResolvedValue({ status: 200, data: { is_tutorial_finished: true } });
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
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

  it('renders the auth stack immediately while session restore is pending', async () => {
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

    expect(recordedScreens.map(({ name }) => name)).toEqual(expect.arrayContaining(['Login', 'Signup']));

    await act(async () => {
      resolveBootstrap(false);
      await flushEffects();
    });

    expect(bootstrapStoredAuthSession).toHaveBeenCalledWith(contextValue.restoreSession);
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

    const guessPathScreen = recordedScreens.find(({ name }) => name === 'GuessPathScreen');

    await act(async () => {
      const headerLeft = guessPathScreen.options({ navigation }).headerLeft;
      create(headerLeft());
    });

    const guessBackButton = mockIconButton.mock.calls.find(([props]) => props.testID === 'guess-path.header.back')[0];

    expect(guessBackButton.icon).toBe('arrow-back');

    await act(async () => {
      guessBackButton.onPress();
    });

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('routes authenticated users through language onboarding when onboarding is incomplete', async () => {
    bootstrapStoredAuthSession.mockResolvedValue(true);
    getOnboardingCompleted.mockResolvedValue(false);

    const contextValue = {
      IsAuthenticated: true,
      isAuthenticated: true,
      restoreSession: jest.fn(),
      logout: jest.fn(),
    };

    await renderRoot(contextValue);

    expect(getOnboardingCompleted).toHaveBeenCalledTimes(1);
    expect(recordedScreens.map(({ name }) => name)).toContain('LanguageOnboarding');
    expect(recordedScreens.map(({ name }) => name)).not.toContain('HomeScreen');
  });

  it('fails closed to language onboarding when the stored onboarding state cannot be read', async () => {
    bootstrapStoredAuthSession.mockResolvedValue(true);
    getOnboardingCompleted.mockRejectedValue(new Error('storage failed'));

    const contextValue = {
      IsAuthenticated: true,
      isAuthenticated: true,
      restoreSession: jest.fn(),
      logout: jest.fn(),
    };

    await renderRoot(contextValue);

    expect(getOnboardingCompleted).toHaveBeenCalledTimes(1);
    expect(recordedScreens.map(({ name }) => name)).toContain('LanguageOnboarding');
    expect(recordedScreens.map(({ name }) => name)).not.toContain('HomeScreen');
  });

  it('skips onboarding in e2e mode after seeding the persisted defaults', async () => {
    bootstrapStoredAuthSession.mockResolvedValue(true);
    isE2EMode.mockReturnValue(true);

    const contextValue = {
      IsAuthenticated: true,
      isAuthenticated: true,
      restoreSession: jest.fn(),
      logout: jest.fn(),
    };

    await renderRoot(contextValue);

    expect(ensureE2EOnboardingBypass).toHaveBeenCalledTimes(1);
    expect(getOnboardingCompleted).not.toHaveBeenCalled();
    expect(recordedScreens.map(({ name }) => name)).toContain('HomeScreen');
    expect(recordedScreens.map(({ name }) => name)).not.toContain('LanguageOnboarding');
  });

  it('fails closed to language onboarding when e2e onboarding seeding fails', async () => {
    bootstrapStoredAuthSession.mockResolvedValue(true);
    isE2EMode.mockReturnValue(true);
    ensureE2EOnboardingBypass.mockRejectedValue(new Error('seed failed'));

    const contextValue = {
      IsAuthenticated: true,
      isAuthenticated: true,
      restoreSession: jest.fn(),
      logout: jest.fn(),
    };

    await renderRoot(contextValue);

    expect(ensureE2EOnboardingBypass).toHaveBeenCalledTimes(1);
    expect(recordedScreens.map(({ name }) => name)).toContain('LanguageOnboarding');
    expect(recordedScreens.map(({ name }) => name)).not.toContain('HomeScreen');
  });

  it('re-validates the restored token against the backend after a successful restore', async () => {
    bootstrapStoredAuthSession.mockResolvedValue(true);

    const contextValue = {
      IsAuthenticated: true,
      isAuthenticated: true,
      restoreSession: jest.fn(),
      logout: jest.fn(),
    };

    await renderRoot(contextValue);

    expect(validateStoredSession).toHaveBeenCalledTimes(1);
    expect(validateStoredSession).toHaveBeenCalledWith({ context: contextValue });
    expect(contextValue.logout).not.toHaveBeenCalled();
  });

  it('logs out when the restored token is rejected by the backend with 401', async () => {
    bootstrapStoredAuthSession.mockResolvedValue(true);
    validateStoredSession.mockResolvedValue({ status: 401, data: { errors: ['Unauthorized'] } });

    const contextValue = {
      IsAuthenticated: true,
      isAuthenticated: true,
      restoreSession: jest.fn(),
      logout: jest.fn(),
    };

    await renderRoot(contextValue);

    expect(validateStoredSession).toHaveBeenCalledTimes(1);
    expect(contextValue.logout).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the restored token validation call fails without an auth rejection', async () => {
    bootstrapStoredAuthSession.mockResolvedValue(true);
    validateStoredSession.mockRejectedValue(new Error('network down'));

    const contextValue = {
      IsAuthenticated: true,
      isAuthenticated: true,
      restoreSession: jest.fn(),
      logout: jest.fn(),
    };

    await renderRoot(contextValue);

    expect(validateStoredSession).toHaveBeenCalledTimes(1);
    expect(contextValue.logout).not.toHaveBeenCalled();
  });

  it('skips token validation in e2e mode', async () => {
    bootstrapStoredAuthSession.mockResolvedValue(true);
    isE2EMode.mockReturnValue(true);

    const contextValue = {
      IsAuthenticated: true,
      isAuthenticated: true,
      restoreSession: jest.fn(),
      logout: jest.fn(),
    };

    await renderRoot(contextValue);

    expect(validateStoredSession).not.toHaveBeenCalled();
    expect(contextValue.logout).not.toHaveBeenCalled();
  });

  it('does not validate the token when no session was restored', async () => {
    bootstrapStoredAuthSession.mockResolvedValue(false);

    const contextValue = {
      IsAuthenticated: false,
      isAuthenticated: false,
      restoreSession: jest.fn(),
      logout: jest.fn(),
    };

    await renderRoot(contextValue);

    expect(validateStoredSession).not.toHaveBeenCalled();
    expect(contextValue.logout).not.toHaveBeenCalled();
  });
});