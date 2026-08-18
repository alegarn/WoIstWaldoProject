// Regression test for the "no ads at all" symptom reported after the gesture
// refactor. Unlike GuessScreen.test.tsx (which mocks consumeAdSlot/adPolicy/
// ad sources), this suite uses the REAL consumeAdSlot (utils/adCadence) and
// REAL ad sources (InternalProAdSource + FallbackAdSource) so a regression in
// the cadence/source wiring surfaces as a failing assertion here, not a green
// test against a stub.
//
// Scope: a free-tier user (paidTier 0, not e2e, not adFree) who wins 3
// consecutive times MUST see adPhase === 'showing' with <AdInterstitial>
// mounted AND adSource.renderSurface() returning the internal pro panel.
//
// Platform: forced to 'android' inside an isolateModules boundary so the
// documented HEAD free-tier behavior (Android-only cadence) is exercised.
// useAdCadence's IS_ANDROID is captured at module load, so GuessScreen must
// be required AFTER the Platform.OS swap.

type MockPictureProps = {
  toAdScreen: (target: { location: { x: number; y: number }; elapsedMs?: number }) => void | Promise<void>;
  [key: string]: unknown;
};
type MockOverlayProps = {
  visible: boolean;
  onDone: () => void | Promise<void>;
  [key: string]: unknown;
};
type MockAdInterstitialProps = {
  adSource: { renderSurface(): unknown };
  onDone: () => void;
  [key: string]: unknown;
};

const mockGuessPicture = jest.fn((_props: MockPictureProps) => null);
const mockSuccessOverlay = jest.fn((_props: MockOverlayProps) => null);
let mockAdMountCount = 0;
let lastAdInterstitialPropsValue: MockAdInterstitialProps | null = null;
const mockAdInterstitial = jest.fn((props: MockAdInterstitialProps) => null);

jest.mock('../components/Picture/GuessPicture', () => {
  return function MockGuessPicture(props: MockPictureProps) {
    mockGuessPicture(props);
    return null;
  };
});

jest.mock('../components/Guess/SuccessOverlay', () => {
  return function MockSuccessOverlay(props: MockOverlayProps) {
    mockSuccessOverlay(props);
    return null;
  };
});

jest.mock('../components/Ads/AdInterstitial', () => {
  const React = jest.requireActual('react');
  return function MockAdInterstitial(props: MockAdInterstitialProps) {
    React.useEffect(() => {
      mockAdMountCount += 1;
      lastAdInterstitialPropsValue = props;
      mockAdInterstitial(props);
      return () => { mockAdMountCount -= 1; };
    }, []);
    return null;
  };
});

jest.mock('../components/Guess/GuessExitSwipeMenu', () => () => null);
jest.mock('../components/Guess/GuessExhaustedPanel', () => () => null);
jest.mock('../components/Guess/GuessAdvanceLoader', () => () => null);
jest.mock('../components/Picture/NextCardImageWarmer', () => () => null);
jest.mock('../components/UI/TutorialOverlay', () => () => null);

// GuessScreen renders a localized <GestureHandlerRootView>; stub the root so
// the screen renders under jest (RNGH's real root calls a native install()).
jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual('react');
  return {
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
      React.createElement('GestureHandlerRootView', null, children),
  };
});

jest.mock('../utils/targetLocation', () => ({ isOnTarget: jest.fn() }));

jest.mock('../utils/handleGuessOutcome', () => ({
  applySuccessSideEffects: jest.fn().mockResolvedValue(undefined),
  resolveNextGuessParams: jest.fn(),
}));

jest.mock('../services/cardDeck', () => ({
  fetchCardBatch: jest.fn().mockResolvedValue({ images: [] }),
  appendCardBatch: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/nextCardAdvancer', () => ({
  resolveNextCardWithServerFallback: jest.fn(),
}));

jest.mock('../utils/guessNavigation', () => ({
  navigateToNextGuess: jest.fn(),
}));

jest.mock('../services/cardPrefetcher', () => ({
  prefetchIfLow: jest.fn().mockResolvedValue(undefined),
  warmAllDeckIfNeeded: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/storageDatum', () => ({
  getNextImagesForScope: jest.fn().mockResolvedValue([]),
  clearExhaustedCategory: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/e2eMode', () => ({
  isE2EMode: jest.fn(() => false),
}));

import { act, create as reactCreate } from 'react-test-renderer';
import { AppState, Platform } from 'react-native';

