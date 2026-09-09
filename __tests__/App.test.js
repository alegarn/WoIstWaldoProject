// App root launch suite.
//
// Renders the REAL app root (real NavigationContainer + native-stack navigator)
// and asserts the launch decisions App.tsx owns:
// - the auth gate (login screen when signed out, app shell when authed)
// - restoring the persisted session from SecureStore
// - the token re-validation probe (logout only on auth rejection)
// - the language-onboarding gate (including fail-closed paths and e2e bypass)
//
// Only system boundaries are mocked:
// - AsyncStorage via __tests__/helpers/statefulAsyncStorageMock.ts (in-memory
//   stateful fake, READ-ONLY: seeded/read through its own API)
// - expo-secure-store (native keychain)
// - expo-file-system (native FS)
// - axios (the network seam)
// - native SDKs / app-shell stubs required to mount the real navigator
//   (ads, nav primitives, screens as inert stand-ins)
//
// Everything else (auth, e2eMode, storageDatum, i18n, navigation) runs REAL.
// Router-config plumbing (which screen is registered at which route) and
// header-option prop capture are intentionally NOT asserted here: screen
// behavior lives in the per-screen suites, the header-right in
// HomeHeaderRight.test.js, the logout provider flow in flushLifecycle.test.js,
// and press-through routing in the Maestro e2e flows.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('./helpers/statefulAsyncStorageMock')({ autoReset: true })
);

jest.mock('expo-file-system', () => ({
  __esModule: true,
  File: class {
    constructor(base, child) {
      this.uri = typeof base === 'string' ? base : `${base?.uri ?? ''}${child ?? ''}`;
      this.exists = true;
      this.delete = jest.fn();
    }
  },
  Paths: {
    cache: { uri: 'file:///cache/' },
  },
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    })),
  },
}));

jest.mock('expo-dev-client', () => ({}));

jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: jest.fn(),
  MobileAds: { initialize: jest.fn(() => ({ adapterStatuses: 'ready' })) },
  MaxAdContentRating: { PG: 'pg' },
  AdsConsentStatus: {},
  AdsConsentDebugGeography: { EEA: 'EEA' },
}));

jest.mock('expo-navigation-bar', () => ({
  NavigationBar: ({ children }) => children,
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

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('react-native-screens', () => {
  const React = require('react');
  const { View } = require('react-native');
  const stub = (props) => React.createElement(View, props, props && props.children);
  return {
    enableScreens: jest.fn(),
    enableFreeze: jest.fn(),
    shouldUseActivityState: () => false,
    Screen: stub,
    ScreenContainer: stub,
    ScreenStack: stub,
    ScreenStackItem: stub,
    ScreenStackHeaderConfig: stub,
    ScreenStackHeaderBackButtonImage: stub,
    ScreenStackHeaderCenterView: stub,
    ScreenStackHeaderLeftView: stub,
    ScreenStackHeaderRightView: stub,
    ScreenStackHeaderSearchBarView: stub,
    SearchBar: stub,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 320, height: 640 };
  const SafeAreaInsetsContext = React.createContext(inset);
  const SafeAreaFrameContext = React.createContext(frame);
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: SafeAreaInsetsContext.Consumer,
    SafeAreaInsetsContext,
    SafeAreaFrameContext,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets: inset, frame },
    initialWindowSafeAreaInsets: inset,
  };
});

jest.mock('../components/UI/IconButton', () => () => null);
jest.mock('../components/UI/LoadingOverlay', () => () => null);

jest.mock('../screens/Groups/HomeHeaderRight', () => ({
  HomeHeaderRight: () => null,
}));

jest.mock('../screens/AuthScreens/LoginScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function LoginScreenStandIn() {
    return React.createElement(Text, { testID: 'screen.login' }, 'login');
  };
});

jest.mock('../screens/HomeScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function HomeScreenStandIn() {
    return React.createElement(Text, { testID: 'screen.home' }, 'home');
  };
});

jest.mock('../screens/LanguageOnboardingScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function LanguageOnboardingScreenStandIn() {
    return React.createElement(Text, { testID: 'screen.language-onboarding' }, 'onboarding');
  };
});

