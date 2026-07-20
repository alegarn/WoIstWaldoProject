import { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';

import LoadingOverlay from '../../components/UI/LoadingOverlay';
import { AD_OUTCOME_ADVANCE, AD_SCREEN_TESTID } from '../../constants/adOutcome';
import { getE2EAdDelayMs } from '../../utils/e2eMode';
import { createFallbackAdSource } from '../../services/ads/FallbackAdSource';
import { createAdMobInterstitialSource } from '../../services/ads/AdMobInterstitialSource';
import { createInternalProAdSource } from '../../services/ads/InternalProAdSource';
import { adMobBridgeSnapshot } from '../../services/ads/AdMobInterstitialBridge';
import type { AdSource } from '../../services/ads/AdSource';

// GDPR/ATT consent + real AdMob ad unit id are deploy obligations.
// See planning-not-docs/precise-plans/non-blocking-guess-ads/RELEASE-OBLIGATIONS.md.

interface AdScreenParams {
  onTarget: boolean;
  imageFile: string;
  pictureId: string;
  description: string;
  imageHeight: number;
  imageWidth: number;
  isPortrait: boolean;
  hiddenLocation: object;
  screenHeight: number;
  screenWidth: number;
  listId: number;
  isTutorial: boolean;
  category: object;
  language: string;
  scope: { kind: 'private' | 'public'; [k: string]: unknown };
  onAdDone?: string;
  advanceParams?: Record<string, unknown> | null;
}

type AdScreenNavigation = {
  navigate(screen: 'GuessScreen', params?: { advanceAfterAd?: boolean; advanceParams?: unknown }): void;
  replace(screen: 'ResultScreen', params?: Record<string, unknown>): void;
};

let defaultAdSourceFactory: () => AdSource = () => {
  const adMob = createAdMobInterstitialSource({ hookSnapshot: adMobBridgeSnapshot });
  const internal = createInternalProAdSource();
  return createFallbackAdSource(adMob, internal);
};

const builtInDefaultFactory = defaultAdSourceFactory;

export function _setAdSourceFactoryForTests(factory?: (() => AdSource) | undefined) {
  // Passing `undefined` restores the built-in default (test isolation pattern;
  // jest.resetModules() alone does NOT re-bind the captured export reference).
  defaultAdSourceFactory = factory === undefined ? builtInDefaultFactory : factory;
}

export default function AdScreen({ navigation, route }: { navigation: AdScreenNavigation; route: { params: AdScreenParams } }) {
  const {
    onTarget, imageFile, pictureId, description, imageHeight, imageWidth,
    isPortrait, hiddenLocation, screenHeight, screenWidth, listId,
    isTutorial, category, language, scope,
    onAdDone, // AD_OUTCOME_ADVANCE (success path) | undefined (failure path)
    advanceParams, // NEW param: stashed next-card params (success path only)
  } = route.params;

  const adSourceRef = useRef<AdSource | null>(null);
  if (adSourceRef.current === null) {
    adSourceRef.current = defaultAdSourceFactory();
  }
  const adSource: AdSource = adSourceRef.current;

  const advanceFromSuccess = onAdDone === AD_OUTCOME_ADVANCE;

  const routeOut = useCallback(() => {
    if (advanceFromSuccess) {
      // Success path: native-stack MERGES these params into the existing GuessScreen
      // instance and pops AdScreen. GuessScreen's advanceAfterAd effect fires on the merge.
      navigation.navigate('GuessScreen', {
        advanceAfterAd: true,
        advanceParams: advanceParams || null,
      });
      return;
    }
    // Failure path: unchanged.
    navigation.replace('ResultScreen', {
      onTarget, imageFile, pictureId, description, imageHeight, imageWidth,
      isPortrait, hiddenLocation, screenHeight, screenWidth, listId,
      isTutorial, category, language,
    });
  }, [
    advanceFromSuccess, navigation, advanceParams,
    onTarget, imageFile, pictureId, description,
    imageHeight, imageWidth, isPortrait, hiddenLocation, screenHeight, screenWidth,
    listId, isTutorial, category, language,
  ]);

  // show() resolving IS the sole completion signal. No listener registration.
  // F1 (resolved): the AdMob bridge is now hoisted to the App root, pre-loads at app
  // start, and refills after each close — so AdMob is loaded BEFORE AdScreen mounts and
  // `isReady()` is reliably true on first paint. If still not ready, the graceful-skip
  // path runs after getE2EAdDelayMs(). (effect deps unchanged: [adSource, routeOut].)
  useEffect(() => {
    if (!adSource.isReady()) {
      // Honor e2e cadence (instant) plus production no-source path (instant).
      const delay = getE2EAdDelayMs();
      const t: ReturnType<typeof setTimeout> = setTimeout(routeOut, delay);
      return () => clearTimeout(t);
    }

    let cancelled = false;
    adSource.show()
      .then(() => { if (!cancelled) routeOut(); })
      .catch(() => { if (!cancelled) routeOut(); });

    return () => { cancelled = true; };
  }, [adSource, routeOut]);

  if (!adSource.isReady()) {
    return (
      <View style={{ flex: 1 }} testID={AD_SCREEN_TESTID}>
        {/* No surface to render; routeOut effect handles navigation. */}
      </View>
    );
  }

  const surface = adSource.renderSurface();

  return (
    <View style={{ flex: 1 }} testID={AD_SCREEN_TESTID}>
      {surface !== null ? surface : <LoadingOverlay message="Loading Ads..." />}
    </View>
  );
}
