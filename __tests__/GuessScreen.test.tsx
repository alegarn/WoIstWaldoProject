// GuessScreen behavior suite.
//
// Renders the REAL screen subtree (GuessPicture → ShowPicture, SuccessOverlay,
// GuessExitSwipeMenu, GuessExhaustedPanel, GuessAdvanceLoader, AdInterstitial,
// NextCardImageWarmer, TutorialOverlay) and drives it through user-visible
// interactions: placing a guess (target icon → confirm modal), the win
// animation auto-completing, exhausted-panel buttons, the exit menu, the ad
// Continue button, and synthetic AppState/background events.
//
// Only system boundaries are mocked:
// - react-native-gesture-handler (native gestures; Pan handlers are captured so
//   tests can fire the same callbacks the native layer would)
// - @react-native-vector-icons/ionicons (native font component)
// - react-native-google-mobile-ads (native SDK; the internal pro fallback panel,
//   the cadence, the billing policy and the ad-source chain all stay real)
// - expo-screen-orientation (native)
// - AsyncStorage via __tests__/helpers/statefulAsyncStorageMock.ts (in-memory
//   stateful fake — deck seeding and exhaustion markers are asserted through it)
// - services/cardDeck (the server deck boundary; fetchCardBatch is the "server",
//   appendCardBatch stays real so top-ups write observable decks)
// - utils/handleGuessOutcome (persistence side-effect boundary: score buffer,
//   deck mutation, file deletes) — its recorded payload IS the scoring contract
// - utils/nextCardAdvancer (jest.fn wrapper over the real implementation so a
//   test can force a resolve outcome/reason; default delegates to the real one)
// - fake timers (jest modern fake timers + a 16ms requestAnimationFrame so
//   Animated frames progress deterministically)
//
// Everything else (target hit-testing, speed timer, streak, ad cadence, ad
// policy, ad sources, storageDatum, e2eMode, i18n) runs REAL. Assertions target
// rendered output (testIDs, English copy from i18n/locales/en.json),
// AsyncStorage state, and navigation calls.

type PanHandler = (event: { translationX?: number; translationY?: number }, success?: boolean) => void;

type MockGesture = {
  onBeginHandler?: PanHandler;
  onUpdateHandler?: PanHandler;
  onEndHandler?: PanHandler;
  onFinalizeHandler?: PanHandler;
};

// Captured Pan gestures. Tests fire the same callbacks the native gesture
// layer would invoke. Referenced lazily inside the mock factory (never during
// module evaluation).
const mockPanGestures: MockGesture[] = [];

// RNGH's real components call native install(). Stub the root + detectors and
// capture Pan handler chains so tests can simulate swipes/drags.
jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual('react');
  const makePan = () => {
    const gesture: Record<string, unknown> = {};
    mockPanGestures.push(gesture as MockGesture);
    gesture.activeOffsetX = () => gesture;
    gesture.activeOffsetY = () => gesture;
    gesture.failOffsetX = () => gesture;
    gesture.failOffsetY = () => gesture;
    gesture.enabled = () => gesture;
    gesture.onBegin = (cb: PanHandler) => {
      gesture.onBeginHandler = cb;
      return gesture;
    };
    gesture.onUpdate = (cb: PanHandler) => {
      gesture.onUpdateHandler = cb;
      return gesture;
    };
    gesture.onEnd = (cb: PanHandler) => {
      gesture.onEndHandler = cb;
      return gesture;
    };
    gesture.onFinalize = (cb: PanHandler) => {
      gesture.onFinalizeHandler = cb;
      return gesture;
    };
    return gesture;
  };
  return {
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
      React.createElement('GestureHandlerRootView', null, children),
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
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

// Native file-system boundary. Deck files "exist" so seeded decks resolve;
// deletes are recorded no-ops.
jest.mock('expo-file-system', () => {
  class File {
    constructor(_uri?: unknown) {}
    get exists(): boolean {
      return true;
    }
    delete(): void {}
    create(): void {}
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

// In-memory AsyncStorage: deck lists, exhaustion markers and cursors are
// seeded/asserted through the store map.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('./helpers/statefulAsyncStorageMock')({ autoReset: true }),
);

// Server deck boundary: fetchCardBatch IS the server in this suite. Default =
// server has no cards. appendCardBatch stays REAL so a stubbed server batch
// lands in the observable AsyncStorage deck.
jest.mock('../services/cardDeck', () => {
  const actual = jest.requireActual('../services/cardDeck');
  return {
    ...actual,
    fetchCardBatch: jest.fn().mockResolvedValue({ images: [] }),
    probeAllPoolForUnplayed: jest.fn().mockResolvedValue({ status: 'exhausted' }),
  };
});

// Persistence side-effect boundary (score buffer + deck mutation + file
// deletes). The recorded payload is the scoring contract.
jest.mock('../utils/handleGuessOutcome', () => ({
  applySuccessSideEffects: jest.fn().mockResolvedValue(undefined),
  resolveNextGuessParams: jest.fn(),
}));

// Resolve seam: default delegates to the real cascade (whose Tier-1 local read
// is the mocked resolveNextGuessParams above); tests override to force a
// reason ('network' | 'empty' | 'server') or a hand-settled promise.
jest.mock('../utils/nextCardAdvancer', () => {
  const actual = jest.requireActual('../utils/nextCardAdvancer');
  return {
    ...actual,
    resolveNextCardWithServerFallback: jest.fn(actual.resolveNextCardWithServerFallback),
  };
});

import React from 'react';
import { AppState, Image } from 'react-native';
import { act, fireEvent, render, RenderAPI } from '@testing-library/react-native';

import GuessScreenBase from '../screens/GuessScreens/GuessScreen';
import { AuthContext } from '../store/auth-context';
import { applySuccessSideEffects, resolveNextGuessParams } from '../utils/handleGuessOutcome';
import { resolveNextCardWithServerFallback } from '../utils/nextCardAdvancer';
import { fetchCardBatch } from '../services/cardDeck';

const applySuccessSideEffectsMock = applySuccessSideEffects as jest.MockedFunction<typeof applySuccessSideEffects>;
const resolveNextGuessParamsMock = resolveNextGuessParams as jest.MockedFunction<typeof resolveNextGuessParams>;
const resolveNextCardWithServerFallbackMock = resolveNextCardWithServerFallback as jest.MockedFunction<
  typeof resolveNextCardWithServerFallback
>;
const fetchCardBatchMock = fetchCardBatch as jest.MockedFunction<typeof fetchCardBatch>;

const actualAdvancer = jest.requireActual('../utils/nextCardAdvancer') as typeof import('../utils/nextCardAdvancer');
const AsyncStorage = require('@react-native-async-storage/async-storage').default as {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  __store: Map<string, string>;
};

type LooseGuessScreenProps = { navigation: unknown; route: { params: Record<string, unknown> } };
const GuessScreen = GuessScreenBase as unknown as React.FC<LooseGuessScreenProps>;

type Nav = Record<string, jest.Mock>;

function makeNav(): Nav {
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

const HIT_HIDDEN_LOCATION = { x: 0.5, y: 0.5 };
const MISS_HIDDEN_LOCATION = { x: 0.05, y: 0.5 };

function baseParams(overrides: Record<string, unknown> = {}) {
  return {
    imageFile: 'file:///waldo.jpg',
    pictureId: 'image-1',
    description: 'Find Waldo',
    imageHeight: 1200,
    imageWidth: 800,
    isPortrait: true,
    hiddenLocation: HIT_HIDDEN_LOCATION,
    listId: 3,
    isTutorial: false,
    skipInstructions: true,
    category: { id: 'cat-1', key: 'nature' },
    language: 'fr',
    ...overrides,
  };
}

function nextCardParams(n: number): Record<string, unknown> {
  return {
    listId: 3 + n,
    pictureId: `image-${1 + n}`,
    imageFile: `file:///card-${1 + n}.jpg`,
    description: `Card ${1 + n}`,
    imageHeight: 1200,
    imageWidth: 800,
    isPortrait: true,
    hiddenLocation: HIT_HIDDEN_LOCATION,
    category: { id: 'cat-1', key: 'nature' },
    language: 'fr',
    isTutorial: false,
    skipInstructions: true,
  };
}

// Serves a fresh next card derived from the picture being played, so any
// number of consecutive win cycles stay consistent.
function serveSuccessiveNextCards() {
  resolveNextGuessParamsMock.mockImplementation(async (args) => {
    const playedIndex = Number(String(args?.currentPictureId ?? 'image-1').slice('image-'.length));
    return { params: nextCardParams(Number.isFinite(playedIndex) ? playedIndex : 1) };
  });
}

function deckKey(categoryKey: string, language: string): string {
  return `imageList:${categoryKey}:${language}`;
}

async function seedDeck(categoryKey: string, language: string, cards: Array<Record<string, unknown>>) {
  await AsyncStorage.setItem(deckKey(categoryKey, language), JSON.stringify(cards));
}

async function storedDeck(categoryKey: string, language: string): Promise<Array<Record<string, unknown>>> {
  const raw = await AsyncStorage.getItem(deckKey(categoryKey, language));
  return raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
}

// --- timing harness ---------------------------------------------------------

// Manual wall clock: the jest-expo run uses legacy fake timers (Date is NOT
// faked), so the suite drives Date.now() itself. `advance()` moves both the
// timer queue and the clock in lockstep.
let mockClockMs = 0;

function useFakeAnimationTimers() {
  jest.useFakeTimers();
  mockClockMs = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => mockClockMs);
  // RN's jest setup maps requestAnimationFrame to setTimeout(cb, 0): chained
  // zero-delay frames would spin Animated.loop forever at a frozen timestamp.
  // A 16ms frame bounds every timer chain, so animations (win overlay, halo
  // hints, speed ring) progress per frame instead of looping eternally.
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: (time: number) => void) =>
    setTimeout(() => cb(jest.now()), 16),
  );
}

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 30; i++) {
      await Promise.resolve();
    }
  });
};

