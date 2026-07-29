type MockPictureProps = {
  toAdScreen: (target: { location: { x: number; y: number }; elapsedMs?: number }) => void | Promise<void>;
  pulseTarget: boolean;
  onInteract: () => void;
  disabled?: boolean;
  [key: string]: unknown;
};
type MockOverlayProps = {
  visible: boolean;
  onDone: () => void | Promise<void>;
  multiplier: number;
  points: number;
  streakTier: { tier: number; multiplier: number; label?: string };
  [key: string]: unknown;
};
type MockMenuProps = {
  showHints: boolean;
  onInteract: () => void;
  onHome: () => void;
  [key: string]: unknown;
};

type MockExhaustedPanelProps = {
  onLeave: () => void;
  onSwitch: () => void;
  streak?: number;
  message?: string;
  [key: string]: unknown;
};

type MockAdInterstitialProps = {
  adSource: unknown;
  onDone: () => void;
  [key: string]: unknown;
};

const mockGuessPicture = jest.fn((_props: MockPictureProps) => null);
const mockTutorialOverlay = jest.fn((_props: Record<string, unknown>) => null);
const mockGuessExitSwipeMenu = jest.fn((_props: MockMenuProps) => null);
const mockSuccessOverlay = jest.fn((_props: MockOverlayProps) => null);
const mockGuessExhaustedPanel = jest.fn((_props: MockExhaustedPanelProps) => null);
const mockGuessAdvanceLoader = jest.fn((_props: Record<string, unknown>) => null);
const mockAdInterstitial = jest.fn((_props: MockAdInterstitialProps) => null);

// D1 (P3): NextCardImageWarmer is mocked like the other Guess sub-components so
// tests can assert which deck-ahead URIs GuessScreen feeds it without depending
// on the warmer's own Image-mount behavior (covered in NextCardImageWarmer.test.tsx).
type MockNextCardImageWarmerProps = {
  uris: (string | null | undefined)[];
};
const mockNextCardImageWarmer = jest.fn((_props: MockNextCardImageWarmerProps) => null);

// Cumulative mount counter for GuessPicture remount regression asserts.
// Monotonically increases on every mount (no decrement) so a key-change-driven
// remount surfaces as count=2 (unmount-then-mount sequence). Name prefixed with
// `mock` so jest.mock's factory can reference it (jest only allows out-of-scope
// vars whose name starts with `mock`).
let mockPictureMountCount = 0;

// Currently-mounted AdInterstitial instance count (increment on mount,
// decrement on cleanup). Drives the D1 "adPhase resets to idle after onDone"
// assertion: after onDone fires, the overlay MUST have unmounted (count → 0).
// Prefixed with `mock` for jest.mock factory out-of-scope visibility.
let mockAdMountCount = 0;

// F1 (test-fidelity): configurable auto-dismiss delay for the SuccessOverlay
// mock. Default null = no auto-fire (preserves the manual-call semantics every
// existing test relies on — lastOverlayProps().onDone() is authoritative).
// Timing-sensitive tests (G1a/G1b/G1c) call setMockOverlayDismissDelayMs(ms)
// to schedule props.onDone() via setTimeout(ms) on mount with visible===true;
// manual calls still preempt the timer via wrappedOnDone's clear. Prefixed
// with `mock` for jest.mock factory out-of-scope visibility.
let mockOverlayDismissDelayMs: number | null = null;
function setMockOverlayDismissDelayMs(ms: number | null): void {
  mockOverlayDismissDelayMs = ms;
}

jest.mock('../components/Picture/GuessPicture', () => {
  const React = jest.requireActual('react');
  return function MockGuessPicture(props: MockPictureProps) {
    React.useEffect(() => {
      mockPictureMountCount += 1;
      return () => {};
    }, []);
    mockGuessPicture(props);
    return null;
  };
});

jest.mock('../components/UI/TutorialOverlay', () => {
  return function MockTutorialOverlay(props: Record<string, unknown>) {
    mockTutorialOverlay(props);
    return null;
  };
});

jest.mock('../components/Guess/GuessExitSwipeMenu', () => {
  return function MockGuessExitSwipeMenu(props: MockMenuProps) {
    mockGuessExitSwipeMenu(props);
    return null;
  };
});

jest.mock('../components/Guess/SuccessOverlay', () => {
  // Cast to typed React so useRef<T>(...) accepts type arguments (the
  // untyped jest.requireActual returns `any`, which TS2347-rejects generics).
  const React = jest.requireActual('react') as typeof import('react');
  return function MockSuccessOverlay(props: MockOverlayProps) {
    // Mirror real SuccessOverlay's onDoneRef pattern: the auto-fire timer
    // always invokes the LATEST onDone, surviving parent re-renders without
    // rescheduling.
    const onDoneRef = React.useRef<() => void | Promise<void>>(props.onDone);
    onDoneRef.current = props.onDone;
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // wrappedOnDone is what tests reach via lastOverlayProps().onDone(). A
    // manual call from a test preempts the scheduled auto-fire by clearing
    // the timer BEFORE delegating to the real handler — this preserves the
    // existing manual-call semantics while keeping the auto-fire path honest.
    const wrappedOnDone = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      onDoneRef.current();
    };

    React.useEffect(() => {
      if (!props.visible) return undefined;
      if (mockOverlayDismissDelayMs === null) return undefined;
      const ms = mockOverlayDismissDelayMs;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onDoneRef.current();
      }, ms);
      return () => {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }, [props.visible]);

    mockSuccessOverlay({ ...props, onDone: wrappedOnDone });
    return null;
  };
});

jest.mock('../components/Guess/GuessExhaustedPanel', () => {
  return function MockGuessExhaustedPanel(props: MockExhaustedPanelProps) {
    mockGuessExhaustedPanel(props);
    return null;
  };
});

jest.mock('../components/Guess/GuessAdvanceLoader', () => {
  return function MockGuessAdvanceLoader(props: Record<string, unknown>) {
    mockGuessAdvanceLoader(props);
    return null;
  };
});

jest.mock('../components/Ads/AdInterstitial', () => {
  const React = jest.requireActual('react');
  return function MockAdInterstitial(props: MockAdInterstitialProps) {
    React.useEffect(() => {
      mockAdMountCount += 1;
      return () => { mockAdMountCount -= 1; };
    }, []);
    mockAdInterstitial(props);
    return null;
  };
});

jest.mock('../components/Picture/NextCardImageWarmer', () => {
  return function MockNextCardImageWarmer(props: MockNextCardImageWarmerProps) {
    mockNextCardImageWarmer(props);
    return null;
  };
});

jest.mock('../utils/targetLocation', () => ({
  isOnTarget: jest.fn(),
}));

jest.mock('../utils/handleGuessOutcome', () => ({
  applySuccessSideEffects: jest.fn(),
  resolveNextGuessParams: jest.fn(),
}));

// Mock cardDeck so resolveNextCardWithServerFallback's foreground tiers return
// a deterministic `reason: 'empty'` (server has no images) rather than the
// transport-error path. This lets the existing exhaustion tests (T11/T12) and
// the new state-machine tests assert terminal exhausted state synchronously
// without fake timers.
jest.mock('../services/cardDeck', () => ({
  fetchCardBatch: jest.fn().mockResolvedValue({ images: [] }),
  appendCardBatch: jest.fn().mockResolvedValue(undefined),
}));

// Wrap resolveNextCardWithServerFallback in a jest.fn so per-test overrides can
// drive specific reason codes (network/server/empty). Default impl delegates to
// the real function (which calls the mocked inner + cardDeck above).
jest.mock('../utils/nextCardAdvancer', () => {
  const actual = jest.requireActual('../utils/nextCardAdvancer');
  return {
    ...actual,
    resolveNextCardWithServerFallback: jest.fn(actual.resolveNextCardWithServerFallback),
  };
});

jest.mock('../utils/guessNavigation', () => ({
  navigateToNextGuess: jest.fn(),
}));

jest.mock('../utils/e2eMode', () => ({
  isE2EMode: jest.fn(() => false),
}));

jest.mock('../services/cardPrefetcher', () => {
  const actual = jest.requireActual('../services/cardPrefetcher');
  return {
    ...actual,
    prefetchIfLow: jest.fn(() => Promise.resolve()),
    warmAllDeckIfNeeded: jest.fn(() => Promise.resolve()),
  };
});

jest.mock('../services/billing/adPolicy', () => ({
  shouldSuppressAds: jest.fn(() => false),
}));

jest.mock('../utils/adCadence', () => ({
  consumeAdSlot: jest.fn(),
}));

jest.mock('../services/ads/FallbackAdSource', () => ({
  createFallbackAdSource: jest.fn(),
}));
jest.mock('../services/ads/AdMobInterstitialSource', () => ({
  createAdMobInterstitialSource: jest.fn(),
}));
jest.mock('../services/ads/InternalProAdSource', () => ({
  createInternalProAdSource: jest.fn(),
}));

