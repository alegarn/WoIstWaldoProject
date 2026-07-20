const mockLoadingOverlay = jest.fn((props: unknown) => null);

jest.mock('../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props: { message?: string }) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../services/ads/FallbackAdSource', () => ({
  createFallbackAdSource: jest.fn(),
}));
jest.mock('../services/ads/AdMobInterstitialSource', () => ({
  createAdMobInterstitialSource: jest.fn(),
}));
jest.mock('../services/ads/InternalProAdSource', () => ({
  createInternalProAdSource: jest.fn(),
  INTERNAL_AD_PANEL_TESTID: 'ad.internal.pro.panel',
  INTERNAL_AD_CONTINUE_TESTID: 'ad.internal.pro.continue',
}));

jest.mock('../services/ads/AdMobInterstitialBridge', () => ({
  AdMobInterstitialBridge: () => null,
  adMobBridgeSnapshot: { get: () => null },
}));

jest.mock('../utils/e2eMode', () => ({
  getE2EAdDelayMs: jest.fn(() => 5000),
  isE2EMode: jest.fn(() => false),
}));

import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import type { ReactNode } from 'react';
import { Button, View } from 'react-native';

import AdScreen, { _setAdSourceFactoryForTests } from '../screens/GuessScreens/AdScreen';
import { getE2EAdDelayMs } from '../utils/e2eMode';
import type { AdSource } from '../services/ads/AdSource';

