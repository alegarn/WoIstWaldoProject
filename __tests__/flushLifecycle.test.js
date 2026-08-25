jest.mock('expo-dev-client', () => ({}));

// T1.11: required so App.tsx (which flushLifecycle.test.js imports as <Root />)
// can load — without it, the suite errors on `MobileAds` TurboModule lookup.
// Mirrors the pattern in __tests__/adHandling.test.js.
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

jest.mock('../utils/sessionScoreStore', () => {
  const actual = jest.requireActual('../utils/sessionScoreStore');
  return {
    ...actual,
    flush: jest.fn().mockImplementation(actual.flush),
    getPending: jest.fn().mockImplementation(actual.getPending),
  };
});

jest.mock('../utils/e2eMode', () => ({
  ensureE2EOnboardingBypass: jest.fn(),
  isE2EMode: jest.fn(),
}));

jest.mock('../utils/auth', () => ({
  bootstrapStoredAuthSession: jest.fn(),
  getStoredAuthState: jest.fn(),
  hasCompleteAuthState: jest.fn(),
  isPersistedBearerToken: jest.fn(),
  validateStoredSession: jest.fn(),
}));

jest.mock('../utils/storageDatum', () => ({
  getOnboardingCompleted: jest.fn(),
  getSessionLanguageFilter: jest.fn(),
  saveSessionLanguageFilter: jest.fn(),
  emptyImageList: jest.fn().mockResolvedValue(undefined),
  getNextImagesForScope: jest.fn().mockResolvedValue([]),
  wipePublicGuessStorage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/guessNavigation', () => ({
  navigateToNextGuess: jest.fn(),
}));

jest.mock('../components/Results/ResultChoices', () => () => null);
jest.mock('../components/UI/TutorialOverlay', () => () => null);

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

jest.mock('../hooks/useActiveGroup', () => ({
  useActiveGroup: () => ({ scope: { kind: 'public' } }),
}));

jest.mock('../store/privateGroupTheme-context', () => {
  const React = require('react');
  return {
    PrivateGroupThemeProvider: ({ children }) => children,
    useScopedPrivateGroupTheme: () => ({ group: null, theme: null }),
  };
});

jest.mock('../components/UI/IconButton', () => () => null);
jest.mock('../components/UI/LoadingOverlay', () => () => null);

