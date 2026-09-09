// Flush lifecycle behavior suite.
//
// Drives the REAL score-send pipeline end to end: App root (AppState triggers),
// AuthContextProvider logout, GuessFeedScreen's leave flush, ShowFailure's
// mount flush, and the real GuessScreen exhausted-leave path. A seeded pending
// score travels through the real sessionScoreStore (bufferScore → flush →
// scoreRequests) to the axios transport seam, and assertions target the
// observable outcomes: score-batch POSTs (URL, payload, Authorization header)
// and the pending buffer read back through the real store.
//
// Only system boundaries are mocked:
// - AsyncStorage via __tests__/helpers/statefulAsyncStorageMock.ts (in-memory
//   stateful fake; the pending buffer is seeded with the real bufferScore and
//   read back with the real getPending)
// - expo-file-system (native FS; files "exist", deletes are recorded)
// - expo-secure-store (native keychain; token writes/deletes are observable)
// - axios (the network seam; a POST to the score-batch endpoint IS "a send")
// - native SDKs / app-shell stubs required to mount the real app (ads, nav
//   primitives, screens, and interactive GuessFlow UI stand-ins)
//
// Everything else (sessionScoreStore, storageDatum, playedPictureIds,
// handleGuessOutcome, nextCardAdvancer, cardPrefetcher, scoreRequests, auth,
// e2eMode, targetLocation, adCadence, adPolicy) runs REAL. sessionScoreStore
// keeps module state (writeChain/flushing) across tests, so every test drains
// its in-flight send before finishing.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('./helpers/statefulAsyncStorageMock')({ autoReset: true })
);

jest.mock('expo-file-system', () => {
  const deletedFiles = [];
  const cacheFiles = new Set();

  class MockFile {
    constructor(base, child) {
      this.uri = typeof base === 'string' ? base : `${base?.uri ?? ''}${child ?? ''}`;
      this.exists = true;
      this.delete = jest.fn(() => {
        deletedFiles.push(this.uri);
      });
    }
  }

  const cacheDir = {
    uri: 'file:///cache/',
    list: jest.fn(() => Array.from(cacheFiles)),
  };

  return {
    __esModule: true,
    File: MockFile,
    Paths: {
      get cache() {
        return cacheDir;
      },
    },
    __deletedFiles: deletedFiles,
    __cacheFiles: cacheFiles,
    __cacheList: cacheDir.list,
  };
});

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

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  return {
    GestureHandlerRootView: ({ children }) => React.createElement('GestureHandlerRootView', null, children),
  };
});

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

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../components/UI/IconButton', () => () => null);
jest.mock('../components/UI/LoadingOverlay', () => () => null);

jest.mock('../components/UI/SwipeImage', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockSwipeImage({ startGuessing }) {
    return React.createElement(
      Pressable,
      {
        testID: 'guess-feed.stub.swipe',
        onPress: () => startGuessing && startGuessing({
          item: {
            pictureId: 'img-1',
            imageFile: 'file:///waldo.jpg',
            listId: 1,
            description: 'Find Waldo',
            touchLocation: { x: 0.5, y: 0.5 },
          },
        }),
      },
      React.createElement(Text, null, 'swipe')
    );
  };
});

jest.mock('../components/Instructions/SwipeInstructions', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockSwipeInstructions({ handleFilterClick }) {
    return React.createElement(
      Pressable,
      { testID: 'guess-feed.stub.start-swipe', onPress: handleFilterClick },
      React.createElement(Text, null, 'start')
    );
  };
});

jest.mock('../components/Guess/GuessExitSwipeMenu', () => () => null);
jest.mock('../components/Picture/GuessPicture', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  // Interactive stub: tap drives the success path (hit, fast elapsed).
  return function MockGuessPicture(props) {
    return React.createElement(
      Pressable,
      {
        testID: 'guess.picture.tap',
        onPress: () => props.toAdScreen && props.toAdScreen({
          location: { x: 0.5, y: 0.5 },
          hiddenLocation: props.hiddenLocation,
          screenWidth: props.screenDimensions?.width ?? 320,
          screenHeight: props.screenDimensions?.height ?? 640,
          elapsedMs: 1000,
        }),
      },
      React.createElement(Text, null, 'pic')
    );
  };
});
jest.mock('../components/Guess/SuccessOverlay', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockSuccessOverlay(props) {
    if (!props.visible) return null;
    return React.createElement(
      Pressable,
      { testID: 'guess.overlay.done', onPress: props.onDone },
      React.createElement(Text, null, 'done')
    );
  };
});
jest.mock('../components/Guess/GuessExhaustedPanel', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockGuessExhaustedPanel({ onLeave }) {
    return React.createElement(
      Pressable,
      { testID: 'guess.exhausted.leave', onPress: onLeave },
      React.createElement(Text, null, 'leave')
    );
  };
});
jest.mock('../components/Guess/GuessAdvanceLoader', () => () => null);

