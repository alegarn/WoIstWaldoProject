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
  error: undefined,
  revenue: null,
  reward: null,
  isEarnedReward: false,
  load: jest.fn(),
  show: jest.fn(),
});

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