// T1.11: sub-component + util mocks required so the REAL GuessScreen (used by the
// new "exhausted Leave" regression test) can mount without dragging in deck /
// billing / ad transport. Mocks mirror GuessScreen.test.tsx's contracts.
jest.mock('../components/Guess/GuessExitSwipeMenu', () => () => null);
jest.mock('../components/Picture/GuessPicture', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  // Interactive stub: tap drives the success path (target on, fast elapsed).
  return function MockGuessPicture(props) {
    return React.createElement(
      Pressable,
      {
        testID: 'guess.picture.tap',
        onPress: () => props.toAdScreen && props.toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 }),
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
jest.mock('../utils/targetLocation', () => ({ isOnTarget: jest.fn(() => true) }));
jest.mock('../utils/handleGuessOutcome', () => ({
  applySuccessSideEffects: jest.fn(() => Promise.resolve()),
  resolveNextGuessParams: jest.fn(),
}));
jest.mock('../utils/nextCardAdvancer', () => {
  const actual = jest.requireActual('../utils/nextCardAdvancer');
  return { ...actual, resolveNextCardWithServerFallback: jest.fn(actual.resolveNextCardWithServerFallback) };
});
jest.mock('../services/cardDeck', () => ({
  fetchCardBatch: jest.fn().mockResolvedValue({ images: [] }),
  appendCardBatch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/cardPrefetcher', () => {
  const actual = jest.requireActual('../services/cardPrefetcher');
  return {
    ...actual,
    prefetchIfLow: jest.fn(() => Promise.resolve()),
    warmAllDeckIfNeeded: jest.fn(() => Promise.resolve()),
  };
});
jest.mock('../utils/speedMultiplier', () => {
  const actual = jest.requireActual('../utils/speedMultiplier');
  return { ...actual };
});
jest.mock('../utils/adCadence', () => ({
  consumeAdSlot: jest.fn(() => ({ showAd: false, nextCount: 0 })),
}));
jest.mock('../services/billing/adPolicy', () => ({
  shouldSuppressAds: jest.fn(() => false),
}));
jest.mock('../services/ads/FallbackAdSource', () => ({
  createFallbackAdSource: jest.fn(() => ({ isReady: () => false })),
}));
jest.mock('../services/ads/AdMobInterstitialSource', () => ({
  createAdMobInterstitialSource: jest.fn(() => ({ isReady: () => false })),
}));
jest.mock('../services/ads/InternalProAdSource', () => ({
  createInternalProAdSource: jest.fn(() => ({ isReady: () => false })),
}));
jest.mock('../utils/scoreRequests', () => ({
  submitScoreBatch: jest.fn().mockResolvedValue(true),
  updateUserScore: jest.fn(),
  getRankingData: jest.fn(),
  getUserScores: jest.fn(),
}));

jest.mock('../screens/Groups/HomeHeaderRight', () => ({
  HomeHeaderRight: () => null,
}));
jest.mock('../screens/AuthScreens/LoginScreen', () => () => null);
jest.mock('../screens/AuthScreens/SignupScreen', () => () => null);
jest.mock('../screens/HomeScreen', () => () => null);
jest.mock('../screens/HideScreens/HidingPathScreen', () => () => null);
jest.mock('../screens/HideScreens/HideScreen', () => () => null);
jest.mock('../screens/GuessScreens/GuessPathScreen', () => () => null);
jest.mock('../screens/GuessScreens/GuessScreen', () => () => null);
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
import { AppState, Pressable, Text, View } from 'react-native';
import { act, create } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';

import { Root } from '../App';
import AuthContextProvider, { AuthContext } from '../store/auth-context';
import GuessFeedScreen from '../screens/GuessScreens/GuessFeedScreen';
import ShowFailure from '../components/Results/ShowFailure';
import { flush as mockedFlush, getPending as mockedGetPending } from '../utils/sessionScoreStore';
import { isE2EMode } from '../utils/e2eMode';
import { bootstrapStoredAuthSession, validateStoredSession } from '../utils/auth';
import { getOnboardingCompleted } from '../utils/storageDatum';

const authContextValue = {
  token: 'Bearer token-1',
  userId: 'user-1',
  scoreId: 'score-1',
  IsAuthenticated: true,
  isAuthenticated: true,
  restoreSession: jest.fn(),
  logout: jest.fn(),
};

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

function flushPromises() {
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => Promise.resolve());
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

describe('flush lifecycle - AppState (App.js)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateListeners.length = 0;
    isE2EMode.mockReturnValue(false);
    bootstrapStoredAuthSession.mockResolvedValue(true);
    validateStoredSession.mockResolvedValue({ status: 200, data: {} });
    getOnboardingCompleted.mockResolvedValue(true);
    mockedFlush.mockReset();
    mockedGetPending.mockReset();
    mockedGetPending.mockResolvedValue([]);
    mockedFlush.mockResolvedValue({ ok: true, sent: 0, retained: 0 });
    installAppStateSpy();
  });

  it('flushes once on AppState background when authenticated (non-e2e)', async () => {
    await actCreate(React.createElement(RootHost, { contextValue: authContextValue }));

    emitAppState('background');
    await act(async () => { await flushPromises(); });

    expect(mockedFlush).toHaveBeenCalledTimes(1);
    expect(mockedFlush).toHaveBeenCalledWith({ authContext: authContextValue });
  });

  it('does NOT flush on AppState inactive (iOS notification/control-center pull-down)', async () => {
    await actCreate(React.createElement(RootHost, { contextValue: authContextValue }));

    emitAppState('inactive');
    await act(async () => { await flushPromises(); });

    expect(mockedFlush).not.toHaveBeenCalled();
  });

  it('retries a retained buffer on AppState active when getPending returns items', async () => {
    mockedGetPending.mockResolvedValue([{ guessId: 'g1' }]);
    await actCreate(React.createElement(RootHost, { contextValue: authContextValue }));

    await act(async () => {
      emitAppState('active');
      await flushPromises();
    });

    expect(mockedGetPending).toHaveBeenCalledTimes(1);
    expect(mockedFlush).toHaveBeenCalledTimes(1);
    expect(mockedFlush).toHaveBeenCalledWith({ authContext: authContextValue });
  });

  it('does NOT retry on AppState active when the buffer is empty', async () => {
    mockedGetPending.mockResolvedValue([]);
    await actCreate(React.createElement(RootHost, { contextValue: authContextValue }));

    await act(async () => {
      emitAppState('active');
      await flushPromises();
    });

    expect(mockedFlush).not.toHaveBeenCalled();
  });

  it('keeps the e2e scheduleHomeResetForE2E path on active and does NOT flush in e2e mode', async () => {
    isE2EMode.mockReturnValue(true);
    await actCreate(React.createElement(RootHost, { contextValue: authContextValue }));

    expect(appStateListeners.length).toBe(1);

    await act(async () => {
      emitAppState('active');
      await flushPromises();
    });

    expect(mockedFlush).not.toHaveBeenCalled();
  });

  it('does not attach any AppState listener when unauthenticated', async () => {
    await actCreate(
      React.createElement(RootHost, {
        contextValue: { ...authContextValue, IsAuthenticated: false, isAuthenticated: false },
      })
    );

    expect(appStateListeners.length).toBe(0);
  });
});