// Ad SDK seams: the composite ad source must never touch the native ad SDKs.
jest.mock('../services/ads/FallbackAdSource', () => ({
  createFallbackAdSource: jest.fn(() => ({ isReady: () => false })),
}));
jest.mock('../services/ads/AdMobInterstitialSource', () => ({
  createAdMobInterstitialSource: jest.fn(() => ({ isReady: () => false })),
}));
jest.mock('../services/ads/InternalProAdSource', () => ({
  createInternalProAdSource: jest.fn(() => ({ isReady: () => false })),
}));

// Server deck boundary: fetchCardBatch IS the server in this suite (it always
// returns "no more cards", which drives GuessScreen to its exhausted state).
// Every storage-side deck writer stays REAL.
jest.mock('../services/cardDeck', () => {
  const actual = jest.requireActual('../services/cardDeck');
  return {
    ...actual,
    fetchCardBatch: jest.fn().mockResolvedValue({ images: [] }),
  };
});

jest.mock('../screens/Groups/HomeHeaderRight', () => ({
  HomeHeaderRight: () => null,
}));
jest.mock('../screens/AuthScreens/LoginScreen', () => () => null);
jest.mock('../screens/AuthScreens/SignupScreen', () => () => null);
jest.mock('../screens/HomeScreen', () => () => null);
jest.mock('../screens/HideScreens/HidingPathScreen', () => () => null);
jest.mock('../screens/HideScreens/HideScreen', () => () => null);
jest.mock('../screens/GuessScreens/GuessPathScreen', () => () => null);
jest.mock('../screens/GuessScreens/ResultScreen', () => () => null);
jest.mock('../screens/LanguageOnboardingScreen', () => () => null);
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

import React, { useContext, useEffect } from 'react';
import { AppState, Pressable, Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

import { Root } from '../App';
import GuessScreen from '../screens/GuessScreens/GuessScreen';
import AuthContextProvider, { AuthContext } from '../store/auth-context';
import GuessFeedScreen from '../screens/GuessScreens/GuessFeedScreen';
import ShowFailure from '../components/Results/ShowFailure';
import { bufferScore, getPending } from '../utils/sessionScoreStore';
import { __resetForTests as resetPrefetcher } from '../services/cardPrefetcher';

const authContextValue = {
  token: 'Bearer token-1',
  userId: 'user-1',
  scoreId: 'score-1',
  IsAuthenticated: true,
  isAuthenticated: true,
  restoreSession: jest.fn(),
  logout: jest.fn(),
};

const PENDING_SCORE = {
  guessId: 'g1',
  imageName: 'p1',
  pictureId: 'p1',
  points: 2,
  streak: 1,
  ts: 1,
  userId: 'user-1',
};

async function seedPendingScore() {
  await bufferScore({ ...PENDING_SCORE });
}

function sentScoreBatches() {
  return axios.post.mock.calls.filter(([url]) => String(url).endsWith('/scores/batch'));
}

const appStateListeners = [];

function installAppStateSpy() {
  appStateListeners.length = 0;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((type, cb) => {
    appStateListeners.push({ type, cb });
    return { remove: jest.fn() };
  });
}

function emitAppState(nextState) {
  act(() => {
    appStateListeners.forEach((entry) => entry.cb(nextState));
  });
}

async function flushPromises() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
}

async function actCreate(element) {
  let renderer;
  await act(async () => {
    renderer = create(element);
    await flushPromises();
  });
  return renderer;
}

async function press(renderer, testID) {
  await act(async () => {
    renderer.root.findByProps({ testID }).props.onPress();
    await flushPromises();
  });
}

