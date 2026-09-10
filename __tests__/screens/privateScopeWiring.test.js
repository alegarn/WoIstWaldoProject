// Private-scope behavior for the screens shared by public and private games.
//
// Renders the REAL screens (GuessScreen, HideScreen, RankingScreen) and drives
// user-visible interactions (taps on instructions, picture surface, validation
// modal). Asserts the observable private-scope contracts:
// - a private win banks the buffered score under the group scope and keeps the
//   player in the game (never routes to ResultScreen/AdScreen)
// - a private hide flow carries the group scope into the SetInstructions step
// - a private ranking reads the group leaderboard endpoint, not the public one
//
// Boundary mocks only:
// - react-native-gesture-handler (native gestures; Pan handlers are captured so
//   the real ShowPicture subtree renders under jest)
// - @react-native-vector-icons/ionicons (native font component)
// - react-native-google-mobile-ads (native SDK)
// - expo-screen-orientation (native)
// - expo-file-system (native file system; cached deck files "exist", deletes
//   are recorded no-ops)
// - AsyncStorage via __tests__/helpers/statefulAsyncStorageMock.ts (in-memory
//   stateful fake; the private deck and the buffered score are seeded/asserted
//   through it)
// - services/cardDeck (the server deck boundary; fetchCardBatch answers empty
//   so top-ups/prefetch hit no network)
// - axios (HTTP boundary for the leaderboard)
//
// Everything else (hit-testing, resolve lifecycle, score buffering, streak,
// ad cadence, group feed cache, i18n) runs REAL. Assertions target rendered
// output, AsyncStorage state, and navigation calls.

const mockPanGestures = [];

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual('react');
  const makePan = () => {
    const gesture = {};
    mockPanGestures.push(gesture);
    for (const chain of ['activeOffsetX', 'activeOffsetY', 'failOffsetX', 'failOffsetY', 'enabled']) {
      gesture[chain] = () => gesture;
    }
    for (const cb of ['onBegin', 'onUpdate', 'onEnd', 'onFinalize']) {
      gesture[cb] = (handler) => {
        gesture[`${cb}Handler`] = handler;
        return gesture;
      };
    }
    return gesture;
  };
  return {
    GestureHandlerRootView: ({ children }) =>
      React.createElement('GestureHandlerRootView', null, children),
    GestureDetector: ({ children }) => React.createElement(React.Fragment, null, children),
    Gesture: { Pan: makePan },
  };
});

jest.mock('@react-native-vector-icons/ionicons', () => ({
  __esModule: true,
  default: () => null,
  Ionicons: () => null,
}));

jest.mock('react-native-google-mobile-ads', () => ({
  TestIds: { INTERSTITIAL: 'test-interstitial-id' },
  useInterstitialAd: jest.fn(() => ({ load: jest.fn(), isLoaded: false })),
}));

jest.mock('expo-screen-orientation', () => ({
  getOrientationAsync: jest.fn().mockResolvedValue(3),
  getOrientationLockAsync: jest.fn().mockResolvedValue('PORTRAIT_UP'),
  lockAsync: jest.fn().mockResolvedValue(undefined),
  OrientationLock: {
    PORTRAIT_UP: 'PORTRAIT_UP',
    PORTRAIT_DOWN: 'PORTRAIT_DOWN',
    LANDSCAPE_LEFT: 'LANDSCAPE_LEFT',
    LANDSCAPE_RIGHT: 'LANDSCAPE_RIGHT',
  },
}));

jest.mock('expo-file-system', () => {
  class File {
    constructor(_uri) {}
    get exists() {
      return true;
    }
    delete() {}
    create() {}
  }
  return {
    File,
    Paths: { cache: 'file:///cache/', document: 'file:///documents/' },
    documentDirectory: 'file:///documents/',
    cacheDirectory: 'file:///cache/',
    getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
    downloadAsync: jest.fn().mockResolvedValue({ uri: 'file:///cache/x', status: 200 }),
    readAsStringAsync: jest.fn().mockResolvedValue(''),
    writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
    deleteAsync: jest.fn().mockResolvedValue(undefined),
    makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
    moveAsync: jest.fn().mockResolvedValue(undefined),
    copyAsync: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('../helpers/statefulAsyncStorageMock')({ autoReset: true }),
);

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
}));

