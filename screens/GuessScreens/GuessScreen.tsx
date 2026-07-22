import { useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import type { FC } from 'react';
import { AppState, Platform, useWindowDimensions, View } from 'react-native';

import AdInterstitial from '../../components/Ads/AdInterstitial';
import GuessExitSwipeMenu from '../../components/Guess/GuessExitSwipeMenu';
import GuessPictureDefault from "../../components/Picture/GuessPicture";
import NextCardImageWarmer from '../../components/Picture/NextCardImageWarmer';
import SuccessOverlay from '../../components/Guess/SuccessOverlay';
import TutorialOverlayDefault from '../../components/UI/TutorialOverlay';
import GuessExhaustedPanel from '../../components/Guess/GuessExhaustedPanel';
import GuessAdvanceLoader from '../../components/Guess/GuessAdvanceLoader';
import { PrivateGroupThemeProvider, useScopedPrivateGroupTheme } from '../../store/privateGroupTheme-context';
import { AuthContext } from '../../store/auth-context';
import { isOnTarget } from "../../utils/targetLocation";
import { applySuccessSideEffects } from '../../utils/handleGuessOutcome';
import { resolveNextCardWithServerFallback } from '../../utils/nextCardAdvancer';
import { advanceReducer, initialAdvance, DEFAULT_RETRY_BUDGET } from '../../utils/advanceState';
import type { AdvanceEvent, AdvanceSnapshot, AdvanceState } from '../../utils/advanceState';
import { isE2EMode } from '../../utils/e2eMode';
import { prefetchIfLow, warmAllDeckIfNeeded } from '../../services/cardPrefetcher';
import { getNextImagesForScope } from '../../utils/storageDatum';
import { computeMultiplier, SPEED_MULTIPLIER_BASE } from '../../utils/speedMultiplier';
import { useAdSource } from '../../hooks/useAdSource';
import { useStreak } from '../../hooks/useStreak';
import { resolveStreakTier } from '../../constants/streakTiers';
import { consumeAdSlot } from '../../utils/adCadence';
import type { AdScope } from '../../utils/adCadence';
import { shouldSuppressAds } from '../../services/billing/entitlements';
import type { AuthContextLike } from '../../services/billing/entitlements';
import type { AdSource } from '../../services/ads/AdSource';

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
};

type GuessNavigation = {
  setParams(params: Record<string, unknown>): void;
  setOptions(options: { headerStyle?: { backgroundColor?: string }; headerTintColor?: string }): void;
  navigate(name: 'GuessPathScreen', params?: Record<string, unknown>): void;
  replace(name: 'ResultScreen', params: Record<string, unknown>): void;
  popToTop(): void;
  addListener(event: 'beforeRemove', listener: () => void): () => void;
};

type NextGuessResult = { params: Record<string, unknown> } | null | undefined;

function computePoints(speedMultiplier: number, streakMultiplier: number): number {
  return Math.round(speedMultiplier * streakMultiplier);
}

