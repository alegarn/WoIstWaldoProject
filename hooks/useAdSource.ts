import { useRef } from 'react';

import { createFallbackAdSource } from '../services/ads/FallbackAdSource';
import { createAdMobInterstitialSource } from '../services/ads/AdMobInterstitialSource';
import { adMobBridgeSnapshot } from '../services/ads/AdMobInterstitialBridge';
import { createInternalProAdSource } from '../services/ads/InternalProAdSource';
import type { AdSource } from '../services/ads/AdSource';

// Composite ad source for the free-tier ad slot. AdMob is bound to the App-level
// bridge snapshot (mounted once for app lifetime in App.tsx via
// <AdMobInterstitialBridge />): on Android, when the bridge has a loaded native
// interstitial, adMob.isReady() is true and FallbackAdSource picks it; otherwise
// the InternalProAdSource fallback panel renders on every platform (its
// isReady() is always true). Ads fire on all platforms for the free tier —
// paid tier and e2e are still skipped by consumeAdSlot.
let defaultAdSourceFactory: () => AdSource = () => {
  const adMob = createAdMobInterstitialSource({ hookSnapshot: adMobBridgeSnapshot });
  const internal = createInternalProAdSource();
  return createFallbackAdSource(adMob, internal);
};

const builtInDefaultFactory = defaultAdSourceFactory;

/**
 * TEST-ONLY seam. Override the factory used by `useAdSource`. Pass `undefined`
 * to restore the built-in default. jest.resetModules() alone does NOT re-bind
 * the captured export reference, so explicit restoration is required for
 * test isolation.
 */
export function _setAdSourceFactoryForTests(factory?: (() => AdSource) | undefined) {
  defaultAdSourceFactory = factory === undefined ? builtInDefaultFactory : factory;
}

/**
 * Memoized AdSource for a component instance. Constructed once via the
 * (overridable for tests) defaultAdSourceFactory.
 */
export function useAdSource(): AdSource {
  const ref = useRef<AdSource | null>(null);
  if (ref.current === null) {
    ref.current = defaultAdSourceFactory();
  }
  return ref.current;
}
