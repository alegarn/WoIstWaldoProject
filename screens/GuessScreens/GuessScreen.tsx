import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import { AppState, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AdInterstitial from '../../components/Ads/AdInterstitial';
import GuessExitSwipeMenu from '../../components/Guess/GuessExitSwipeMenu';
import GuessPicture from "../../components/Picture/GuessPicture";
import type { ToAdScreenArgs } from "../../components/Picture/GuessPicture";
import NextCardImageWarmer from '../../components/Picture/NextCardImageWarmer';
import SuccessOverlay from '../../components/Guess/SuccessOverlay';
import TutorialOverlayDefault from '../../components/UI/TutorialOverlay';
import GuessExhaustedPanel from '../../components/Guess/GuessExhaustedPanel';
import GuessAdvanceLoader from '../../components/Guess/GuessAdvanceLoader';
import { PrivateGroupThemeProvider, useScopedPrivateGroupTheme } from '../../store/privateGroupTheme-context';
import { AuthContext } from '../../store/auth-context';
import { isOnTarget } from "../../utils/targetLocation";
import { isWinningTrace } from '../../utils/shapeMatch';
import type { Point } from '../../utils/shapeGeometry';
import { isE2EMode } from '../../utils/e2eMode';
import { prefetchIfLow, warmAllDeckIfNeeded } from '../../services/cardPrefetcher';
import { getNextImagesForScope, clearExhaustedCategory } from '../../utils/storageDatum';
import { normalizeMode } from '../../utils/sessionFilter';
import { computeMultiplier, SPEED_MULTIPLIER_BASE, SHAPE_SPEED_BONUS_THRESHOLD_MS } from '../../utils/speedMultiplier';
import { computePoints, resolveCorrectGuessOutcome } from '../../utils/guessPoints';
import { bufferWinScore } from '../../utils/handleGuessOutcome';
import { flush } from '../../utils/sessionScoreStore';
import { useAdvanceStateMachine } from '../../hooks/useAdvanceStateMachine';
import { useResolveLifecycle } from '../../hooks/useResolveLifecycle';
import { useAdCadence } from '../../hooks/useAdCadence';
import { useAdSource } from '../../hooks/useAdSource';
import { useStreak } from '../../hooks/useStreak';
import { resolveStreakTier } from '../../constants/streakTiers';
import { OverlayZIndex } from '../../constants/overlayZIndex';
import type { AdScope } from '../../utils/adCadence';
import type { AdSource } from '../../services/ads/AdSource';
import type { ActiveGroupAdContext } from '../../services/billing/adPolicy';

type HiddenLocation = { x: number; y: number };
type GuessCategory = { id?: string; key?: string };
type ImageMode = 'point' | 'shape';
type ShapeOutline = Point[];

type GuessRouteParams = {
  imageFile?: string;
  pictureId?: string;
  description?: string;
  imageHeight?: number;
  imageWidth?: number;
  isPortrait?: boolean;
  hiddenLocation?: HiddenLocation;
  mode?: ImageMode;
  shape?: ShapeOutline | null;
  listId?: number;
  isTutorial?: boolean;
  category?: GuessCategory;
  language?: string;
  // Session filter mode (D8) — travels as filterMode, NEVER `mode`, which is
  // the CARD's mode. Absent → 'any' = today's unfiltered behavior.
  filterMode?: string;
  scope?: AdScope;
  activeGroup?: ActiveGroupAdContext | null;
  skipInstructions?: boolean;
};

type GuessNavigation = {
  setParams(params: Record<string, unknown>): void;
  setOptions(options: { headerStyle?: { backgroundColor?: string }; headerTintColor?: string }): void;
  navigate(name: 'GuessPathScreen', params?: Record<string, unknown>): void;
  replace(name: 'ResultScreen', params: Record<string, unknown>): void;
  popToTop(): void;
  reset(state: { index: number; routes: Array<{ name: string; params?: Record<string, unknown> }> }): void;
  addListener(event: 'beforeRemove', listener: () => void): () => void;
};

type SharedParams = {
  onTarget: boolean;
  imageFile?: string;
  pictureId?: string;
  description?: string;
  imageHeight?: number;
  imageWidth?: number;
  isPortrait?: boolean;
  hiddenLocation?: HiddenLocation;
  mode?: ImageMode;
  shape?: ShapeOutline | null;
  screenHeight: number;
  screenWidth: number;
  listId?: number;
  isTutorial?: boolean;
  category?: GuessCategory;
  language?: string;
  scope?: AdScope;
};

type GuessScreenProps = {
  navigation: GuessNavigation;
  route: { params: GuessRouteParams };
};

type TutorialOverlayComponent = FC<{
  screen?: string;
  isPortrait?: boolean;
}>;

// TutorialOverlay is a .tsx dep whose inferred prop signature is narrower than
// what this screen legitimately passes; cast to a local structural type that
// mirrors what the screen actually passes — behavior preserved. (Its own
// cleanup is out of scope for the shape-mode-cue plan.)
const TutorialOverlay = TutorialOverlayDefault as unknown as TutorialOverlayComponent;

export default function GuessScreen({ navigation, route }: GuessScreenProps) {

  const { imageFile, pictureId, description, imageHeight, imageWidth, isPortrait, hiddenLocation, mode, shape, listId, isTutorial, category, language, filterMode, scope, activeGroup, skipInstructions } = route.params;
  const sessionFilterMode = normalizeMode(filterMode);
  const isPrivate = scope?.kind === 'private';

  const [showSuccess, setShowSuccess] = useState(false);
  // Exit-menu open state is owned here (controlled GuessExitSwipeMenu). The
  // legacy menu detected the left-edge swipe itself in a separate higher-zIndex
  // subtree that intercepted touches in the left 36px and starved the target's
  // drag. Detection now lives in the picture subtree (ShowPicture's nested RNGH
  // surface detector); the surface fires `onEdgeSwipe` → flip this state.
  const [exitMenuOpen, setExitMenuOpen] = useState(false);
  // F4: synchronous mirror of `showSuccess` so useResolveLifecycle's no-ad
  // commit gate can read overlay visibility WITHOUT waiting for a passive
  // effect flush. Written synchronously by `applyShowSuccess` at every
  // setShowSuccess call site; the effect mirror below is belt-and-suspenders.
  const overlayVisibleRef = useRef(false);
  // F4 (CC2): single source of truth for `showSuccess` writes — writes
  // `overlayVisibleRef.current` SYNCHRONOUSLY before the state update so the
  // warming-retry commit gate in useResolveLifecycle never observes a stale
  // false-while-overlay-mounted. A passive effect mirror (below) catches any
  // call site that slips past this helper.
  const applyShowSuccess = (next: boolean) => {
    overlayVisibleRef.current = next;
    setShowSuccess(next);
  };
  const [successMultiplier, setSuccessMultiplier] = useState<number>(SPEED_MULTIPLIER_BASE);
  const { streak, tier, multiplier: streakMultiplier, onWin, onLose, reset } = useStreak();
  const { advance, dispatch, advanceStateRef } = useAdvanceStateMachine({
    navigation,
  });
  // Hints show on the first card of each game series (every fresh mount of
  // GuessScreen). Advancing to later cards uses setParams (no remount), so the
  // dismissed state persists for the rest of the series. Suppressed in e2e mode.
  const [hintsActive, setHintsActive] = useState<boolean>(!isE2EMode());
  const dismissHints = useCallback(() => setHintsActive(false), []);

  const authContext = useContext(AuthContext);
  const { userId } = authContext;

  const adSource = useAdSource();
  const {
    consumeAdSlot,
    resetSuccessesSinceLastAd,
  } = useAdCadence({ scope, activeGroup, authContext, adSource });

  // C2 (ad-in-screen-overlay §4.4): in-component overlay state. adPhase gates
  // the conditional <AdInterstitial> render.
  const [adPhase, setAdPhase] = useState<'idle' | 'showing'>('idle');

  // §2.3 (2) + §2.4: resolve-lifecycle machinery (nextCardResolveRef,
  // pendingNextRef, runResolveCycle, onAdvanceResolved, scheduleRetry,
  // retryTimerRef, retryCountRef, mountedRef, handleAdDone) lives in the hook.
  const {
    kickoffResolve,
    awaitResolve,
    consumePendingNext,
    consumeDeferredAd,
    handleAdDone,
    clearRetryTimer,
    clearPendingNext,
  } = useResolveLifecycle({
    dispatch,
    advanceStateRef,
    setAdPhase,
    onWin,
    overlayVisibleRef,
    resolveArgs: {
      category,
      language,
      filterMode: sessionFilterMode,
      currentListId: listId,
      currentPictureId: pictureId,
      isTutorial,
      scope,
      authContext,
    },
    sideEffectArgs: {
      listId,
      categoryKey: category?.key,
      language,
      filterMode: sessionFilterMode,
      imageFile,
      pictureId,
      scope,
      userId,
    },
    consumeAdSlot,
  });

  // PT6 cleanup ownership stays in GuessScreen: clear retry timers only when a
  // real mid-advance -> terminal/idle transition happens, not on every render.
  const previousAdvanceStateRef = useRef(advance.state);
  
  useEffect(() => {
    overlayVisibleRef.current = showSuccess;
  }, [showSuccess]);
  
  useEffect(() => {
    const previousState = previousAdvanceStateRef.current;
    previousAdvanceStateRef.current = advance.state;
    const wasMidAdvance = previousState === 'advancing' || previousState === 'warming';
    const isMidAdvance = advance.state === 'advancing' || advance.state === 'warming';
    if (wasMidAdvance && !isMidAdvance) {
      clearRetryTimer();
    }
  }, [advance.state, clearRetryTimer]);

  const { group, theme } = useScopedPrivateGroupTheme(scope);

  useEffect(() => {
    if (!theme) return;
    navigation.setOptions({
      headerStyle: { backgroundColor: theme.primaryColor },
      headerTintColor: theme.headerTintColor,
    });
  }, [navigation, theme?.primaryColor, theme?.headerTintColor]);

  // Eagerly warm the 'all' deck on entering a real-category streak so the
  // category→all fallback is instant when the category exhausts. Fire-and-forget;
  // the prefetcher dedupes + shares the in-flight promise across this and the
  // per-win prefetch. No-op for 'all' itself (no fallback needed) and in e2e.
  useEffect(() => {
    if (category?.key === 'all') return;
    warmAllDeckIfNeeded({
      language,
      mode: sessionFilterMode,
      scope,
      authContext,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only warm
  }, []);

  // PT2: AppState listener. Backgrounding from any mid-advance state
  // (advancing/warming) clears retry timers and forces `exhausted` so the
  // player lands on a deterministic state on foreground (timers don't survive
  // backgrounding reliably). `idle`/`exhausted` are left untouched.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState: string) => {
      if (nextAppState === 'active') return;
      const current = advanceStateRef.current;
      if (current !== 'idle' && current !== 'exhausted') {
        clearRetryTimer();
        // F4 nit: terminal transition dispatched outside the hook — also drop
        // any staged next so a staged-next-then-background orphan cannot leak.
        clearPendingNext();
        dispatch({ type: 'FAILED_PERMANENT' });
      }
    });
    return () => sub.remove();
  }, [dispatch, clearRetryTimer, clearPendingNext]);

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
      mode: sessionFilterMode,
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
    // PB2: exactly one win per advancing cycle. advanceStateRef is flipped
    // synchronously by dispatch(WIN) below, so a re-entrant confirm while the
    // advance is mid-flight returns here without re-banking or re-kicking.
    if (advanceStateRef.current !== 'idle') return;
    // B2: PUBLIC scope threads categoryKey only (bundled string keys, no
    // server UUID); PRIVATE scope keeps categoryId (UUID). Mirrors the
    // cardDeck.buildFeedFilters split.
    prefetchIfLow({
      categoryKey: category?.key || 'all',
      ...(isPrivate ? { categoryId: category?.id } : {}),
      language,
      mode: sessionFilterMode,
      scope,
      authContext,
      currentListId: listId,
    }).catch(() => {});
    setSuccessMultiplier(multiplier);
    applyShowSuccess(true);
    // C1 (§4.2): the WIN dispatch + resolve kickoff both fire at WIN time so
    // the ~2-3s SuccessOverlay window covers a Tier-1/Tier-2 fetch. The A7
    // guard in onAdvanceResolved requires advanceStateRef to read 'advancing'
    // before the in-flight resolve can commit side effects, so dispatch(WIN)
    // precedes the kickoff. handleOverlayDone awaits the in-flight resolve at
    // dismiss — usually already settled.
    dispatch({ type: 'WIN' });
    // WIN-CREDIT (bug-2 fix, reverses the old PB6/C1 no-advance-no-credit
    // rule): the win is buffered HERE, at win time — not in the advance flow.
    // A last/only card (the advance exhausts) or a leave mid-advance must
    // still reach the server via the exit/background flush. Same scoring
    // inputs as before (speed multiplier × post-increment streak tier).
    const { finalPoints, nextStreak, nextTier } = resolveCorrectGuessOutcome({ multiplier, currentStreak: streak });
    await bufferWinScore({
      pictureId,
      scope,
      userId,
      points: finalPoints,
      multiplier,
      streak: nextStreak,
      streakMultiplier: nextTier.multiplier,
    });
    kickoffResolve();
  }

  function applyFailurePath(sharedParams: SharedParams) {
    onLose();
    resetSuccessesSinceLastAd();
    navigation.replace('ResultScreen', sharedParams);
  }

  async function toAdScreen(args: ToAdScreenArgs) {
    // Shape branch (plan H5): hidden `shape` (storage, normalized [0,1]) vs the
    // guess outline drawn on the F surface, matched by isWinningTrace in IMAGE
    // space only (score ≥ 0.9 + length cap) — screen size never influences the
    // verdict. The speed bonus uses the 10s shape window. Point mode keeps
    // isOnTarget + the 5s window byte-identical.
    const isShapeMode = mode === 'shape';
    const onTarget = isShapeMode
      ? isWinningTrace({
          hiddenShape: shape ?? [],
          guessShape: args.shape ?? [],
          imageWidth: imageWidth ?? 0,
          imageHeight: imageHeight ?? 0,
        })
      : isOnTarget({
          ...args,
          // .js dep reads hiddenLocation as required; the point-mode path
          // always has it (GuessScreen forwards the route param).
          hiddenLocation: args.hiddenLocation!,
        });
    const multiplier = isShapeMode
      ? computeMultiplier(args?.elapsedMs ?? 0, SHAPE_SPEED_BONUS_THRESHOLD_MS)
      : computeMultiplier(args?.elapsedMs ?? 0);
    const sharedParams: SharedParams = {
      onTarget, imageFile: uri, pictureId, description,
      imageHeight, imageWidth, isPortrait, hiddenLocation,
      screenHeight, screenWidth, listId, isTutorial,
      category, language, scope,
      ...(isShapeMode ? { mode, shape } : {}),
    };
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
    applyShowSuccess(false);
    // C1 (§4.2): await the resolve kicked off in applySuccessPath. The
    // in-flight ref is always populated when handleOverlayDone fires
    // (showSuccess is only true after applySuccessPath); no fallback branch
    // per agent-defaults §2.2.
    await awaitResolve();
    // P2 / F1 (G1): after applyShowSuccess(false) + awaitResolve, three
    // branches reach here: (a) no-ad path dispatches RESOLVED here; (b)
    // deferred-ad path (overlay was still animating when resolve settled)
    // triggers setAdPhase('showing') here via consumeDeferredAd — pendingNext
    // was already staged on the hook, handleAdDone will commit RESOLVED on
    // dismiss; (c) non-deferred ad path (overlay-down fast path at resolve
    // time) already set adPhase='showing' inside onAdvanceResolved, so the
    // guard skips the dispatch here and leaves RESOLVED to handleAdDone.
    if (consumeDeferredAd()) {
      setAdPhase('showing');
      return;
    }
    if (adPhase !== 'showing') {
      const next = consumePendingNext();
      if (next) {
        dispatch({ type: 'RESOLVED', next: next.params });
      }
    }
  }

  function handleExitToHome() {
    // Direct exit flush (ShowFailure mount-flush form): guarantees a
    // just-banked win reaches the server on this exit, even when this screen
    // is not the one owning the beforeRemove listener (popToTop unwinds the
    // feed's useFlushOnLeave too — flush() dedupes concurrent triggers).
    void flush({ authContext });
    if (isPrivate) {
      // v6-compatible equivalent of v7's popTo('PrivateHomeScreen').
      // Mirrors the reset-to-private-home pattern used by ResultChoices.js and
      // guessNavigation.js. Carries `scope` so PrivateHomeScreen shows the
      // correct group, and pops GuessFeedScreen/GuessPathScreen/GuessScreen —
      // their beforeRemove listeners (useFlushOnLeave) flush unsent batches.
      navigation.reset({
        index: 1,
        routes: [
          { name: 'HomeScreen' },
          { name: 'PrivateHomeScreen', params: { scope } },
        ],
      });
      return;
    }
    navigation.popToTop();
  }

  function handleSwitchCategory() {
    // Same direct exit flush as handleExitToHome: the switch leaves the game
    // without unwinding a screen that owns a beforeRemove flush, so the
    // just-banked win must be sent here.
    void flush({ authContext });
    // F3a invalidation (E1): clear the exhausted-cache entry for the CURRENT
    // category+scope so re-entering re-queries the server (handles newly
    // uploaded images since the category was marked empty). Fire-and-forget —
    // navigation proceeds without waiting; the next mount re-queries fresh.
    clearExhaustedCategory(category?.key, language, scope, sessionFilterMode).catch(() => {});
    navigation.navigate('GuessPathScreen', isPrivate ? { scope } : {});
  }


  return(
    <PrivateGroupThemeProvider group={group}>
    {/* RNGH root scoped to the guess screen subtree so it hosts the nested
        GestureDetectors in ShowPicture (target drag + surface edge/handle
        swipes) WITHOUT wrapping the app/navigators — an app-wide wrap broke
        HomeScreen header touches. */}
    <GestureHandlerRootView style={{ flex: 1 }}>
    <>
    <GuessExitSwipeMenu
      isOpen={exitMenuOpen}
      onClose={() => setExitMenuOpen(false)}
      onHome={handleExitToHome}
      showHints={hintsActive}
      onInteract={dismissHints}
    />
    <GuessPicture
      // PB-key-collision: keying on listId alone collides when Tier 2
      // foreground-fetches a new card whose normalizeListIds-assigned listId
      // happens to equal the just-played card's listId (post-removal deck's
      // max is below the cursor, so the assigner starts fresh from 1 — and the
      // played card's listId was also 1). The collision silently skipped
      // remount, leaving useTargetDrag's userInteractedRef=true blocking the
      // target reset on the new card → target rendered at the old dragged
      // position (or off-screen). pictureId is server-unique per card; for
      // pictureId-less cards, folding in imageFile keeps two distinct cards
      // on the same listId key-distinct (fallback layer for the in-place
      // card-swap reveal/drag resets upstream).
      key={pictureId ?? `${listId}-${imageFile ?? ''}`}
      navigation={navigation}
      // only in dev with local images, but imageFile in Prod
      imageFile={uri}
      pictureId={pictureId}
      description={description}
      imageIsPortrait={isPortrait}
      imageHeight={imageHeight}
      imageWidth={imageWidth}
      hiddenLocation={hiddenLocation}
      mode={mode}
      shape={shape}
      // Raw route value — GuessPicture owns normalization (cue gating).
      filterMode={filterMode}
      screenDimensions={screenDimensions}
      toAdScreen={toAdScreen}
      skipInstructions={skipInstructions}
      pulseTarget={hintsActive}
      onInteract={dismissHints}
      // PB2: input gating — disable tap/drag confirmation while the advance
      // state machine is mid-cycle so toAdScreen cannot double-fire.
      disabled={advance.state !== 'idle'}
      onEdgeSwipe={() => setExitMenuOpen(true)}
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
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: OverlayZIndex.AD_INTERSTITIAL }}>
        <AdInterstitial adSource={adSource} onDone={handleAdDone} />
      </View>
    )}
    {(advance.state === 'warming' || (advance.state === 'advancing' && !showSuccess)) && (
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
    </GestureHandlerRootView>
    </PrivateGroupThemeProvider>
  );
};