jest.mock('../screens/AuthScreens/SignupScreen', () => () => null);
jest.mock('../screens/HideScreens/HidingPathScreen', () => () => null);
jest.mock('../screens/HideScreens/HideScreen', () => () => null);
jest.mock('../screens/GuessScreens/GuessPathScreen', () => () => null);
jest.mock('../screens/GuessScreens/GuessFeedScreen', () => () => null);
jest.mock('../screens/GuessScreens/GuessScreen', () => () => null);
jest.mock('../screens/GuessScreens/ResultScreen', () => () => null);
jest.mock('../screens/SetInstructionScreen', () => () => null);
jest.mock('../screens/RankingScreen', () => () => null);
jest.mock('../screens/SettingsScreen', () => () => null);
jest.mock('../screens/Groups/GroupsListScreen', () => () => null);
jest.mock('../screens/Groups/PrivateHomeScreen', () => () => null);
jest.mock('../screens/Groups/CreateGroupScreen', () => () => null);
jest.mock('../screens/Groups/GroupSettingsScreen', () => () => null);
jest.mock('../screens/Groups/JoinByCodeScreen', () => () => null);
jest.mock('../screens/Groups/MemberManagementScreen', () => () => null);
jest.mock('../screens/Billing/PaywallScreen', () => () => null);
jest.mock('../screens/Billing/SubscriptionManagementScreen', () => () => null);

import React from 'react';
import { act, create } from 'react-test-renderer';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import { Root } from '../App';
import { AuthContext } from '../store/auth-context';

const asyncStorageMock = jest.requireMock('@react-native-async-storage/async-storage');

const mountedRenderers = [];

function buildContextValue({ authenticated } = {}) {
  return {
    token: 'Bearer token-1',
    userId: 'user-1',
    scoreId: 'score-1',
    IsAuthenticated: authenticated,
    isAuthenticated: authenticated,
    restoreSession: jest.fn(),
    logout: jest.fn(),
  };
}

function seedStoredSession() {
  SecureStore.getItemAsync.mockImplementation((key) =>
    Promise.resolve(key === 'token' ? 'Bearer token-1' : key === 'userId' ? 'user-1' : null)
  );
}

function seedStoredSessionPending() {
  let resolveStorage;
  const pendingStorage = new Promise((resolve) => {
    resolveStorage = resolve;
  });

  SecureStore.getItemAsync.mockImplementation(() => pendingStorage);

  return (value) => resolveStorage(value);
}

async function flushPromises() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
}

async function mountRoot(contextValue) {
  let renderer;

  await act(async () => {
    renderer = create(
      <AuthContext.Provider value={contextValue}>
        <Root />
      </AuthContext.Provider>
    );

    await flushPromises();
  });

  mountedRenderers.push(renderer);
  return renderer;
}

function hasScreen(renderer, testID) {
  return renderer.root.findAllByProps({ testID }).length > 0;
}

afterEach(async () => {
  while (mountedRenderers.length > 0) {
    const renderer = mountedRenderers.pop();

    await act(async () => {
      renderer.unmount();
    });
  }
});