// Steps the clock in small increments so timers scheduled mid-advance (grace,
// chrono ticks) observe a Date.now() that matches the timer queue position.
const advance = async (ms: number) => {
  const step = 50;
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    mockClockMs += step;
    await act(async () => {
      jest.advanceTimersByTime(step);
      await Promise.resolve();
    });
  }
};

// --- interaction helpers ----------------------------------------------------

type ScreenHandle = {
  screen: RenderAPI;
  navigation: Nav;
  routeRef: { current: { params: Record<string, unknown> } };
  rerenderWithParams: (params: Record<string, unknown>) => Promise<void>;
};

function renderGuessScreen(
  params: Record<string, unknown>,
  navigation: Nav = makeNav(),
  authValue?: Record<string, unknown>,
): ScreenHandle {
  const routeRef = { current: { params: { ...params } } };
  const providerValue = authValue as React.ComponentProps<typeof AuthContext.Provider>['value'];
  const wrap = (ui: React.ReactElement) =>
    authValue ? <AuthContext.Provider value={providerValue}>{ui}</AuthContext.Provider> : ui;

  const screen = render(wrap(<GuessScreen navigation={navigation} route={routeRef.current} />));
  const rerenderWithParams = async (next: Record<string, unknown>) => {
    routeRef.current = { params: { ...routeRef.current.params, ...next } };
    await act(async () => {
      screen.rerender(wrap(<GuessScreen navigation={navigation} route={routeRef.current} />));
    });
  };
  return { screen, navigation, routeRef, rerenderWithParams };
}

// Player places a guess (surface tap places the target in e2e mode), taps the
// target circle and confirms in the validation modal.
async function confirmGuess(handle: ScreenHandle) {
  await act(async () => {
    if (!handle.screen.queryByTestId('game.picture.clear-guess')) {
      fireEvent.press(handle.screen.getByTestId('game.picture.guess-surface'));
      await Promise.resolve();
      await Promise.resolve();
    }
  });
  await act(async () => {
    fireEvent.press(handle.screen.getByTestId('game.picture.clear-guess'));
  });
  await act(async () => {
    fireEvent.press(handle.screen.getByTestId('game.picture.guess-modal.confirm'));
  });
  await flush();
}

// The real SuccessOverlay auto-fires onDone when its animation completes; step
// frames until it does.
async function dismissWinOverlay(handle: ScreenHandle, maxMs = 10000) {
  for (let elapsed = 0; elapsed < maxMs; elapsed += 100) {
    if (!handle.screen.queryByTestId('guess.success.overlay')) return;
    await advance(100);
  }
  if (handle.screen.queryByTestId('guess.success.overlay')) {
    throw new Error('win overlay did not dismiss within the advance budget');
  }
}

// One full win cycle: guess → confirm → animation → next card applied. The
// merged route mirrors what the real navigator re-renders after setParams.
// Requires the resolve to return a next card (serveSuccessiveNextCards or a
// per-test mock).
async function playWinCycle(handle: ScreenHandle) {
  await confirmGuess(handle);
  await dismissWinOverlay(handle);
  const lastSetParams = handle.navigation.setParams.mock.calls[handle.navigation.setParams.mock.calls.length - 1];
  if (lastSetParams) {
    await handle.rerenderWithParams(lastSetParams[0] as Record<string, unknown>);
  }
}

