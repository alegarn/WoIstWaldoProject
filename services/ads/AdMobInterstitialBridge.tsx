// Host component for useInterstitialAd. Captures the hook return into a module-level
// snapshot consumed by AdMobInterstitialSource. Renders null.
//
// The bridge OWNS ad-unit-id resolution (dev vs prod): the source never resolves it.
//
// Hoisted to the App root: mounts once for the app lifetime and refills after each close
// (isClosed), so a single interstitial stays loaded across all ad cycles. AdScreen reads
// adMobBridgeSnapshot without mounting the bridge (N9 + F1 fixes).

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { TestIds, useInterstitialAd } from 'react-native-google-mobile-ads';
import { PLACEHOLDER_AD_UNIT_ID } from './AdMobInterstitialSource';
import type { HookSnapshot, HookSnapshotHandle } from './AdSource';

let currentSnapshot: HookSnapshot | null = null;

export const adMobBridgeSnapshot: HookSnapshotHandle = {
  get() { return currentSnapshot; },
};

function resolveAdUnitId() {
  return __DEV__
    ? TestIds.INTERSTITIAL
    : (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || PLACEHOLDER_AD_UNIT_ID);
}

export function AdMobInterstitialBridge(): null {
  const adUnitId = resolveAdUnitId();
  const hook = useInterstitialAd(adUnitId);

  // Three-effect split (avoids the dep-change null race, B3):
  //  1) mount-only marker effect (no-op body; documents ownership)
  //  2) capture effect (writes the latest hook into the module snapshot on every
  //     load/closed/shown change — NO cleanup, so it never nulls mid-lifecycle)
  //  3) unmount-only cleanup (empty dep array -> cleanup fires once on real unmount)
  useEffect(() => {
    // Mount-only: register this bridge as the snapshot owner. The empty dep array means
    // this runs once on mount and the cleanup runs once on unmount (no dep-change teardown).
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (typeof hook?.load !== 'function') return;
    if (hook?.isLoaded) return; // already loaded — no-op (prevents load loop)
    hook.load();
  }, [hook?.load, hook?.isLoaded, hook?.isClosed]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    currentSnapshot = hook as HookSnapshot;
  }, [hook?.isLoaded, hook?.isClosed, hook?.isShowing]);

  useEffect(() => {
    return () => {
      currentSnapshot = null;
    };
  }, []);

  return null;
}