import { isOnTarget as isOnTargetImpl } from '../utils/targetLocation';
import { applySuccessSideEffects as applySuccessSideEffectsImpl } from '../utils/handleGuessOutcome';
import { resolveNextGuessParams as resolveNextGuessParamsImpl } from '../utils/handleGuessOutcome';
import { resolveNextCardWithServerFallback as resolveNextCardWithServerFallbackImpl } from '../utils/nextCardAdvancer';

const isOnTarget = isOnTargetImpl as jest.MockedFunction<typeof isOnTargetImpl>;
const applySuccessSideEffects = applySuccessSideEffectsImpl as jest.MockedFunction<typeof applySuccessSideEffectsImpl>;
const resolveNextGuessParams = resolveNextGuessParamsImpl as jest.MockedFunction<typeof resolveNextGuessParamsImpl>;
const resolveNextCardWithServerFallback = resolveNextCardWithServerFallbackImpl as jest.MockedFunction<typeof resolveNextCardWithServerFallbackImpl>;

type LooseGuessScreenProps = { navigation: unknown; route: { params: Record<string, unknown> } };
type GuessScreenComp = React.FC<LooseGuessScreenProps>;

const mountedRenderers: Array<ReturnType<typeof reactCreate>> = [];
function create(...args: Parameters<typeof reactCreate>): ReturnType<typeof reactCreate> {
  const renderer = reactCreate(...args);
  mountedRenderers.push(renderer);
  return renderer;
}

// GuessScreen is require()'d lazily inside beforeAll AFTER Platform.OS has been
// swapped to 'android', so the module-load-time IS_ANDROID capture in
// useAdCadence (HEAD) sees android. The require runs exactly once and shares
// the test file's React instance (no isolateModules duplication).
let GuessScreen: GuessScreenComp;
const ORIGINAL_PLATFORM_OS = Platform.OS;

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
  return {
    replace: jest.fn(),
    setParams: jest.fn(),
    popToTop: jest.fn(),
    popTo: jest.fn(),
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => () => {}),
  };
}

function lastPictureProps(): MockPictureProps {
  return mockGuessPicture.mock.calls[mockGuessPicture.mock.calls.length - 1][0];
}

function lastOverlayProps(): MockOverlayProps {
  return mockSuccessOverlay.mock.calls[mockSuccessOverlay.mock.calls.length - 1][0];
}

describe('GuessScreen free-tier ad regression (real cadence + real sources)', () => {
  beforeAll(() => {
    // Force Platform.OS = 'android' BEFORE GuessScreen is required so the
    // module-load-time IS_ANDROID capture in useAdCadence (HEAD) sees android
    // — the documented HEAD free-tier platform. The require runs once, against
    // the same React instance as the test file (no isolateModules duplication).
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    GuessScreen = require('../screens/GuessScreens/GuessScreen').default as GuessScreenComp;
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: ORIGINAL_PLATFORM_OS, configurable: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdMountCount = 0;
    lastAdInterstitialPropsValue = null;
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue({ params: { listId: 4 } });
    resolveNextCardWithServerFallback.mockResolvedValue({ next: { params: { listId: 4 } }, reason: 'ok' });
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

  it('free-tier (paidTier 0) user: 3 consecutive wins → AdInterstitial mounts AND adSource.renderSurface() is non-null', async () => {
    const navigation = makeNav();
    await act(async () => {
      create(<GuessScreen navigation={navigation} route={{ params: PUBLIC_ROUTE_PARAMS }} />);
    });

    // Drive 3 consecutive wins through the picture's toAdScreen → success path.
    // Each win: tap (toAdScreen) kicks off WIN+resolve; SuccessOverlay's onDone
    // (handleOverlayDone) drains the deferred ad / dispatches RESOLVED.
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
      });
      await act(async () => {
        lastOverlayProps().onDone();
      });
    }

    // The 3rd win's consumeAdSlot fires showAd=true → setAdPhase('showing') →
    // AdInterstitial mounts. Assert the mount + a non-null surface (the internal
    // pro panel JSX), exercising the real FallbackAdSource → InternalProAdSource
    // renderSurface chain.
    expect(mockAdMountCount).toBe(1);
    expect(lastAdInterstitialPropsValue).not.toBeNull();
    const surface = lastAdInterstitialPropsValue!.adSource.renderSurface();
    expect(surface).not.toBeNull();
  });
});