// Fires the picture surface's edge-swipe handler the way the native Pan
// recognizer would (rightward swipe → exit menu).
async function fireSurfaceSwipe(translation: { translationX: number; translationY: number }) {
  const surfaceGesture = [...mockPanGestures].reverse().find((g) => g.onEndHandler);
  if (!surfaceGesture?.onEndHandler) {
    throw new Error('no surface Pan gesture captured');
  }
  await act(async () => {
    surfaceGesture.onEndHandler?.(translation, true);
  });
}

function renderedImageUris(screen: RenderAPI): string[] {
  return screen
    .UNSAFE_getAllByType(Image as unknown as React.ComponentType<{ source?: { uri?: string } }>)
    .map((node) => node.props.source?.uri)
    .filter((uri): uri is string => typeof uri === 'string');
}

function findAppStateListener(): (state: string) => void {
  const mock = AppState.addEventListener as unknown as jest.Mock;
  const call = mock.mock.calls.find((c: unknown[]) => c[0] === 'change');
  if (!call || typeof call[1] !== 'function') {
    throw new Error('AppState "change" listener was not registered');
  }
  return call[1] as (state: string) => void;
}

function setE2EMode(enabled: boolean) {
  if (enabled) {
    process.env.EXPO_PUBLIC_E2E_MODE = 'true';
  } else {
    delete process.env.EXPO_PUBLIC_E2E_MODE;
  }
}