// Exponential retry cadence for the `warming` state (§5.3 + §8 risk row).
// 3 attempts total, 1s/2s/4s. After the budget is consumed the reducer
// transitions to `exhausted` via the final RETRY_TICK (no further resolve).
const RETRY_DELAYS_MS = [1000, 2000, 4000];

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
  // C1: mirror successMultiplier into a ref so the in-flight resolve kicked off
  // inside the same render as setSuccessMultiplier reads the FRESH value. The
  // state update is batched + committed on the next tick, but runResolveCycle
  // captures the closure now — without the ref, onAdvanceResolved would score
  // the win with the previous-tap multiplier.
  const successMultiplierRef = useRef<number>(SPEED_MULTIPLIER_BASE);
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
  // C1 (ad-in-screen-overlay §4.2): holds the in-flight next-card resolve
  // Promise kicked off in applySuccessPath so handleOverlayDone can await it
  // instead of re-entering the cascade at dismiss. Discarded on unmount (PT6
  // cleanup) so a swipe-home during the overlay never lands a setState-after-
  // unmount when the trailing resolve settles.
  const nextCardResolveRef = useRef<Promise<void> | null>(null);
  // CONCERN #1 (post-implementation verification pass): PT6 cleanup nulls
  // nextCardResolveRef but cannot cancel the in-flight runResolveCycle()
  // Promise. When it settles post-unmount, onAdvanceResolved would fire
  // applySuccessSideEffects → bufferScore (AsyncStorage) + removeImageFromList
  // (deck mutation) + deleteImageFromStorage (file delete). User decision:
  // ABORT the win-credit on swipe-home. Flipped to false in the PT6 cleanup
  // below; checked at the top of onAdvanceResolved.
  const mountedRef = useRef(true);
  // Snapshot ref used by `dispatch` to compute the next state synchronously.
  // useEffect([advance.state]) updates advanceStateRef AFTER commit, but an
  // awaited async chain (e.g. runResolveCycle → onAdvanceResolved) continues
  // on the microtask queue before passive effects run, leaving the ref stale.
  // dispatch updates both refs synchronously so the A7 guard inside
  // onAdvanceResolved and the AppState listener see the post-event state
  // immediately. The useEffect below is defense-in-depth (re-syncs from the
  // committed advance in case the optimistic update diverged).
  const advanceSnapRef = useRef<AdvanceSnapshot>(advance);
  const dispatch = useCallback((event: AdvanceEvent) => {
    const next = advanceReducer(advanceSnapRef.current, event);
    advanceSnapRef.current = next;
    advanceStateRef.current = next.state;
    dispatchAdvance(event);
  }, [dispatchAdvance]);
  useEffect(() => {
    advanceSnapRef.current = advance;
    advanceStateRef.current = advance.state;
  }, [advance]);
  // Hints show on the first card of each game series (every fresh mount of
  // GuessScreen). Advancing to later cards uses setParams (no remount), so the
  // dismissed state persists for the rest of the series. Suppressed in e2e mode.
  const [hintsActive, setHintsActive] = useState<boolean>(!isE2EMode());
  const dismissHints = useCallback(() => setHintsActive(false), []);

  const authContext = useContext(AuthContext);
  const { userId } = authContext;

  const [successesSinceLastAd, setSuccessesSinceLastAd] = useState(0);
  const adSource = useAdSource();

  // C2 (ad-in-screen-overlay §4.4): in-component overlay state. adPhase gates
  // the conditional <AdInterstitial> render. pendingNextRef holds the resolved
  // next card so the post-ad RESOLVED dispatch can fire from handleAdDone —
  // the advance state machine stays in `advancing` during the ad (no premature
  // setParams), then lands in `idle` on dismiss.
  const [adPhase, setAdPhase] = useState<'idle' | 'showing'>('idle');
  const pendingNextRef = useRef<NonNullable<NextGuessResult> | null>(null);

  const { group, theme } = useScopedPrivateGroupTheme(scope);

  useEffect(() => {
    if (!theme) return;
    navigation.setOptions({
      headerStyle: { backgroundColor: theme.primaryColor },
      headerTintColor: theme.headerTintColor,
    });
  }, [navigation, theme?.primaryColor, theme?.headerTintColor]);

  // PB1: the advance reducer is the single source of truth for advance. The reducer
  // itself is pure (no navigation); this idle-entry side-effect consumes a staged
  // `advance.next` via setParams whenever the machine lands in `idle` with a non-null
  // payload. Identity-tracked (single-apply-per-resolve latch) so a re-dispatch with
  // the same `next` reference (e.g. test mocks returning a shared object, or any
  // future code path that re-stages without a new reference) does not double-apply
  // setParams. The latch's premise is now the in-overlay RESOLVED dispatch — the
  // AdScreen round-trip is gone, but the single-apply invariant still holds.
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
  // unmount (Leave tap during warming, navigation.popToTop, etc.). C1: also
  // discard the in-flight next-card resolve ref so a swipe-home during the
  // SuccessOverlay does not land a setState-after-unmount when the trailing
  // resolve settles.
  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      nextCardResolveRef.current = null;
      mountedRef.current = false;
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
        dispatch({ type: 'FAILED_PERMANENT' });
      }
    });
    return () => sub.remove();
  }, [dispatch]);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const uri = imageFile;

  const screenDimensions = { width: screenWidth, height: screenHeight };

  // P3 (D1): deck-ahead URI window for NextCardImageWarmer. The local deck is
  // already prefetched (server metadata + base64 file write to Paths.cache),
  // but RN has NOT decoded those bitmaps until <ImageBackground> mounts with
  // the URI at advance time. Reading the next N imageFile URIs here and
  // handing them to the off-screen warmer forces RN to decode them into the
  // in-memory image cache during the SuccessOverlay animation / ad display,
  // so the advance swap shows a warm bitmap (no blank frame).
  //
  // Re-runs only when the cursor (listId) or the deck identity (category,
  // language, scope) changes — exactly when the deck-ahead window slides.
  // Errors are swallowed: a failed read just means no warming this round
  // (the on-screen <ImageBackground> cold-decodes as before; no regression).
  const [nextCardUris, setNextCardUris] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    getNextImagesForScope({
      category,
      language,
      currentListId: listId,
      scope,
      limit: 7,
    })
      .then((cards) => {
        if (cancelled) return;
        const uris = (Array.isArray(cards) ? cards : [])
          .map((card) => card?.imageFile)
          .filter((u): u is string => typeof u === 'string' && u.length > 0)
          .slice(0, 7);
        setNextCardUris(uris);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deck-ahead window only depends on cursor + deck identity
  }, [listId, category?.key, category?.id, language, scope]);

  async function applySuccessPath(multiplier: number) {
    // PB6: streak + score commit deferred to RESOLVED side-effect in
    // onAdvanceResolved — a tap that fails to advance must not credit the
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
    successMultiplierRef.current = multiplier;
    setShowSuccess(true);
    // C1 (§4.2): the WIN dispatch + resolve kickoff both fire at WIN time so
    // the ~2-3s SuccessOverlay window covers a Tier-1/Tier-2 fetch. The A7
    // guard in onAdvanceResolved requires advanceStateRef to read 'advancing'
    // before the in-flight resolve can commit side effects, so dispatch(WIN)
    // precedes the kickoff. handleOverlayDone awaits nextCardResolveRef.current
    // at dismiss — usually already settled.
    dispatch({ type: 'WIN' });
    retryCountRef.current = 0;
    nextCardResolveRef.current = runResolveCycle();
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
    // C1 (§4.2): await the resolve kicked off in applySuccessPath. The ref is
    // always populated when handleOverlayDone fires (showSuccess is only true
    // after applySuccessPath); no fallback branch per agent-defaults §2.2.
    await nextCardResolveRef.current;
    // P2: in the no-ad path, RESOLVED is dispatched HERE (after the overlay
    // animation completes) instead of inside onAdvanceResolved so the next
    // card's imageFile URI does not land in route.params WHILE the overlay is
    // still animating its fade-out (which would flash the next image behind
    // the semi-transparent overlay). The ad path sets adPhase='showing' before
    // this point, so the guard skips the dispatch here and leaves it to
    // handleAdDone (sole dispatch site for the ad path). handleOverlayDone is
    // not memoized (re-created every render) and SuccessOverlay reads onDone
    // through an internal ref kept fresh on every parent render, so the
    // adPhase read sees the latest committed value — no stale-closure risk.
    if (adPhase !== 'showing') {
      const next = pendingNextRef.current;
      pendingNextRef.current = null;
      if (next) {
        dispatch({ type: 'RESOLVED', next: next.params });
      }
    }
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

    // P1 (ad-overlay post-fix §1 C1): treat reason='empty' the same as
    // reason='network'|'server' — all non-ok reasons are transient. The
    // cascade's Tier 4 looping-replay almost always recovers on retry (the
    // server doesn't delete played cards); the safety-net panel only mounts
    // after 3 failed retries (state='exhausted'). Never interrupt the streak
    // on a single empty cascade.
    // FAILED_TRANSIENT is a no-op when already in warming (reducer rejects it);
    // legal only from advancing.
    dispatch({ type: 'FAILED_TRANSIENT' });
    scheduleRetry();
  }

  // PB6: streak + score commit lives here — only on a successfully resolved
  // next card. Pairs with the cadence rollback (no commit) on null advance.
  async function onAdvanceResolved(next: NonNullable<NextGuessResult>) {
    // A7 (Phase 2 review): the in-flight resolve may complete AFTER AppState
    // backgrounding forced FAILED_PERMANENT → `exhausted`. Without this guard,
    // onWin / applySuccessSideEffects / decideAdSlot / setAdPhase would all
    // fire on stale state (the reducer correctly rejects the trailing RESOLVED,
    // but the side effects have already happened). Mirror advance.state via
    // advanceStateRef and bail before any side effect. Both 'advancing'
    // (initial resolve) and 'warming' (retry recovery) are valid resolving
    // states — the reducer accepts RESOLVED from either.
    if (advanceStateRef.current !== 'advancing' && advanceStateRef.current !== 'warming') return;
    // mountedRef guard: a swipe-home during SuccessOverlay nulls nextCardResolveRef
    // but does NOT cancel the in-flight Promise. applySuccessSideEffects mutates
    // AsyncStorage + the local deck + the filesystem — those must NOT fire post-unmount.
    if (!mountedRef.current) return;
    const { nextStreak, nextTier, finalPoints } = resolveCorrectGuessOutcome({ multiplier: successMultiplierRef.current, currentStreak: streak });
    onWin();
    await applySuccessSideEffects({ listId, categoryKey: category?.key, language, imageFile: uri, pictureId, scope, userId, points: finalPoints, multiplier: successMultiplierRef.current, streak: nextStreak, streakMultiplier: nextTier.multiplier });

    const { showAd, nextCount } = decideAdSlot({
      successesSinceLastAd, scope, authContext,
      isAndroid: Platform.OS === 'android',
      adSource,
    });
    setSuccessesSinceLastAd(nextCount);

    // P2: when no ad is due, RESOLVED is NOT dispatched here in the INITIAL
    // resolve (state=advancing) — the resolved next is staged on
    // pendingNextRef and the dispatch is deferred to handleOverlayDone
    // (mirrors the ad-path defer to handleAdDone) so the next image's
    // imageFile URI does not land in route.params while the SuccessOverlay is
    // still animating. The ad branch below stages on the same ref + flips
    // adPhase → 'showing'; RESOLVED fires from handleAdDone after the ad
    // dismisses. handleOverlayDone's `adPhase !== 'showing'` guard keeps the
    // two paths mutually exclusive (no double dispatch).
    //
    // WARMING EXCEPTION: when state=warming, the resolve that fired this
    // onAdvanceResolved came from scheduleRetry's fire-and-forget
    // runResolveCycle() (NOT the promise stored in nextCardResolveRef). By
    // this point handleOverlayDone has already returned (its await on the
    // original nextCardResolveRef completed when the first runResolveCycle
    // returned null+network and dispatched FAILED_TRANSIENT). No later
    // callback exists to commit a staged next, so we dispatch immediately to
    // preserve the "RESOLVED exactly once per win cycle" invariant. The A7
    // guard above already admitted state=warming as a valid resolving state.
    if (!showAd) {
      if (advanceStateRef.current === 'advancing') {
        pendingNextRef.current = next;
        return;
      }
      dispatch({ type: 'RESOLVED', next: next.params });
      return;
    }

    // C2 (ad-in-screen-overlay §3.2 step 3-5): showAd branch renders the
    // in-component overlay. Stage the resolved next on the ref + flip
    // adPhase → 'showing'. RESOLVED is deferred to handleAdDone so the
    // reducer lands in `idle` only after the ad dismisses.
    pendingNextRef.current = next;
    setAdPhase('showing');
  }

  // C2: fires from AdInterstitial's onDone (post-ad). Hides the overlay +
  // dispatches RESOLVED with the staged next so the idle-entry side-effect
  // consumes setParams(advance.next). useCallback keeps the onDone ref
  // stable across re-renders so AdInterstitial's effect deps don't churn.
  const handleAdDone = useCallback(() => {
    const next = pendingNextRef.current;
    pendingNextRef.current = null;
    setAdPhase('idle');
    if (next) {
      dispatch({ type: 'RESOLVED', next: next.params });
    }
  }, [dispatch]);

  // Schedule the next warming retry. Exponential backoff 1s/2s/4s. After the
  // budget is consumed, the final RETRY_TICK transitions the reducer to
  // `exhausted` and we do not issue another resolve.
  function scheduleRetry() {
    retryCountRef.current += 1;
    const n = retryCountRef.current;
    const delay = RETRY_DELAYS_MS[n - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      dispatch({ type: 'RETRY_TICK' });
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
      // PB-key-collision: keying on listId alone collides when Tier 2
      // foreground-fetches a new card whose normalizeListIds-assigned listId
      // happens to equal the just-played card's listId (post-removal deck's
      // max is below the cursor, so the assigner starts fresh from 1 — and the
      // played card's listId was also 1). The collision silently skipped
      // remount, leaving useTargetDrag's userInteractedRef=true blocking the
      // target reset on the new card → target rendered at the old dragged
      // position (or off-screen). pictureId is server-unique per card; fall
      // back to listId only if it is ever absent.
      key={pictureId ?? listId}
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
    {/*
      P3 (D1): off-screen hidden <Image> mounts that force RN to decode the
      next N deck bitmaps into the in-memory image cache BEFORE the advance
      swap. Rendered unconditionally (not gated on adPhase/showSuccess) so
      decode happens during the SuccessOverlay animation AND during the ad
      display. Self-contained: renders null when uris=[] and uses absolute
      positioning internally so it never affects layout.
    */}
    <NextCardImageWarmer uris={nextCardUris} />
    <SuccessOverlay visible={showSuccess} multiplier={successMultiplier} points={computePoints(successMultiplier, streakMultiplier)} streakTier={tier} onDone={handleOverlayDone} />
    {adPhase === 'showing' && (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }}>
        <AdInterstitial adSource={adSource} onDone={handleAdDone} />
      </View>
    )}
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