describe('AdScreen', () => {
  const BASE_ROUTE_PARAMS = {
    onTarget: true,
    imageFile: 'file:///waldo.jpg',
    pictureId: 'test-card-1',
    description: 'Find Waldo',
    imageHeight: 1200, imageWidth: 800, isPortrait: true,
    hiddenLocation: { x: 0.5, y: 0.5 },
    screenHeight: 2000, screenWidth: 1000,
    listId: 3, isTutorial: false,
    category: { id: 'cat-1', key: 'nature' }, language: 'fr',
    scope: { kind: 'public' as const },
  };

  function installFakeSource({
    isReady = true,
    show = jest.fn().mockResolvedValue(undefined),
    renderSurface = (): ReactNode => null,
  }: {
    isReady?: boolean;
    show?: jest.Mock;
    renderSurface?: () => ReactNode;
  } = {}): AdSource {
    const fake: AdSource = {
      isReady: jest.fn(() => isReady),
      show,
      renderSurface,
    };
    _setAdSourceFactoryForTests(() => fake);
    return fake;
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    _setAdSourceFactoryForTests(undefined); // restore built-in default
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('routes to ResultScreen when onAdDone is undefined (failure path)', async () => {
    installFakeSource({ isReady: false });
    const navigation = { replace: jest.fn(), navigate: jest.fn(), setParams: jest.fn() };
    const route = { params: { ...BASE_ROUTE_PARAMS } };

    await act(async () => { create(<AdScreen navigation={navigation} route={route} />); });
    await act(async () => { jest.runOnlyPendingTimers(); });

    expect(navigation.replace).toHaveBeenCalledWith('ResultScreen', expect.objectContaining({ onTarget: true }));
  });

  it('navigates to GuessScreen with advanceAfterAd + advanceParams when onAdDone=advance (success path)', async () => {
    const fake = installFakeSource({ isReady: true });
    const navigation = { replace: jest.fn(), navigate: jest.fn(), setParams: jest.fn() };
    const stashed = { listId: 4, pictureId: 'test-card-2' };
    const route = { params: { ...BASE_ROUTE_PARAMS, onAdDone: 'advance', advanceParams: stashed } };

    await act(async () => { create(<AdScreen navigation={navigation} route={route} />); });
    // show() resolves on next microtask; the .then routeOut fires.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(fake.show).toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith('GuessScreen', expect.objectContaining({
      advanceAfterAd: true,
      advanceParams: stashed,
    }));
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('skips the ad surface when source is not ready (graceful skip)', async () => {
    // reason: e2eMode module is jest.mock'd above, so the import binding is a jest.Mock at runtime;
    // the TS-declared type is the real `() => number`, hence the cast.
    (getE2EAdDelayMs as jest.MockedFunction<typeof getE2EAdDelayMs>).mockReturnValue(0);
    installFakeSource({ isReady: false });
    const navigation = { replace: jest.fn(), navigate: jest.fn(), setParams: jest.fn() };
    const route = { params: { ...BASE_ROUTE_PARAMS, onAdDone: 'advance' } };

    await act(async () => { create(<AdScreen navigation={navigation} route={route} />); });
    await act(async () => { jest.runOnlyPendingTimers(); });

    // Graceful skip on success path also routes back to GuessScreen.
    expect(navigation.navigate).toHaveBeenCalledWith('GuessScreen', expect.objectContaining({
      advanceAfterAd: true,
    }));
  });

  it('renders the source surface and Continue resolves show() when renderSurface returns JSX', async () => {
    let continueFn: (() => void) | null = null;
    const CONTINUE_TESTID = 'ad.internal.pro.continue';
    // Fake source that mimics InternalProAdSource's renderSurface shape.
    const fakeSurfaceSource: AdSource = {
      isReady: () => true,
      show: jest.fn().mockImplementation(() => new Promise<void>((resolve) => { continueFn = resolve; })),
      renderSurface: () => (
        <View testID="ad.internal.pro.panel">
          <Button testID={CONTINUE_TESTID} title="Continue" onPress={() => { if (continueFn) { const r = continueFn; continueFn = null; r(); } }} />
        </View>
      ),
    };
    _setAdSourceFactoryForTests(() => fakeSurfaceSource);
    const navigation = { replace: jest.fn(), navigate: jest.fn(), setParams: jest.fn() };
    const stashed = { listId: 4 };
    const route = { params: { ...BASE_ROUTE_PARAMS, onAdDone: 'advance', advanceParams: stashed } };

    // reason: `act` async overload returns Promise<void>, so renderer can't flow out via return;
    // definite-assignment assertion mirrors the original `let renderer` pattern.
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<AdScreen navigation={navigation} route={route} />);
    });

    // AdScreen rendered the surface returned by renderSurface().
    const continueBtn = renderer.root.findByProps({ testID: CONTINUE_TESTID });
    expect(continueBtn).toBeTruthy();

    // Tap Continue → show() resolves → routeOut fires → navigate to GuessScreen.
    await act(async () => {
      continueBtn.props.onPress();
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(navigation.navigate).toHaveBeenCalledWith('GuessScreen', expect.objectContaining({
      advanceAfterAd: true,
      advanceParams: stashed,
    }));
  });

  it('composite FallbackAdSource delegates renderSurface to the picked source (LSP regression guard)', async () => {
    // Build a real composite the way production does: primary (AdMob-like, no surface) +
    // secondary (internal-like, with surface). When primary is NOT ready, the composite's
    // renderSurface must return the secondary's JSX — not null.
    // NOTE: jest.mock at top of file stubs the module for AdScreen wiring; reach for the
    // real impl via jest.requireActual so this guard exercises the real composite.
    const { createFallbackAdSource } = jest.requireActual('../services/ads/FallbackAdSource') as {
      createFallbackAdSource: (primary: AdSource, secondary: AdSource) => AdSource;
    };
    const secondarySurface = <View testID="composite.secondary.surface" />;
    const primary: AdSource = { isReady: () => false, show: jest.fn(), renderSurface: () => null };
    const secondary: AdSource = {
      isReady: () => true,
      show: jest.fn().mockResolvedValue(undefined),
      renderSurface: () => secondarySurface,
    };
    const composite = createFallbackAdSource(primary, secondary);
    const surface = composite.renderSurface();
    expect(surface).toBe(secondarySurface);
  });
});
