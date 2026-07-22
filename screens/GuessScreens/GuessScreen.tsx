import { useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import type { FC } from 'react';
import { AppState, Platform, useWindowDimensions } from 'react-native';

import GuessExitSwipeMenu from '../../components/Guess/GuessExitSwipeMenu';
import GuessPictureDefault from "../../components/Picture/GuessPicture";
import SuccessOverlay from '../../components/Guess/SuccessOverlay';
import TutorialOverlayDefault from '../../components/UI/TutorialOverlay';
import GuessExhaustedPanel from '../../components/Guess/GuessExhaustedPanel';
import GuessAdvanceLoader from '../../components/Guess/GuessAdvanceLoader';
import { PrivateGroupThemeProvider, useScopedPrivateGroupTheme } from '../../store/privateGroupTheme-context';
import { AuthContext } from '../../store/auth-context';
import { AD_OUTCOME_ADVANCE } from '../../constants/adOutcome';
import { isOnTarget } from "../../utils/targetLocation";
import { applySuccessSideEffects } from '../../utils/handleGuessOutcome';
import { resolveNextCardWithServerFallback } from '../../utils/nextCardAdvancer';
import { advanceReducer, initialAdvance, DEFAULT_RETRY_BUDGET } from '../../utils/advanceState';
import type { AdvanceEvent, AdvanceSnapshot, AdvanceState } from '../../utils/advanceState';
import { isE2EMode } from '../../utils/e2eMode';
import { prefetchIfLow, warmAllDeckIfNeeded } from '../../services/cardPrefetcher';
import { computeMultiplier, SPEED_MULTIPLIER_BASE } from '../../utils/speedMultiplier';
import { useFlushOnLeave } from '../../hooks/useFlushOnLeave';
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
  navigate(name: 'GuessPathScreen', params?: Record<string, unknown>): void;
  replace(name: 'ResultScreen', params: Record<string, unknown>): void;
  popToTop(): void;
  addListener(event: 'beforeRemove', listener: () => void): () => void;
};

type AdSource = { isReady(): boolean };

type NextGuessResult = { params: Record<string, unknown> } | null | undefined;

function computePoints(speedMultiplier: number, streakMultiplier: number): number {
  return Math.round(speedMultiplier * streakMultiplier);
}

// Exponential retry cadence for the `warming` state (§5.3 + §8 risk row).
// 3 attempts total, 1s/2s/4s. After the budget is consumed the reducer
// transitions to `exhausted` via the final RETRY_TICK (no further resolve).
const RETRY_DELAYS_MS = [1000, 2000, 4000];

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

type RouteAfterOverlayArgs = {
  next: NonNullable<NextGuessResult>;
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
  showAd: boolean;
};