function ContextProbe({ onValue }) {
  const value = useContext(AuthContext);
  useEffect(() => {
    onValue(value);
  }, [onValue, value]);
  return null;
}

function RootHost({ contextValue }) {
  return React.createElement(AuthContext.Provider, { value: contextValue }, React.createElement(Root));
}

function StackHost({ contextValue, Root }) {
  return React.createElement(AuthContext.Provider, { value: contextValue }, React.createElement(Root));
}

describe('sending the pending score buffer on app switches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrefetcher();
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue(undefined);
    SecureStore.deleteItemAsync.mockResolvedValue(undefined);
    axios.post.mockResolvedValue(true);
    installAppStateSpy();
  });

  it('sends the pending buffer to the server when the app goes to background', async () => {
    await seedPendingScore();
    await actCreate(React.createElement(RootHost, { contextValue: authContextValue }));

    emitAppState('background');
    await act(async () => { await flushPromises(); });

    const batches = sentScoreBatches();
    expect(batches).toHaveLength(1);
    const [url, body, config] = batches[0];
    expect(url).toBe('https://backend.example/api/v1/users/user-1/scores/batch');
    expect(body.batch.results).toEqual([
      { guess_id: 'g1', image_name: 'p1', points: 2, streak: 1 },
    ]);
    expect(config.headers.Authorization).toBe('Bearer token-1');
    expect(await getPending()).toEqual([]);
  });

  it('does not send when the app is merely inactive (iOS notification shade)', async () => {
    await seedPendingScore();
    await actCreate(React.createElement(RootHost, { contextValue: authContextValue }));

    emitAppState('inactive');
    await act(async () => { await flushPromises(); });

    expect(sentScoreBatches()).toHaveLength(0);
    expect(await getPending()).toHaveLength(1);
  });

  it('sends the unsent buffer when the app returns to the foreground', async () => {
    await seedPendingScore();
    await actCreate(React.createElement(RootHost, { contextValue: authContextValue }));

    await act(async () => {
      emitAppState('active');
      await flushPromises();
    });

    expect(sentScoreBatches()).toHaveLength(1);
    expect(await getPending()).toEqual([]);
  });

  it('sends nothing on foreground return when nothing is pending', async () => {
    await actCreate(React.createElement(RootHost, { contextValue: authContextValue }));

    await act(async () => {
      emitAppState('active');
      await flushPromises();
    });

    expect(sentScoreBatches()).toHaveLength(0);
  });

  it('never sends scores in e2e mode', async () => {
    process.env.EXPO_PUBLIC_E2E_MODE = 'true';
    try {
      await seedPendingScore();
      await actCreate(React.createElement(RootHost, { contextValue: authContextValue }));

      await act(async () => {
        emitAppState('active');
        await flushPromises();
      });
      emitAppState('background');
      await act(async () => { await flushPromises(); });

      expect(sentScoreBatches()).toHaveLength(0);
      expect(await getPending()).toHaveLength(1);
    } finally {
      delete process.env.EXPO_PUBLIC_E2E_MODE;
    }
  });

  it('does not monitor app state when signed out', async () => {
    await actCreate(
      React.createElement(RootHost, {
        contextValue: { ...authContextValue, IsAuthenticated: false, isAuthenticated: false },
      })
    );

    expect(appStateListeners).toHaveLength(0);
  });
});

