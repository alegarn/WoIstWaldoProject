import { useRef } from 'react';

import { createFallbackAdSource } from '../services/ads/FallbackAdSource';
import { createAdMobInterstitialSource } from '../services/ads/AdMobInterstitialSource';
import { createInternalProAdSource } from '../services/ads/InternalProAdSource';
import type { AdSource } from '../services/ads/AdSource';

// On iOS the whole ad feature is a no-op (Q1): the AdMob source is never ready, and
// the InternalProAdSource is suppressed by useAdCadence's platform gate before
// any overlay is shown. We still construct the composite for shape parity.
//
// NOTE (F2/F3): GuessScreen deliberately constructs AdMob WITHOUT a hookSnapshot —
// GuessScreen never reads AdMob readiness at runtime; it only checks the composite's
// `isReady()` to feed `consumeAdSlot({ isSourceReady })`, which on Android reduces to
// `true` because InternalProAdSource.isReady() is always true. The real AdMob hook
// wiring lives in App.tsx (<AdMobInterstitialBridge />, hoisted for app lifetime).
let defaultAdSourceFactory: () => AdSource = () => {
  const adMob = createAdMobInterstitialSource();
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