// A fast win (no timer advance before confirming) scores multiplier 2 — the
// default for every win cycle in the suite.
describe('GuessScreen', () => {
  beforeEach(() => {
    // mockReset (not mockClear): stale mockResolvedValueOnce queues from a
    // failed test must not leak into the next test's resolver queue.
    jest.clearAllMocks();
    resolveNextGuessParamsMock.mockReset().mockResolvedValue({ params: { listId: 4 } });
    applySuccessSideEffectsMock.mockReset().mockResolvedValue(undefined);
    resolveNextCardWithServerFallbackMock.mockReset().mockImplementation(actualAdvancer.resolveNextCardWithServerFallback);
    fetchCardBatchMock.mockReset().mockResolvedValue({ isError: false, images: [] });
    useFakeAnimationTimers();
    setE2EMode(false);
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }) as any);
  });

  afterEach(async () => {
    await act(async () => {
      await Promise.resolve();
    });
    jest.restoreAllMocks();
    jest.useRealTimers();
    setE2EMode(false);
  });

  describe('placing a guess', () => {
    it('a correct guess plays the win animation and stays on the screen', async () => {
      const navigation = makeNav();
      const handle = renderGuessScreen(baseParams(), navigation);

      await confirmGuess(handle);

      expect(handle.screen.queryByTestId('guess.success.overlay')).not.toBeNull();
      expect(navigation.replace).not.toHaveBeenCalled();
      expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('a fast find earns the ×2 speed bonus: +2 points with a ×2 pill', async () => {
      const handle = renderGuessScreen(baseParams());

      await confirmGuess(handle);

      expect(handle.screen.getByTestId('guess.success.speed-badge')).toBeTruthy();
      expect(handle.screen.getByText('+2')).toBeTruthy();
      expect(handle.screen.getByText('×2')).toBeTruthy();
    });

    it('a find over the 5s speed window earns no bonus: +1 point, no pill', async () => {
      const handle = renderGuessScreen(baseParams());

      // Reading grace (3s) holds the chrono; past 3s it runs, and 9s on the
      // clock is ~6s of elapsed time — over the 5s speed window.
      await advance(9000);
      await confirmGuess(handle);

      expect(handle.screen.queryByTestId('guess.success.speed-badge')).toBeNull();
      expect(handle.screen.getByText('+1')).toBeTruthy();
    });

    it('after the win animation the next card replaces the current picture', async () => {
      serveSuccessiveNextCards();
      const navigation = makeNav();
      const handle = renderGuessScreen(baseParams(), navigation);

      await playWinCycle(handle);

      expect(navigation.setParams).toHaveBeenCalledTimes(1);
      expect(navigation.setParams).toHaveBeenCalledWith(nextCardParams(1));
      expect(navigation.replace).not.toHaveBeenCalled();
      expect(handle.screen.getByTestId('game.picture.guess-image').props.source).toEqual({
        uri: nextCardParams(1).imageFile,
      });
      // The win overlay is gone and the player can guess again.
      expect(handle.screen.queryByTestId('guess.success.overlay')).toBeNull();
      expect(handle.screen.queryByTestId('game.picture.clear-guess')).not.toBeNull();
    });

    it('confirming a spot away from the hidden point ends the round on the failure screen', async () => {
      const navigation = makeNav();
      const handle = renderGuessScreen(baseParams({ hiddenLocation: MISS_HIDDEN_LOCATION }), navigation);

      await confirmGuess(handle);

      expect(navigation.replace).toHaveBeenCalledTimes(1);
      expect(navigation.replace).toHaveBeenCalledWith(
        'ResultScreen',
        expect.objectContaining({ onTarget: false, pictureId: 'image-1' }),
      );
      expect(handle.screen.queryByTestId('guess.success.overlay')).toBeNull();
      expect(applySuccessSideEffectsMock).not.toHaveBeenCalled();
    });

    it('a miss in a private group keeps the group context on the result screen', async () => {
      const navigation = makeNav();
      const scope = { kind: 'private', groupId: 'group-7' };
      const handle = renderGuessScreen(baseParams({ hiddenLocation: MISS_HIDDEN_LOCATION, scope }), navigation);

      await confirmGuess(handle);

      expect(navigation.replace).toHaveBeenCalledWith(
        'ResultScreen',
        expect.objectContaining({ onTarget: false, scope }),
      );
    });

    it('the played card is banked exactly once per win with the speed and streak values', async () => {
      serveSuccessiveNextCards();
      const handle = renderGuessScreen(baseParams());

      await playWinCycle(handle);

      expect(applySuccessSideEffectsMock).toHaveBeenCalledTimes(1);
      expect(applySuccessSideEffectsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: 3,
          categoryKey: 'nature',
          language: 'fr',
          pictureId: 'image-1',
          points: 2,
          multiplier: 2,
          streak: 1,
          streakMultiplier: 1.0,
        }),
      );
    });

    it('seven consecutive wins bank the post-increment streak and show the tier-2 pill', async () => {
      serveSuccessiveNextCards();
      const handle = renderGuessScreen(baseParams());

      for (let cycle = 1; cycle <= 6; cycle++) {
        await playWinCycle(handle);
      }

      // 7th win: the celebration pill reflects the newly reached tier…
      await confirmGuess(handle);
      expect(handle.screen.getByText('🔥 In the Zone ×3')).toBeTruthy();

      // …and the buffered score carries the post-increment values.
      await dismissWinOverlay(handle);
      expect(applySuccessSideEffectsMock).toHaveBeenCalledTimes(7);
      expect(applySuccessSideEffectsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          points: 6,
          multiplier: 2,
          streak: 7,
          streakMultiplier: 3.0,
        }),
      );
    });

    it('a fresh screen after a miss starts the streak over', async () => {
      serveSuccessiveNextCards();
      const handle = renderGuessScreen(baseParams());

      await playWinCycle(handle);
      await playWinCycle(handle);

      await confirmGuess(handle);
      expect(handle.screen.getByText('🔥 Focused ×2')).toBeTruthy();
      await dismissWinOverlay(handle);

      // A miss replaces the screen in the real app; a fresh mount represents
      // the screen the player lands on next.
      handle.screen.unmount();
      const fresh = renderGuessScreen(baseParams());
      await confirmGuess(fresh);

      expect(fresh.screen.queryByTestId('guess.success.streak.pill')).toBeNull();
    });
  });

  describe('deck exhaustion', () => {
    function serveEmptyDeck() {
      resolveNextGuessParamsMock.mockResolvedValue(null);
    }

    it('an empty deck ends the round on the "No more cards" panel with no retry loop', async () => {
      serveEmptyDeck();
      const handle = renderGuessScreen(baseParams());

      await confirmGuess(handle);
      await dismissWinOverlay(handle);

      expect(handle.screen.queryByTestId('guess-exhausted-panel')).not.toBeNull();
      expect(handle.screen.getByText('No more cards')).toBeTruthy();
      expect(handle.screen.queryByTestId('guess-advance-loader')).toBeNull();

      // Empty is deterministic: no timers revive the resolver.
      const resolvesAfterExhausted = resolveNextCardWithServerFallbackMock.mock.calls.length;
      await advance(10000);
      expect(resolveNextCardWithServerFallbackMock.mock.calls.length).toBe(resolvesAfterExhausted);
    });

    it('the exhausted panel banks the streak so far', async () => {
      resolveNextGuessParamsMock
        .mockResolvedValueOnce({ params: nextCardParams(1) })
        .mockResolvedValueOnce({ params: nextCardParams(2) })
        .mockResolvedValue(null);
      const handle = renderGuessScreen(baseParams());

      await playWinCycle(handle);
      await playWinCycle(handle);
      await confirmGuess(handle);
      await dismissWinOverlay(handle);

      expect(handle.screen.getByTestId('guess-exhausted-streak')).toBeTruthy();
      expect(handle.screen.getByText('Streak: 2')).toBeTruthy();
    });

    it('"Switch category" clears the exhausted marker and returns to the category picker', async () => {
      serveEmptyDeck();
      const navigation = makeNav();
      const handle = renderGuessScreen(baseParams(), navigation);

      await confirmGuess(handle);
      await dismissWinOverlay(handle);
      // The empty server fetch marked the category exhausted while advancing.
      await expect(AsyncStorage.getItem('exhaustedCategory:nature:fr')).resolves.toBe('1');

      await act(async () => {
        fireEvent.press(handle.screen.getByTestId('guess-exhausted-switch'));
      });
      await flush();

      expect(await AsyncStorage.getItem('exhaustedCategory:nature:fr')).toBeNull();
      expect(navigation.navigate).toHaveBeenCalledWith('GuessPathScreen', {});
    });

    it('"Switch category" in a private group carries the group scope back to its picker', async () => {
      serveEmptyDeck();
      const navigation = makeNav();
      const scope = { kind: 'private', groupId: 'g-42' };
      const handle = renderGuessScreen(baseParams({ scope }), navigation);

      await confirmGuess(handle);
      await dismissWinOverlay(handle);

      await act(async () => {
        fireEvent.press(handle.screen.getByTestId('guess-exhausted-switch'));
      });
      await flush();

      expect(navigation.navigate).toHaveBeenCalledWith('GuessPathScreen', { scope });
    });

    it('"Leave game" on the exhausted panel goes home', async () => {
      serveEmptyDeck();
      const navigation = makeNav();
      const handle = renderGuessScreen(baseParams(), navigation);

      await confirmGuess(handle);
      await dismissWinOverlay(handle);

      await act(async () => {
        fireEvent.press(handle.screen.getByTestId('guess-exhausted-leave'));
      });

      expect(navigation.popToTop).toHaveBeenCalledTimes(1);
      expect(navigation.reset).not.toHaveBeenCalled();
    });

    it('a private group exhaustion leaves to [Home, PrivateHome] instead of popping', async () => {
      serveEmptyDeck();
      const navigation = makeNav();
      const scope = { kind: 'private', groupId: 'g-1' };
      const handle = renderGuessScreen(baseParams({ scope }), navigation);

      await confirmGuess(handle);
      await dismissWinOverlay(handle);

      await act(async () => {
        fireEvent.press(handle.screen.getByTestId('guess-exhausted-leave'));
      });

      expect(navigation.reset).toHaveBeenCalledWith({
        index: 1,
        routes: [
          { name: 'HomeScreen' },
          { name: 'PrivateHomeScreen', params: { scope } },
        ],
      });
      expect(navigation.popToTop).not.toHaveBeenCalled();
    });

    it('a server failure ends on the exhausted panel without burning retries', async () => {
      resolveNextCardWithServerFallbackMock.mockResolvedValue({ next: null, reason: 'server' });
      const handle = renderGuessScreen(baseParams());

      await confirmGuess(handle);
      await dismissWinOverlay(handle);

      expect(handle.screen.queryByTestId('guess-exhausted-panel')).not.toBeNull();
      const resolvesAfter = resolveNextCardWithServerFallbackMock.mock.calls.length;
      await advance(10000);
      expect(resolveNextCardWithServerFallbackMock.mock.calls.length).toBe(resolvesAfter);
    });

    it('a network hiccup retries 1s/2s/4s with a loader, then lands on the exhausted panel', async () => {
      resolveNextCardWithServerFallbackMock.mockResolvedValue({ next: null, reason: 'network' });
      const handle = renderGuessScreen(baseParams());

      await confirmGuess(handle);
      await dismissWinOverlay(handle);

      expect(handle.screen.queryByTestId('guess-advance-loader')).not.toBeNull();
      expect(handle.screen.queryByTestId('guess-exhausted-panel')).toBeNull();

      await advance(1000);
      expect(handle.screen.queryByTestId('guess-exhausted-panel')).toBeNull();
      await advance(2000);
      expect(handle.screen.queryByTestId('guess-exhausted-panel')).toBeNull();
      await advance(4000);

      expect(handle.screen.queryByTestId('guess-exhausted-panel')).not.toBeNull();
      // Initial resolve + two retries; the third tick only exhausts.
      expect(resolveNextCardWithServerFallbackMock.mock.calls.length).toBe(3);
      expect(applySuccessSideEffectsMock).not.toHaveBeenCalled();
    });

    it('an empty category consults the all-deck fallback before giving up', async () => {
      serveEmptyDeck();
      const handle = renderGuessScreen(baseParams());

      await confirmGuess(handle);
      await flush();
      await dismissWinOverlay(handle);

      expect(handle.screen.queryByTestId('guess-exhausted-panel')).not.toBeNull();
      // Tier 2 asked for the played category; the Tier 3/4 fallback chain asked
      // for 'all' (the mount warm-up also asks once).
      const categoryFetches = fetchCardBatchMock.mock.calls.filter(
        (call) => (call[0] as { categoryKey?: string }).categoryKey === 'nature',
      );
      const allFetches = fetchCardBatchMock.mock.calls.filter(
        (call) => (call[0] as { categoryKey?: string }).categoryKey === 'all',
      );
      expect(categoryFetches.length).toBeGreaterThanOrEqual(1);
      expect(allFetches.length).toBeGreaterThanOrEqual(2);
    });

    it('a network hiccup that recovers lands the next card exactly once, scored with the original speed bonus', async () => {
      const next = nextCardParams(1);
      resolveNextCardWithServerFallbackMock
        .mockResolvedValueOnce({ next: null, reason: 'network' })
        .mockResolvedValueOnce({ next: { params: next }, reason: 'ok' });
      const navigation = makeNav();
      const handle = renderGuessScreen(baseParams(), navigation);

      await confirmGuess(handle);
      await dismissWinOverlay(handle);
      // The win animation outlives the first retry slot (1s): the recovery
      // lands on the scheduled retry tick.
      await advance(1500);
      await flush();

      // Recovered: next card lands exactly once.
      expect(navigation.setParams).toHaveBeenCalledTimes(1);
      expect(navigation.setParams).toHaveBeenCalledWith(next);
      expect(handle.screen.queryByTestId('guess.success.overlay')).toBeNull();
      expect(handle.screen.queryByTestId('guess-exhausted-panel')).toBeNull();

      // The recovered advance credits the success-time speed bonus.
      expect(applySuccessSideEffectsMock).toHaveBeenCalledTimes(1);
      expect(applySuccessSideEffectsMock).toHaveBeenCalledWith(
        expect.objectContaining({ multiplier: 2, streak: 1, points: 2 }),
      );

      // No strand: the retry budget is done, nothing fires again.
      const resolvesAfterRecovery = resolveNextCardWithServerFallbackMock.mock.calls.length;
      await advance(10000);
      expect(resolveNextCardWithServerFallbackMock.mock.calls.length).toBe(resolvesAfterRecovery);
      expect(navigation.setParams).toHaveBeenCalledTimes(1);
    });

    it('backgrounding during warming forces the exhausted panel and cancels the pending retry', async () => {
      resolveNextCardWithServerFallbackMock
        .mockResolvedValueOnce({ next: null, reason: 'network' })
        .mockResolvedValueOnce({ next: { params: nextCardParams(1) }, reason: 'ok' });
      const navigation = makeNav();
      const handle = renderGuessScreen(baseParams(), navigation);

      await confirmGuess(handle);
      await dismissWinOverlay(handle);
      expect(handle.screen.queryByTestId('guess-advance-loader')).not.toBeNull();

      await act(async () => {
        findAppStateListener()('background');
      });

      expect(handle.screen.queryByTestId('guess-exhausted-panel')).not.toBeNull();

      // The cleared retry timer can no longer land the recovered card.
      await advance(10000);
      expect(navigation.setParams).not.toHaveBeenCalled();

      // Foregrounding does not auto-recover — the player must choose.
      await act(async () => {
        findAppStateListener()('active');
      });
      expect(handle.screen.queryByTestId('guess-exhausted-panel')).not.toBeNull();
    });

    it('backgrounding mid-resolve aborts the win: no score, no streak, no ad', async () => {
      let settleResolve!: (v: { next: { params: Record<string, unknown> }; reason: 'ok' }) => void;
      resolveNextCardWithServerFallbackMock.mockReturnValue(
        new Promise((resolve) => {
          settleResolve = resolve as typeof settleResolve;
        }),
      );
      const handle = renderGuessScreen(baseParams());

      await confirmGuess(handle);
      await dismissWinOverlay(handle);

      await act(async () => {
        findAppStateListener()('background');
      });
      expect(handle.screen.queryByTestId('guess-exhausted-panel')).not.toBeNull();

      await act(async () => {
        settleResolve({ next: { params: { listId: 4 } }, reason: 'ok' });
        await Promise.resolve();
      });
      await flush();

      expect(applySuccessSideEffectsMock).not.toHaveBeenCalled();
      expect(handle.screen.queryByTestId('ad.internal.pro.panel')).toBeNull();
      expect(handle.screen.queryByTestId('guess-exhausted-panel')).not.toBeNull();
    });

    it('leaving mid-warming cancels the retry loop without state updates after unmount', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      resolveNextCardWithServerFallbackMock.mockResolvedValue({ next: null, reason: 'network' });
      const handle = renderGuessScreen(baseParams());

      await confirmGuess(handle);
      await dismissWinOverlay(handle);
      expect(handle.screen.queryByTestId('guess-advance-loader')).not.toBeNull();

      handle.screen.unmount();
      await advance(10000);

      const setStateWarning = consoleErrorSpy.mock.calls.find((c: unknown[]) =>
        /setState after unmount|state update on an unmounted|Can't perform a React state update/i.test(
          String(c[0] ?? ''),
        ),
      );
      expect(setStateWarning).toBeUndefined();
      consoleErrorSpy.mockRestore();
    });

    it('swiping home while the resolve is in flight aborts the win credit', async () => {
      let settleResolve!: (v: { next: { params: Record<string, unknown> }; reason: 'ok' }) => void;
      resolveNextCardWithServerFallbackMock.mockReturnValue(
        new Promise((resolve) => {
          settleResolve = resolve as typeof settleResolve;
        }),
      );
      const handle = renderGuessScreen(baseParams());

      await confirmGuess(handle);
      handle.screen.unmount();

      await act(async () => {
        settleResolve({ next: { params: { listId: 4 } }, reason: 'ok' });
        await Promise.resolve();
      });
      await flush();

      expect(applySuccessSideEffectsMock).not.toHaveBeenCalled();
    });

    it('swiping home while the score awaits banks nothing and never shows the ad', async () => {
      let finishSideEffects!: () => void;
      applySuccessSideEffectsMock.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishSideEffects = resolve;
          }),
      );
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const handle = renderGuessScreen(baseParams());

      await confirmGuess(handle);
      expect(applySuccessSideEffectsMock).toHaveBeenCalledTimes(1);

      handle.screen.unmount();
      await act(async () => {
        finishSideEffects();
        await Promise.resolve();
      });
      await flush();

      const setStateWarning = consoleErrorSpy.mock.calls.find((c: unknown[]) =>
        /setState after unmount|state update on an unmounted|Can't perform a React state update/i.test(
          String(c[0] ?? ''),
        ),
      );
      expect(setStateWarning).toBeUndefined();
      consoleErrorSpy.mockRestore();
    });

    it('runs exactly one deck resolve per win (kicked off at confirm, awaited at dismiss)', async () => {
      serveEmptyDeck();
      const handle = renderGuessScreen(baseParams());

      expect(resolveNextCardWithServerFallbackMock).not.toHaveBeenCalled();

      await confirmGuess(handle);
      expect(resolveNextCardWithServerFallbackMock).toHaveBeenCalledTimes(1);

      await dismissWinOverlay(handle);
      expect(resolveNextCardWithServerFallbackMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('hints', () => {
    it('the first card shows the swipe hints until the player interacts', async () => {
      const handle = renderGuessScreen(baseParams());

      expect(handle.screen.queryByTestId('guess.hint.swipe-halo')).not.toBeNull();

      // First interaction dismisses the hints even when the modal is cancelled.
      await act(async () => {
        fireEvent.press(handle.screen.getByTestId('game.picture.clear-guess'));
      });
      await act(async () => {
        fireEvent.press(handle.screen.getByTestId('game.picture.guess-modal.close'));
      });

      expect(handle.screen.queryByTestId('guess.hint.swipe-halo')).toBeNull();
    });

    it('e2e mode plays without hints', async () => {
      setE2EMode(true);
      const handle = renderGuessScreen(baseParams());

      expect(handle.screen.queryByTestId('guess.hint.swipe-halo')).toBeNull();
    });
  });

  describe('exit menu', () => {
    it('a rightward swipe on the picture opens the exit menu', async () => {
      const handle = renderGuessScreen(baseParams());

      expect(handle.screen.queryByTestId('guess.exit.panel')).toBeNull();

      await fireSurfaceSwipe({ translationX: 60, translationY: 0 });

      expect(handle.screen.queryByTestId('guess.exit.panel')).not.toBeNull();
      expect(handle.screen.queryByTestId('guess.hint.swipe-halo')).toBeNull();
    });

    it('closing the exit menu returns to the game', async () => {
      const handle = renderGuessScreen(baseParams());

      await fireSurfaceSwipe({ translationX: 60, translationY: 0 });
      await act(async () => {
        fireEvent.press(handle.screen.getByTestId('guess.exit.close'));
      });

      expect(handle.screen.queryByTestId('guess.exit.panel')).toBeNull();
    });

    it('Home in a public game pops to the root', async () => {
      const navigation = makeNav();
      const handle = renderGuessScreen(baseParams(), navigation);

      await fireSurfaceSwipe({ translationX: 60, translationY: 0 });
      await act(async () => {
        fireEvent.press(handle.screen.getByTestId('guess.exit.home'));
      });

      expect(navigation.popToTop).toHaveBeenCalledTimes(1);
      expect(navigation.reset).not.toHaveBeenCalled();
    });

    it('Home in a private game resets the stack to [Home, PrivateHome]', async () => {
      const navigation = makeNav();
      const scope = { kind: 'private', groupId: 'g-1' };
      const handle = renderGuessScreen(baseParams({ scope }), navigation);

      await fireSurfaceSwipe({ translationX: 60, translationY: 0 });
      await act(async () => {
        fireEvent.press(handle.screen.getByTestId('guess.exit.home'));
      });

      expect(navigation.reset).toHaveBeenCalledWith({
        index: 1,
        routes: [
          { name: 'HomeScreen' },
          { name: 'PrivateHomeScreen', params: { scope } },
        ],
      });
      expect(navigation.popToTop).not.toHaveBeenCalled();
    });
  });

  describe('ads', () => {
    // The real cadence shows an ad on every 3rd free-tier win. The first two
    // wins complete (animation + next card); the 3rd guess is left pending so
    // each test controls what happens around the ad.
    async function playTwoWinsAndStartThird(handle: ScreenHandle) {
      serveSuccessiveNextCards();
      await playWinCycle(handle);
      await playWinCycle(handle);
      await confirmGuess(handle);
    }

    it('free tier: every 3rd win shows the internal ad panel once the animation ends', async () => {
      const navigation = makeNav();
      const handle = renderGuessScreen(baseParams(), navigation);

      await playTwoWinsAndStartThird(handle);

      // The ad waits for the win animation to finish (never under the burst).
      expect(handle.screen.queryByTestId('guess.success.overlay')).not.toBeNull();
      expect(handle.screen.queryByTestId('ad.internal.pro.panel')).toBeNull();
      const setParamsBeforeAd = navigation.setParams.mock.calls.length;

      await dismissWinOverlay(handle);

      expect(handle.screen.queryByTestId('ad.internal.pro.panel')).not.toBeNull();
      // RESOLVED stays deferred until the ad is done: no further setParams.
      expect(navigation.setParams.mock.calls.length).toBe(setParamsBeforeAd);
      expect(navigation.navigate).not.toHaveBeenCalledWith('AdScreen', expect.anything());
    });

    it('tapping Continue on the ad reveals the next card', async () => {
      const navigation = makeNav();
      const handle = renderGuessScreen(baseParams(), navigation);

      await playTwoWinsAndStartThird(handle);
      await dismissWinOverlay(handle);
      expect(handle.screen.queryByTestId('ad.internal.pro.panel')).not.toBeNull();

      await act(async () => {
        fireEvent.press(handle.screen.getByTestId('ad.internal.pro.continue'));
      });
      await flush();

      const applied = handle.navigation.setParams.mock.calls[
        handle.navigation.setParams.mock.calls.length - 1
      ][0] as Record<string, unknown>;
      expect(applied).toEqual(expect.objectContaining({ pictureId: 'image-4' }));

      await handle.rerenderWithParams(applied);
      expect(handle.screen.queryByTestId('ad.internal.pro.panel')).toBeNull();
      expect(handle.screen.getByTestId('game.picture.guess-image').props.source).toEqual({
        uri: 'file:///card-4.jpg',
      });
    });

    it('backgrounding while an ad is pending cancels it — no ad over the exhausted panel', async () => {
      resolveNextGuessParamsMock
        .mockResolvedValueOnce({ params: nextCardParams(1) })
        .mockResolvedValueOnce({ params: nextCardParams(2) })
        .mockResolvedValue(null);
      const handle = renderGuessScreen(baseParams());

      await playWinCycle(handle);
      await playWinCycle(handle);
      await confirmGuess(handle);

      // The ad is deferred behind the still-running win animation; background
      // the app mid-defer.
      await act(async () => {
        findAppStateListener()('background');
      });
      expect(handle.screen.queryByTestId('guess-exhausted-panel')).not.toBeNull();

      await dismissWinOverlay(handle);

      expect(handle.screen.queryByTestId('ad.internal.pro.panel')).toBeNull();
      expect(handle.screen.queryByTestId('guess-exhausted-panel')).not.toBeNull();
    });

    it('a slow resolve shows the ad as soon as it lands after the animation', async () => {
      let settleResolve!: (v: { next: { params: Record<string, unknown> }; reason: 'ok' }) => void;
      resolveNextCardWithServerFallbackMock.mockImplementation(() => {
        if (resolveNextCardWithServerFallbackMock.mock.calls.length <= 2) {
          return Promise.resolve({ next: { params: nextCardParams(resolveNextCardWithServerFallbackMock.mock.calls.length) }, reason: 'ok' as const });
        }
        return new Promise((resolve) => {
          settleResolve = resolve as typeof settleResolve;
        });
      });
      const handle = renderGuessScreen(baseParams());

      await playWinCycle(handle);
      await playWinCycle(handle);
      await confirmGuess(handle);

      // The win animation finishes while the 3rd resolve is still pending.
      await dismissWinOverlay(handle);
      expect(handle.screen.queryByTestId('ad.internal.pro.panel')).toBeNull();

      await act(async () => {
        settleResolve({ next: { params: nextCardParams(3) }, reason: 'ok' });
        await Promise.resolve();
      });

      expect(handle.screen.queryByTestId('ad.internal.pro.panel')).not.toBeNull();
    });

    it('a win with no next card never triggers the ad (rollback)', async () => {
      resolveNextGuessParamsMock
        .mockResolvedValueOnce({ params: nextCardParams(1) })
        .mockResolvedValueOnce({ params: nextCardParams(2) })
        .mockResolvedValue(null);
      const handle = renderGuessScreen(baseParams());

      await playWinCycle(handle);
      await playWinCycle(handle);
      await confirmGuess(handle);
      await dismissWinOverlay(handle);

      expect(handle.screen.queryByTestId('guess-exhausted-panel')).not.toBeNull();
      expect(handle.screen.queryByTestId('ad.internal.pro.panel')).toBeNull();
      expect(applySuccessSideEffectsMock).toHaveBeenCalledTimes(2);
    });

    it('a miss ends the round: the next game needs a fresh 3-win streak for an ad', async () => {
      serveSuccessiveNextCards();
      const first = renderGuessScreen(baseParams());

      await playWinCycle(first);
      await playWinCycle(first);

      // The miss replaces the screen (ResultScreen); the next game is a new
      // GuessScreen mount. The ad counter must not carry over — two wins on
      // the fresh screen cannot be the "3rd win".
      await first.rerenderWithParams({ hiddenLocation: MISS_HIDDEN_LOCATION, pictureId: 'image-miss' });
      await confirmGuess(first);
      first.screen.unmount();

      const next = renderGuessScreen(baseParams());
      await playWinCycle(next);
      await playWinCycle(next);
      expect(next.screen.queryByTestId('ad.internal.pro.panel')).toBeNull();

      // The 3rd win of the fresh game is the ad win.
      await confirmGuess(next);
      await dismissWinOverlay(next);
      expect(next.screen.queryByTestId('ad.internal.pro.panel')).not.toBeNull();
    });

    it('a paid creator viewing their own large private group never sees ads', async () => {
      serveSuccessiveNextCards();
      const scope = { kind: 'private', groupId: 'g-9' };
      const activeGroup = { isOwnedByViewer: true, memberCount: 6 };
      const handle = renderGuessScreen(baseParams({ scope, activeGroup }), makeNav(), {
        paidTier: 2,
      });

      await playWinCycle(handle);
      await playWinCycle(handle);
      await confirmGuess(handle);
      await dismissWinOverlay(handle);

      expect(handle.screen.queryByTestId('ad.internal.pro.panel')).toBeNull();
      // The third card still lands — suppression never blocks the advance.
      const applied = handle.navigation.setParams.mock.calls[
        handle.navigation.setParams.mock.calls.length - 1
      ][0] as Record<string, unknown>;
      await handle.rerenderWithParams(applied);
      expect(handle.screen.getByTestId('game.picture.guess-image').props.source).toEqual({
        uri: 'file:///card-4.jpg',
      });
    });

    it('e2e mode never shows ads', async () => {
      setE2EMode(true);
      const navigation = makeNav();
      const handle = renderGuessScreen(baseParams(), navigation);

      await playTwoWinsAndStartThird(handle);
      await dismissWinOverlay(handle);

      expect(handle.screen.queryByTestId('ad.internal.pro.panel')).toBeNull();
      expect(navigation.navigate).not.toHaveBeenCalledWith('AdScreen', expect.anything());
      // The third card still lands — e2e skips the ad, not the advance.
      const applied = handle.navigation.setParams.mock.calls[
        handle.navigation.setParams.mock.calls.length - 1
      ][0] as Record<string, unknown>;
      expect(applied).toEqual(expect.objectContaining({ pictureId: 'image-4' }));
    });
  });

  describe('background deck top-up', () => {
    it('entering a real category warms the all-deck in the background', async () => {
      fetchCardBatchMock.mockResolvedValue({
        isError: false,
        images: [{ pictureId: 'all-1', imageFile: 'file:///all-1.jpg', listId: 1 }],
      });
      const handle = renderGuessScreen(baseParams());
      await flush();

      const allFetches = fetchCardBatchMock.mock.calls.filter(
        (call) => (call[0] as { categoryKey?: string }).categoryKey === 'all',
      );
      expect(allFetches.length).toBeGreaterThanOrEqual(1);
      const warmed = await storedDeck('all', 'fr');
      expect(warmed.map((card) => card.pictureId)).toContain('all-1');
      expect(handle.screen.queryByTestId('guess.success.overlay')).toBeNull();
    });

    it('entering the all category skips the warm-up fetch', async () => {
      renderGuessScreen(baseParams({ category: { id: 'cat-all', key: 'all' } }));
      await flush();

      expect(fetchCardBatchMock).not.toHaveBeenCalled();
    });

    it('winning fires a background top-up fetch for the current public category', async () => {
      const handle = renderGuessScreen(baseParams());
      await flush();
      const fetchesBefore = fetchCardBatchMock.mock.calls.length;

      await confirmGuess(handle);
      await flush();

      expect(fetchCardBatchMock.mock.calls.length).toBeGreaterThan(fetchesBefore);
      const natureFetches = fetchCardBatchMock.mock.calls.filter(
        (call) =>
          (call[0] as { categoryKey?: string }).categoryKey === 'nature' &&
          (call[0] as { categoryId?: unknown }).categoryId === undefined,
      );
      expect(natureFetches.length).toBeGreaterThanOrEqual(1);
    });

    it('a private top-up targets the group category id', async () => {
      const scope = { kind: 'private', groupId: 'group-7' };
      const handle = renderGuessScreen(baseParams({ scope }));
      await flush();
      const fetchesBefore = fetchCardBatchMock.mock.calls.length;

      await confirmGuess(handle);
      await flush();

      expect(fetchCardBatchMock.mock.calls.length).toBeGreaterThan(fetchesBefore);
      const privateFetches = fetchCardBatchMock.mock.calls.filter(
        (call) =>
          (call[0] as { categoryKey?: string }).categoryKey === 'nature' &&
          (call[0] as { categoryId?: unknown }).categoryId === 'cat-1' &&
          (call[0] as { scope?: unknown }).scope === scope,
      );
      expect(privateFetches.length).toBeGreaterThanOrEqual(1);
    });

    it('a miss never fires a top-up fetch', async () => {
      const handle = renderGuessScreen(baseParams({ hiddenLocation: MISS_HIDDEN_LOCATION }));
      await flush();
      const fetchesBefore = fetchCardBatchMock.mock.calls.length;

      await confirmGuess(handle);
      await flush();

      expect(fetchCardBatchMock.mock.calls.length).toBe(fetchesBefore);
    });

    it('top-up fetches are skipped entirely in e2e mode', async () => {
      setE2EMode(true);
      const handle = renderGuessScreen(baseParams());
      await flush();

      await confirmGuess(handle);
      await flush();

      expect(fetchCardBatchMock).not.toHaveBeenCalled();
    });

    it('a stalled top-up never blocks the win animation', async () => {
      fetchCardBatchMock.mockReturnValue(new Promise(() => {}));
      const handle = renderGuessScreen(baseParams());

      await confirmGuess(handle);

      expect(handle.screen.queryByTestId('guess.success.overlay')).not.toBeNull();
    });

    it('a failed top-up never breaks the win flow', async () => {
      fetchCardBatchMock.mockRejectedValue(new Error('network down'));
      serveSuccessiveNextCards();
      const navigation = makeNav();
      const handle = renderGuessScreen(baseParams(), navigation);

      await confirmGuess(handle);
      expect(handle.screen.queryByTestId('guess.success.overlay')).not.toBeNull();

      await playWinCycle(handle);

      expect(navigation.setParams).toHaveBeenCalledWith(nextCardParams(1));
    });
  });

  describe('deck-ahead image warming', () => {
    it('upcoming deck cards are mounted as hidden images for pre-decoding', async () => {
      await seedDeck('nature', 'fr', [
        { pictureId: 'behind', imageFile: 'file:///behind.jpg', listId: 2 },
        { pictureId: 'played', imageFile: 'file:///waldo.jpg', listId: 3 },
        { pictureId: 'ahead-1', imageFile: 'file:///ahead/1.jpg', listId: 4 },
        { pictureId: 'ahead-2', imageFile: 'file:///ahead/2.jpg', listId: 5 },
      ]);
      const handle = renderGuessScreen(baseParams({ listId: 3 }));
      await flush();

      const uris = renderedImageUris(handle.screen);
      expect(uris).toContain('file:///ahead/1.jpg');
      expect(uris).toContain('file:///ahead/2.jpg');
      // Behind-cursor deck cards are not warmed.
      expect(uris).not.toContain('file:///behind.jpg');
    });

    it('the deck-ahead window caps at 7 hidden images', async () => {
      await seedDeck(
        'nature',
        'fr',
        Array.from({ length: 10 }, (_, i) => ({
          pictureId: `ahead-${i}`,
          imageFile: `file:///ahead/${i}.jpg`,
          listId: 4 + i,
        })),
      );
      const handle = renderGuessScreen(baseParams({ listId: 3 }));
      await flush();

      const warmCount = renderedImageUris(handle.screen).filter((uri) => uri.startsWith('file:///ahead/')).length;
      expect(warmCount).toBe(7);
    });

    it('an empty deck mounts no hidden warm images', async () => {
      const handle = renderGuessScreen(baseParams());
      await flush();

      expect(renderedImageUris(handle.screen).filter((uri) => uri.startsWith('file:///ahead/'))).toHaveLength(0);
    });
  });

  describe('card identity across advances', () => {
    it('the picture swaps even when the next card collides on listId', async () => {
      const next = {
        ...nextCardParams(1),
        listId: 3, // collides with the played card's listId
        pictureId: 'image-collision-free',
      };
      resolveNextGuessParamsMock.mockResolvedValue({ params: next });
      const navigation = makeNav();
      const handle = renderGuessScreen(baseParams(), navigation);

      await confirmGuess(handle);
      await dismissWinOverlay(handle);
      await handle.rerenderWithParams(next);

      expect(navigation.setParams).toHaveBeenCalledWith(next);
      expect(handle.screen.getByTestId('game.picture.guess-image').props.source).toEqual({
        uri: 'file:///card-2.jpg',
      });
    });

    it('a second confirm during an in-flight advance cannot double-bank the win', async () => {
      resolveNextCardWithServerFallbackMock.mockReturnValue(new Promise(() => {}));
      const navigation = makeNav();
      const handle = renderGuessScreen(baseParams(), navigation);

      await confirmGuess(handle);
      await dismissWinOverlay(handle);

      // The resolve is still in flight: another confirm must not credit a
      // second win or advance twice.
      await confirmGuess(handle);

      expect(applySuccessSideEffectsMock).not.toHaveBeenCalled();
      expect(navigation.setParams).not.toHaveBeenCalled();
      expect(handle.screen.queryByTestId('guess-exhausted-panel')).toBeNull();
    });
  });
});