describe('logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrefetcher();
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue(undefined);
    SecureStore.deleteItemAsync.mockResolvedValue(undefined);
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = 'test-ios-key';
    axios.post.mockResolvedValue(true);
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  });

  async function mountProvider() {
    let latestContext;
    const renderer = await actCreate(
      React.createElement(
        AuthContextProvider,
        null,
        React.createElement(ContextProbe, {
          onValue: (value) => {
            latestContext = value;
          },
        })
      )
    );
    return { renderer, getLatestContext: () => latestContext };
  }

  async function authenticate(getLatestContext) {
    await act(async () => {
      await getLatestContext().authenticate({
        token: 'Bearer token-123',
        userId: 'user-1',
        email: 'waldo@example.com',
        username: 'waldo',
        scoreId: 'score-9',
        isTutorialFinished: true,
      });
    });
  }

  it('sends the pending buffer before clearing the stored token', async () => {
    await seedPendingScore();
    const { getLatestContext } = await mountProvider();
    await authenticate(getLatestContext);

    let resolveSend;
    axios.post.mockImplementation(() => new Promise((resolve) => { resolveSend = resolve; }));

    let logoutPromise;
    await act(async () => {
      logoutPromise = getLatestContext().logout();
      await flushPromises();
    });

    expect(sentScoreBatches()).toHaveLength(1);
    const [url, , config] = sentScoreBatches()[0];
    expect(url).toBe('https://backend.example/api/v1/users/user-1/scores/batch');
    expect(config.headers.Authorization).toBe('Bearer token-123');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();

    await act(async () => {
      resolveSend(true);
      await logoutPromise;
    });

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('token');
    expect(await getPending()).toEqual([]);
  });

  it('still signs the user out when the send fails and keeps the buffer for later', async () => {
    await seedPendingScore();
    const { getLatestContext } = await mountProvider();
    await authenticate(getLatestContext);

    axios.post.mockRejectedValue(new Error('network down'));

    await act(async () => {
      await getLatestContext().logout();
    });

    expect(sentScoreBatches()).toHaveLength(1);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('token');
    expect(await getPending()).toHaveLength(1);
  });
});

describe('leaving the guess flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrefetcher();
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue(undefined);
    SecureStore.deleteItemAsync.mockResolvedValue(undefined);
    axios.post.mockResolvedValue(true);
  });

  it('advancing from the feed into a guess does not send scores', async () => {
    await seedPendingScore();
    const StackRoot = buildGuessStack({ homeTestId: 'stack.home.go-feed', guessPopTestId: 'stack.guess.pop-top' });
    const renderer = await actCreate(React.createElement(StackHost, { contextValue: authContextValue, Root: StackRoot }));

    await press(renderer, 'stack.home.go-feed');
    await press(renderer, 'guess-feed.stub.start-swipe');
    await press(renderer, 'guess-feed.stub.swipe');

    expect(sentScoreBatches()).toHaveLength(0);
    expect(await getPending()).toHaveLength(1);
  });

  it('popping home from a guess sends the pending buffer exactly once', async () => {
    await seedPendingScore();
    const StackRoot = buildGuessStack({ homeTestId: 'stack.home.go-feed', guessPopTestId: 'stack.guess.pop-top' });
    const renderer = await actCreate(React.createElement(StackHost, { contextValue: authContextValue, Root: StackRoot }));

    await press(renderer, 'stack.home.go-feed');
    await press(renderer, 'guess-feed.stub.start-swipe');
    await press(renderer, 'guess-feed.stub.swipe');
    expect(sentScoreBatches()).toHaveLength(0);

    await press(renderer, 'stack.guess.pop-top');

    const batches = sentScoreBatches();
    expect(batches).toHaveLength(1);
    expect(batches[0][1].batch.results).toEqual([
      { guess_id: 'g1', image_name: 'p1', points: 2, streak: 1 },
    ]);
    expect(await getPending()).toEqual([]);
  });
});

describe('concurrent flush triggers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrefetcher();
    appStateListeners.length = 0;
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue(undefined);
    SecureStore.deleteItemAsync.mockResolvedValue(undefined);
    axios.post.mockResolvedValue(true);
    installAppStateSpy();
  });

  it('many triggers during one in-flight send produce a single POST', async () => {
    await seedPendingScore();

    let resolveSend;
    axios.post.mockImplementation(() => new Promise((resolve) => { resolveSend = resolve; }));

    const failureRenderer = await actCreate(
      React.createElement(
        AuthContext.Provider,
        { value: authContextValue },
        React.createElement(ShowFailure, {
          navigation: { replace: jest.fn(), reset: jest.fn() },
          route: { params: { isTutorial: false } },
        })
      )
    );

    expect(sentScoreBatches()).toHaveLength(1);

    const rootRenderer = await actCreate(React.createElement(RootHost, { contextValue: authContextValue }));
    emitAppState('background');
    await act(async () => { await flushPromises(); });

    const StackRoot = buildGuessStack({ homeTestId: 'multi.home.go-feed', guessPopTestId: 'multi.guess.pop-top' });
    const stackRenderer = await actCreate(React.createElement(StackHost, { contextValue: authContextValue, Root: StackRoot }));

    await press(stackRenderer, 'multi.home.go-feed');
    await press(stackRenderer, 'guess-feed.stub.start-swipe');
    await press(stackRenderer, 'guess-feed.stub.swipe');
    await press(stackRenderer, 'multi.guess.pop-top');

    expect(sentScoreBatches()).toHaveLength(1);

    await act(async () => {
      resolveSend(true);
      await flushPromises();
    });

    expect(await getPending()).toEqual([]);

    await act(async () => {
      failureRenderer.unmount();
      rootRenderer.unmount();
      stackRenderer.unmount();
    });
  });
});