describe('flush lifecycle - logout flushes before token clear', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue(undefined);
    SecureStore.deleteItemAsync.mockResolvedValue(undefined);
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = 'test-ios-key';
    mockedFlush.mockReset();
    mockedFlush.mockResolvedValue({ ok: true, sent: 1, retained: 0 });
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  });

  function callOrderForArg(mock, arg) {
    const idx = mock.mock.calls.findIndex((args) => args[0] === arg);
    return idx === -1 ? null : mock.mock.invocationCallOrder[idx];
  }

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

  it('awaits flush before deleting the persisted token', async () => {
    const { getLatestContext } = await mountProvider();

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

    mockedFlush.mockClear();

    await act(async () => {
      await getLatestContext().logout();
    });

    expect(mockedFlush).toHaveBeenCalledTimes(1);
    const flushOrder = mockedFlush.mock.invocationCallOrder[0];
    const tokenDeleteOrder = callOrderForArg(SecureStore.deleteItemAsync, 'token');

    expect(tokenDeleteOrder).not.toBeNull();
    expect(flushOrder).toBeLessThan(tokenDeleteOrder);

    const flushedContext = mockedFlush.mock.calls[0][0].authContext;
    expect(flushedContext.token).toBe('Bearer token-123');
  });

  it('still clears the token when flush rejects (logout proceeds, buffer retained)', async () => {
    const { getLatestContext } = await mountProvider();

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

    mockedFlush.mockClear();
    mockedFlush.mockRejectedValueOnce(new Error('network down'));

    await act(async () => {
      await getLatestContext().logout();
    });

    expect(mockedFlush).toHaveBeenCalledTimes(1);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('token');
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

function StackHost({ contextValue, Root }) {
  return React.createElement(AuthContext.Provider, { value: contextValue }, React.createElement(Root));
}

describe('flush lifecycle - swipe-menu Home leaves the guess flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFlush.mockReset();
    mockedFlush.mockResolvedValue({ ok: true, sent: 0, retained: 0 });
  });

  it('entering GuessScreen from GuessFeedScreen does NOT flush (advances in place, no leave)', async () => {
    const StackRoot = buildGuessStack({ homeTestId: 'stack.home.go-feed', guessPopTestId: 'stack.guess.pop-top' });
    const renderer = await actCreate(React.createElement(StackHost, { contextValue: authContextValue, Root: StackRoot }));

    await press(renderer, 'stack.home.go-feed');

    expect(mockedFlush).not.toHaveBeenCalled();

    await press(renderer, 'guess-feed.stub.start-swipe');
    await press(renderer, 'guess-feed.stub.swipe');

    expect(mockedFlush).not.toHaveBeenCalled();
  });

  it('swipe-menu Home (popToTop from GuessScreen) removes GuessFeedScreen and fires the leave flush exactly once', async () => {
    const StackRoot = buildGuessStack({ homeTestId: 'stack.home.go-feed', guessPopTestId: 'stack.guess.pop-top' });
    const renderer = await actCreate(React.createElement(StackHost, { contextValue: authContextValue, Root: StackRoot }));

    await press(renderer, 'stack.home.go-feed');
    await press(renderer, 'guess-feed.stub.start-swipe');
    await press(renderer, 'guess-feed.stub.swipe');

    expect(mockedFlush).not.toHaveBeenCalled();

    await press(renderer, 'stack.guess.pop-top');

    expect(mockedFlush).toHaveBeenCalledTimes(1);
    expect(mockedFlush).toHaveBeenCalledWith({ authContext: authContextValue });
  });
});

describe('flush lifecycle - rapid multi-trigger wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateListeners.length = 0;
    isE2EMode.mockReturnValue(false);
    bootstrapStoredAuthSession.mockResolvedValue(true);
    validateStoredSession.mockResolvedValue({ status: 200, data: {} });
    getOnboardingCompleted.mockResolvedValue(true);
    mockedFlush.mockReset();
    mockedGetPending.mockReset();
    mockedGetPending.mockResolvedValue([]);
    mockedFlush.mockReturnValue(new Promise(() => {}));
    installAppStateSpy();
  });

  it('invokes flush from each wiring point once when flush never resolves (coalescing owned by the buffer)', async () => {
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

    expect(mockedFlush).toHaveBeenCalledTimes(1);

    await actCreate(React.createElement(RootHost, { contextValue: authContextValue }));

    emitAppState('background');
    await act(async () => { await flushPromises(); });

    expect(mockedFlush).toHaveBeenCalledTimes(2);

    const StackRoot = buildGuessStack({ homeTestId: 'multi.home.go-feed', guessPopTestId: 'multi.guess.pop-top' });
    const stackRenderer = await actCreate(React.createElement(StackHost, { contextValue: authContextValue, Root: StackRoot }));

    await press(stackRenderer, 'multi.home.go-feed');
    await press(stackRenderer, 'guess-feed.stub.start-swipe');
    await press(stackRenderer, 'guess-feed.stub.swipe');
    await press(stackRenderer, 'multi.guess.pop-top');

    expect(mockedFlush).toHaveBeenCalledTimes(3);

    for (const call of mockedFlush.mock.calls) {
      expect(call[0]).toEqual({ authContext: authContextValue });
    }
  });
});