// Server deck boundary: the server never has cards in this suite, so
// prefetch/top-up noise resolves to empty without touching axios.
jest.mock('../../services/cardDeck', () => {
  const actual = jest.requireActual('../../services/cardDeck');
  return {
    ...actual,
    fetchCardBatch: jest.fn().mockResolvedValue({ isError: false, images: [] }),
    probeAllPoolForUnplayed: jest.fn().mockResolvedValue({ status: 'exhausted' }),
  };
});

import React from 'react';
import { AppState } from 'react-native';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import GuessScreen from '../../screens/GuessScreens/GuessScreen';
import HideScreen from '../../screens/HideScreens/HideScreen';
import RankingScreen from '../../screens/RankingScreen';
import { AuthContext } from '../../store/auth-context';

const PRIVATE_SCOPE = { kind: 'private', groupId: 'g-123' };

const AUTH = {
  token: 'Bearer token-1',
  uid: 'uid-1',
  expiry: 'never',
  access_token: 'access-1',
  client: 'client-1',
  userId: 'user-1',
};

function makeNav() {
  return {
    replace: jest.fn(),
    setParams: jest.fn(),
    popToTop: jest.fn(),
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => () => {}),
  };
}

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 30; i++) {
      await Promise.resolve();
    }
  });
};

// Same teardown hazards as __tests__/GuessScreen.test.tsx: heavy animated
// trees make the fake→real timer switch cost 50-800ms of real time per test
// (CPU-coupled), so the 5s default can flip to timeout failures on starved
// CI workers. 20s bounds that without slowing green runs.
jest.setTimeout(20000);

