// Behavior tests for hooks/useAdSource.
//
// Verifies the composite AdSource wiring: the default factory must build AdMob
// WITH the App-level bridge snapshot (regression: previously constructed
// without it, so AdMobInterstitialSource.isReady() always returned false), wrap
// it with InternalProAdSource in a FallbackAdSource, and expose the test-only
// factory override seam.

import { renderHook } from '@testing-library/react-native';

import { useAdSource, _setAdSourceFactoryForTests } from '../hooks/useAdSource';
import { adMobBridgeSnapshot } from '../services/ads/AdMobInterstitialBridge';
import type { AdSource } from '../services/ads/AdSource';

const mockAdMobSource: AdSource = {
  isReady: () => true,
  show: jest.fn().mockResolvedValue(undefined),
  renderSurface: () => null,
};
const mockInternalSource: AdSource = {
  isReady: () => true,
  show: jest.fn().mockResolvedValue(undefined),
  renderSurface: () => null,
};
const mockFallbackSource: AdSource = {
  isReady: () => true,
  show: jest.fn().mockResolvedValue(undefined),
  renderSurface: () => null,
};

const mockCreateAdMob = jest.fn(() => mockAdMobSource);
const mockCreateInternal = jest.fn(() => mockInternalSource);
const mockCreateFallback = jest.fn(() => mockFallbackSource);

jest.mock('../services/ads/AdMobInterstitialSource', () => ({
  __esModule: true,
  createAdMobInterstitialSource: (...args: unknown[]) => mockCreateAdMob(...(args as [unknown])),
}));

jest.mock('../services/ads/InternalProAdSource', () => ({
  __esModule: true,
  createInternalProAdSource: (...args: unknown[]) => mockCreateInternal(...(args as [])),
}));

jest.mock('../services/ads/FallbackAdSource', () => ({
  __esModule: true,
  createFallbackAdSource: (...args: unknown[]) =>
    mockCreateFallback(...(args as [AdSource, AdSource])),
}));

jest.mock('../services/ads/AdMobInterstitialBridge', () => ({
  __esModule: true,
  adMobBridgeSnapshot: { get: () => null },
}));

describe('useAdSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore the built-in default between tests so each renderHook exercises
    // the real default factory (the test-only seam is sticky at module scope).
    _setAdSourceFactoryForTests(undefined);
  });

  afterEach(() => {
    _setAdSourceFactoryForTests(undefined);
  });

  it('default factory builds AdMob WITH { hookSnapshot: adMobBridgeSnapshot } (regression: was built without it)', () => {
    renderHook(() => useAdSource());

    expect(mockCreateAdMob).toHaveBeenCalledTimes(1);
    expect(mockCreateAdMob).toHaveBeenCalledWith({ hookSnapshot: adMobBridgeSnapshot });
  });

  it('default factory returns a FallbackAdSource wrapping adMob + internal sources', () => {
    const { result } = renderHook(() => useAdSource());

    expect(mockCreateInternal).toHaveBeenCalledTimes(1);
    expect(mockCreateFallback).toHaveBeenCalledTimes(1);
    expect(mockCreateFallback).toHaveBeenCalledWith(mockAdMobSource, mockInternalSource);

    // The composite returned IS the fallback source built by the factory.
    expect(result.current).toBe(mockFallbackSource);
  });

  it('_setAdSourceFactoryForTests override replaces the source, and undefined restores the built-in default', () => {
    const customSource: AdSource = {
      isReady: () => true,
      show: jest.fn().mockResolvedValue(undefined),
      renderSurface: () => null,
    };
    const customFactory = jest.fn(() => customSource);

    _setAdSourceFactoryForTests(customFactory);

    const { result: first } = renderHook(() => useAdSource());
    expect(first.current).toBe(customSource);
    expect(customFactory).toHaveBeenCalledTimes(1);
    // Built-in factories untouched while the override is active.
    expect(mockCreateAdMob).not.toHaveBeenCalled();

    // Restore the built-in default.
    _setAdSourceFactoryForTests(undefined);

    const { result: second } = renderHook(() => useAdSource());
    expect(mockCreateAdMob).toHaveBeenCalledWith({ hookSnapshot: adMobBridgeSnapshot });
    expect(second.current).toBe(mockFallbackSource);
  });
});