describe('flush lifecycle - exhausted Leave (real GuessScreen, no double-flush on popToTop)', () => {
  // CB1 + PT3 + C3: GuessScreen no longer mounts useFlushOnLeave (the AdScreen
  // round-trip premise is gone — ads render as in-component overlay, no param
  // merge). On popToTop from GuessExhaustedPanel, only GuessFeedScreen's hook
  // fires flush; the sessionScoreStore `flushing` guard coalesces any residual
  // overlap into a single POST. The test asserts the structural invariant:
  // "no double-flush on popToTop from GuessExhaustedPanel."
  let RealGuessScreen;
  let submitScoreBatch;
  let AsyncStorage;

  beforeAll(() => {
    RealGuessScreen = jest.requireActual('../screens/GuessScreens/GuessScreen').default;
    submitScoreBatch = require('../utils/scoreRequests').submitScoreBatch;
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
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
            component: RealGuessScreen,
            options: { headerShown: false },
          })
        )
      );
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    // Pre-populate the buffer so flush has something to POST.
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'pendingScoreEvents') {
        return Promise.resolve(JSON.stringify([
          { guessId: 'g1', pictureId: 'p1', points: 2, streak: 1, ts: 1, userId: 'user-1' },
        ]));
      }
      return Promise.resolve(null);
    });
    AsyncStorage.setItem.mockResolvedValue(undefined);
    // Use the real flush + flushing guard so POST deduplication is observable.
    const actual = jest.requireActual('../utils/sessionScoreStore');
    mockedFlush.mockImplementation(actual.flush);
    mockedGetPending.mockImplementation(actual.getPending);
    submitScoreBatch.mockResolvedValue(true);
  });

  it('exhausted Leave button → popToTop + flush ≤2 + single POST (CB1 + PT3)', async () => {
    const StackRoot = buildRealGuessStack({ homeTestId: 'real.home.go-feed' });
    const renderer = await actCreate(React.createElement(StackHost, { contextValue: authContextValue, Root: StackRoot }));

    // Home → GuessFeedScreen (mounts GuessFeedScreen's useFlushOnLeave).
    await press(renderer, 'real.home.go-feed');
    // GuessFeedScreen → GuessScreen via the SwipeImage stand-in. C3: GuessScreen
    // no longer mounts useFlushOnLeave (AdScreen round-trip is gone).
    await press(renderer, 'guess-feed.stub.start-swipe');
    await press(renderer, 'guess-feed.stub.swipe');

    // Drive GuessScreen to exhausted (safety-net path): tap picture (success)
    // → tap overlay Done → resolveNextCardWithServerFallback returns
    // { next: null, reason: 'empty' } (cardDeck mock returns empty) →
    // C1 (P1 post-fix): single empty cascade dispatches FAILED_TRANSIENT →
    // warming, NOT exhausted. The safety-net panel only mounts after 3 failed
    // retries (RETRY_TICKs at 1s/2s/4s). Fake-timer-drive the retry budget so
    // GuessExhaustedPanel mounts (safety net intact).
    jest.useFakeTimers();
    await press(renderer, 'guess.picture.tap');
    await press(renderer, 'guess.overlay.done');
    await act(async () => { await flushPromises(); });
    await act(async () => { jest.advanceTimersByTime(1000); });
    await act(async () => { jest.advanceTimersByTime(2000); });
    await act(async () => { jest.advanceTimersByTime(4000); });
    jest.useRealTimers();

    expect(renderer.root.findByProps({ testID: 'guess.exhausted.leave' })).toBeDefined();

    mockedFlush.mockClear();
    submitScoreBatch.mockClear();

    // Tap Leave → handleExitToHome → navigation.popToTop → beforeRemove fires on
    // every popped screen. C3: GuessScreen has no useFlushOnLeave hook, so only
    // GuessFeedScreen's hook fires flush. ≤2 calls + flushing guard bounds the
    // underlying POST to exactly one.
    await press(renderer, 'guess.exhausted.leave');
    await act(async () => { await flushPromises(); });

    expect(mockedFlush.mock.calls.length).toBeLessThanOrEqual(2);
    expect(submitScoreBatch).toHaveBeenCalledTimes(1);
  });
});
