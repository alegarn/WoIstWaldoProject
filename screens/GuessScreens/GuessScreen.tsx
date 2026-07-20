import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import { Dimensions, Platform } from 'react-native';

import GuessExitSwipeMenu from '../../components/Guess/GuessExitSwipeMenu';
import GuessPictureDefault from "../../components/Picture/GuessPicture";
import SuccessOverlay from '../../components/Guess/SuccessOverlay';
import TutorialOverlayDefault from '../../components/UI/TutorialOverlay';
import { PrivateGroupThemeProvider, useScopedPrivateGroupTheme } from '../../store/privateGroupTheme-context';
import { AuthContext } from '../../store/auth-context';
import { AD_OUTCOME_ADVANCE } from '../../constants/adOutcome';
import { isOnTarget } from "../../utils/targetLocation";
import { applySuccessSideEffects } from '../../utils/handleGuessOutcome';
import { navigateToNextGuess } from '../../utils/guessNavigation';
import { resolveNextCardWithServerFallback } from '../../utils/nextCardAdvancer';
import { isE2EMode } from '../../utils/e2eMode';
import { prefetchIfLow, warmAllDeckIfNeeded } from '../../services/cardPrefetcher';
import { computeMultiplier, isSpeedBonus, SPEED_MULTIPLIER_BASE } from '../../utils/speedMultiplier';
import { useStreak } from '../../hooks/useStreak';
import { resolveStreakTier } from '../../constants/streakTiers';
import { consumeAdSlot } from '../../utils/adCadence';
import type { AdScope } from '../../utils/adCadence';
import { shouldSuppressAds } from '../../services/billing/entitlements';
import type { AuthContextLike } from '../../services/billing/entitlements';
import {
  createFallbackAdSource,
} from '../../services/ads/FallbackAdSource';
import { createAdMobInterstitialSource } from '../../services/ads/AdMobInterstitialSource';
import { createInternalProAdSource } from '../../services/ads/InternalProAdSource';

type HiddenLocation = { x: number; y: number };
type GuessCategory = { id?: string; key?: string };

type TargetInfos = {
  location: { x: number; y: number };
  hiddenLocation: HiddenLocation;
  screenWidth: number;
  screenHeight: number;
  target?: unknown;
  elapsedMs?: number;
};

type GuessRouteParams = {
  imageFile?: string;
  pictureId?: string;
  description?: string;
  imageHeight?: number;
  imageWidth?: number;
  isPortrait?: boolean;
  hiddenLocation?: HiddenLocation;
  listId?: number;
  isTutorial?: boolean;
  category?: GuessCategory;
  language?: string;
  scope?: AdScope;
  skipInstructions?: boolean;
  advanceAfterAd?: boolean;
  advanceParams?: Record<string, unknown> | null;
};

type GuessNavigation = {
  setParams(params: Record<string, unknown>): void;
  setOptions(options: { headerStyle?: { backgroundColor?: string }; headerTintColor?: string }): void;
  navigate(name: 'AdScreen', params: Record<string, unknown>): void;
  replace(name: 'ResultScreen', params: Record<string, unknown>): void;
  popToTop(): void;
};

type AdSource = { isReady(): boolean };

type NextGuessResult = { params: Record<string, unknown> } | null | undefined;

let defaultAdSourceFactory = (): AdSource => {
  // On iOS the whole ad feature is a no-op (Q1): the AdMob source is never ready, and
  // the InternalProAdSource is suppressed via consumeAdSlot by a platform gate here.
  // We still construct the composite for shape parity; the platform gate is enforced
  // in handleOverlayDone via Platform.OS !== 'android' → no navigation to AdScreen.
  //
  // NOTE (F2/F3): GuessScreen deliberately constructs AdMob WITHOUT a hookSnapshot —
  // GuessScreen never reads AdMob readiness at runtime; it only checks the composite's
  // `isReady()` to feed `consumeAdSlot({ isSourceReady })`, which on Android reduces to
  // `true` because InternalProAdSource.isReady() is always true. The real AdMob hook
  // wiring lives in AdScreen (which mounts <AdMobInterstitialBridge /> and constructs
  // the source with `hookSnapshot: adMobBridgeSnapshot`).
  const adMob = createAdMobInterstitialSource();
  const internal = createInternalProAdSource();
  return createFallbackAdSource(adMob, internal);
};

