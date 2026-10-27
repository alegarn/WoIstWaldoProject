import type { ReactTestRenderer } from 'react-test-renderer';
import React from 'react';
import { act, create } from 'react-test-renderer';

import {
  AdMobInterstitialBridge,
  adMobBridgeSnapshot,
} from '../../services/ads/AdMobInterstitialBridge';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

jest.mock('react-native-google-mobile-ads', () => ({
  TestIds: { INTERSTITIAL: 'test-interstitial-id' },
  useInterstitialAd: jest.fn(),
}));

const noopHook = () => ({
  isLoaded: false,
  isOpened: false,
  isClicked: false,
  isClosed: false,
  isShowing: false,
  error: undefined as Error | null | undefined,
  revenue: null,
  reward: null,
  isEarnedReward: false,
  load: jest.fn(),
  show: jest.fn(),
});

const LOAD_RETRY_DELAY_MS = 4_000;
const LOAD_RETRY_MAX_ATTEMPTS = 3;

function flushEffects() {
  return Promise.resolve().then(() => Promise.resolve());
}

describe('services/ads/AdMobInterstitialBridge', () => {
  let rn: { Platform: { OS: string } };
  let ads: { useInterstitialAd: jest.Mock };

  beforeEach(() => {
    rn = require('react-native');
    ads = require('react-native-google-mobile-ads');
    rn.Platform.OS = 'android';
    ads.useInterstitialAd.mockImplementation(noopHook);
  });

  it('mount calls load() on Android', async () => {
    const load = jest.fn();
    ads.useInterstitialAd.mockImplementation(() => ({ ...noopHook(), load }));

    await act(async () => {
      create(<AdMobInterstitialBridge />);
      await flushEffects();
    });

    expect(load).toHaveBeenCalled();
  });

  it('mount does NOT call load() on iOS (Q1: iOS no-op)', async () => {
    const load = jest.fn();
    ads.useInterstitialAd.mockImplementation(() => ({ ...noopHook(), load }));
    rn.Platform.OS = 'ios';

    try {
      await act(async () => {
        create(<AdMobInterstitialBridge />);
        await flushEffects();
      });

      expect(load).not.toHaveBeenCalled();
    } finally {
      rn.Platform.OS = 'android';
    }
  });

  it('load error warns and retries load() after a backoff delay (H1)', async () => {
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const load = jest.fn();
      let currentHook = { ...noopHook(), load };
      ads.useInterstitialAd.mockImplementation(() => currentHook);

      let renderer!: ReactTestRenderer;
      await act(async () => {
        renderer = create(<AdMobInterstitialBridge />);
        await flushEffects();
      });
      expect(load).toHaveBeenCalledTimes(1);

      currentHook = { ...noopHook(), load, error: new Error('no fill') };
      await act(async () => {
        renderer.update(<AdMobInterstitialBridge />);
        await flushEffects();
      });
      expect(warnSpy).toHaveBeenCalledWith(
        '[AdMobInterstitial] interstitial load failed:',
        expect.any(Error),
      );
      expect(load).toHaveBeenCalledTimes(1); // no immediate hot retry

      await act(async () => {
        jest.advanceTimersByTime(LOAD_RETRY_DELAY_MS);
      });
      expect(load).toHaveBeenCalledTimes(2);

      currentHook = { ...noopHook(), load };
      await act(async () => {
        renderer.update(<AdMobInterstitialBridge />);
        await flushEffects();
      });
      expect(load).toHaveBeenCalledTimes(2); // retry reset must not double-load
    } finally {
      warnSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('caps retries at 3 attempts per error episode (no hot retry loop)', async () => {
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const load = jest.fn();
      let currentHook = { ...noopHook(), load };
      ads.useInterstitialAd.mockImplementation(() => currentHook);

      let renderer!: ReactTestRenderer;
      await act(async () => {
        renderer = create(<AdMobInterstitialBridge />);
        await flushEffects();
      });
      expect(load).toHaveBeenCalledTimes(1);

      for (let attempt = 1; attempt <= LOAD_RETRY_MAX_ATTEMPTS; attempt += 1) {
        currentHook = { ...noopHook(), load, error: new Error(`no fill ${attempt}`) };
        await act(async () => {
          renderer.update(<AdMobInterstitialBridge />);
          await flushEffects();
        });
        await act(async () => {
          jest.advanceTimersByTime(LOAD_RETRY_DELAY_MS * attempt);
        });
        expect(load).toHaveBeenCalledTimes(1 + attempt);
        currentHook = { ...noopHook(), load };
        await act(async () => {
          renderer.update(<AdMobInterstitialBridge />);
          await flushEffects();
        });
        expect(load).toHaveBeenCalledTimes(1 + attempt);
      }

      currentHook = { ...noopHook(), load, error: new Error('still no fill') };
      await act(async () => {
        renderer.update(<AdMobInterstitialBridge />);
        await flushEffects();
      });
      expect(warnSpy).toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(LOAD_RETRY_DELAY_MS * 10);
      });
      expect(load).toHaveBeenCalledTimes(1 + LOAD_RETRY_MAX_ATTEMPTS);
    } finally {
      warnSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('does NOT burn retry budget when an unrelated dep flips under a persistent error', async () => {
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const load = jest.fn();
      const persistentError = new Error('no fill');
      let currentHook = { ...noopHook(), load };
      ads.useInterstitialAd.mockImplementation(() => currentHook);

      let renderer!: ReactTestRenderer;
      await act(async () => {
        renderer = create(<AdMobInterstitialBridge />);
        await flushEffects();
      });
      expect(load).toHaveBeenCalledTimes(1);

      // Error episode starts: exactly one retry is scheduled (attempt 1).
      currentHook = { ...noopHook(), load, error: persistentError };
      await act(async () => {
        renderer.update(<AdMobInterstitialBridge />);
        await flushEffects();
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(load).toHaveBeenCalledTimes(1);

      // Unrelated flip (isClosed) while the SAME error persists: no re-schedule,
      // no budget consumption, backoff timer survives.
      currentHook = { ...noopHook(), load, error: persistentError, isClosed: true };
      await act(async () => {
        renderer.update(<AdMobInterstitialBridge />);
        await flushEffects();
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);

      // Only the original attempt-1 retry fires; a budget-burning re-run would
      // have re-scheduled as attempt 2 and loaded again here.
      await act(async () => {
        jest.advanceTimersByTime(LOAD_RETRY_DELAY_MS);
      });
      expect(load).toHaveBeenCalledTimes(2);

      // ...and no second retry appears later (budget intact, no attempt 2).
      await act(async () => {
        jest.advanceTimersByTime(LOAD_RETRY_DELAY_MS * 10);
      });
      expect(load).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('resets the retry budget after a successful load', async () => {
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const load = jest.fn();
      let currentHook = { ...noopHook(), load };
      ads.useInterstitialAd.mockImplementation(() => currentHook);

      let renderer!: ReactTestRenderer;
      await act(async () => {
        renderer = create(<AdMobInterstitialBridge />);
        await flushEffects();
      });

      for (let attempt = 1; attempt <= LOAD_RETRY_MAX_ATTEMPTS; attempt += 1) {
        currentHook = { ...noopHook(), load, error: new Error(`no fill ${attempt}`) };
        await act(async () => {
          renderer.update(<AdMobInterstitialBridge />);
          await flushEffects();
        });
        await act(async () => {
          jest.advanceTimersByTime(LOAD_RETRY_DELAY_MS * attempt);
        });
        currentHook = { ...noopHook(), load };
        await act(async () => {
          renderer.update(<AdMobInterstitialBridge />);
          await flushEffects();
        });
      }
      expect(load).toHaveBeenCalledTimes(1 + LOAD_RETRY_MAX_ATTEMPTS);

      currentHook = { ...noopHook(), load, isLoaded: true };
      await act(async () => {
        renderer.update(<AdMobInterstitialBridge />);
        await flushEffects();
      });

      currentHook = { ...noopHook(), load, error: new Error('fresh episode') };
      await act(async () => {
        renderer.update(<AdMobInterstitialBridge />);
        await flushEffects();
      });
      await act(async () => {
        jest.advanceTimersByTime(LOAD_RETRY_DELAY_MS);
      });
      expect(load).toHaveBeenCalledTimes(2 + LOAD_RETRY_MAX_ATTEMPTS);
    } finally {
      warnSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('warns once and falls back to the placeholder id in prod without the env var', async () => {
    const originalDev = __DEV__;
    const originalEnv = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID;
    delete process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      (globalThis as { __DEV__?: boolean }).__DEV__ = false;
      await act(async () => {
        create(<AdMobInterstitialBridge />);
        await flushEffects();
      });
      await act(async () => {
        create(<AdMobInterstitialBridge />);
        await flushEffects();
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID'),
      );
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
      if (originalEnv === undefined) {
        delete process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID;
      } else {
        process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID = originalEnv;
      }
      warnSpy.mockRestore();
    }
  });

  it('snapshot is updated when hook state changes on Android', async () => {
    let currentHook = noopHook();
    ads.useInterstitialAd.mockImplementation(() => currentHook);

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<AdMobInterstitialBridge />);
      await flushEffects();
    });

    expect(adMobBridgeSnapshot.get()?.isLoaded).toBe(false);

    currentHook = { ...noopHook(), isLoaded: true };

    await act(async () => {
      renderer.update(<AdMobInterstitialBridge />);
      await flushEffects();
    });

    expect(adMobBridgeSnapshot.get()?.isLoaded).toBe(true);
  });

  it('snapshot is NOT nulled on dep-change (only on unmount)', async () => {
    let currentHook = { ...noopHook(), isLoaded: false };
    ads.useInterstitialAd.mockImplementation(() => currentHook);

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<AdMobInterstitialBridge />);
      await flushEffects();
    });

    expect(adMobBridgeSnapshot.get()).not.toBeNull();

    currentHook = { ...noopHook(), isLoaded: true };
    await act(async () => {
      renderer.update(<AdMobInterstitialBridge />);
      await flushEffects();
    });

    expect(adMobBridgeSnapshot.get()).not.toBeNull();

    currentHook = { ...noopHook(), isLoaded: false };
    await act(async () => {
      renderer.update(<AdMobInterstitialBridge />);
      await flushEffects();
    });

    expect(adMobBridgeSnapshot.get()).not.toBeNull();
  });

  it('snapshot IS nulled on unmount', async () => {
    ads.useInterstitialAd.mockImplementation(noopHook);

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<AdMobInterstitialBridge />);
      await flushEffects();
    });

    expect(adMobBridgeSnapshot.get()).not.toBeNull();

    await act(async () => {
      renderer.unmount();
      await flushEffects();
    });

    expect(adMobBridgeSnapshot.get()).toBeNull();
  });

  it('renders null (no children, no surface)', async () => {
    ads.useInterstitialAd.mockImplementation(noopHook);

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<AdMobInterstitialBridge />);
      await flushEffects();
    });

    expect(renderer.toJSON()).toBeNull();
  });
});
