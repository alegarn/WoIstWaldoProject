jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

jest.mock('react-native-google-mobile-ads', () => ({
  TestIds: { INTERSTITIAL: 'test-interstitial-id' },
  useInterstitialAd: jest.fn(),
}));

import {
  createAdMobInterstitialSource,
  PLACEHOLDER_AD_UNIT_ID,
  ADMOB_SHOW_TIMEOUT_MS,
  ADMOB_OPEN_TIMEOUT_MS,
  ADMOB_POLL_INTERVAL_MS,
} from '../../services/ads/AdMobInterstitialSource';
import type { HookSnapshot, HookSnapshotHandle } from '../../services/ads/AdSource';

function makeSnapshot(overrides: Partial<HookSnapshot> = {}): HookSnapshot {
  return {
    isLoaded: false,
    isOpened: false,
    isClosed: false,
    isShowing: false,
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

    it('ADMOB_OPEN_TIMEOUT_MS is 10000 (named constant guard, G25)', () => {
      expect(ADMOB_OPEN_TIMEOUT_MS).toBe(10_000);
    });

    it('ADMOB_POLL_INTERVAL_MS is 200 (named constant guard, G25)', () => {
      expect(ADMOB_POLL_INTERVAL_MS).toBe(200);
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

  it('show() does NOT resolve instantly: waits for the ad to open before close (H3)', async () => {
    jest.useFakeTimers();
    try {
      const snap = makeSnapshot({ isLoaded: true, show: jest.fn() });
      const hookSnapshot: HookSnapshotHandle = { get: () => snap };
      const source = createAdMobInterstitialSource({ hookSnapshot });
      let settled = false;
      const promise = source.show().then(() => { settled = true; });

      expect(snap.show).toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(ADMOB_POLL_INTERVAL_MS * 5);
      expect(settled).toBe(false);

      snap.isShowing = true;
      await jest.advanceTimersByTimeAsync(ADMOB_POLL_INTERVAL_MS);
      expect(settled).toBe(false); // opened, but not closed yet

      snap.isClosed = true;
      await jest.advanceTimersByTimeAsync(ADMOB_POLL_INTERVAL_MS);
      await promise;
      expect(settled).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('show() resolves when the ad never opens (open timeout, game continues)', async () => {
    jest.useFakeTimers();
    try {
      const snap = makeSnapshot({ isLoaded: true, show: jest.fn() });
      const hookSnapshot: HookSnapshotHandle = { get: () => snap };
      const source = createAdMobInterstitialSource({ hookSnapshot });
      let settled = false;
      const promise = source.show().then(() => { settled = true; });

      await jest.advanceTimersByTimeAsync(ADMOB_OPEN_TIMEOUT_MS + ADMOB_POLL_INTERVAL_MS);
      await promise;
      expect(settled).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('show() resolves when the ad opens but never closes (show timeout)', async () => {
    jest.useFakeTimers();
    try {
      const snap = makeSnapshot({ isLoaded: true, isShowing: true, show: jest.fn() });
      const hookSnapshot: HookSnapshotHandle = { get: () => snap };
      const source = createAdMobInterstitialSource({ hookSnapshot });
      let settled = false;
      const promise = source.show().then(() => { settled = true; });

      await jest.advanceTimersByTimeAsync(ADMOB_POLL_INTERVAL_MS); // open poll sees isShowing
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(ADMOB_SHOW_TIMEOUT_MS + ADMOB_POLL_INTERVAL_MS);
      await promise;
      expect(settled).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('show() swallows errors from the hook and keeps waiting per contract (never rejects)', async () => {
    jest.useFakeTimers();
    try {
      const snap = makeSnapshot({
        isLoaded: true,
        show: jest.fn().mockRejectedValue(new Error('ad network down')),
      });
      const hookSnapshot: HookSnapshotHandle = { get: () => snap };
      const source = createAdMobInterstitialSource({ hookSnapshot });
      const promise = source.show();
      await jest.advanceTimersByTimeAsync(ADMOB_OPEN_TIMEOUT_MS + ADMOB_POLL_INTERVAL_MS);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  describe('dispose (host unmount mid-show)', () => {
    it('stops the poll interval and resolves the pending show() wait', async () => {
      jest.useFakeTimers();
      try {
        const snap = makeSnapshot({ isLoaded: true, show: jest.fn() });
        const hookSnapshot: HookSnapshotHandle = { get: () => snap };
        const source = createAdMobInterstitialSource({ hookSnapshot });
        let settled = false;
        const promise = source.show().then(() => { settled = true; });

        // Mid-poll: ad neither opened nor timed out.
        await jest.advanceTimersByTimeAsync(ADMOB_POLL_INTERVAL_MS * 2);
        expect(settled).toBe(false);
        expect(jest.getTimerCount()).toBeGreaterThan(0);

        source.dispose?.();
        await promise;
        expect(settled).toBe(true);

        // Interval stopped: no timers survive dispose, and later ticks are inert.
        expect(jest.getTimerCount()).toBe(0);
        await jest.advanceTimersByTimeAsync(ADMOB_OPEN_TIMEOUT_MS + ADMOB_SHOW_TIMEOUT_MS);
        expect(settled).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });

    it('resolves the pending close wait when disposed after the ad opened', async () => {
      jest.useFakeTimers();
      try {
        const snap = makeSnapshot({ isLoaded: true, show: jest.fn() });
        const hookSnapshot: HookSnapshotHandle = { get: () => snap };
        const source = createAdMobInterstitialSource({ hookSnapshot });
        let settled = false;
        const promise = source.show().then(() => { settled = true; });

        snap.isShowing = true;
        await jest.advanceTimersByTimeAsync(ADMOB_POLL_INTERVAL_MS);
        expect(settled).toBe(false); // opened, waiting for close

        source.dispose?.();
        await promise;
        expect(settled).toBe(true);
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });

    it('show() after dispose() is a safe no-op', async () => {
      const snap = makeSnapshot({ isLoaded: true, show: jest.fn() });
      const hookSnapshot: HookSnapshotHandle = { get: () => snap };
      const source = createAdMobInterstitialSource({ hookSnapshot });
      source.dispose?.();
      await expect(source.show()).resolves.toBeUndefined();
      expect(snap.show).not.toHaveBeenCalled();
    });
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
});