describe('private scope games', () => {
  describe('GuessScreen', () => {
    // Manual wall clock: the win overlay and hint animations run on
    // Animated/rAF, so the suite drives Date.now() + the timer queue in
    // lockstep (same harness as __tests__/GuessScreen.test.tsx).
    let mockClockMs = 0;

    function useFakeAnimationTimers() {
      jest.useFakeTimers();
      mockClockMs = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => mockClockMs);
      jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) =>
        setTimeout(() => cb(jest.now()), 16),
      );
    }

    function privateGuessParams() {
      return {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'img-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 1,
        isTutorial: false,
        skipInstructions: true,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        scope: PRIVATE_SCOPE,
      };
    }

    async function seedGroupDeck(cards) {
      // Key shape from services/groups/groupFeedCache (categoryId, language).
      await AsyncStorage.setItem('groupFeed:g-123:cat-1:fr', JSON.stringify(cards));
    }

    async function confirmGuess(screen) {
      await act(async () => {
        fireEvent.press(screen.getByTestId('game.picture.guess-surface'));
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        fireEvent.press(screen.getByTestId('game.picture.clear-guess'));
      });
      await act(async () => {
        fireEvent.press(screen.getByTestId('game.picture.guess-modal.confirm'));
      });
      await flush();
    }

    beforeEach(() => {
      jest.clearAllMocks();
      delete process.env.EXPO_PUBLIC_E2E_MODE;
      useFakeAnimationTimers();
      jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
    });

    afterEach(async () => {
      // Drain in-flight chains inside act while fake timers are still active,
      // unmount before the fake→real switch, then drop queued frames so no
      // leaked rAF/timer chain survives into the next test on real timers.
      await act(async () => {
        await Promise.resolve();
      });
      cleanup();
      jest.clearAllTimers();
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    it('a correct guess banks the score under the group scope and keeps the player in the game', async () => {
      await seedGroupDeck([
        { pictureId: 'img-1', imageFile: 'file:///waldo.jpg', listId: 1 },
        { pictureId: 'img-2', imageFile: 'file:///waldo-2.jpg', listId: 2 },
      ]);
      const navigation = makeNav();
      const screen = render(
        <AuthContext.Provider value={AUTH}>
          <GuessScreen navigation={navigation} route={{ params: privateGuessParams() }} />
        </AuthContext.Provider>,
      );

      await confirmGuess(screen);

      expect(screen.queryByTestId('guess.success.overlay')).not.toBeNull();
      expect(navigation.replace).not.toHaveBeenCalled();
      expect(navigation.navigate).not.toHaveBeenCalled();

      const buffered = JSON.parse(await AsyncStorage.getItem('pendingScoreEvents'));
      expect(buffered).toHaveLength(1);
      expect(buffered[0]).toEqual(
        expect.objectContaining({
          scope: PRIVATE_SCOPE,
          imageId: 'img-1',
          pictureId: 'img-1',
          points: 2,
          userId: 'user-1',
        }),
      );
    });
  });

  describe('HideScreen', () => {
    it('hiding in a private group carries the group scope into the instructions step', async () => {
      const navigation = makeNav();
      const screen = render(
        <HideScreen
          navigation={navigation}
          route={{
            params: {
              uri: 'file:///hide.jpg',
              imageHeight: 1200,
              imageWidth: 800,
              isPortrait: true,
              isTutorial: false,
              scope: PRIVATE_SCOPE,
            },
          }}
        />,
      );

      // The picture subtree hosts its GestureDetectors in a localized RNGH
      // root (mirror of GuessScreen) or RNGH throws at mount.
      const roots = screen.root.findAll((node) => node.type === 'GestureHandlerRootView');
      expect(roots.length).toBeGreaterThanOrEqual(1);

      await act(async () => {
        fireEvent.press(screen.getByTestId('game.instructions.hide.start'));
      });
      expect(screen.queryByTestId('game.picture.hide-image')).not.toBeNull();

      await act(async () => {
        fireEvent.press(screen.getByTestId('game.picture.hide-surface'), {
          locationX: 50,
          locationY: 50,
          nativeEvent: { locationX: 50, locationY: 50 },
        });
      });
      await act(async () => {
        fireEvent.press(screen.getByTestId('game.picture.clear-hide'));
      });
      await act(async () => {
        fireEvent.press(screen.getByTestId('game.picture.hide-modal.confirm'));
      });
      await flush();

      expect(navigation.navigate).toHaveBeenCalledTimes(1);
      const [routeName, params] = navigation.navigate.mock.calls[0];
      expect(routeName).toBe('SetInstructions');
      expect(params.scope).toEqual(PRIVATE_SCOPE);
    });
  });

  describe('RankingScreen', () => {
    it('loads the private ranking from the group leaderboard endpoint, not the public scores endpoint', async () => {
      axios.get.mockImplementation(async (url) => {
        if (String(url).includes('/leaderboard')) {
          return {
            status: 200,
            data: {
              data: {
                rows: [{ rank: '1', username: 'waldo', total_score: 25, max_streak: 2, user_id: 'u1' }],
                next_cursor: null,
                has_more: false,
              },
            },
          };
        }
        return { status: 200, data: { owned: [], joined: [] } };
      });

      const navigation = { setOptions: jest.fn() };
      const screen = render(
        <AuthContext.Provider value={AUTH}>
          <RankingScreen navigation={navigation} route={{ params: { scope: PRIVATE_SCOPE } }} />
        </AuthContext.Provider>,
      );
      await flush();

      const leaderboardCalls = axios.get.mock.calls.filter(([url]) =>
        String(url).includes('api/v1/private_groups/g-123/leaderboard'),
      );
      expect(leaderboardCalls).toHaveLength(1);
      expect(leaderboardCalls[0][1].headers.Authorization).toBe('Bearer token-1');

      const publicScoresCalls = axios.get.mock.calls.filter(([url]) =>
        String(url).includes(`/users/${AUTH.userId}/scores`),
      );
      expect(publicScoresCalls).toHaveLength(0);

      expect(screen.getByText('waldo')).toBeTruthy();
    });
  });
});