type DecideAdSlotArgs = {
  successesSinceLastAd: number;
  scope?: AdScope;
  authContext: AuthContextLike;
  isAndroid: boolean;
  adSource: AdSource;
};

function decideAdSlot({ successesSinceLastAd, scope, authContext, isAndroid, adSource }: DecideAdSlotArgs) {
  // Cadence decision — owned solely by consumeAdSlot.
  // Short-circuit on isAndroid preserves the original platform gate so adSource.isReady()
  // is never evaluated on iOS (where adSource may be a no-op composite).
  return consumeAdSlot({
    successesSinceLastAd,
    scope,
    isAdFree: shouldSuppressAds(authContext),
    isE2E: isE2EMode(),
    isSourceReady: isAndroid && adSource.isReady(),
  });
}

type ApplyAdvanceArgs = {
  navigation: GuessNavigation;
  category?: GuessCategory;
  language?: string;
  listId?: number;
  isTutorial?: boolean;
  scope?: AdScope;
  isPrivate: boolean;
};

function applyAdvance(next: NextGuessResult, { navigation, category, language, listId, isTutorial, scope, isPrivate }: ApplyAdvanceArgs) {
  if (!next) {
    navigateToNextGuess(navigation, {
      category, language, currentListId: listId, isTutorial,
      scope: isPrivate ? scope : undefined,
    });
    return;
  }
  navigation.setParams(next.params);
}

type RouteAfterOverlayArgs = {
  next: NextGuessResult;
  navigation: GuessNavigation;
  uri?: string;
  pictureId?: string;
  description?: string;
  imageHeight?: number;
  imageWidth?: number;
  isPortrait?: boolean;
  hiddenLocation?: HiddenLocation;
  screenHeight: number;
  screenWidth: number;
  listId?: number;
  isTutorial?: boolean;
  category?: GuessCategory;
  language?: string;
  scope?: AdScope;
  isPrivate: boolean;
  showAd: boolean;
};

function routeAfterOverlay({
  next, navigation, uri, pictureId, description,
  imageHeight, imageWidth, isPortrait, hiddenLocation,
  screenHeight, screenWidth, listId, isTutorial,
  category, language, scope, isPrivate, showAd,
}: RouteAfterOverlayArgs) {
  if (!showAd) {
    applyAdvance(next, { navigation, category, language, listId, isTutorial, scope, isPrivate });
    return;
  }

  // Interject AdScreen between this card and the next. Pass sharedParams + onAdDone.
  navigation.navigate('AdScreen', {
    onTarget: true,
    imageFile: uri,
    pictureId,
    description,
    imageHeight,
    imageWidth,
    isPortrait,
    hiddenLocation,
    screenHeight,
    screenWidth,
    listId,
    isTutorial,
    category,
    language,
    scope,
    onAdDone: AD_OUTCOME_ADVANCE,
    // Stash the resolved next params so AdScreen's goBack + our effect can apply them.
    advanceParams: next ? next.params : null,
  });
}

type GuessScreenProps = {
  navigation: GuessNavigation;
  route: { params: GuessRouteParams };
};

type GuessPictureComponent = FC<{
  navigation?: GuessNavigation;
  imageFile?: string;
  pictureId?: string;
  description?: string;
  imageIsPortrait?: boolean;
  imageHeight?: number;
  imageWidth?: number;
  hiddenLocation?: HiddenLocation;
  screenDimensions?: { width?: number; height?: number };
  toAdScreen?: (targetInfos: TargetInfos) => Promise<void> | void;
  skipInstructions?: boolean;
  pulseTarget?: boolean;
  onInteract?: () => void;
}>;