function buildGuessStack({ homeTestId, guessPopTestId }) {
  const Stack = createNativeStackNavigator();

  function HomeStandIn({ navigation }) {
    return React.createElement(
      Pressable,
      { testID: homeTestId, onPress: () => navigation.navigate('GuessFeedScreen') },
      React.createElement(Text, null, 'home')
    );
  }

  function GuessScreenStandIn({ navigation }) {
    return React.createElement(
      Pressable,
      { testID: guessPopTestId, onPress: () => navigation.popToTop() },
      React.createElement(Text, null, 'home')
    );
  }

  return function GuessStackRoot() {
    return React.createElement(
      NavigationContainer,
      null,
      React.createElement(
        Stack.Navigator,
        { initialRouteName: 'HomeScreen' },
        React.createElement(Stack.Screen, { name: 'HomeScreen', component: HomeStandIn }),
        React.createElement(Stack.Screen, {
          name: 'GuessFeedScreen',
          component: GuessFeedScreen,
          options: { headerShown: false },
        }),
        React.createElement(Stack.Screen, {
          name: 'GuessScreen',
          component: GuessScreenStandIn,
          options: { headerShown: false },
        })
      )
    );
  };
}

describe('leaving through the exhausted panel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrefetcher();
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue(undefined);
    SecureStore.deleteItemAsync.mockResolvedValue(undefined);
    axios.post.mockResolvedValue(true);
    installAppStateSpy();
  });

  function buildRealGuessStack({ homeTestId }) {
    const Stack = createNativeStackNavigator();

    function HomeStandIn({ navigation }) {
      return React.createElement(
        Pressable,
        { testID: homeTestId, onPress: () => navigation.navigate('GuessFeedScreen') },
        React.createElement(Text, null, 'home')
      );
    }

    return function GuessStackRoot() {
      return React.createElement(
        NavigationContainer,
        null,
        React.createElement(
          Stack.Navigator,
          { initialRouteName: 'HomeScreen' },
          React.createElement(Stack.Screen, { name: 'HomeScreen', component: HomeStandIn }),
          React.createElement(Stack.Screen, {
            name: 'GuessFeedScreen',
            component: GuessFeedScreen,
            options: { headerShown: false },
          }),
          React.createElement(Stack.Screen, {
            name: 'GuessScreen',
            component: GuessScreen,
            options: { headerShown: false },
          })
        )
      );
    };
  }

  it('sends the buffered score exactly once when the player leaves', async () => {
    await seedPendingScore();
    const StackRoot = buildRealGuessStack({ homeTestId: 'real.home.go-feed' });
    const renderer = await actCreate(React.createElement(StackHost, { contextValue: authContextValue, Root: StackRoot }));

    await press(renderer, 'real.home.go-feed');
    await press(renderer, 'guess-feed.stub.start-swipe');
    await press(renderer, 'guess-feed.stub.swipe');

    // Win the card, dismiss the overlay; the server (fetchCardBatch stub) is
    // empty, so the screen lands on the exhausted panel.
    await press(renderer, 'guess.picture.tap');
    await press(renderer, 'guess.overlay.done');
    await act(async () => { await flushPromises(); });

    expect(renderer.root.findByProps({ testID: 'guess.exhausted.leave' })).toBeDefined();
    expect(sentScoreBatches()).toHaveLength(0);

    await press(renderer, 'guess.exhausted.leave');
    await act(async () => { await flushPromises(); });

    const batches = sentScoreBatches();
    expect(batches).toHaveLength(1);
    expect(batches[0][1].batch.results).toEqual([
      { guess_id: 'g1', image_name: 'p1', points: 2, streak: 1 },
    ]);
    expect(await getPending()).toEqual([]);
  });
});