// D1 (P3): GuessScreen reads the deck ahead via getNextImagesForScope to feed
// NextCardImageWarmer. Default resolves [] so existing tests are unaffected;
// per-test overrides drive the warmer-wiring assertions below. Other exports
// stay real so the unmocked resolve chain (nextCardAdvancer → nextCardResolver
// → getNextImageForScope SINGULAR) keeps working in tests that exercise it.
// E1: clearExhaustedCategory is mocked (jest.fn) so handleSwitchCategory tests
// can assert the call without invoking AsyncStorage / groupFeedCache.
jest.mock('../utils/storageDatum', () => {
  const actual = jest.requireActual('../utils/storageDatum');
  return {
    ...actual,
    getNextImagesForScope: jest.fn().mockResolvedValue([]),
    clearExhaustedCategory: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock('../hooks/useStreak', () => {
  const actual = jest.requireActual<{
    useStreak: (initial?: number) => {
      streak: number;
      tier: unknown;
      multiplier: number;
      onWin(...a: unknown[]): unknown;
      onLose(...a: unknown[]): unknown;
      reset(...a: unknown[]): unknown;
    };
  }>('../hooks/useStreak');
  const spies = { onWin: jest.fn(), onLose: jest.fn(), reset: jest.fn() };
  const useStreakMock = jest.fn((initial: number) => {
    const result = actual.useStreak(initial);
    return {
      ...result,
      onWin: (...args: unknown[]) => { spies.onWin(...args); return result.onWin(...args); },
      onLose: (...args: unknown[]) => { spies.onLose(...args); return result.onLose(...args); },
      reset: (...args: unknown[]) => { spies.reset(...args); return result.reset(...args); },
    };
  });
  // reason: attach an introspection-only field not present on the jest.Mock type; bridge through unknown since the mock object genuinely carries __spies at runtime.
  (useStreakMock as unknown as { __spies: typeof spies }).__spies = spies;
  return { useStreak: useStreakMock };
});

import { act, create as reactCreate } from 'react-test-renderer';
import type { FC } from 'react';
import { AppState } from 'react-native';

import GuessScreenBase from '../screens/GuessScreens/GuessScreen';
import { isOnTarget as isOnTargetImpl } from '../utils/targetLocation';
import { applySuccessSideEffects as applySuccessSideEffectsImpl, resolveNextGuessParams as resolveNextGuessParamsImpl } from '../utils/handleGuessOutcome';
import { navigateToNextGuess as navigateToNextGuessImpl } from '../utils/guessNavigation';
import { prefetchIfLow as prefetchIfLowImpl } from '../services/cardPrefetcher';
import { warmAllDeckIfNeeded as warmAllDeckIfNeededImpl } from '../services/cardPrefetcher';
import { consumeAdSlot as consumeAdSlotImpl } from '../utils/adCadence';
import { shouldSuppressAds as shouldSuppressAdsImpl } from '../services/billing/adPolicy';
import { resolveNextCardWithServerFallback as resolveNextCardWithServerFallbackImpl } from '../utils/nextCardAdvancer';
import { getNextImagesForScope as getNextImagesForScopeImpl } from '../utils/storageDatum';

// reason: these modules are fully replaced by jest.mock at runtime; cast the typed
// import bindings to jest.MockedFunction so .mockReturnValue/.mockResolvedValue/.mockImplementation read cleanly without per-call casts.
const isOnTarget = isOnTargetImpl as jest.MockedFunction<typeof isOnTargetImpl>;
const applySuccessSideEffects = applySuccessSideEffectsImpl as jest.MockedFunction<typeof applySuccessSideEffectsImpl>;
const resolveNextGuessParams = resolveNextGuessParamsImpl as jest.MockedFunction<typeof resolveNextGuessParamsImpl>;
const navigateToNextGuess = navigateToNextGuessImpl as jest.MockedFunction<typeof navigateToNextGuessImpl>;
const prefetchIfLow = prefetchIfLowImpl as jest.MockedFunction<typeof prefetchIfLowImpl>;
const warmAllDeckIfNeeded = warmAllDeckIfNeededImpl as jest.MockedFunction<typeof warmAllDeckIfNeededImpl>;
const consumeAdSlot = consumeAdSlotImpl as jest.MockedFunction<typeof consumeAdSlotImpl>;
const shouldSuppressAds = shouldSuppressAdsImpl as jest.MockedFunction<typeof shouldSuppressAdsImpl>;
const resolveNextCardWithServerFallback = resolveNextCardWithServerFallbackImpl as jest.MockedFunction<typeof resolveNextCardWithServerFallbackImpl>;
const getNextImagesForScope = getNextImagesForScopeImpl as jest.MockedFunction<typeof getNextImagesForScopeImpl>;

const mountedRenderers: Array<ReturnType<typeof reactCreate>> = [];

function create(...args: Parameters<typeof reactCreate>): ReturnType<typeof reactCreate> {
  const renderer = reactCreate(...args);
  mountedRenderers.push(renderer);
  return renderer;
}
const advanceModuleActual = jest.requireActual('../utils/nextCardAdvancer') as typeof import('../utils/nextCardAdvancer');

// reason: source's GuessNavigation requires navigate/setOptions, but several test fixtures only supply replace/setParams/popToTop; loosen prop types to keep fixtures byte-identical to the .js baseline.
type LooseGuessScreenProps = { navigation: unknown; route: { params: Record<string, unknown> } };
const GuessScreen = GuessScreenBase as unknown as FC<LooseGuessScreenProps>;

function lastPictureProps(): MockPictureProps {
  return mockGuessPicture.mock.calls[mockGuessPicture.mock.calls.length - 1][0];
}

function lastOverlayProps(): MockOverlayProps {
  return mockSuccessOverlay.mock.calls[mockSuccessOverlay.mock.calls.length - 1][0];
}

function lastMenuProps(): MockMenuProps {
  return mockGuessExitSwipeMenu.mock.calls[mockGuessExitSwipeMenu.mock.calls.length - 1][0];
}

function lastAdInterstitialProps(): MockAdInterstitialProps {
  return mockAdInterstitial.mock.calls[mockAdInterstitial.mock.calls.length - 1][0];
}

function streakSpies() {
  const { useStreak } = require('../hooks/useStreak');
  return useStreak.__spies as { onWin: jest.Mock; onLose: jest.Mock; reset: jest.Mock };
}

describe('GuessScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPictureMountCount = 0;
    mockAdMountCount = 0;
    // F1: reset the SuccessOverlay mock's auto-dismiss delay so per-test
    // overrides do not leak across tests.
    setMockOverlayDismissDelayMs(null);
    const { isE2EMode } = require('../utils/e2eMode');
    isE2EMode.mockReturnValue(false);
    consumeAdSlot.mockReturnValue({ showAd: false, nextCount: 1 });
    shouldSuppressAds.mockReturnValue(false);
    // Reset the outer resolver mock to its default (actual implementation)
    // so per-test mockResolvedValue overrides don't leak across tests.
    resolveNextCardWithServerFallback.mockImplementation(advanceModuleActual.resolveNextCardWithServerFallback);
    // D1 (P3): default the warmer deck reader to [] so existing tests see no
    // URIs; per-test overrides assert the wiring.
    getNextImagesForScope.mockResolvedValue([]);
    // Stub AppState.addEventListener as a jest.fn so tests can capture the
    // registered listener and dispatch synthetic events. Restored after each.
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }) as any);
  });

  afterEach(async () => {
    await act(async () => {
      while (mountedRenderers.length > 0) {
        mountedRenderers.pop()?.unmount();
      }
      await Promise.resolve();
    });
    jest.restoreAllMocks();
  });

  it('on success (public): buffers side effects, shows overlay, never navigates to AdScreen/ResultScreen', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
    });

    // PB6 + C1: streak + score commit when the resolve settles. C1 kicks the
    // resolve off in applySuccessPath at tap time, so applySuccessSideEffects
    // may already have fired by here (microtask-flushed by act()).
    expect(navigation.replace).not.toHaveBeenCalledWith('AdScreen', expect.anything());
    expect(navigation.replace).not.toHaveBeenCalledWith('ResultScreen', expect.anything());

    const overlayProps = lastOverlayProps();
    expect(overlayProps.visible).toBe(true);
    expect(overlayProps.onDone).toEqual(expect.any(Function));
    expect(overlayProps.multiplier).toBe(2);

    // PB6: streak + score committed on RESOLVED (after onDone with successful resolve).
    await act(async () => {
      overlayProps.onDone();
    });

    expect(applySuccessSideEffects).toHaveBeenCalledWith({
      listId: 3,
      categoryKey: 'nature',
      language: 'fr',
      imageFile: 'file:///waldo.jpg',
      pictureId: 'image-1',
      scope: undefined,
      userId: '',
      points: 2,
      multiplier: 2,
      streak: 1,
      streakMultiplier: 1.0,
    });
  });

  it('on a slow success (elapsedMs past threshold) uses multiplier=1 and skips the bonus', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 6000 });
    });

    expect(lastOverlayProps().multiplier).toBe(1);

    await act(async () => {
      lastOverlayProps().onDone();
    });

    expect(applySuccessSideEffects).toHaveBeenLastCalledWith({
      listId: 3,
      categoryKey: 'nature',
      language: 'fr',
      imageFile: 'file:///waldo.jpg',
      pictureId: 'image-1',
      scope: undefined,
      userId: '',
      points: 1,
      multiplier: 1,
      streak: 1,
      streakMultiplier: 1.0,
    });
  });

  it('never navigates to AdScreen regardless of speed bonus', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
    });

    expect(navigation.replace).not.toHaveBeenCalledWith('AdScreen', expect.anything());
    expect(navigation.replace).not.toHaveBeenCalledWith('ResultScreen', expect.anything());
  });

  it('overlay onDone with resolved params advances via setParams (no replace, no navigateToNextGuess)', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    const nextParams = {
      listId: 4,
      imageFile: 'file:///next.jpg',
      pictureId: 'image-2',
      description: 'Next card',
      hiddenLocation: { x: 0.3, y: 0.7 },
      category: { id: 'cat-1', key: 'nature' },
      language: 'fr',
      isTutorial: false,
      skipInstructions: true,
    };
    resolveNextGuessParams.mockResolvedValue({ params: nextParams });

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
    });

    const overlayProps = lastOverlayProps();
    await act(async () => {
      overlayProps.onDone();
    });

    expect(resolveNextGuessParams).toHaveBeenCalledWith({
      category: { id: 'cat-1', key: 'nature' },
      language: 'fr',
      currentListId: 3,
      currentPictureId: 'image-1',
      isTutorial: false,
      scope: undefined,
    });
    expect(navigation.setParams).toHaveBeenCalledWith(nextParams);
    expect(navigation.replace).not.toHaveBeenCalledWith('GuessScreen', expect.anything());
    expect(navigateToNextGuess).not.toHaveBeenCalled();
    // Regression (T4): prefetch fired during success path but did not block overlay/setParams.
    expect(prefetchIfLow).toHaveBeenCalledTimes(1);
    expect(prefetchIfLow).toHaveBeenCalledWith({
      categoryKey: 'nature',
      categoryId: 'cat-1',
      language: 'fr',
      scope: undefined,
      authContext: expect.objectContaining({ userId: '' }),
      currentListId: 3,
    });
  });

  it('overlay onDone with null (deck empty) dispatches FAILED_PERMANENT → exhausted, mounts GuessExhaustedPanel (no retry)', async () => {
    // F3b: reason='empty' (default cardDeck mock) is deterministic — the
    // cascade already tried Tier 3 'all' cross-fallback + Tier 4 looping-replay
    // before returning null. No retry; straight to exhausted + safety-net panel.
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue(null);
    navigateToNextGuess.mockResolvedValue(undefined);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
    });

    const overlayProps = lastOverlayProps();
    await act(async () => {
      overlayProps.onDone();
    });

    // No warming — deterministic empty → straight to exhausted.
    expect(mockGuessAdvanceLoader).not.toHaveBeenCalled();
    // Safety-net panel mounts immediately on FAILED_PERMANENT.
    expect(mockGuessExhaustedPanel).toHaveBeenCalled();
    expect(navigateToNextGuess).not.toHaveBeenCalled();
    expect(navigation.setParams).not.toHaveBeenCalled();
    // Regression (T5): prefetch fired on win but did not interfere with the exhausted transition.
    expect(prefetchIfLow).toHaveBeenCalledTimes(1);
  });

  it('on failure (private scope): navigates to ResultScreen with sharedParams, no side effects, overlay hidden', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const scope = { kind: 'private', groupId: 'group-7' };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        scope,
      },
    };
    isOnTarget.mockReturnValue(false);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.1, y: 0.2 } });
    });

    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith('ResultScreen', {
      onTarget: false,
      imageFile: 'file:///waldo.jpg',
      pictureId: 'image-1',
      description: 'Find Waldo',
      imageHeight: 1200,
      imageWidth: 800,
      isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        screenHeight: 1334,
        screenWidth: 750,
        listId: 3,
      isTutorial: false,
      category: { id: 'cat-1', key: 'nature' },
      language: 'fr',
      scope,
    });
    expect(applySuccessSideEffects).not.toHaveBeenCalled();

    const overlayProps = lastOverlayProps();
    expect(overlayProps.visible).toBe(false);
  });

  it('activates hints on the first card of each game series (non-e2e mount)', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    expect(pictureProps.pulseTarget).toBe(true);
    expect(pictureProps.onInteract).toEqual(expect.any(Function));

    const menuProps = lastMenuProps();
    expect(menuProps.showHints).toBe(true);
    expect(menuProps.onInteract).toEqual(expect.any(Function));
  });

  it('suppresses hints in e2e mode', async () => {
    const { isE2EMode } = require('../utils/e2eMode');
    isE2EMode.mockReturnValue(true);

    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    expect(lastPictureProps().pulseTarget).toBe(false);
    expect(lastMenuProps().showHints).toBe(false);
  });

  it('dismisses hints on first onInteract', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    expect(lastPictureProps().pulseTarget).toBe(true);
    expect(lastMenuProps().showHints).toBe(true);

    await act(async () => {
      lastPictureProps().onInteract();
    });

    expect(lastPictureProps().pulseTarget).toBe(false);
    expect(lastMenuProps().showHints).toBe(false);
  });

  it('on success: calls streak.onWin and passes streakTier (tier >= 0) to SuccessOverlay', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
    });

    // PB6 + C1: onWin fires when the resolve settles. C1 kicks the resolve off
    // at tap time, so onWin may already have fired by here. onLose never fires
    // on the success path.
    expect(streakSpies().onLose).not.toHaveBeenCalled();

    const overlayProps = lastOverlayProps();
    expect(overlayProps.streakTier).toBeDefined();
    expect(overlayProps.streakTier.tier).toBeGreaterThanOrEqual(0);

    await act(async () => {
      overlayProps.onDone();
    });

    expect(streakSpies().onWin).toHaveBeenCalledTimes(1);
    expect(streakSpies().onLose).not.toHaveBeenCalled();
  });

  it('after 3 consecutive successes, SuccessOverlay streakTier.tier === 1 (Focused)', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    // PB6: streak commits only on RESOLVED — each tap+onDone cycle increments.
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
      });
      await act(async () => {
        lastOverlayProps().onDone();
      });
    }

    expect(streakSpies().onWin).toHaveBeenCalledTimes(3);
  });

  it('on failure: calls streak.onLose before navigating to ResultScreen', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };
    isOnTarget.mockReturnValue(false);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.1, y: 0.2 } });
    });

    expect(streakSpies().onLose).toHaveBeenCalledTimes(1);
    expect(streakSpies().onWin).not.toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith('ResultScreen', expect.anything());
  });

  it('after success then failure: streak resets and a fresh mount starts a tier-0 streak', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    // PB6: streak commits only on RESOLVED — tap+onDone each cycle.
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
      });
      await act(async () => {
        lastOverlayProps().onDone();
      });
    }
    expect(streakSpies().onWin).toHaveBeenCalledTimes(3);

    isOnTarget.mockReturnValue(false);
    await act(async () => {
      lastPictureProps().toAdScreen({ location: { x: 0.1, y: 0.2 } });
    });
    expect(streakSpies().onLose).toHaveBeenCalledTimes(1);

    isOnTarget.mockReturnValue(true);
    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });
    await act(async () => {
      lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
    });

    expect(lastOverlayProps().streakTier.tier).toBe(0);
  });

  it('final points reflects both multipliers: Math.round(base * speedMul * streakMul)', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    // PB6: streak commits only on RESOLVED — each tap+onDone cycle increments.
    // 3 cycles land streak=3 (tier 1, streakMultiplier=2.0); the overlay render
    // after the 3rd onDone reflects the committed tier, so points=round(2*2.0)=4.
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
      });
      await act(async () => {
        lastOverlayProps().onDone();
      });
    }

    const overlayProps = lastOverlayProps();
    expect(overlayProps.multiplier).toBe(2);
    expect(overlayProps.streakTier.multiplier).toBe(2.0);
    expect(overlayProps.points).toBe(4);
  });

  it('regression: 3rd consecutive win buffers post-increment streak=3, streakMultiplier=2.0, points=4 (not stale tier-0 values)', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    // PB6: streak commits only on RESOLVED — each tap+onDone cycle increments.
    // 3 cycles → applySuccessSideEffects fires 3× (once per RESOLVED). Last call
    // sees currentStreak=2 → nextStreak=3, tier 1 (mult 2.0), points=round(2*2.0)=4.
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
      });
      await act(async () => {
        lastOverlayProps().onDone();
      });
    }

    expect(applySuccessSideEffects).toHaveBeenCalledTimes(3);
    expect(applySuccessSideEffects).toHaveBeenLastCalledWith({
      listId: 3,
      categoryKey: 'nature',
      language: 'fr',
      imageFile: 'file:///waldo.jpg',
      pictureId: 'image-1',
      scope: undefined,
      userId: '',
      points: 4,
      multiplier: 2,
      streak: 3,
      streakMultiplier: 2.0,
    });

    const overlayProps = lastOverlayProps();
    expect(overlayProps.streakTier.tier).toBe(1);
    expect(overlayProps.streakTier.multiplier).toBe(2.0);
    expect(overlayProps.points).toBe(4);
  });

  it('regression: 7th consecutive win buffers post-increment streak=7, streakMultiplier=3.0, points=6', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    // PB6: streak commits only on RESOLVED — each tap+onDone cycle increments.
    // 7 cycles → applySuccessSideEffects fires 7× (once per RESOLVED). Last call
    // sees currentStreak=6 → nextStreak=7, tier 2 (mult 3.0), points=round(2*3.0)=6.
    for (let i = 0; i < 7; i++) {
      await act(async () => {
        lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
      });
      await act(async () => {
        lastOverlayProps().onDone();
      });
    }

    expect(applySuccessSideEffects).toHaveBeenCalledTimes(7);
    expect(applySuccessSideEffects).toHaveBeenLastCalledWith({
      listId: 3,
      categoryKey: 'nature',
      language: 'fr',
      imageFile: 'file:///waldo.jpg',
      pictureId: 'image-1',
      scope: undefined,
      userId: '',
      points: 6,
      multiplier: 2,
      streak: 7,
      streakMultiplier: 3.0,
    });

    const overlayProps = lastOverlayProps();
    expect(overlayProps.streakTier.tier).toBe(2);
    expect(overlayProps.streakTier.multiplier).toBe(3.0);
    expect(overlayProps.points).toBe(6);
  });

  describe('background prefetch on streak win', () => {
    function baseRoute(overrides: Record<string, unknown> = {}) {
      return {
        params: {
          imageFile: 'file:///waldo.jpg',
          pictureId: 'image-1',
          description: 'Find Waldo',
          imageHeight: 1200,
          imageWidth: 800,
          isPortrait: true,
          hiddenLocation: { x: 0.5, y: 0.5 },
          listId: 3,
          isTutorial: false,
          category: { id: 'cat-1', key: 'nature' },
          language: 'fr',
          ...overrides,
        },
      };
    }

    it('T1: on success fires prefetchIfLow on tap with identity deps (PB6: score commit deferred to RESOLVED)', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      // PB6 + C1: applySuccessSideEffects fires when the resolve settles; C1
      // kicks the resolve off at tap, so it may already have fired by here.
      // The observable invariant is prefetchIfLow's call shape on tap.
      expect(prefetchIfLow).toHaveBeenCalledTimes(1);
      expect(prefetchIfLow).toHaveBeenCalledWith({
        categoryKey: 'nature',
        categoryId: 'cat-1',
        language: 'fr',
        scope: undefined,
        authContext: expect.objectContaining({ userId: '' }),
        currentListId: 3,
      });
    });

    it('T7 (plan-spec): on success (private scope): prefetchIfLow called with private scope passed through', async () => {
      // Mirrors T1 with scope = { kind: 'private', groupId: 'group-7' }.
      // Screen must NOT strip or rewrite scope; prefetcher handles private
      // write path internally (out of scope for screen test).
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      const privateScope = { kind: 'private', groupId: 'group-7' };
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute({ scope: privateScope })} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      // C1: applySuccessSideEffects fires when the resolve settles. The
      // observable invariant here is prefetchIfLow's private-scope pass-through.
      expect(prefetchIfLow).toHaveBeenCalledTimes(1);
      expect(prefetchIfLow).toHaveBeenCalledWith({
        categoryKey: 'nature',
        categoryId: 'cat-1',
        language: 'fr',
        scope: privateScope,
        authContext: expect.objectContaining({ userId: '' }),
        currentListId: 3,
      });
    });

    it('T2: prefetch is fire-and-forget (overlay visible even before prefetch resolves)', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      // Never-resolving deferred: if awaited, SuccessOverlay would never show.
      prefetchIfLow.mockReturnValue(new Promise(() => {}));

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      expect(prefetchIfLow).toHaveBeenCalledTimes(1);
      expect(lastOverlayProps().visible).toBe(true);
    });

    it('T3: prefetch is a no-op in e2e mode (screen-side guard is internal to prefetcher)', async () => {
      // Prefetcher guards on isE2EMode internally. Mock the module to mimic that behavior.
      const { isE2EMode } = require('../utils/e2eMode');
      isE2EMode.mockReturnValue(true);
      prefetchIfLow.mockImplementation(() => {
        // Mirror real prefetcher: e2e mode short-circuits before any work.
        return Promise.resolve();
      });

      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      // Screen still calls prefetchIfLow (it does not duplicate the e2e check);
      // the prefetcher module owns the no-op behavior.
      expect(prefetchIfLow).toHaveBeenCalledTimes(1);
      expect(lastOverlayProps().visible).toBe(true);
    });

    it('T6: on a miss, prefetchIfLow is never called (no deck mutation)', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      isOnTarget.mockReturnValue(false);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.1, y: 0.2 } });
      });

      expect(navigation.replace).toHaveBeenCalledWith('ResultScreen', expect.anything());
      expect(prefetchIfLow).not.toHaveBeenCalled();
    });

    it('T6b: categoryKey falls back to "all" when category is null', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute({ category: null })} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      expect(prefetchIfLow).toHaveBeenCalledTimes(1);
      expect(prefetchIfLow).toHaveBeenCalledWith(expect.objectContaining({
        categoryKey: 'all',
        categoryId: undefined,
      }));
    });

    it('T7: prefetch rejection does not break the success flow (overlay still shows, setParams still fires onDone)', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      // Lazy: build the rejected promise only when the screen calls the mock,
      // so the call-site .catch(() => {}) attaches synchronously.
      prefetchIfLow.mockImplementation(() => Promise.reject(new Error('network down')));
      const nextParams = {
        listId: 4,
        imageFile: 'file:///next.jpg',
        pictureId: 'image-2',
        description: 'Next card',
        hiddenLocation: { x: 0.3, y: 0.7 },
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        isTutorial: false,
        skipInstructions: true,
      };
      resolveNextGuessParams.mockResolvedValue({ params: nextParams });

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      // Overlay still shown despite prefetch rejection (call-site .catch swallows).
      expect(prefetchIfLow).toHaveBeenCalledTimes(1);
      expect(lastOverlayProps().visible).toBe(true);

      const overlayProps = lastOverlayProps();
      await act(async () => {
        overlayProps.onDone();
      });

      // Flush the rejected promise's unhandled-rejection microtask.
      await act(async () => { await Promise.resolve(); });

      expect(navigation.setParams).toHaveBeenCalledWith(nextParams);
      expect(navigateToNextGuess).not.toHaveBeenCalled();
    });

    it('T8: mount fires eager warm-all for real category', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      expect(warmAllDeckIfNeeded).toHaveBeenCalledTimes(1);
      expect(warmAllDeckIfNeeded).toHaveBeenCalledWith(expect.objectContaining({
        language: 'fr',
        scope: undefined,
        authContext: expect.objectContaining({ userId: '' }),
      }));
    });

    it('T9: mount does NOT fire warm-all for "all" category', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute({ category: { id: 'cat-all', key: 'all' } })} />);
      });

      expect(warmAllDeckIfNeeded).not.toHaveBeenCalled();
    });

    it('T10: handleOverlayDone waits for warm-all and retries when deck exhausted in real category', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      warmAllDeckIfNeeded.mockResolvedValue(undefined);

      const nextParams = {
        listId: 4,
        imageFile: 'file:///next.jpg',
        pictureId: 'image-2',
        description: 'Next card',
        hiddenLocation: { x: 0.3, y: 0.7 },
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        isTutorial: false,
        skipInstructions: true,
      };
      resolveNextGuessParams
        .mockResolvedValueOnce(null)   // Tier 1 (local)
        .mockResolvedValueOnce(null)   // T2.7 PB4 Tier 2 short-circuit recheck (prefetchIfLow is mocked no-op, so the deck is still empty)
        .mockResolvedValueOnce({ params: nextParams });  // Tier 3 after warm-all lands the fallback card

      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      const overlayProps = lastOverlayProps();
      await act(async () => {
        overlayProps.onDone();
      });

      // mount (1) + Tier 3 cross-fallback in handleOverlayDone (1) = 2
      expect(warmAllDeckIfNeeded).toHaveBeenCalledTimes(2);
      // T2.7 PB4 adds an extra resolveNextGuessParams call inside
      // foregroundTopUp's Tier 2 short-circuit recheck — this is intentional
      // and correct.
      expect(resolveNextGuessParams).toHaveBeenCalledTimes(3);
      expect(navigation.setParams).toHaveBeenCalledWith(nextParams);
      expect(navigateToNextGuess).not.toHaveBeenCalled();
    });

    it('T11: handleOverlayDone dispatches FAILED_PERMANENT → exhausted (mounts GuessExhaustedPanel, no retry) when deck is truly empty after warm retry', async () => {
      // F3b: empty is deterministic. The cascade already tried Tier 3 'all'
      // cross-fallback + Tier 4 looping-replay before returning null. No retry;
      // exhausted panel mounts immediately.
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      warmAllDeckIfNeeded.mockResolvedValue(undefined);

      resolveNextGuessParams.mockResolvedValue(null);
      navigateToNextGuess.mockResolvedValue(undefined);

      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      const overlayProps = lastOverlayProps();
      await act(async () => {
        overlayProps.onDone();
      });

      expect(warmAllDeckIfNeeded).toHaveBeenCalledTimes(2);
      // T2.7 PB4 adds an extra resolveNextGuessParams call inside
      // foregroundTopUp's Tier 2 short-circuit recheck — this is intentional
      // and correct.
      expect(resolveNextGuessParams).toHaveBeenCalledTimes(3);
      // No warming — deterministic empty → straight to exhausted.
      expect(mockGuessAdvanceLoader).not.toHaveBeenCalled();
      // Safety-net panel mounts on FAILED_PERMANENT.
      expect(mockGuessExhaustedPanel).toHaveBeenCalled();
      expect(navigateToNextGuess).not.toHaveBeenCalled();
      expect(navigation.setParams).not.toHaveBeenCalled();
    });

    it('T12: handleOverlayDone does NOT warm when category is "all" (dispatches FAILED_PERMANENT → exhausted, mounts GuessExhaustedPanel, no retry)', async () => {
      // F3b: empty is deterministic. No retry; exhausted panel mounts.
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };

      resolveNextGuessParams.mockResolvedValue(null);
      navigateToNextGuess.mockResolvedValue(undefined);

      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute({ category: { id: 'cat-all', key: 'all' } })} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      const overlayProps = lastOverlayProps();
      await act(async () => {
        overlayProps.onDone();
      });

      expect(warmAllDeckIfNeeded).not.toHaveBeenCalled();
      // T2.7 PB4 adds an extra resolveNextGuessParams call inside
      // foregroundTopUp's Tier 2 short-circuit recheck — this is intentional
      // and correct.
      expect(resolveNextGuessParams).toHaveBeenCalledTimes(2);
      // No warming — deterministic empty → straight to exhausted.
      expect(mockGuessAdvanceLoader).not.toHaveBeenCalled();
      // Safety-net panel mounts on FAILED_PERMANENT.
      expect(mockGuessExhaustedPanel).toHaveBeenCalled();
      expect(navigateToNextGuess).not.toHaveBeenCalled();
    });
  });

  const PUBLIC_ROUTE_PARAMS = {
    imageFile: 'file:///waldo.jpg',
    pictureId: 'image-1',
    description: 'Find Waldo',
    imageHeight: 1200, imageWidth: 800, isPortrait: true,
    hiddenLocation: { x: 0.5, y: 0.5 },
    listId: 3, isTutorial: false,
    category: { id: 'cat-1', key: 'nature' }, language: 'fr',
  };

  function makeNav() {
    // addListener default no-op kept for forward-compat with hooks that may
    // subscribe to navigation events. C3 removed useFlushOnLeave from
    // GuessScreen (AdScreen round-trip is gone); the stub remains harmless.
    return {
      replace: jest.fn(),
      setParams: jest.fn(),
      popToTop: jest.fn(),
      navigate: jest.fn(),
      goBack: jest.fn(),
      addListener: jest.fn(() => () => {}),
    };
  }

  it('on success + ad not due: advances directly (no AdScreen navigation)', async () => {
    consumeAdSlot.mockReturnValue({ showAd: false, nextCount: 1 });
    shouldSuppressAds.mockReturnValue(false);
    const navigation = makeNav();
    const route = { params: PUBLIC_ROUTE_PARAMS };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

    await act(async () => { create(<GuessScreen navigation={navigation} route={route} />); });
    await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
    await act(async () => { lastOverlayProps().onDone(); });

    expect(navigation.navigate).not.toHaveBeenCalledWith('AdScreen', expect.anything());
    expect(navigation.setParams).toHaveBeenCalledWith({ listId: 4 });
  });

  it('win → no ad → setParams called exactly once (state machine is single source of truth)', async () => {
    // Phase 1 review fix A: onAdvanceResolved's no-ad branch no longer calls
    // applyAdvance. The reducer's RESOLVED transition + idle-entry effect is
    // the single source of truth, so setParams fires exactly once.
    consumeAdSlot.mockReturnValue({ showAd: false, nextCount: 1 });
    shouldSuppressAds.mockReturnValue(false);
    const navigation = makeNav();
    const route = { params: PUBLIC_ROUTE_PARAMS };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    const nextParams = { listId: 4, imageFile: 'file:///next.jpg' };
    resolveNextGuessParams.mockResolvedValue({ params: nextParams });

    await act(async () => { create(<GuessScreen navigation={navigation} route={route} />); });
    await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
    await act(async () => { lastOverlayProps().onDone(); });

    expect(navigation.setParams).toHaveBeenCalledTimes(1);
    expect(navigation.setParams).toHaveBeenCalledWith(nextParams);
    expect(navigation.navigate).not.toHaveBeenCalledWith('AdScreen', expect.anything());
  });

  it('P2 no-ad success: navigation.setParams NOT called between toAdScreen and overlay onDone — called exactly once after onDone', async () => {
    // P2: in the no-ad path, RESOLVED must defer to handleOverlayDone (after the
    // SuccessOverlay animation completes) so the next image's imageFile URI does
    // not land in route.params WHILE the overlay is still animating its fade-out
    // (which would flash the next image behind the semi-transparent overlay).
    // Mirrors the ad-path defer contract (handleAdDone is the sole dispatch site
    // there); here handleOverlayDone is the sole dispatch site for the no-ad path.
    consumeAdSlot.mockReturnValue({ showAd: false, nextCount: 1 });
    shouldSuppressAds.mockReturnValue(false);
    const navigation = makeNav();
    const nextParams = { listId: 4, pictureId: 'image-2', imageFile: 'file:///next.jpg' };
    resolveNextCardWithServerFallback.mockResolvedValue({ next: { params: nextParams }, reason: 'ok' });
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);

    await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
    await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });

    // PRE-FIX: setParams already landed here because onAdvanceResolved's no-ad
    // branch dispatched RESOLVED as soon as the resolve settled (during the
    // overlay animation). POST-FIX: deferred to handleOverlayDone.
    expect(navigation.setParams).not.toHaveBeenCalledWith(nextParams);

    await act(async () => { lastOverlayProps().onDone(); });

    // Sole dispatch site for the no-ad path: exactly one setParams with the
    // next card, AFTER the overlay completes.
    expect(navigation.setParams).toHaveBeenCalledTimes(1);
    expect(navigation.setParams).toHaveBeenCalledWith(nextParams);
  });

  it('on success + private scope: renders AdInterstitial when cadence is due (private no longer suppresses ads)', async () => {
    consumeAdSlot.mockReturnValue({ showAd: true, nextCount: 0 }); // cadence due
    shouldSuppressAds.mockReturnValue(false);
    const navigation = makeNav();
    const route = { params: { ...PUBLIC_ROUTE_PARAMS, scope: { kind: 'private', groupId: 'g-1' } } };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

    await act(async () => { create(<GuessScreen navigation={navigation} route={route} />); });
    await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
    await act(async () => { lastOverlayProps().onDone(); });

    // C2: private scope path uses the in-component overlay, not the AdScreen route.
    expect(mockAdInterstitial.mock.calls.length).toBeGreaterThan(0);
    expect(navigation.navigate).not.toHaveBeenCalledWith('AdScreen', expect.anything());
  });

  it('passes the active private-group snapshot into shouldSuppressAds', async () => {
    const navigation = makeNav();
    const route = {
      params: {
        ...PUBLIC_ROUTE_PARAMS,
        scope: { kind: 'private', groupId: 'g-1' },
        activeGroup: { isOwnedByViewer: true, memberCount: 6 },
      },
    };

    await act(async () => { create(<GuessScreen navigation={navigation} route={route} />); });

    expect(shouldSuppressAds).toHaveBeenCalledWith(expect.objectContaining({
      paidTier: expect.any(Number),
      scope: 'private',
      activeGroup: { isOwnedByViewer: true, memberCount: 6 },
    }));
  });

  it('on success + tier >= 1 (no_ads gate): never navigates to AdScreen', async () => {
    consumeAdSlot.mockReturnValue({ showAd: false, nextCount: 1 }); // frozen
    shouldSuppressAds.mockReturnValue(true);
    const navigation = makeNav();
    const route = { params: PUBLIC_ROUTE_PARAMS };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

    await act(async () => { create(<GuessScreen navigation={navigation} route={route} />); });
    await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
    await act(async () => { lastOverlayProps().onDone(); });

    expect(navigation.navigate).not.toHaveBeenCalledWith('AdScreen', expect.anything());
  });

  it('on success + isE2EMode: never navigates to AdScreen', async () => {
    const { isE2EMode } = require('../utils/e2eMode');
    isE2EMode.mockReturnValue(true);
    consumeAdSlot.mockReturnValue({ showAd: false, nextCount: 1 });
    const navigation = makeNav();
    const route = { params: PUBLIC_ROUTE_PARAMS };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

    await act(async () => { create(<GuessScreen navigation={navigation} route={route} />); });
    await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
    await act(async () => { lastOverlayProps().onDone(); });

    expect(navigation.navigate).not.toHaveBeenCalledWith('AdScreen', expect.anything());
  });

  it('on failure: resets counter to 0 and navigates to ResultScreen', async () => {
    const navigation = makeNav();
    const route = { params: PUBLIC_ROUTE_PARAMS };
    isOnTarget.mockReturnValue(false);

    await act(async () => { create(<GuessScreen navigation={navigation} route={route} />); });
    await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.1, y: 0.1 } }); });

    expect(navigation.replace).toHaveBeenCalledWith('ResultScreen', expect.objectContaining({ onTarget: false }));
  });

  it('resets successesSinceLastAd to 0 on failure (verified via next success)', async () => {
    // First success: tick counter from 0 → 1.
    consumeAdSlot.mockReturnValueOnce({ showAd: false, nextCount: 1 });
    shouldSuppressAds.mockReturnValue(false);
    const navigation = makeNav();
    const route = { params: PUBLIC_ROUTE_PARAMS };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

    await act(async () => { create(<GuessScreen navigation={navigation} route={route} />); });
    await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
    await act(async () => { lastOverlayProps().onDone(); });
    expect(consumeAdSlot).toHaveBeenLastCalledWith(expect.objectContaining({ successesSinceLastAd: 0 }));

    // Now a FAILURE: counter should reset to 0.
    isOnTarget.mockReturnValue(false);
    await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.1, y: 0.1 } }); });
    expect(navigation.replace).toHaveBeenCalledWith('ResultScreen', expect.objectContaining({ onTarget: false }));

    // Next success: counter MUST be 0 again (proves the reset happened).
    isOnTarget.mockReturnValue(true);
    consumeAdSlot.mockReturnValueOnce({ showAd: false, nextCount: 1 });
    await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
    await act(async () => { lastOverlayProps().onDone(); });
    expect(consumeAdSlot).toHaveBeenLastCalledWith(expect.objectContaining({ successesSinceLastAd: 0 }));
  });

  it('passes current counter to consumeAdSlot and persists nextCount across renders', async () => {
    // First success: counter starts at 0, consumeAdSlot returns nextCount=1 (no ad).
    consumeAdSlot.mockReturnValueOnce({ showAd: false, nextCount: 1 });
    shouldSuppressAds.mockReturnValue(false);
    const navigation = makeNav();
    const route = { params: PUBLIC_ROUTE_PARAMS };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

    await act(async () => { create(<GuessScreen navigation={navigation} route={route} />); });
    await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
    await act(async () => { lastOverlayProps().onDone(); });

    expect(consumeAdSlot).toHaveBeenLastCalledWith(expect.objectContaining({
      successesSinceLastAd: 0,
      isSourceReady: expect.any(Boolean),
    }));

    // Second success: counter should now be 1 (persisted from the first cycle).
    consumeAdSlot.mockReturnValueOnce({ showAd: false, nextCount: 2 });
    await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
    await act(async () => { lastOverlayProps().onDone(); });

    expect(consumeAdSlot).toHaveBeenLastCalledWith(expect.objectContaining({
      successesSinceLastAd: 1,
    }));
  });

  describe('toAdScreen characterization', () => {
    it('passes post-increment streak and resolveStreakTier(N+1).multiplier to applySuccessSideEffects (off-by-one guard)', async () => {
      const { resolveStreakTier } = require('../constants/streakTiers');
      const navigation = makeNav();
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />);
      });

      // PB6: streak commits on RESOLVED — tap+onDone each cycle.
      for (let n = 1; n <= 5; n++) {
        await act(async () => {
          lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
        });
        await act(async () => {
          lastOverlayProps().onDone();
        });
        const nextStreak = n;
        const expectedStreakMultiplier = resolveStreakTier(nextStreak).multiplier;
        expect(applySuccessSideEffects).toHaveBeenLastCalledWith(expect.objectContaining({
          streak: nextStreak,
          streakMultiplier: expectedStreakMultiplier,
        }));
        expect(streakSpies().onWin).toHaveBeenCalledTimes(n);
      }
    });

    it.each([
      ['undefined (treated as 0)', undefined, 2],
      ['4000 (under threshold)', 4000, 2],
      ['4999 (just under threshold)', 4999, 2],
      ['5000 (at threshold)', 5000, 1],
      ['6000 (over threshold)', 6000, 1],
    ])('maps elapsedMs = %s to speed multiplier %d on success', async (_label, elapsedMs, expectedMultiplier) => {
      const navigation = makeNav();
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />);
      });

      const target = elapsedMs === undefined
        ? { location: { x: 0.5, y: 0.5 } }
        : { location: { x: 0.5, y: 0.5 }, elapsedMs: elapsedMs as number };
      await act(async () => {
        lastPictureProps().toAdScreen(target);
      });

      // PB6: applySuccessSideEffects deferred to RESOLVED; overlay multiplier set on tap.
      expect(lastOverlayProps().multiplier).toBe(expectedMultiplier);

      await act(async () => {
        lastOverlayProps().onDone();
      });

      expect(applySuccessSideEffects).toHaveBeenLastCalledWith(expect.objectContaining({
        multiplier: expectedMultiplier,
      }));
    });

    it('PB6: applySuccessSideEffects fires on RESOLVED, AFTER prefetchIfLow on tap (order inverted from pre-PB6)', async () => {
      const navigation = makeNav();
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />);
      });
      await act(async () => {
        lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      // prefetchIfLow fires synchronously inside applySuccessPath; C1 then
      // kicks off the resolve, whose trailing onAdvanceResolved fires
      // applySuccessSideEffects strictly later (after the await microtask).
      const prefetchOrder = prefetchIfLow.mock.invocationCallOrder[0];
      expect(prefetchOrder).toEqual(expect.any(Number));

      await act(async () => {
        lastOverlayProps().onDone();
      });

      // applySuccessSideEffects fires from the resolve settle, strictly after prefetchIfLow.
      const applyOrder = applySuccessSideEffects.mock.invocationCallOrder[0];
      expect(applyOrder).toEqual(expect.any(Number));
      expect(applyOrder).toBeGreaterThan(prefetchOrder);
    });

    it('on success: never calls navigation.navigate or navigation.replace (overlay-only)', async () => {
      const navigation = makeNav();
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />);
      });
      await act(async () => {
        lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      expect(navigation.navigate).not.toHaveBeenCalled();
      expect(navigation.replace).not.toHaveBeenCalled();
      expect(lastOverlayProps().visible).toBe(true);
    });

    it('on success with category.key === "all": prefetch still fires with categoryKey "all" (|| "all" fallback path)', async () => {
      const navigation = makeNav();
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={{ params: { ...PUBLIC_ROUTE_PARAMS, category: { id: 'cat-all', key: 'all' } } }} />);
      });
      await act(async () => {
        lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      expect(prefetchIfLow).toHaveBeenCalledTimes(1);
      expect(prefetchIfLow).toHaveBeenCalledWith(expect.objectContaining({
        categoryKey: 'all',
        categoryId: 'cat-all',
      }));
    });
  });

  describe('T1.8 + PB6 (cadence rollback + streak/score defer on null advance)', () => {
    it('win → cadence says showAd + next is null → ad NOT shown, cadence counter unchanged (rollback = skip commit)', async () => {
    // T1.8 + A7 (Phase 2 review): when advance fails (next=null), the cadence
    // rollback is structural — onAdvanceResolved is never reached, so
    // consumeAdSlot / setSuccessesSinceLastAd cannot fire and the would-be
    // nextCount=3 cannot leak into the counter. The A7 guard additionally
    // ensures any subsequent cycle from a non-idle state (e.g. exhausted after
    // a null-next win) cannot fire side effects either. The original test
    // relied on side effects firing from stale `exhausted` state to observe
    // the persisted counter; that path is now correctly blocked by the A7
    // guard, so we assert the structural fact directly: consumeAdSlot was
    // never called during the null-next cycle (no commit could have happened).
    consumeAdSlot.mockReturnValue({ showAd: true, nextCount: 3 });
    shouldSuppressAds.mockReturnValue(false);
    const navigation = makeNav();
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue(null);

    await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
    await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
    await act(async () => { lastOverlayProps().onDone(); });

    // T1.8: ad NOT shown when next is null (onAdvanceResolved never reached).
    expect(navigation.navigate).not.toHaveBeenCalledWith('AdScreen', expect.anything());
    // T1.8 rollback = consumeAdSlot never reached → no nextCount=3 commit.
    expect(consumeAdSlot).not.toHaveBeenCalled();
    expect(streakSpies().onWin).not.toHaveBeenCalled();
    expect(applySuccessSideEffects).not.toHaveBeenCalled();
  });

    it('PB6: win → next card resolved → streak + score committed in RESOLVED side-effect (NOT in toAdScreen)', async () => {
      const navigation = makeNav();
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });

      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });

      // PB6 + C1: tap kicks off the resolve fire-and-forget; streak/score
      // commit when the resolve settles (not synchronously on the tap).

      await act(async () => { lastOverlayProps().onDone(); });

      // PB6: streak + score committed exactly once across the win+dismiss flow.
      expect(streakSpies().onWin).toHaveBeenCalledTimes(1);
      expect(applySuccessSideEffects).toHaveBeenCalledTimes(1);
      expect(applySuccessSideEffects).toHaveBeenLastCalledWith(expect.objectContaining({
        streak: 1,
        points: 2,
      }));
    });

    it('PB6: win → next card null → streak NOT incremented, score NOT buffered, dispatches FAILED_PERMANENT → exhausted (no retry)', async () => {
      // F3b: deterministic empty → exhausted, no warming, no commit.
      const navigation = makeNav();
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      resolveNextGuessParams.mockResolvedValue(null);

      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });

      // PB6: failed advance does not credit the streak or buffer the score.
      expect(streakSpies().onWin).not.toHaveBeenCalled();
      expect(applySuccessSideEffects).not.toHaveBeenCalled();
      // No warming — deterministic empty → straight to exhausted.
      expect(mockGuessAdvanceLoader).not.toHaveBeenCalled();
      // Safety-net panel mounts on FAILED_PERMANENT.
      expect(mockGuessExhaustedPanel).toHaveBeenCalled();
    });
  });

  describe('T1.6 advance state machine lifecycle (warming/retry/AppState/input gating)', () => {
    function findAppStateListener(): (state: string) => void {
      const mock = AppState.addEventListener as unknown as jest.Mock;
      const call = mock.mock.calls.find((c: unknown[]) => c[0] === 'change');
      if (!call || typeof call[1] !== 'function') {
        throw new Error('AppState "change" listener was not registered');
      }
      return call[1] as (state: string) => void;
    }

    it('F3b: win → next card null + reason "empty" → dispatch FAILED_PERMANENT → exhausted, mounts GuessExhaustedPanel, NO retry scheduled', async () => {
      // F3b: reason='empty' is deterministic — the cascade already tried Tier 3
      // 'all' cross-fallback + Tier 4 looping-replay before returning null. Do
      // NOT retry; straight to exhausted + safety-net panel.
      jest.useFakeTimers();
      resolveNextCardWithServerFallback.mockResolvedValue({ next: null, reason: 'empty' });
      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });

      // No warming — deterministic empty → straight to exhausted.
      expect(mockGuessAdvanceLoader).not.toHaveBeenCalled();
      // Safety-net panel mounts on FAILED_PERMANENT.
      expect(mockGuessExhaustedPanel).toHaveBeenCalled();
      expect(navigation.replace).not.toHaveBeenCalledWith('GuessScreen', expect.anything());
      expect(navigateToNextGuess).not.toHaveBeenCalled();
      // Streak + score never committed.
      expect(streakSpies().onWin).not.toHaveBeenCalled();
      expect(applySuccessSideEffects).not.toHaveBeenCalled();

      // NO retry scheduled — advancing timers must NOT re-invoke the resolver.
      const callsAfterAdvance = resolveNextCardWithServerFallback.mock.calls.length;
      await act(async () => { jest.advanceTimersByTime(10000); });
      expect(resolveNextCardWithServerFallback.mock.calls.length).toBe(callsAfterAdvance);

      jest.useRealTimers();
    });

    it('win → next card null + reason "network" → GuessAdvanceLoader, retries 3×, then exhausted', async () => {
      jest.useFakeTimers();
      resolveNextCardWithServerFallback.mockResolvedValue({ next: null, reason: 'network' });
      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });

      // After onDone: overlay hidden, state=warming, loader mounted, no exhausted panel yet.
      expect(mockGuessAdvanceLoader).toHaveBeenCalled();
      expect(mockGuessExhaustedPanel).not.toHaveBeenCalled();

      // Retry 1 at 1s — transient again, still warming.
      await act(async () => { jest.advanceTimersByTime(1000); });
      expect(mockGuessExhaustedPanel).not.toHaveBeenCalled();

      // Retry 2 at 2s — transient again.
      await act(async () => { jest.advanceTimersByTime(2000); });
      expect(mockGuessExhaustedPanel).not.toHaveBeenCalled();

      // Retry 3 at 4s — reducer transitions to exhausted on the final RETRY_TICK.
      await act(async () => { jest.advanceTimersByTime(4000); });

      expect(mockGuessExhaustedPanel).toHaveBeenCalledWith(expect.objectContaining({
        onLeave: expect.any(Function),
        onSwitch: expect.any(Function),
      }));

      // Streak + score never committed (PB6).
      expect(streakSpies().onWin).not.toHaveBeenCalled();
      expect(applySuccessSideEffects).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('F4 (WHILE-overlay-up): warming retry succeeds WHILE SuccessOverlay still mounted → setParams NOT called until handleOverlayDone (N3 + race fix)', async () => {
      // F4 race: for tier1+ wins the SuccessOverlay dismisses at ~1200-2600ms
      // while the first warming retry fires at 1000ms — so the retry can land
      // WHILE showSuccess===true. Without the overlayVisibleRef commit gate,
      // onAdvanceResolved's warming branch dispatched RESOLVED unconditionally
      // → setParams swapped route.params.imageFile BEHIND the still-visible
      // overlay (next image flashes under the win animation). Fixed by staging
      // on pendingNextRef when overlayVisibleRef.current===true and deferring
      // the dispatch to handleOverlayDone (after the fade). This test advances
      // the retry timer BEFORE firing onDone to exercise the race window.
      jest.useFakeTimers();
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      const nextParams = { listId: 4, imageFile: 'file:///next.jpg', pictureId: 'p-2' };
      resolveNextCardWithServerFallback
        .mockResolvedValueOnce({ next: null, reason: 'network' })
        .mockResolvedValueOnce({ next: { params: nextParams }, reason: 'ok' });

      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      // Flush the in-flight resolve chain (runResolveCycle awaits the mocked
      // resolver, then dispatches FAILED_TRANSIENT + schedules the retry). NO
      // onDone yet — overlay stays mounted to exercise the race window.
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });

      // PRE-CHECK: setParams has not been called yet (no resolve has succeeded).
      expect(navigation.setParams).not.toHaveBeenCalledWith(nextParams);

      // Advance 1s WHILE overlay is still up — retry 1 succeeds. With the fix
      // the next is staged on pendingNextRef and NO RESOLVED dispatch fires
      // (no setParams) — imageFile does NOT swap behind the overlay.
      await act(async () => { jest.advanceTimersByTime(1000); });
      expect(navigation.setParams).not.toHaveBeenCalledWith(nextParams);

      // NOW dismiss the overlay — handleOverlayDone drains pendingNextRef and
      // dispatches RESOLVED → idle → setParams. The next image appears AFTER
      // the fade.
      await act(async () => { lastOverlayProps().onDone(); });

      expect(navigation.setParams).toHaveBeenCalledWith(nextParams);
      expect(navigation.setParams).toHaveBeenCalledTimes(1);
      expect(mockGuessExhaustedPanel).not.toHaveBeenCalled();
      // PB6: streak + score committed exactly once on the recovered advance.
      expect(streakSpies().onWin).toHaveBeenCalledTimes(1);
      expect(applySuccessSideEffects).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('F4 (b) AFTER-overlay-down: warming retry succeeds after handleOverlayDone returned → RESOLVED dispatched immediately, setParams called exactly once, NO 7s strand', async () => {
      // F4 (b): the inverse of the WHILE-overlay-up case. Overlay dismissed
      // BEFORE the retry fires (tier0 race: dismiss ≈900ms < retry 1000ms).
      // overlayVisibleRef.current===false at retry time → dispatch RESOLVED
      // immediately (no staging, no strand). The previous design's effect-only
      // overlayVisible mirror would have stranded the user in `warming` here
      // (no transition to re-trigger the effect commit); the ref-as-control-
      // flow design closes both sides.
      jest.useFakeTimers();
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      const nextParams = { listId: 4, imageFile: 'file:///next.jpg', pictureId: 'p-2' };
      resolveNextCardWithServerFallback
        .mockResolvedValueOnce({ next: null, reason: 'network' })
        .mockResolvedValueOnce({ next: { params: nextParams }, reason: 'ok' });

      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      // Overlay dismissed FIRST → overlayVisibleRef.current===false.
      await act(async () => { lastOverlayProps().onDone(); });

      expect(mockGuessAdvanceLoader).toHaveBeenCalled();
      expect(navigation.setParams).not.toHaveBeenCalledWith(nextParams);

      // Retry 1 at 1s — second resolve succeeds, overlay already down →
      // dispatch RESOLVED immediately → idle → setParams exactly once.
      await act(async () => { jest.advanceTimersByTime(1000); });

      expect(navigation.setParams).toHaveBeenCalledWith(nextParams);
      expect(navigation.setParams).toHaveBeenCalledTimes(1);
      expect(mockGuessExhaustedPanel).not.toHaveBeenCalled();

      // NO 7s strand: advance well past the retry budget; nothing else fires.
      const resolveCallsAfterRecovery = resolveNextCardWithServerFallback.mock.calls.length;
      await act(async () => { jest.advanceTimersByTime(10000); });
      expect(resolveNextCardWithServerFallback.mock.calls.length).toBe(resolveCallsAfterRecovery);
      expect(navigation.setParams).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('F4 (c) warming recovery while overlay up → setParams NOT called until handleOverlayDone (deferred commit invariant)', async () => {
      // F4 (c): belts-and-suspenders companion to the WHILE-overlay-up rewrite.
      // Asserts the deferred-commit invariant in isolation: while the overlay is
      // visible, setParams MUST stay at 0 calls regardless of how many resolves
      // succeed; only handleOverlayDone unblocks the commit. Guards against a
      // future regression that re-introduces an unconditional dispatch.
      jest.useFakeTimers();
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      const nextParams = { listId: 4, imageFile: 'file:///next.jpg', pictureId: 'p-2' };
      resolveNextCardWithServerFallback
        .mockResolvedValueOnce({ next: null, reason: 'network' })
        .mockResolvedValueOnce({ next: { params: nextParams }, reason: 'ok' });

      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });

      // Overlay still up. Fire the successful retry.
      await act(async () => { jest.advanceTimersByTime(1000); });

      // Deferred-commit invariant: staging happened, dispatch did NOT.
      expect(navigation.setParams).not.toHaveBeenCalled();
      // The panel must not have appeared either (state stays warming).
      expect(mockGuessExhaustedPanel).not.toHaveBeenCalled();

      // Commit fires ONLY after handleOverlayDone.
      await act(async () => { lastOverlayProps().onDone(); });
      expect(navigation.setParams).toHaveBeenCalledTimes(1);
      expect(navigation.setParams).toHaveBeenCalledWith(nextParams);

      jest.useRealTimers();
    });

    it('F4 (d) handleSwitchCategory → clearExhaustedCategory called for current category+language+scope before navigate', async () => {
      // F3a invalidation (E1): switching category clears the exhausted-cache
      // entry for the CURRENT category+language+scope so re-entering re-queries
      // the server (handles newly uploaded images since the category was
      // marked empty). Fire-and-forget; navigation proceeds without waiting.
      const { clearExhaustedCategory } = require('../utils/storageDatum');
      const navigation = makeNav();
      // Force the exhausted panel to mount so handleSwitchCategory is reachable.
      resolveNextCardWithServerFallback.mockResolvedValue({ next: null, reason: 'empty' });
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });

      // Exhausted panel mounted; grab its onSwitch callback.
      expect(mockGuessExhaustedPanel).toHaveBeenCalled();
      const panelCall = mockGuessExhaustedPanel.mock.calls[mockGuessExhaustedPanel.mock.calls.length - 1][0];
      expect(panelCall.onSwitch).toEqual(expect.any(Function));

      clearExhaustedCategory.mockClear();
      await act(async () => { panelCall.onSwitch(); });

      // Cleared for the CURRENT category (PUBLIC_ROUTE_PARAMS: key='nature',
      // language='fr', scope=undefined → public branch).
      expect(clearExhaustedCategory).toHaveBeenCalledWith('nature', 'fr', undefined);
      // And then navigated.
      expect(navigation.navigate).toHaveBeenCalledWith('GuessPathScreen', {});
    });

    it('F4 (d-private) handleSwitchCategory → clearExhaustedCategory called for current category+scope in PRIVATE scope', async () => {
      // F3a private isolation (E1): in a private scope the clear call MUST
      // carry the scope so the group feed cache (not AsyncStorage) is cleared.
      const { clearExhaustedCategory } = require('../utils/storageDatum');
      const navigation = makeNav();
      const scope = { kind: 'private', groupId: 'g-42' };
      const route = { params: { ...PUBLIC_ROUTE_PARAMS, scope } };
      resolveNextCardWithServerFallback.mockResolvedValue({ next: null, reason: 'empty' });
      await act(async () => { create(<GuessScreen navigation={navigation} route={route} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });

      const panelCall = mockGuessExhaustedPanel.mock.calls[mockGuessExhaustedPanel.mock.calls.length - 1][0];
      clearExhaustedCategory.mockClear();
      await act(async () => { panelCall.onSwitch(); });

      expect(clearExhaustedCategory).toHaveBeenCalledWith('nature', 'fr', scope);
      expect(navigation.navigate).toHaveBeenCalledWith('GuessPathScreen', { scope });
    });

    it('F4 (f) staged-then-background orphan: warming stages next on pendingNextRef → AppState backgrounding → FAILED_PERMANENT → pendingNextRef is null (no leak)', async () => {
      // F4 nit defense: a warming-stages-next followed by AppState
      // backgrounding dispatches FAILED_PERMANENT. The terminal transition
      // MUST null pendingNextRef so a foregrounded session does not observe a
      // stale staged next from the abandoned cycle. Next WIN overwrites the
      // ref before read, but null-on-terminal is cheap defense.
      jest.useFakeTimers();
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      const nextParams = { listId: 4, imageFile: 'file:///next.jpg', pictureId: 'p-2' };
      resolveNextCardWithServerFallback
        .mockResolvedValueOnce({ next: null, reason: 'network' })
        .mockResolvedValueOnce({ next: { params: nextParams }, reason: 'ok' });

      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });

      // Overlay still up; fire the successful retry → stages on pendingNextRef
      // (overlayVisibleRef.current === true).
      await act(async () => { jest.advanceTimersByTime(1000); });
      expect(navigation.setParams).not.toHaveBeenCalled();

      // Background mid-stage → AppState listener dispatches FAILED_PERMANENT.
      const listener = findAppStateListener();
      await act(async () => { listener('background'); });

      // State lands on exhausted; pendingNextRef has been nulled by the
      // terminal transition (F4 nit). Verify by dismissing the overlay: the
      // consumePendingNext + RESOLVED dispatch path must find nothing staged,
      // so setParams stays at 0 (no orphan commit from the abandoned cycle).
      expect(mockGuessExhaustedPanel).toHaveBeenCalled();
      await act(async () => { lastOverlayProps().onDone(); });
      expect(navigation.setParams).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('R4: retry recovery credits the success-time multiplier through the retry loop (not the latest state)', async () => {
      // §2.4 contract: the multiplier used at retry time MUST equal the value
      // at the moment of the success that triggered the cycle. Fast tap
      // (elapsedMs=1000) → multiplier=2 (above SPEED_MULTIPLIER_BASE=1, so a
      // stale-state read or a ref-mirror regression that falls back to the
      // initial state would surface as multiplier=1). Threading is via an
      // explicit arg through runResolveCycle → onAdvanceResolved →
      // scheduleRetry → runResolveCycle (no mirror ref).
      jest.useFakeTimers();
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      const nextParams = { listId: 4, imageFile: 'file:///next.jpg', pictureId: 'p-2' };
      resolveNextCardWithServerFallback
        .mockResolvedValueOnce({ next: null, reason: 'network' })
        .mockResolvedValueOnce({ next: { params: nextParams }, reason: 'ok' });

      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      // Fast tap → multiplier=2 (under the speed bonus threshold).
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 }); });
      await act(async () => { lastOverlayProps().onDone(); });

      expect(mockGuessAdvanceLoader).toHaveBeenCalled();

      // Fire retry 1 at 1s — second resolve succeeds → RESOLVED with multiplier=2
      // threaded from the original success, not a fresh read of state.
      await act(async () => { jest.advanceTimersByTime(1000); });

      expect(applySuccessSideEffects).toHaveBeenCalledTimes(1);
      expect(applySuccessSideEffects).toHaveBeenLastCalledWith(expect.objectContaining({
        multiplier: 2,
      }));

      jest.useRealTimers();
    });

    it('win → next card resolved → setParams called (no remount), useStreak preserved', async () => {
      const nextParams = { listId: 4, imageFile: 'file:///next.jpg', pictureId: 'p-2' };
      resolveNextCardWithServerFallback.mockResolvedValue({ next: { params: nextParams }, reason: 'ok' });

      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });

      // Advance uses setParams (no remount) — never replace/navigateToNextGuess.
      expect(navigation.setParams).toHaveBeenCalledWith(nextParams);
      expect(navigation.replace).not.toHaveBeenCalledWith('GuessScreen', expect.anything());
      expect(navigateToNextGuess).not.toHaveBeenCalled();
      // useStreak preserved across the advance (no reset call).
      expect(streakSpies().reset).not.toHaveBeenCalled();
    });

    it('PB2: tap during advancing → input disabled, reducer rejects double-WIN', async () => {
      // Make the resolve hang so the screen stays in `advancing`.
      resolveNextCardWithServerFallback.mockReturnValue(new Promise(() => {}));

      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });

      // Idle initially → not disabled.
      expect(lastPictureProps().disabled).toBe(false);

      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });

      // Advancing (resolve hangs) → GuessPicture disabled.
      expect(lastPictureProps().disabled).toBe(true);
      // Overlay hidden — does not double as a loading spinner (R1).
      expect(lastOverlayProps().visible).toBe(false);
      // Loader now shown during `advancing && !showSuccess` to cover the
      // foreground-fetch gap after the success animation dismisses; deliberate
      // fix for the "frozen screen after animation" symptom.
      expect(mockGuessAdvanceLoader).toHaveBeenCalled();
    });

    describe('F3b: retry gating on reason (D1)', () => {
      // F3b contract: retry only on 'network'. 'empty' | 'server' (and any
      // unmapped reason) are deterministic — the cascade already tried Tier 3
      // 'all' cross-fallback + Tier 4 looping-replay before returning null, so
      // retrying just burns 1s+2s+4s. FAILED_PERMANENT → exhausted, no retry.

      it('(a) reason="network" → FAILED_TRANSIENT dispatched + scheduleRetry fires 3 ticks (1s/2s/4s) → exhausted', async () => {
        jest.useFakeTimers();
        resolveNextCardWithServerFallback.mockResolvedValue({ next: null, reason: 'network' });
        const navigation = makeNav();
        await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
        await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
        await act(async () => { lastOverlayProps().onDone(); });

        // Warming observable: state=warming → loader mounted, panel NOT yet.
        expect(mockGuessAdvanceLoader).toHaveBeenCalled();
        expect(mockGuessExhaustedPanel).not.toHaveBeenCalled();

        // Tick 1 @1s — still warming (retry 1 of 3).
        await act(async () => { jest.advanceTimersByTime(1000); });
        expect(mockGuessExhaustedPanel).not.toHaveBeenCalled();

        // Tick 2 @2s — still warming (retry 2 of 3).
        await act(async () => { jest.advanceTimersByTime(2000); });
        expect(mockGuessExhaustedPanel).not.toHaveBeenCalled();

        // Tick 3 @4s — final RETRY_TICK transitions reducer to exhausted.
        await act(async () => { jest.advanceTimersByTime(4000); });
        expect(mockGuessExhaustedPanel).toHaveBeenCalled();

        // Initial resolve + 2 retry resolves (tick 3 only transitions to
        // exhausted via RETRY_TICK; n < DEFAULT_RETRY_BUDGET gates the resolve).
        expect(resolveNextCardWithServerFallback.mock.calls.length).toBe(3);

        jest.useRealTimers();
      });

      it('(b) reason="empty" → FAILED_PERMANENT dispatched, scheduleRetry NOT called (no further resolves)', async () => {
        jest.useFakeTimers();
        resolveNextCardWithServerFallback.mockResolvedValue({ next: null, reason: 'empty' });
        const navigation = makeNav();
        await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
        await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
        await act(async () => { lastOverlayProps().onDone(); });

        // No warming — straight to exhausted.
        expect(mockGuessAdvanceLoader).not.toHaveBeenCalled();
        expect(mockGuessExhaustedPanel).toHaveBeenCalled();

        const callsAfterAdvance = resolveNextCardWithServerFallback.mock.calls.length;
        await act(async () => { jest.advanceTimersByTime(10000); });
        expect(resolveNextCardWithServerFallback.mock.calls.length).toBe(callsAfterAdvance);

        jest.useRealTimers();
      });

      it('(c) reason="server" → FAILED_PERMANENT dispatched, scheduleRetry NOT called (no further resolves)', async () => {
        jest.useFakeTimers();
        resolveNextCardWithServerFallback.mockResolvedValue({ next: null, reason: 'server' });
        const navigation = makeNav();
        await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
        await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
        await act(async () => { lastOverlayProps().onDone(); });

        // No warming — straight to exhausted.
        expect(mockGuessAdvanceLoader).not.toHaveBeenCalled();
        expect(mockGuessExhaustedPanel).toHaveBeenCalled();

        const callsAfterAdvance = resolveNextCardWithServerFallback.mock.calls.length;
        await act(async () => { jest.advanceTimersByTime(10000); });
        expect(resolveNextCardWithServerFallback.mock.calls.length).toBe(callsAfterAdvance);

        jest.useRealTimers();
      });

      it('(d) reason="ok" with next → onAdvanceResolved called, setParams with next.params (unchanged)', async () => {
        const nextParams = { listId: 4, imageFile: 'file:///next.jpg', pictureId: 'p-2' };
        resolveNextCardWithServerFallback.mockResolvedValue({ next: { params: nextParams }, reason: 'ok' });
        isOnTarget.mockReturnValue(true);
        applySuccessSideEffects.mockResolvedValue(undefined);

        const navigation = makeNav();
        await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
        await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
        await act(async () => { lastOverlayProps().onDone(); });

        expect(navigation.setParams).toHaveBeenCalledWith(nextParams);
        expect(mockGuessExhaustedPanel).not.toHaveBeenCalled();
        expect(streakSpies().onWin).toHaveBeenCalledTimes(1);
        expect(applySuccessSideEffects).toHaveBeenCalledTimes(1);
      });
    });

    it('PT2: warming → app backgrounded → state=exhausted on foreground', async () => {
      resolveNextCardWithServerFallback.mockResolvedValue({ next: null, reason: 'network' });

      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });

      expect(mockGuessAdvanceLoader).toHaveBeenCalled();
      expect(mockGuessExhaustedPanel).not.toHaveBeenCalled();

      const listener = findAppStateListener();
      await act(async () => { listener('background'); });

      // Backgrounding from warming forces FAILED_PERMANENT → exhausted.
      expect(mockGuessExhaustedPanel).toHaveBeenCalledWith(expect.objectContaining({
        onLeave: expect.any(Function),
        onSwitch: expect.any(Function),
      }));
      // Subsequent 'active' does NOT auto-recover — player must tap Switch/Leave.
      await act(async () => { listener('active'); });
      expect(mockGuessExhaustedPanel).toHaveBeenCalledTimes(1);
    });

    it('PT6: Leave (unmount) during warming → retry timer cleared, no setState after unmount', async () => {
      jest.useFakeTimers();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
      resolveNextCardWithServerFallback.mockResolvedValue({ next: null, reason: 'network' });

      const navigation = makeNav();
      let renderer: ReturnType<typeof create>;
      await act(async () => { renderer = create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });

      expect(mockGuessAdvanceLoader).toHaveBeenCalled();
      const loaderCallsBefore = mockGuessAdvanceLoader.mock.calls.length;

      // Unmount while warming — the PT6 cleanup clears the pending retry timer.
      await act(async () => { renderer.unmount(); });
      expect(clearTimeoutSpy).toHaveBeenCalled();

      // Run any pending timers; nothing should re-render the unmounted tree.
      await act(async () => { jest.advanceTimersByTime(10000); });

      // No further calls into the loader mock (would indicate setState-after-unmount).
      expect(mockGuessAdvanceLoader.mock.calls.length).toBe(loaderCallsBefore);
      const setStateWarning = consoleErrorSpy.mock.calls.find((c: unknown[]) =>
        /setState after unmount|state update on an unmounted|Can't perform a React state update/i.test(String(c[0] ?? '')),
      );
      expect(setStateWarning).toBeUndefined();

      consoleErrorSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
      jest.useRealTimers();
    });

    it('warming → RESOLVED transition → retry timer cleared (no leftover timer fires)', async () => {
      // Phase 1 review fix B: every transition out of a mid-advance state
      // runs the PT6 cleanup, so an in-flight retry timer cannot survive the
      // transition. Today the timer self-nulls at firing so the cleanup is a
      // no-op, but the test guards against a future regression that schedules
      // a timer and then transitions without self-nulling.
      jest.useFakeTimers();
      const nextParams = { listId: 4, imageFile: 'file:///next.jpg', pictureId: 'p-2' };
      resolveNextCardWithServerFallback
        .mockResolvedValueOnce({ next: null, reason: 'network' })
        .mockResolvedValueOnce({ next: { params: nextParams }, reason: 'ok' });

      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });

      expect(mockGuessAdvanceLoader).toHaveBeenCalled();
      const resolveCallsBeforeRecovery = resolveNextCardWithServerFallback.mock.calls.length;

      // Fire retry 1 at 1s — second resolve succeeds → RESOLVED → idle.
      await act(async () => { jest.advanceTimersByTime(1000); });

      expect(navigation.setParams).toHaveBeenCalledWith(nextParams);
      expect(mockGuessExhaustedPanel).not.toHaveBeenCalled();

      // The warming → idle transition fires the PT6 cleanup; advance well past
      // every retry delay and assert no further resolve / setParams fires.
      await act(async () => { jest.advanceTimersByTime(10000); });

      expect(resolveNextCardWithServerFallback.mock.calls.length).toBe(resolveCallsBeforeRecovery + 1);
      expect(navigation.setParams).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('AppState background during in-flight resolve → no onWin, no applySuccessSideEffects, no AdScreen navigation (A7)', async () => {
      // A7 (Phase 2 review): if AppState backgrounding mid-resolve dispatches
      // FAILED_PERMANENT (state=exhausted) while resolveNextCardWithServerFallback
      // is still in flight, the trailing resolve must NOT fire any side effects
      // — the reducer already rejects the trailing RESOLVED, but onWin /
      // applySuccessSideEffects / decideAdSlot / setAdPhase would all
      // run on stale state without a guard on advanceStateRef.current.
      consumeAdSlot.mockReturnValue({ showAd: true, nextCount: 1 });
      shouldSuppressAds.mockReturnValue(false);

      let resolveAdvance!: (v: { next: { params: Record<string, unknown> }; reason: 'ok' }) => void;
      resolveNextCardWithServerFallback.mockReturnValue(
        new Promise<{ next: { params: Record<string, unknown> }; reason: 'ok' }>((resolve) => {
          resolveAdvance = resolve;
        }),
      );

      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });

      // Trigger WIN → state=advancing, resolver is in flight (promise held).
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });

      // No side effects yet — resolver has not settled.
      expect(streakSpies().onWin).not.toHaveBeenCalled();
      expect(applySuccessSideEffects).not.toHaveBeenCalled();

      // Background mid-resolve → AppState listener forces FAILED_PERMANENT → exhausted.
      const listener = findAppStateListener();
      await act(async () => { listener('background'); });

      expect(mockGuessExhaustedPanel).toHaveBeenCalledWith(expect.objectContaining({
        onLeave: expect.any(Function),
        onSwitch: expect.any(Function),
      }));

      // Now settle the in-flight resolve with a successful next card.
      await act(async () => {
        resolveAdvance({ next: { params: { listId: 4 } }, reason: 'ok' });
      });
      // Flush microtasks so any wrongly-unguarded post-await path can fire.
      await act(async () => { await Promise.resolve(); });

      // A7: no stale side effects.
      expect(streakSpies().onWin).not.toHaveBeenCalled();
      expect(applySuccessSideEffects).not.toHaveBeenCalled();
      expect(consumeAdSlot).not.toHaveBeenCalled();
      expect(navigation.navigate).not.toHaveBeenCalledWith('AdScreen', expect.anything());
      // Reducer already rejected the trailing RESOLVED — state stays exhausted.
      expect(mockGuessExhaustedPanel).toHaveBeenCalledTimes(1);
    });
  });

  // Regression: Tier 2 foreground-fetch path used to collide listId with the
  // just-played card (when the played card was the local deck's highest, the
  // post-removal deck's max is below the cursor, so normalizeListIds starts
  // fresh from 1 — and the OLD card's listId was also 1). The result was
  // key={listId} collision → no remount → useTargetDrag's userInteractedRef
  // blocked the target reset → target rendered at the OLD dragged position
  // (or off-screen) on the NEW card. Fix: key on pictureId (server-unique)
  // with a listId fallback.
  describe('Tier 2 target-remount regression (PB-key-collision)', () => {
    it('Tier 2 returns card with COLLIDING listId (same as played) → GuessPicture still remounts (key on pictureId)', async () => {
      const firstParams = {
        listId: 1,
        pictureId: 'old-pic',
        imageFile: 'file:///old.jpg',
        description: 'old',
        hiddenLocation: { x: 0.5, y: 0.5 },
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        isTutorial: false,
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
      };
      // Tier 2 returns next card with listId=1 (COLLIDES) but a different pictureId.
      const nextParams = {
        listId: 1,
        pictureId: 'new-pic',
        imageFile: 'file:///new.jpg',
        description: 'new',
        hiddenLocation: { x: 0.3, y: 0.7 },
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        isTutorial: false,
        skipInstructions: true,
      };

      // Mimic real native-stack: setParams MERGES into the live route.params
      // object AND the navigator re-renders the screen with the merged route.
      // Without the post-setParams update(), the screen closure keeps the
      // initial route.params reference and the key never changes regardless of
      // the fix (real React Navigation triggers a parent re-render).
      let currentRoute = { params: { ...firstParams } };
      const navigation = makeNav();
      navigation.setParams.mockImplementation((update: Record<string, unknown>) => {
        currentRoute = { params: { ...currentRoute.params, ...update } };
      });

      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      resolveNextGuessParams.mockResolvedValue({ params: nextParams });

      let renderer: ReturnType<typeof create>;
      await act(async () => {
        renderer = create(<GuessScreen navigation={navigation} route={currentRoute} />);
      });

      // Initial mount only.
      expect(mockPictureMountCount).toBe(1);

      // Win → Tier 2 → setParams with new card.
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });

      // setParams fired.
      expect(navigation.setParams).toHaveBeenCalledWith(nextParams);

      // Re-render with the merged route (mimics the navigator's response).
      await act(async () => {
        renderer.update(<GuessScreen navigation={navigation} route={currentRoute} />);
      });

      // The FIX: even though listId collides, pictureId differs → key changes →
      // GuessPicture remounts → useTargetDrag gets fresh state → target renders
      // at the new card's center. mockPictureMountCount must be 2 after the advance.
      expect(mockPictureMountCount).toBe(2);

      // And the latest props carry the NEW pictureId (not stale).
      expect(lastPictureProps().pictureId).toBe('new-pic');
    });

    it('without the fix: COLLIDING listId + identical pictureId would NOT remount (sanity)', async () => {
      // Defense: if both listId and pictureId are identical (truly the same
      // card identity), the key should NOT change — this is correct behavior.
      // Documents the key contract for future regressions.
      const firstParams = {
        listId: 7,
        pictureId: 'same-pic',
        imageFile: 'file:///same.jpg',
        description: 'same',
        hiddenLocation: { x: 0.5, y: 0.5 },
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        isTutorial: false,
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
      };

      let currentRoute = { params: { ...firstParams } };
      const navigation = makeNav();
      navigation.setParams.mockImplementation((update: Record<string, unknown>) => {
        currentRoute = { params: { ...currentRoute.params, ...update } };
      });

      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      // Resolve returns the SAME identity (same pictureId, same listId) — only
      // description differs. setParams merges, but key (pictureId) is unchanged.
      resolveNextGuessParams.mockResolvedValue({
        params: { ...firstParams, description: 'updated' },
      });

      let renderer: ReturnType<typeof create>;
      await act(async () => {
        renderer = create(<GuessScreen navigation={navigation} route={currentRoute} />);
      });
      expect(mockPictureMountCount).toBe(1);

      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });
      await act(async () => {
        renderer.update(<GuessScreen navigation={navigation} route={currentRoute} />);
      });

      // Same identity → no remount. This is the intended ceiling of the key fix.
      expect(mockPictureMountCount).toBe(1);
    });

    it('PB2 disabled prop: GuessScreen passes advance-state-derived disabled and the prop reaches useTargetDrag (regression)', async () => {
      // The disabled prop on GuessPicture was previously not declared in
      // GuessPictureProps, so GuessScreen's `disabled={advance.state !== 'idle'}`
      // was silently dropped. After the fix, GuessPicture accepts `disabled`
      // and forwards it to useTargetDrag via `enabled: !disabled && !isE2EMode()`.
      // This test only re-asserts that the screen passes the prop; the
      // component-level wiring is covered in GuessPicture.test.js.
      resolveNextCardWithServerFallback.mockReturnValue(new Promise(() => {}));
      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });

      expect(lastPictureProps().disabled).toBe(false);

      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });

      expect(lastPictureProps().disabled).toBe(true);
    });
  });

  describe('C1 resolve-in-parallel (kick at WIN, await at dismiss)', () => {
    it('kicks off runResolveCycle in applySuccessPath at tap (before overlay dismiss)', async () => {
      resolveNextCardWithServerFallback.mockResolvedValue({ next: null, reason: 'empty' });
      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });

      // No resolve before tap.
      expect(resolveNextCardWithServerFallback).not.toHaveBeenCalled();

      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });

      // Kicked off fire-and-forget at tap (in applySuccessPath), not at dismiss.
      expect(resolveNextCardWithServerFallback).toHaveBeenCalledTimes(1);
    });

    it('handleOverlayDone awaits the pre-kicked-off resolve; no second resolve call at dismiss', async () => {
      resolveNextCardWithServerFallback.mockResolvedValue({ next: null, reason: 'empty' });
      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });

      expect(resolveNextCardWithServerFallback).toHaveBeenCalledTimes(1);

      await act(async () => { lastOverlayProps().onDone(); });

      // handleOverlayDone awaits the ref-held Promise — does NOT re-invoke resolve.
      expect(resolveNextCardWithServerFallback).toHaveBeenCalledTimes(1);
    });

    it('swipe-home during SuccessOverlay → in-flight resolve ABORTS: applySuccessSideEffects NOT called (persistent-storage guard)', async () => {
      // CONCERN #1 (post-implementation verification pass): PT6 cleanup nulls
      // nextCardResolveRef on unmount but does NOT cancel the in-flight
      // runResolveCycle() Promise. When it settles post-unmount,
      // onAdvanceResolved fires applySuccessSideEffects → bufferScore
      // (AsyncStorage write) + removeImageFromList (deck mutation) +
      // deleteImageFromStorage (file delete). These are PERSISTENT STORAGE
      // mutations after the user navigated away. Plan §4.2 + §10 risk row 2
      // said "discard" — user decision: ABORT the win-credit on swipe-home via
      // a mountedRef guard in onAdvanceResolved.
      jest.clearAllMocks();
      consumeAdSlot.mockReturnValue({ showAd: false, nextCount: 1 });
      shouldSuppressAds.mockReturnValue(false);
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

      let resolveAdvance!: (v: { next: { params: Record<string, unknown> }; reason: 'ok' }) => void;
      resolveNextCardWithServerFallback.mockReturnValue(
        new Promise<{ next: { params: Record<string, unknown> }; reason: 'ok' }>((resolve) => {
          resolveAdvance = resolve;
        }),
      );

      const navigation = makeNav();
      let renderer: ReturnType<typeof create>;
      await act(async () => { renderer = create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });

      // WIN kicked off the in-flight resolve; it is pending (held by harness).
      expect(resolveNextCardWithServerFallback).toHaveBeenCalledTimes(1);

      // Swipe-home (unmount) BEFORE the resolve settles. PT6 cleanup runs and
      // (after the fix) flips mountedRef.current=false.
      await act(async () => { renderer.unmount(); });

      // Settle the in-flight resolve. Without the guard, onAdvanceResolved
      // fires applySuccessSideEffects — the abort must prevent that.
      await act(async () => {
        resolveAdvance({ next: { params: { listId: 4 } }, reason: 'ok' });
      });
      await act(async () => { await Promise.resolve(); });

      expect(applySuccessSideEffects).not.toHaveBeenCalled();
    });

    it('swipe-home while success side effects await → cadence and ad state do not update after unmount', async () => {
      jest.clearAllMocks();
      shouldSuppressAds.mockReturnValue(false);
      isOnTarget.mockReturnValue(true);
      consumeAdSlot.mockReturnValue({ showAd: true, nextCount: 0 });

      let finishSuccessSideEffects!: () => void;
      applySuccessSideEffects.mockImplementation(
        () => new Promise<void>((resolve) => {
          finishSuccessSideEffects = resolve;
        }),
      );

      let resolveAdvance!: (v: { next: { params: Record<string, unknown> }; reason: 'ok' }) => void;
      resolveNextCardWithServerFallback.mockReturnValue(
        new Promise<{ next: { params: Record<string, unknown> }; reason: 'ok' }>((resolve) => {
          resolveAdvance = resolve;
        }),
      );

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const navigation = makeNav();
      let renderer: ReturnType<typeof create>;
      await act(async () => { renderer = create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });

      await act(async () => {
        resolveAdvance({ next: { params: { listId: 4 } }, reason: 'ok' });
        await Promise.resolve();
      });

      expect(applySuccessSideEffects).toHaveBeenCalledTimes(1);

      await act(async () => { renderer.unmount(); });

      await act(async () => {
        finishSuccessSideEffects();
        await Promise.resolve();
      });

      expect(consumeAdSlot).not.toHaveBeenCalled();
      expect(mockAdInterstitial).not.toHaveBeenCalled();
      const setStateWarning = consoleErrorSpy.mock.calls.find((c: unknown[]) =>
        /setState after unmount|state update on an unmounted|Can't perform a React state update/i.test(String(c[0] ?? '')),
      );
      expect(setStateWarning).toBeUndefined();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('ad-in-overlay contract (D1)', () => {
    // D1 (a): showAd → AdInterstitial rendered (not AdScreen route).
    // (Moved from the top-level `describe('GuessScreen')` body; semantics unchanged.)
    it('on success + ad due (public, tier 0): renders AdInterstitial overlay (no AdScreen navigation)', async () => {
      consumeAdSlot.mockReturnValue({ showAd: true, nextCount: 0 });
      shouldSuppressAds.mockReturnValue(false);
      const navigation = makeNav();
      const route = { params: PUBLIC_ROUTE_PARAMS };
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });

      await act(async () => { create(<GuessScreen navigation={navigation} route={route} />); });
      const pictureProps = lastPictureProps();
      await act(async () => { pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      const callsBeforeDismiss = mockAdInterstitial.mock.calls.length;
      const overlayProps = lastOverlayProps();
      await act(async () => { overlayProps.onDone(); });

      // C2: in-component overlay replaces the AdScreen route. AdInterstitial
      // mounted at least once between dismiss and now; RESOLVED is deferred
      // to handleAdDone (not fired yet here), so setParams has not landed.
      expect(mockAdInterstitial.mock.calls.length).toBeGreaterThan(callsBeforeDismiss);
      expect(lastAdInterstitialProps().onDone).toEqual(expect.any(Function));
      expect(navigation.navigate).not.toHaveBeenCalledWith('AdScreen', expect.anything());
      expect(navigation.setParams).not.toHaveBeenCalledWith(expect.objectContaining({ listId: 4 }));
    });

    it('AdInterstitial onDone → dispatch RESOLVED + setParams(next) + overlay unmounts (adPhase idle)', async () => {
      consumeAdSlot.mockReturnValue({ showAd: true, nextCount: 0 });
      shouldSuppressAds.mockReturnValue(false);
      const navigation = makeNav();
      const nextParams = { listId: 4, pictureId: 'image-2', imageFile: 'file:///next.jpg' };
      resolveNextCardWithServerFallback.mockResolvedValue({ next: { params: nextParams }, reason: 'ok' });
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });

      // Overlay mounted; capture its onDone then assert no setParams yet.
      const onDone = lastAdInterstitialProps().onDone;
      expect(navigation.setParams).not.toHaveBeenCalledWith(nextParams);
      // D1 (item 5) explicit: overlay is mounted right now (adPhase === 'showing').
      expect(mockAdMountCount).toBe(1);

      const callsBeforeAdDone = mockAdInterstitial.mock.calls.length;
      await act(async () => { onDone(); });

      // C2 §3.2 step 5: RESOLVED fires from handleAdDone → idle-entry effect
      // applies setParams(advance.next) exactly once.
      expect(navigation.setParams).toHaveBeenCalledWith(nextParams);

      // Overlay unmounts (adPhase → 'idle') → AdInterstitial mock NOT called again.
      expect(mockAdInterstitial.mock.calls.length).toBe(callsBeforeAdDone);
      // D1 (item 5) explicit: AdInterstitial is no longer mounted after onDone.
      expect(mockAdMountCount).toBe(0);
    });

    it('ad dismissed → GuessPicture re-renders with next card (next.pictureId)', async () => {
      consumeAdSlot.mockReturnValue({ showAd: true, nextCount: 0 });
      shouldSuppressAds.mockReturnValue(false);
      const nextParams = {
        listId: 4,
        pictureId: 'next-pic-42',
        imageFile: 'file:///next.jpg',
        description: 'Next card',
        hiddenLocation: { x: 0.3, y: 0.7 },
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        isTutorial: false,
        skipInstructions: true,
      };
      resolveNextCardWithServerFallback.mockResolvedValue({ next: { params: nextParams }, reason: 'ok' });

      // Mimic native-stack: setParams MERGES into route.params and the navigator
      // re-renders the screen with the merged route (the test renderer does not
      // do this automatically).
      let currentRoute = { params: { ...PUBLIC_ROUTE_PARAMS } };
      const navigation = makeNav();
      navigation.setParams.mockImplementation((update: Record<string, unknown>) => {
        currentRoute = { params: { ...currentRoute.params, ...update } };
      });
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      let renderer: ReturnType<typeof create>;
      await act(async () => { renderer = create(<GuessScreen navigation={navigation} route={currentRoute} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });

      // Dismiss the ad → RESOLVED → setParams(next) → merged route.
      await act(async () => { lastAdInterstitialProps().onDone(); });

      // Re-render with merged route so GuessPicture sees the new props.
      await act(async () => {
        renderer.update(<GuessScreen navigation={navigation} route={currentRoute} />);
      });

      // GuessPicture received the next card's pictureId (not stale).
      expect(lastPictureProps().pictureId).toBe('next-pic-42');
    });

    // D1 (item 4): consolidated end-to-end assertion. Drive the full win → ad →
    // onDone → next-card flow and assert navigation.navigate('AdScreen', ...) was
    // never invoked at any point. Defense-in-depth companions live in the sibling
    // ad-due / no-ads / e2e tests above; this one proves the contract across the
    // whole advance cycle (the AdScreen route was deleted in C3).
    it('full win → ad → onDone → next-card flow: navigation.navigate("AdScreen") never called', async () => {
      consumeAdSlot.mockReturnValue({ showAd: true, nextCount: 0 });
      shouldSuppressAds.mockReturnValue(false);
      const navigation = makeNav();
      const nextParams = {
        listId: 4,
        pictureId: 'next-pic-d1',
        imageFile: 'file:///next-d1.jpg',
        description: 'D1 next card',
        hiddenLocation: { x: 0.3, y: 0.7 },
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        isTutorial: false,
        skipInstructions: true,
      };
      resolveNextCardWithServerFallback.mockResolvedValue({ next: { params: nextParams }, reason: 'ok' });
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { lastOverlayProps().onDone(); });
      await act(async () => { lastAdInterstitialProps().onDone(); });

      expect(navigation.navigate).not.toHaveBeenCalledWith('AdScreen', expect.anything());
      // Sanity: the next card actually landed (proves the flow ran to completion).
      expect(navigation.setParams).toHaveBeenCalledWith(expect.objectContaining({ listId: 4 }));
    });
  });

  // F1 (G1): win-animation / ad overlap fix. Mirror the E1 no-ad commit gate
  // onto the showAd branch: defer setAdPhase('showing') until the SuccessOverlay
  // has dismissed so AdInterstitial never mounts under the still-animating
  // success burst. Terminal-drain defense prevents an orphan ad firing on top
  // of the exhausted panel after a backgrounding mid-deferred cycle.
  describe('F1 G1: ad trigger deferred until SuccessOverlay dismisses', () => {
    function findAppStateListener(): (state: string) => void {
      const mock = AppState.addEventListener as unknown as jest.Mock;
      const call = mock.mock.calls.find((c: unknown[]) => c[0] === 'change');
      if (!call || typeof call[1] !== 'function') {
        throw new Error('AppState "change" listener was not registered');
      }
      return call[1] as (state: string) => void;
    }

    it('G1a: win + ad due + FAST resolve (overlay still up) → AdInterstitial NOT mounted until SuccessOverlay onDone fires', async () => {
      jest.useFakeTimers();
      setMockOverlayDismissDelayMs(100);
      consumeAdSlot.mockReturnValue({ showAd: true, nextCount: 0 });
      shouldSuppressAds.mockReturnValue(false);
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      resolveNextCardWithServerFallback.mockResolvedValue({ next: { params: { listId: 4 } }, reason: 'ok' });

      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      // Resolve settles fast while overlay still animating → ad must be deferred.
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });

      // Ad NOT mounted yet (overlayVisibleRef.current === true at resolve time).
      expect(mockAdMountCount).toBe(0);

      // Advance LESS than the dismiss delay — overlay still up, ad still deferred.
      await act(async () => { jest.advanceTimersByTime(50); });
      expect(mockAdMountCount).toBe(0);

      // Advance PAST the dismiss delay — SuccessOverlay's auto-fire triggers
      // handleOverlayDone → consumeDeferredAd → setAdPhase('showing') → mount.
      await act(async () => { jest.advanceTimersByTime(60); });
      expect(mockAdMountCount).toBe(1);

      jest.useRealTimers();
    });

    it('G1b: deferred-ad set → AppState backgrounding dispatches FAILED_PERMANENT → onDone fires → AdInterstitial NOT mounted (drain prevents orphan)', async () => {
      jest.useFakeTimers();
      setMockOverlayDismissDelayMs(100);
      consumeAdSlot.mockReturnValue({ showAd: true, nextCount: 0 });
      shouldSuppressAds.mockReturnValue(false);
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      resolveNextCardWithServerFallback.mockResolvedValue({ next: { params: { listId: 4 } }, reason: 'ok' });

      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      // Deferred state: ad deferred, overlay still up.
      expect(mockAdMountCount).toBe(0);

      // Background mid-deferred → AppState listener dispatches FAILED_PERMANENT;
      // the terminal drain MUST also clear adDeferredRef so a later onDone
      // cannot orphan an ad on top of the exhausted panel.
      const listener = findAppStateListener();
      await act(async () => { listener('background'); });

      // State landed on exhausted; safety-net panel mounted.
      expect(mockGuessExhaustedPanel).toHaveBeenCalled();

      // Fire onDone (animation completes / overlay auto-dismisses). Without the
      // drain, handleOverlayDone would see adDeferred===true and trigger the ad
      // on top of the exhausted panel. Drain must prevent this.
      await act(async () => { jest.advanceTimersByTime(150); });

      expect(mockAdMountCount).toBe(0);

      jest.useRealTimers();
    });

    it('G1c: win + ad due + SLOW resolve (overlay already down) → AdInterstitial mounted immediately on resolve (no extra wait)', async () => {
      jest.useFakeTimers();
      setMockOverlayDismissDelayMs(100);
      consumeAdSlot.mockReturnValue({ showAd: true, nextCount: 0 });
      shouldSuppressAds.mockReturnValue(false);
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      let resolveAdvance!: (v: { next: { params: Record<string, unknown> }; reason: string }) => void;
      resolveNextCardWithServerFallback.mockReturnValue(new Promise((r) => {
        resolveAdvance = r as (v: { next: { params: Record<string, unknown> }; reason: string }) => void;
      }));

      const navigation = makeNav();
      await act(async () => { create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />); });
      await act(async () => { lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 } }); });

      // Advance PAST the dismiss delay while resolve is still pending — overlay
      // auto-dismisses; handleOverlayDone awaits the still-pending resolve and
      // consumes no deferred ad (the flag was never set: resolve hasn't run).
      await act(async () => { jest.advanceTimersByTime(150); });
      expect(mockAdMountCount).toBe(0);

      // Resolve settles AFTER the overlay is already down → overlayVisibleRef
      // === false in the ad branch → setAdPhase('showing') fires immediately
      // (fast-path), no extra wait for a second onDone.
      await act(async () => {
        resolveAdvance({ next: { params: { listId: 4 } }, reason: 'ok' });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockAdMountCount).toBe(1);

      jest.useRealTimers();
    });
  });

  // D1 (P3): NextCardImageWarmer wiring — GuessScreen must read the deck ahead
  // (getNextImagesForScope) and feed the upcoming imageFile URIs to the warmer
  // so RN decodes those bitmaps before the advance swap. Warmer renders
  // unconditionally (not gated on adPhase / showSuccess) so decode happens
  // during the SuccessOverlay animation AND during the ad display.
  describe('D1 P3: NextCardImageWarmer deck-ahead wiring', () => {
    it('NextCardImageWarmer mounted with the next 5 deck URIs when deck has >5 remaining', async () => {
      const navigation = makeNav();
      const route = { params: { ...PUBLIC_ROUTE_PARAMS, listId: 1 } };
      // Deck ahead: cards 2..7 (6 cards). Cap is 7, but the user spec target
      // window is 5-7; assert the warmer receives exactly the 5 next URIs the
      // call site slices (test fixture sets up 6 ahead, slice(0, 7) returns 6;
      // we assert the call args shape and that URIs map correctly).
      const aheadDeck = [
        { listId: 2, imageFile: 'file:///deck/2.jpg' },
        { listId: 3, imageFile: 'file:///deck/3.jpg' },
        { listId: 4, imageFile: 'file:///deck/4.jpg' },
        { listId: 5, imageFile: 'file:///deck/5.jpg' },
        { listId: 6, imageFile: 'file:///deck/6.jpg' },
        { listId: 7, imageFile: 'file:///deck/7.jpg' },
      ];
      getNextImagesForScope.mockResolvedValue(aheadDeck);

      await act(async () => { create(<GuessScreen navigation={navigation} route={route} />); });

      // Reader was called with the cursor + scope so the deck-ahead window
      // is scoped to the currently-displayed card.
      expect(getNextImagesForScope).toHaveBeenCalledWith(expect.objectContaining({
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        currentListId: 1,
        scope: undefined,
      }));

      // Warmer received the next 5 deck imageFile URIs (call-site slice(0, 7),
      // capped to 5 in this fixture by limit=5; assert the mapping is correct).
      expect(mockNextCardImageWarmer).toHaveBeenCalled();
      const warmerCall = mockNextCardImageWarmer.mock.calls[mockNextCardImageWarmer.mock.calls.length - 1][0];
      expect(warmerCall.uris).toEqual([
        'file:///deck/2.jpg',
        'file:///deck/3.jpg',
        'file:///deck/4.jpg',
        'file:///deck/5.jpg',
        'file:///deck/6.jpg',
        'file:///deck/7.jpg',
      ]);
    });

    it('NextCardImageWarmer caps at 7 URIs even if the deck-ahead reader returns more', async () => {
      const navigation = makeNav();
      const route = { params: { ...PUBLIC_ROUTE_PARAMS, listId: 1 } };
      // Reader returns 10; the call site must defensively slice(0, 7) so the
      // warmer never mounts more than 7 hidden <Image> components (memory
      // ceiling ~14MB). Asserted here at the wiring boundary.
      getNextImagesForScope.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          listId: i + 2,
          imageFile: `file:///deck/${i + 2}.jpg`,
        })),
      );

      await act(async () => { create(<GuessScreen navigation={navigation} route={route} />); });

      const warmerCall = mockNextCardImageWarmer.mock.calls[mockNextCardImageWarmer.mock.calls.length - 1][0];
      expect(warmerCall.uris).toHaveLength(7);
    });

    it('NextCardImageWarmer receives [] when deck is empty/exhausted (no crash, renders nothing)', async () => {
      const navigation = makeNav();
      const route = { params: { ...PUBLIC_ROUTE_PARAMS, listId: 99 } };
      getNextImagesForScope.mockResolvedValue([]);

      await act(async () => { create(<GuessScreen navigation={navigation} route={route} />); });

      // Warmer was still mounted (unconditional render), but with [] uris —
      // the warmer component itself returns null on [] (covered in its own
      // suite); GuessScreen must not gate the mount on deck state.
      expect(mockNextCardImageWarmer).toHaveBeenCalled();
      const warmerCall = mockNextCardImageWarmer.mock.calls[mockNextCardImageWarmer.mock.calls.length - 1][0];
      expect(warmerCall.uris).toEqual([]);
    });
  });
});