describe('App root', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue(undefined);
    SecureStore.deleteItemAsync.mockResolvedValue(undefined);
    axios.get.mockResolvedValue({ status: 200, data: {} });
    axios.post.mockResolvedValue({});
  });

  it('mounts the signed-out app on the login screen without restoring or probing anything', async () => {
    const contextValue = buildContextValue({ authenticated: false });

    const renderer = await mountRoot(contextValue);

    expect(hasScreen(renderer, 'screen.login')).toBe(true);
    expect(hasScreen(renderer, 'screen.home')).toBe(false);
    expect(contextValue.restoreSession).not.toHaveBeenCalled();
    expect(contextValue.logout).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('shows the login screen immediately and restores the stored session once storage resolves', async () => {
    const contextValue = buildContextValue({ authenticated: false });
    const resolveStorage = seedStoredSessionPending();

    const renderer = await mountRoot(contextValue);

    expect(hasScreen(renderer, 'screen.login')).toBe(true);
    expect(contextValue.restoreSession).not.toHaveBeenCalled();

    await act(async () => {
      resolveStorage('Bearer token-1');
      await flushPromises();
    });

    expect(contextValue.restoreSession).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'Bearer token-1' })
    );
  });

  it('mounts the authenticated app on home for an authed context with a stored session', async () => {
    seedStoredSession();
    await AsyncStorage.setItem('onboardingCompleted', 'true');
    const contextValue = buildContextValue({ authenticated: true });

    const renderer = await mountRoot(contextValue);

    expect(hasScreen(renderer, 'screen.home')).toBe(true);
    expect(hasScreen(renderer, 'screen.login')).toBe(false);
    expect(contextValue.restoreSession).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'Bearer token-1', userId: 'user-1' })
    );
  });

  it('keeps the session when the restored token is still server-valid', async () => {
    seedStoredSession();
    await AsyncStorage.setItem('onboardingCompleted', 'true');
    const contextValue = buildContextValue({ authenticated: true });

    const renderer = await mountRoot(contextValue);

    expect(hasScreen(renderer, 'screen.home')).toBe(true);
    expect(contextValue.logout).not.toHaveBeenCalled();
  });

  it('logs the user out when the server rejects the restored token with 401', async () => {
    seedStoredSession();
    axios.get.mockResolvedValue({ status: 401, data: { errors: ['Unauthorized'] } });
    const contextValue = buildContextValue({ authenticated: true });

    await mountRoot(contextValue);

    expect(contextValue.logout).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the validation probe fails without an auth rejection', async () => {
    seedStoredSession();
    await AsyncStorage.setItem('onboardingCompleted', 'true');
    axios.get.mockRejectedValue(new Error('network down'));
    const contextValue = buildContextValue({ authenticated: true });

    const renderer = await mountRoot(contextValue);

    expect(hasScreen(renderer, 'screen.home')).toBe(true);
    expect(contextValue.logout).not.toHaveBeenCalled();
  });

  it('does not probe the backend when no session is stored', async () => {
    const contextValue = buildContextValue({ authenticated: false });

    await mountRoot(contextValue);

    expect(axios.get).not.toHaveBeenCalled();
    expect(contextValue.logout).not.toHaveBeenCalled();
  });

  it('skips the backend probe in e2e mode', async () => {
    seedStoredSession();
    process.env.EXPO_PUBLIC_E2E_MODE = 'true';

    try {
      const contextValue = buildContextValue({ authenticated: true });

      const renderer = await mountRoot(contextValue);

      expect(hasScreen(renderer, 'screen.home')).toBe(true);
      expect(axios.get).not.toHaveBeenCalled();
      expect(contextValue.logout).not.toHaveBeenCalled();
    } finally {
      delete process.env.EXPO_PUBLIC_E2E_MODE;
    }
  });

  it('lands on home when onboarding is already completed', async () => {
    seedStoredSession();
    await AsyncStorage.setItem('onboardingCompleted', 'true');
    const contextValue = buildContextValue({ authenticated: true });

    const renderer = await mountRoot(contextValue);

    expect(hasScreen(renderer, 'screen.home')).toBe(true);
    expect(hasScreen(renderer, 'screen.language-onboarding')).toBe(false);
  });

  it('routes through language onboarding when onboarding is incomplete', async () => {
    seedStoredSession();
    await AsyncStorage.setItem('onboardingCompleted', 'false');
    const contextValue = buildContextValue({ authenticated: true });

    const renderer = await mountRoot(contextValue);

    expect(hasScreen(renderer, 'screen.language-onboarding')).toBe(true);
    expect(hasScreen(renderer, 'screen.home')).toBe(false);
  });

  it('fails closed to language onboarding when the stored onboarding flag cannot be read', async () => {
    seedStoredSession();
    asyncStorageMock.default.getItem.mockImplementationOnce((key) =>
      key === 'onboardingCompleted'
        ? Promise.reject(new Error('storage failed'))
        : Promise.resolve(asyncStorageMock.__store.has(key) ? asyncStorageMock.__store.get(key) : null)
    );
    const contextValue = buildContextValue({ authenticated: true });

    const renderer = await mountRoot(contextValue);

    expect(hasScreen(renderer, 'screen.language-onboarding')).toBe(true);
    expect(hasScreen(renderer, 'screen.home')).toBe(false);
  });

  it('seeds the onboarding bypass and lands on home in e2e mode', async () => {
    seedStoredSession();
    process.env.EXPO_PUBLIC_E2E_MODE = 'true';

    try {
      const contextValue = buildContextValue({ authenticated: true });

      const renderer = await mountRoot(contextValue);

      expect(hasScreen(renderer, 'screen.home')).toBe(true);
      expect(hasScreen(renderer, 'screen.language-onboarding')).toBe(false);
      expect(await AsyncStorage.getItem('onboardingCompleted')).toBe('true');
      expect(await AsyncStorage.getItem('preferredLanguage')).toBe('en');
    } finally {
      delete process.env.EXPO_PUBLIC_E2E_MODE;
    }
  });

  it('fails closed to language onboarding when the e2e bypass seeding fails', async () => {
    seedStoredSession();
    asyncStorageMock.default.setItem.mockRejectedValueOnce(new Error('seed failed'));
    process.env.EXPO_PUBLIC_E2E_MODE = 'true';

    try {
      const contextValue = buildContextValue({ authenticated: true });

      const renderer = await mountRoot(contextValue);

      expect(hasScreen(renderer, 'screen.language-onboarding')).toBe(true);
      expect(hasScreen(renderer, 'screen.home')).toBe(false);
    } finally {
      delete process.env.EXPO_PUBLIC_E2E_MODE;
    }
  });
});