function routeAfterOverlay({
  next, navigation, uri, pictureId, description,
  imageHeight, imageWidth, isPortrait, hiddenLocation,
  screenHeight, screenWidth, listId, isTutorial,
  category, language, scope, showAd,
}: RouteAfterOverlayArgs) {
  // T1.6b (Phase 1 review fix A): no-ad path is a no-op. The reducer's RESOLVED
  // transition (staged in onAdvanceResolved) drives the idle-entry side-effect,
  // which applies setParams — the state machine stays the single source of truth
  // for advance and setParams fires exactly once.
  if (!showAd) {
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

type SharedParams = {
  onTarget: boolean;
  imageFile?: string;
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
};

function buildSharedParams(args: SharedParams): SharedParams {
  return { ...args };
}

type ResolveCorrectGuessOutcomeArgs = {
  multiplier: number;
  currentStreak: number;
};

type CorrectGuessOutcome = {
  nextStreak: number;
  nextTier: ReturnType<typeof resolveStreakTier>;
  finalPoints: number;
};

function resolveCorrectGuessOutcome({ multiplier, currentStreak }: ResolveCorrectGuessOutcomeArgs): CorrectGuessOutcome {
  const nextStreak = currentStreak + 1;
  const nextTier = resolveStreakTier(nextStreak);
  const finalPoints = computePoints(multiplier, nextTier.multiplier);
  return { nextStreak, nextTier, finalPoints };
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
  disabled?: boolean;
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
  const [advance, dispatchAdvance] = useReducer(
    (prev: AdvanceSnapshot, event: AdvanceEvent) => advanceReducer(prev, event),
    initialAdvance,
  );
  // PT6: retry timers live in a ref so they survive renders but can be cleared
  // synchronously from cleanup / AppState handlers without waiting for state.
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef<number>(0);
  // Mirror advance.state into a ref so the AppState listener (mounted once) can
  // read the latest state without re-subscribing on every transition.
  const advanceStateRef = useRef<AdvanceState>(advance.state);
  useEffect(() => {
    advanceStateRef.current = advance.state;
  }, [advance.state]);
  // Hints show on the first card of each game series (every fresh mount of
  // GuessScreen). Advancing to later cards uses setParams (no remount), so the
  // dismissed state persists for the rest of the series. Suppressed in e2e mode.
  const [hintsActive, setHintsActive] = useState<boolean>(!isE2EMode());
  const dismissHints = useCallback(() => setHintsActive(false), []);

  const authContext = useContext(AuthContext);
  const { userId } = authContext;

  // T1.11 mitigation (b-i): mount useFlushOnLeave gated on advanceAfterAd !== undefined.
  // popToTop (from GuessExhaustedPanel Leave) fires beforeRemove on EVERY popped screen,
  // so an unguarded mount here double-flushes with GuessFeedScreen's own hook. The gate
  // keeps GuessScreen's hook dormant in normal sessions (no advanceAfterAd merge),
  // leaving GuessFeedScreen as the sole flush trigger on popToTop. The `flushing` guard
  // in sessionScoreStore.coalesces any residual overlap (deep-link / AdScreen return).
  useFlushOnLeave({
    navigation,
    authContext,
    enabled: route.params?.advanceAfterAd !== undefined,
  });

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
  // native-stack MERGES those params into this route. PB1: the effect dispatches into the
  // advance state machine instead of writing setParams directly, so the machine stays the
  // single source of truth for advance. The no-stash branch transitions to `exhausted`
  // (GuessExhaustedPanel renders, no navigation.reset). The stash branch stages `stashed`
  // on the snapshot via WIN → RESOLVED; the idle-entry effect below consumes advance.next
  // via setParams. RC5: the stashed value is consumed AS-IS — the 4-tier resolver is NOT
  // re-run on the AdScreen return path.
  // Deps intentionally narrow to advanceAfterAd: we only want to fire on the merge event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!route.params?.advanceAfterAd) return;
    navigation.setParams({ advanceAfterAd: undefined, advanceParams: undefined });
    const stashed = route.params?.advanceParams;
    if (!stashed) {
      dispatchAdvance({ type: 'FAILED_PERMANENT' });
      return;
    }
    dispatchAdvance({ type: 'WIN' });
    dispatchAdvance({ type: 'RESOLVED', next: stashed });
  }, [route.params?.advanceAfterAd]);

  // PB1: the advance reducer is the single source of truth for advance. The reducer
  // itself is pure (no navigation); this idle-entry side-effect consumes a staged
  // `advance.next` via setParams whenever the machine lands in `idle` with a non-null
  // payload. Identity-tracked so a re-staged same-ref (e.g. across the AdScreen
  // round-trip) does not double-apply.
  const appliedNextRef = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (advance.state === 'idle' && advance.next && appliedNextRef.current !== advance.next) {
      appliedNextRef.current = advance.next;
      navigation.setParams(advance.next);
    }
  }, [advance.state, advance.next, navigation]);

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

  // PT6: clear any pending retry timer on unmount so we never setState after
  // unmount (Leave tap during warming, navigation.popToTop, etc.).
  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  // PT6 (Phase 1 review fix B): also clear any in-flight retry timer when
  // the screen transitions OUT of a mid-advance state (advancing/warming →
  // idle/exhausted). React 19 batches the idle→advancing→warming dispatches
  // (separated only by a microtask boundary in runResolveCycle) into a single
  // commit, so a cleanup keyed on a derived isMidAdvance boolean would fire on
  // that batched commit — AFTER scheduleRetry has already set the timer — and
  // silently cancel the next retry. Track the previous state in a ref and only
  // clear when actually leaving mid-advance. Forward-safety: today the timer
  // self-nulls at firing so this is a no-op, but a future regression that
  // schedules a timer and transitions without self-nulling will be caught.
  const prevAdvanceStateRef = useRef<AdvanceState>(advance.state);
  useEffect(() => {
    const prev = prevAdvanceStateRef.current;
    prevAdvanceStateRef.current = advance.state;
    const wasMidAdvance = prev === 'advancing' || prev === 'warming';
    const isMidAdvanceNow = advance.state === 'advancing' || advance.state === 'warming';
    if (wasMidAdvance && !isMidAdvanceNow && retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [advance.state]);

  // PT2: AppState listener. Backgrounding from any mid-advance state
  // (advancing/warming) clears retry timers and forces `exhausted` so the
  // player lands on a deterministic state on foreground (timers don't survive
  // backgrounding reliably). `idle`/`exhausted` are left untouched.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState: string) => {
      if (nextAppState === 'active') return;
      const current = advanceStateRef.current;
      if (current !== 'idle' && current !== 'exhausted') {
        if (retryTimerRef.current !== null) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        dispatchAdvance({ type: 'FAILED_PERMANENT' });
      }
    });
    return () => sub.remove();
  }, []);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const uri = imageFile;

  const screenDimensions = { width: screenWidth, height: screenHeight };

  async function applySuccessPath(multiplier: number) {
    // PB6: streak + score commit deferred to RESOLVED side-effect in
    // handleOverlayDone — a tap that fails to advance must not credit the
    // streak/score. Only the speed multiplier + overlay state commit here;
    // fire-and-forget deck prefetch is preserved (PB7 Phase 3 covers image
    // preload placement separately).
    prefetchIfLow({
      categoryKey: category?.key || 'all',
      categoryId: category?.id,
      language,
      scope,
      authContext,
      currentListId: listId,
    }).catch(() => {});
    setSuccessMultiplier(multiplier);
    setShowSuccess(true);
  }

  function applyFailurePath(sharedParams: SharedParams) {
    onLose();
    setSuccessesSinceLastAd(0);
    navigation.replace('ResultScreen', sharedParams);
  }

  async function toAdScreen(targetInfos: TargetInfos) {
    const onTarget = isOnTarget(targetInfos);
    const multiplier = computeMultiplier(targetInfos?.elapsedMs ?? 0);
    const sharedParams = buildSharedParams({
      onTarget, imageFile: uri, pictureId, description,
      imageHeight, imageWidth, isPortrait, hiddenLocation,
      screenHeight, screenWidth, listId, isTutorial,
      category, language, scope,
    });
    if (!onTarget) {
      applyFailurePath(sharedParams);
      return;
    }
    await applySuccessPath(multiplier);
  };

  async function handleOverlayDone() {
    // R1 (§5.10): hide the success overlay FIRST so it never reads as a
    // "frozen" loading spinner. The advance state machine takes over the UI
    // (advancing/warming) while the next card resolves.
    setShowSuccess(false);
    dispatchAdvance({ type: 'WIN' });
    retryCountRef.current = 0;
    await runResolveCycle();
  }

  // Drives the advance state machine from a single resolve attempt. Called
  // initially by handleOverlayDone (state=advancing) and re-entered on each
  // scheduled retry tick (state=warming). Side effects (streak commit, score
  // buffer, ad cadence, setParams/navigation) fire ONLY on a successful
  // resolve — see onAdvanceResolved (PB6).
  async function runResolveCycle() {
    const { next, reason } = await resolveNextCardWithServerFallback({
      category, language, currentListId: listId, isTutorial, scope, authContext,
    });

    if (next) {
      await onAdvanceResolved(next);
      return;
    }

    if (reason === 'empty') {
      // Server genuinely has no cards for the language/scope — terminal.
      dispatchAdvance({ type: 'FAILED_PERMANENT' });
      return;
    }

    // reason === 'network' | 'server' — transient. FAILED_TRANSIENT is a no-op
    // when already in warming (reducer rejects it); legal only from advancing.
    dispatchAdvance({ type: 'FAILED_TRANSIENT' });
    scheduleRetry();
  }

  // PB6: streak + score commit lives here — only on a successfully resolved
  // next card. Pairs with the cadence rollback (no commit) on null advance.
  async function onAdvanceResolved(next: NonNullable<NextGuessResult>) {
    const { nextStreak, nextTier, finalPoints } = resolveCorrectGuessOutcome({ multiplier: successMultiplier, currentStreak: streak });
    onWin();
    await applySuccessSideEffects({ listId, categoryKey: category?.key, language, imageFile: uri, pictureId, scope, userId, points: finalPoints, multiplier: successMultiplier, streak: nextStreak, streakMultiplier: nextTier.multiplier });

    const { showAd, nextCount } = decideAdSlot({
      successesSinceLastAd, scope, authContext,
      isAndroid: Platform.OS === 'android',
      adSource,
    });
    setSuccessesSinceLastAd(nextCount);

    // PB1: when an ad is interjected, the state machine stays in `advancing`
    // and `advance.next` is NOT staged — the stashed params ride on the
    // AdScreen route instead, and the advanceAfterAd effect re-enters the
    // machine (WIN → RESOLVED) on the return merge. This keeps the idle-entry
    // setParams side-effect dormant during the ad interlude (test:
    // "ad due → setParams not called with next params").
    if (!showAd) {
      dispatchAdvance({ type: 'RESOLVED', next: next.params });
    }

    routeAfterOverlay({
      next, navigation, uri, pictureId, description,
      imageHeight, imageWidth, isPortrait, hiddenLocation,
      screenHeight, screenWidth, listId, isTutorial,
      category, language, scope, showAd,
    });
  }

  // Schedule the next warming retry. Exponential backoff 1s/2s/4s. After the
  // budget is consumed, the final RETRY_TICK transitions the reducer to
  // `exhausted` and we do not issue another resolve.
  function scheduleRetry() {
    retryCountRef.current += 1;
    const n = retryCountRef.current;
    const delay = RETRY_DELAYS_MS[n - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      dispatchAdvance({ type: 'RETRY_TICK' });
      if (n < DEFAULT_RETRY_BUDGET) {
        void runResolveCycle();
      }
    }, delay);
  }

  function handleExitToHome() {
    navigation.popToTop();
  }

  function handleSwitchCategory() {
    navigation.navigate('GuessPathScreen', isPrivate ? { scope } : {});
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
      // PB2: input gating — disable tap/drag confirmation while the advance
      // state machine is mid-cycle so toAdScreen cannot double-fire.
      disabled={advance.state !== 'idle'}
    />
    <SuccessOverlay visible={showSuccess} multiplier={successMultiplier} points={computePoints(successMultiplier, streakMultiplier)} streakTier={tier} onDone={handleOverlayDone} />
    {advance.state === 'warming' && (
      <GuessAdvanceLoader />
    )}
    {advance.state === 'exhausted' && (
      <GuessExhaustedPanel
        streak={streak}
        onLeave={handleExitToHome}
        onSwitch={handleSwitchCategory}
      />
    )}
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
