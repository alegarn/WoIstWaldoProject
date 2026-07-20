jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

jest.mock('react-native-google-mobile-ads', () => ({
  TestIds: { INTERSTITIAL: 'test-interstitial-id' },
  useInterstitialAd: jest.fn(),
}));

import {
  createAdMobInterstitialSource,
  PLACEHOLDER_AD_UNIT_ID,
  ADMOB_SHOW_TIMEOUT_MS,
} from '../../services/ads/AdMobInterstitialSource';
import type { HookSnapshot, HookSnapshotHandle } from '../../services/ads/AdSource';

function makeSnapshot(overrides: Partial<HookSnapshot> = {}): HookSnapshot {
  return {
    isLoaded: false,
    isClosed: false,
    show: jest.fn(),
    ...overrides,
  };
}

describe('services/ads/AdMobInterstitialSource', () => {
  describe('constants', () => {
    it('PLACEHOLDER_AD_UNIT_ID is the documented placeholder', () => {
      expect(PLACEHOLDER_AD_UNIT_ID).toBe('ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyyyyyy');
    });

    it('ADMOB_SHOW_TIMEOUT_MS is 30000 (named constant guard, G25)', () => {
      expect(ADMOB_SHOW_TIMEOUT_MS).toBe(30_000);
    });
  });

  it('isReady() returns false when snapshot is null', () => {
    const hookSnapshot: HookSnapshotHandle = { get: () => null };
    const source = createAdMobInterstitialSource({ hookSnapshot });
    expect(source.isReady()).toBe(false);
  });

  it('isReady() returns false when hook reports isLoaded=false', () => {
    const snap = makeSnapshot({ isLoaded: false });
    const hookSnapshot: HookSnapshotHandle = { get: () => snap };
    const source = createAdMobInterstitialSource({ hookSnapshot });
    expect(source.isReady()).toBe(false);
  });

  it('isReady() returns true when hook reports isLoaded=true on Android', () => {
    const snap = makeSnapshot({ isLoaded: true });
    const hookSnapshot: HookSnapshotHandle = { get: () => snap };
    const source = createAdMobInterstitialSource({ hookSnapshot });
    expect(source.isReady()).toBe(true);
  });

  it('isReady() returns false on iOS even when hook is loaded (Q1: iOS no-op)', () => {
    const rn = require('react-native') as { Platform: { OS: string } };
    rn.Platform.OS = 'ios';
    try {
      const snap = makeSnapshot({ isLoaded: true });
      const hookSnapshot: HookSnapshotHandle = { get: () => snap };
      const source = createAdMobInterstitialSource({ hookSnapshot });
      expect(source.isReady()).toBe(false);
    } finally {
      rn.Platform.OS = 'android';
    }
  });

  it('show() resolves without throwing when source is not ready', async () => {
    const snap = makeSnapshot({ isLoaded: false, show: jest.fn() });
    const hookSnapshot: HookSnapshotHandle = { get: () => snap };
    const source = createAdMobInterstitialSource({ hookSnapshot });
    await expect(source.show()).resolves.toBeUndefined();
    expect(snap.show).not.toHaveBeenCalled();
  });

  it('show() calls the hook show() and resolves when it resolves', async () => {
    const snap = makeSnapshot({ isLoaded: true, show: jest.fn().mockResolvedValue(undefined) });
    const hookSnapshot: HookSnapshotHandle = { get: () => snap };
    const source = createAdMobInterstitialSource({ hookSnapshot });
    await source.show();
    expect(snap.show).toHaveBeenCalled();
  });

  it('show() swallows errors from the hook (contract: never rejects)', async () => {
    const snap = makeSnapshot({
      isLoaded: true,
      show: jest.fn().mockRejectedValue(new Error('ad network down')),
    });
    const hookSnapshot: HookSnapshotHandle = { get: () => snap };
    const source = createAdMobInterstitialSource({ hookSnapshot });
    await expect(source.show()).resolves.toBeUndefined();
  });

  it('show() resolves via ADMOB_SHOW_TIMEOUT_MS when the hook show() hangs (timeout race)', async () => {
    jest.useFakeTimers();
    try {
      const neverResolves = new Promise(() => {});
      const snap = makeSnapshot({ isLoaded: true, show: jest.fn().mockReturnValue(neverResolves) });
      const hookSnapshot: HookSnapshotHandle = { get: () => snap };
      const source = createAdMobInterstitialSource({ hookSnapshot });
      const promise = source.show();
      jest.advanceTimersByTime(30_000);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('show() early-returns on iOS without touching the hook (Q1: iOS no-op)', async () => {
    const rn = require('react-native') as { Platform: { OS: string } };
    rn.Platform.OS = 'ios';
    try {
      const snap = makeSnapshot({ isLoaded: true, show: jest.fn() });
      const hookSnapshot: HookSnapshotHandle = { get: () => snap };
      const source = createAdMobInterstitialSource({ hookSnapshot });
      await source.show();
      expect(snap.show).not.toHaveBeenCalled();
    } finally {
      rn.Platform.OS = 'android';
    }
  });

  it('show() clears the timeout in finally even if hook rejects (no leaked timer)', async () => {
    jest.useFakeTimers();
    try {
      const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
      const snap = makeSnapshot({
        isLoaded: true,
        show: jest.fn().mockRejectedValue(new Error('boom')),
      });
      const hookSnapshot: HookSnapshotHandle = { get: () => snap };
      const source = createAdMobInterstitialSource({ hookSnapshot });
      await expect(source.show()).resolves.toBeUndefined();
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });
});
