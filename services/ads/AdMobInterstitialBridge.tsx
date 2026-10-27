// Host component for useInterstitialAd. Captures the hook return into a module-level
// snapshot consumed by AdMobInterstitialSource. Renders null.
//
// The bridge OWNS ad-unit-id resolution (dev vs prod): the source never resolves it.
//
// Hoisted to the App root: mounts once for the app lifetime and refills after each close
// (isClosed), so a single interstitial stays loaded across all ad cycles. AdScreen reads
// adMobBridgeSnapshot without mounting the bridge (N9 + F1 fixes).

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { TestIds, useInterstitialAd } from 'react-native-google-mobile-ads';
import { PLACEHOLDER_AD_UNIT_ID } from './AdMobInterstitialSource';
import type { HookSnapshot, HookSnapshotHandle } from './AdSource';

// Load-retry tuning (Bug H1): the SDK resets its internal loaded state on
// AdEventType.ERROR, so a re-load() works — but without a retry, one failed/no-fill
// load at start means no AdMob for the whole session. Bounded retries avoid a hot
// loop on persistent no-fill.
const LOAD_RETRY_DELAY_MS = 4_000;
const LOAD_RETRY_MAX_ATTEMPTS = 3;

let currentSnapshot: HookSnapshot | null = null;

export const adMobBridgeSnapshot: HookSnapshotHandle = {
  get() { return currentSnapshot; },
};

let warnedPlaceholderAdUnit = false;

function resolveAdUnitId() {
  if (__DEV__) return TestIds.INTERSTITIAL;
  const configured = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID;
  if (configured) return configured;
  if (!warnedPlaceholderAdUnit) {
    warnedPlaceholderAdUnit = true;
    console.warn(
      '[AdMobInterstitial] prod ads disabled: EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID is not set; ' +
      'falling back to a placeholder ad unit id until EAS provides the env var.',
    );
  }
  return PLACEHOLDER_AD_UNIT_ID;
}

export function AdMobInterstitialBridge(): null {
  const adUnitId = resolveAdUnitId();
  const hook = useInterstitialAd(adUnitId);
  const loadRetryAttemptsRef = useRef(0);

  // Effect split (avoids the dep-change null race, B3): initial-load/refill effect,
  // retry effect (error identity), capture effect, unmount-only cleanup.

  // Initial load / refill effect. Runs only when the load identity or loaded state
  // changes — NOT on unrelated flips (isClosed etc.), so transient re-renders can
  // neither double-load nor disturb the retry budget (Bug: dep flips burned budget).
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (typeof hook?.load !== 'function') return;
    if (hook?.isLoaded) {
      loadRetryAttemptsRef.current = 0; // successful load resets the retry budget
      return; // already loaded — no-op (prevents load loop)
    }
    if (hook?.error) return; // the retry effect owns the error path
    hook.load();
  }, [hook?.load, hook?.isLoaded]);

  // Retry effect. Keyed on the error IDENTITY (each load failure is a fresh error),
  // so an attempt is counted exactly once per scheduled retry: unrelated dep flips
  // while the same error persists never re-run this effect, and the backoff timer
  // survives them (Bug H1 + review: budget burned by isClosed flips).
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (typeof hook?.load !== 'function') return;
    if (!hook?.error) return;
    if (loadRetryAttemptsRef.current >= LOAD_RETRY_MAX_ATTEMPTS) return;
    console.warn('[AdMobInterstitial] interstitial load failed:', hook.error);
    loadRetryAttemptsRef.current += 1;
    const attempt = loadRetryAttemptsRef.current;
    const retryTimer = setTimeout(() => {
      hook.load();
    }, LOAD_RETRY_DELAY_MS * attempt);
    return () => {
      clearTimeout(retryTimer);
    };
  }, [hook?.error, hook?.load]);

  // Capture effect: registers this bridge as the snapshot owner. AdMobInterstitialSource
  // reads the snapshot through the module-level handle, so it never mounts the bridge.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    currentSnapshot = hook as HookSnapshot;
  }, [hook?.isLoaded, hook?.isClosed, hook?.isShowing, hook?.isOpened, hook?.error]);

  useEffect(() => {
    return () => {
      currentSnapshot = null;
    };
  }, []);

  return null;
}