type TutorialOverlayComponent = FC<{
  screen?: string;
  isPortrait?: boolean;
}>;

// GuessPicture.js and TutorialOverlay.js are .js deps with prop signatures inferred
// narrower than the props the original screen legitimately passes (e.g. `navigation`,
// `pictureId` are passed through to GuessPicture; TutorialOverlay omits instructionsPosition/
// onPress which the .js destructures but treats as optional at runtime). Cast to local
// structural types that mirror what this screen actually passes — behavior preserved.
const GuessPicture = GuessPictureDefault as unknown as GuessPictureComponent;
const TutorialOverlay = TutorialOverlayDefault as unknown as TutorialOverlayComponent;

export default function GuessScreen({ navigation, route }: GuessScreenProps) {

  const { imageFile, pictureId, description, imageHeight, imageWidth, isPortrait, hiddenLocation, listId, isTutorial, category, language, scope, skipInstructions } = route.params;
  const isPrivate = scope?.kind === 'private';

  const [showSuccess, setShowSuccess] = useState(false);
  const [successMultiplier, setSuccessMultiplier] = useState<number>(SPEED_MULTIPLIER_BASE);
  const { streak, tier, multiplier: streakMultiplier, onWin, onLose, reset } = useStreak();
  // Hints show on the first card of each game series (every fresh mount of
  // GuessScreen). Advancing to later cards uses setParams (no remount), so the
  // dismissed state persists for the rest of the series. Suppressed in e2e mode.
  const [hintsActive, setHintsActive] = useState<boolean>(!isE2EMode());
  const dismissHints = useCallback(() => setHintsActive(false), []);

  const authContext = useContext(AuthContext);
  const { userId } = authContext;

  const [successesSinceLastAd, setSuccessesSinceLastAd] = useState(0);
  const adSourceRef = useRef<AdSource | null>(null);
  if (adSourceRef.current === null) {
    adSourceRef.current = defaultAdSourceFactory();
  }
  const adSource = adSourceRef.current;

  const { group, theme } = useScopedPrivateGroupTheme(scope);

  useEffect(() => {
    if (!theme) return;
    navigation.setOptions({
      headerStyle: { backgroundColor: theme.primaryColor },
      headerTintColor: theme.headerTintColor,
    });
  }, [navigation, theme?.primaryColor, theme?.headerTintColor]);

  // When AdScreen returns via navigation.navigate('GuessScreen', {advanceAfterAd, advanceParams}),
  // native-stack MERGES those params into this route. The effect reads them, advances, clears.
  // Deps intentionally narrow to advanceAfterAd: we only want to fire on the merge event.
  // navigation is stable across renders (React Navigation guarantee); applyAdvance is
  // redefined per render but we close over the latest version at the time the dep changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!route.params?.advanceAfterAd) return;
    navigation.setParams({ advanceAfterAd: undefined });
    const stashed = route.params?.advanceParams;
    if (stashed) {
      navigation.setParams({ advanceParams: undefined });
      navigation.setParams(stashed);
    } else {
      applyAdvance(null, { navigation, category, language, listId, isTutorial, scope, isPrivate });
    }
  }, [route.params?.advanceAfterAd]);

  // Eagerly warm the 'all' deck on entering a real-category streak so the
  // category→all fallback is instant when the category exhausts. Fire-and-forget;
  // the prefetcher dedupes + shares the in-flight promise across this and the
  // per-win prefetch. No-op for 'all' itself (no fallback needed) and in e2e.
  useEffect(() => {
    if (category?.key === 'all') return;
    warmAllDeckIfNeeded({
      language,
      scope,
      authContext,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only warm
  }, []);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const uri = imageFile;

  let screenDimensions: { width?: number; height?: number } = {};
  isPortrait ?
    (screenDimensions = { width: screenWidth, height: screenHeight }) :
    (screenDimensions = { width: screenHeight, height: screenWidth });


  async function toAdScreen(targetInfos: TargetInfos) {
    let onTarget = isOnTarget(targetInfos);
    // Missing elapsedMs is treated as 0 by design: yields the fastest tier (fastest-find reward), preserving backward compatibility for callers that don't pass it.
    const elapsedMs = targetInfos?.elapsedMs ?? 0;
    const multiplier = computeMultiplier(elapsedMs);
    // Forward-looking speed-bonus reward gate: no ad hop exists on success today,
    // but when AdScreen is restored this flag (multiplier > 1) will skip the ad for fast finds.
    isSpeedBonus(multiplier);
    const sharedParams = {
      onTarget: onTarget,
      imageFile: uri,
      pictureId: pictureId,
      description: description,
      imageHeight: imageHeight,
      imageWidth:imageWidth,
      isPortrait: isPortrait,
      hiddenLocation: hiddenLocation,
      screenHeight: screenHeight,
      screenWidth: screenWidth,
      listId: listId,
      isTutorial: isTutorial,
      category,
      language,
      scope,
    };

    if (onTarget) {
      const nextStreak = streak + 1;
      const nextTier = resolveStreakTier(nextStreak);
      onWin();
      const finalPoints = Math.round(1 * multiplier * nextTier.multiplier);
      await applySuccessSideEffects({ listId, categoryKey: category?.key, language, imageFile: uri, pictureId, scope, userId, points: finalPoints, multiplier, streak: nextStreak, streakMultiplier: nextTier.multiplier });
      // Background prefetch (fire-and-forget). Keeps the deck warm for long streaks
      // without blocking the success animation or the setParams advance. Dedup +
      // warm-all handled by the prefetcher module (SRP).
      prefetchIfLow({
        categoryKey: category?.key || 'all',
        categoryId: category?.id,
        language,
        scope,
        authContext,
      }).catch(() => {});
      setSuccessMultiplier(multiplier);
      setShowSuccess(true);
      return;
    }

    onLose();
    setSuccessesSinceLastAd(0);
    navigation.replace('ResultScreen', sharedParams);
  };

  async function handleOverlayDone() {
    const next = await resolveNextCardWithServerFallback({
      category, language, currentListId: listId, isTutorial, scope, authContext,
    });

    setShowSuccess(false);

    const { showAd, nextCount } = decideAdSlot({
      successesSinceLastAd, scope, authContext,
      isAndroid: Platform.OS === 'android',
      adSource,
    });
    setSuccessesSinceLastAd(nextCount);

    routeAfterOverlay({
      next, navigation, uri, pictureId, description,
      imageHeight, imageWidth, isPortrait, hiddenLocation,
      screenHeight, screenWidth, listId, isTutorial,
      category, language, scope, isPrivate, showAd,
    });
  }

  function handleExitToHome() {
    navigation.popToTop();
  }


  return(
    <PrivateGroupThemeProvider group={group}>
    <>
    <GuessExitSwipeMenu onHome={handleExitToHome} showHints={hintsActive} onInteract={dismissHints} />
    <GuessPicture
      key={listId}
      navigation={navigation}
      // only in dev with local images, but imageFile in Prod
      imageFile={uri}
      pictureId={pictureId}
      description={description}
      imageIsPortrait={isPortrait}
      imageHeight={imageHeight}
      imageWidth={imageWidth}
      hiddenLocation={hiddenLocation}
      screenDimensions={screenDimensions}
      toAdScreen={toAdScreen}
      skipInstructions={skipInstructions}
      pulseTarget={hintsActive}
      onInteract={dismissHints}
    />
    <SuccessOverlay visible={showSuccess} multiplier={successMultiplier} points={Math.round(1 * successMultiplier * streakMultiplier)} streakTier={tier} onDone={handleOverlayDone} />
    {
      isTutorial && 
        <TutorialOverlay
         screen={"GuessScreen"}
         isPortrait={isPortrait}
        />
      }
    </>  
    </PrivateGroupThemeProvider>
  );
};
