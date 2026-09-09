// Behavior tests for hooks/useAdSource.
//
// The real composite runs end-to-end (real FallbackAdSource wrapping the real
// AdMobInterstitialSource and InternalProAdSource). The only seams mocked are
// the boundaries the component cannot own in tests: the App-level AdMob bridge
// snapshot (the native ads boundary) and Platform.OS.
//
// What is verified: given ad availability, the hook's ad source USES the right
// ad source — it shows the AdMob interstitial through the bridge when a loaded
// ad exists (Android), and falls back to the internal pro panel otherwise.
// This keeps the original regression guarded (a factory that builds AdMob
// without the bridge snapshot makes isReady() false and no interstitial ever
// shows) while asserting observable effects instead of factory wiring.

import { Platform } from 'react-native';
import type { ReactElement } from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';

import { useAdSource, _setAdSourceFactoryForTests } from '../hooks/useAdSource';
import {
  INTERNAL_AD_CONTINUE_TESTID,
  INTERNAL_AD_PANEL_TESTID,
  INTERNAL_AD_TIMEOUT_MS,
} from '../services/ads/InternalProAdSource';
import type { AdSource, HookSnapshot } from '../services/ads/AdSource';

// Native-ads boundary: what the App-mounted <AdMobInterstitialBridge /> would
// report about the loaded interstitial.
const mockBridge: { snapshot: HookSnapshot | null } = { snapshot: null };

jest.mock('../services/ads/AdMobInterstitialBridge', () => ({
  __esModule: true,
  adMobBridgeSnapshot: { get: () => mockBridge.snapshot },
}));

function setBridgeSnapshot(snapshot: HookSnapshot | null) {
  mockBridge.snapshot = snapshot;
}

const originalOSDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function setPlatformOS(os: 'android' | 'ios') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });
}

afterEach(() => {
  jest.useRealTimers();
  if (originalOSDescriptor) {
    Object.defineProperty(Platform, 'OS', originalOSDescriptor);
  }
  setBridgeSnapshot(null);
});

describe('useAdSource', () => {
  it('shows the AdMob interstitial through the app bridge when a loaded ad is available (android)', async () => {
    setPlatformOS('android');
    const nativeShow = jest.fn().mockResolvedValue(undefined);
    setBridgeSnapshot({ isLoaded: true, show: nativeShow });

    const { result } = renderHook(() => useAdSource());

    expect(result.current.isReady()).toBe(true);

    await result.current.show();

    expect(nativeShow).toHaveBeenCalledTimes(1);
  });

  it('never picks the AdMob interstitial on iOS, even with a loaded bridge snapshot', async () => {
    jest.useFakeTimers();
    setPlatformOS('ios');
    const nativeShow = jest.fn().mockResolvedValue(undefined);
    setBridgeSnapshot({ isLoaded: true, show: nativeShow });

    const { result } = renderHook(() => useAdSource());

    expect(result.current.isReady()).toBe(true);
    const surface = render(result.current.renderSurface() as ReactElement);
    expect(surface.getByTestId(INTERNAL_AD_PANEL_TESTID)).toBeTruthy();

    const shown = result.current.show();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(INTERNAL_AD_TIMEOUT_MS);
    });
    await shown;

    expect(nativeShow).not.toHaveBeenCalled();
  });

  it('falls back to the internal pro panel when no AdMob interstitial is loaded', async () => {
    jest.useFakeTimers();
    setPlatformOS('android');
    const nativeShow = jest.fn().mockResolvedValue(undefined);
    setBridgeSnapshot({ isLoaded: false, show: nativeShow });

    const { result } = renderHook(() => useAdSource());

    expect(result.current.isReady()).toBe(true);
    const surface = render(result.current.renderSurface() as ReactElement);
    expect(surface.getByTestId(INTERNAL_AD_PANEL_TESTID)).toBeTruthy();
    expect(surface.getByTestId(INTERNAL_AD_CONTINUE_TESTID)).toBeTruthy();

    const shown = result.current.show();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(INTERNAL_AD_TIMEOUT_MS);
    });
    await shown;

    expect(nativeShow).not.toHaveBeenCalled();
  });

  it('completes the internal fallback ad when the user taps Continue', async () => {
    setPlatformOS('android');
    setBridgeSnapshot({ isLoaded: false, show: jest.fn() });

    const { result } = renderHook(() => useAdSource());
    const surface = render(result.current.renderSurface() as ReactElement);

    let resolved = false;
    const shown = result.current.show().then(() => {
      resolved = true;
    });

    fireEvent.press(surface.getByTestId(INTERNAL_AD_CONTINUE_TESTID));
    await shown;

    expect(resolved).toBe(true);
  });

  it('honors the test-only factory override and restores the built-in default afterwards', async () => {
    const customSource: AdSource = {
      isReady: () => true,
      show: jest.fn().mockResolvedValue(undefined),
      renderSurface: () => null,
    };

    _setAdSourceFactoryForTests(() => customSource);

    const { result: overridden } = renderHook(() => useAdSource());
    expect(overridden.current).toBe(customSource);

    _setAdSourceFactoryForTests(undefined);

    const { result: restored } = renderHook(() => useAdSource());
    expect(restored.current).not.toBe(customSource);
    expect(restored.current.isReady()).toBe(true);
    const surface = render(restored.current.renderSurface() as ReactElement);
    expect(surface.getByTestId(INTERNAL_AD_PANEL_TESTID)).toBeTruthy();
  });
});
