import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import { AppState, useWindowDimensions, View } from 'react-native';

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
import { isE2EMode } from '../../utils/e2eMode';
import { prefetchIfLow, warmAllDeckIfNeeded } from '../../services/cardPrefetcher';
import { getNextImagesForScope } from '../../utils/storageDatum';
import { computeMultiplier, SPEED_MULTIPLIER_BASE } from '../../utils/speedMultiplier';
import { computePoints } from '../../utils/guessPoints';
import { useAdvanceStateMachine } from '../../hooks/useAdvanceStateMachine';
import { useResolveLifecycle } from '../../hooks/useResolveLifecycle';
import { useAdCadence } from '../../hooks/useAdCadence';
import { useAdSource } from '../../hooks/useAdSource';
import { useStreak } from '../../hooks/useStreak';
import { resolveStreakTier } from '../../constants/streakTiers';
import { OverlayZIndex } from '../../constants/overlayZIndex';
import type { AdScope } from '../../utils/adCadence';
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
  } = useAdCadence({ scope, authContext, adSource });

  // C2 (ad-in-screen-overlay §4.4): in-component overlay state. adPhase gates
  // the conditional <AdInterstitial> render.
  const [adPhase, setAdPhase] = useState<'idle' | 'showing'>('idle');

  // §2.3 (2) + §2.4: resolve-lifecycle machinery (nextCardResolveRef,
  // pendingNextRef, runResolveCycle, onAdvanceResolved, scheduleRetry,
  // retryTimerRef, retryCountRef, mountedRef, handleAdDone) lives in the hook.
  // `multiplier` is threaded explicitly through runResolveCycle →
  // onAdvanceResolved → scheduleRetry → runResolveCycle so the success-time
  // value survives the retry loop with no parallel multiplier mirror ref.
  const {
    kickoffResolve,
    awaitResolve,
    consumePendingNext,
    handleAdDone,
    clearRetryTimer,
  } = useResolveLifecycle({
    dispatch,
    advanceStateRef,
    setAdPhase,
    currentStreak: streak,
    onWin,
    resolveArgs: {
      category,
      language,
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
        dispatch({ type: 'FAILED_PERMANENT' });
      }
    });
    return () => sub.remove();
  }, [dispatch, clearRetryTimer]);

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
    setShowSuccess(true);
    // C1 (§4.2): the WIN dispatch + resolve kickoff both fire at WIN time so
    // the ~2-3s SuccessOverlay window covers a Tier-1/Tier-2 fetch. The A7
    // guard in onAdvanceResolved requires advanceStateRef to read 'advancing'
    // before the in-flight resolve can commit side effects, so dispatch(WIN)
    // precedes the kickoff. handleOverlayDone awaits the in-flight resolve at
    // dismiss — usually already settled. The multiplier is threaded through
    // kickoffResolve so it survives the retry loop without a mirror ref.
    dispatch({ type: 'WIN' });
    kickoffResolve(multiplier);
  }

  function applyFailurePath(sharedParams: SharedParams) {
    onLose();
    resetSuccessesSinceLastAd();
    navigation.replace('ResultScreen', sharedParams);
  }

  async function toAdScreen(targetInfos: TargetInfos) {
    const onTarget = isOnTarget(targetInfos);
    const multiplier = computeMultiplier(targetInfos?.elapsedMs ?? 0);
    const sharedParams: SharedParams = {
      onTarget, imageFile: uri, pictureId, description,
      imageHeight, imageWidth, isPortrait, hiddenLocation,
      screenHeight, screenWidth, listId, isTutorial,
      category, language, scope,
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
    setShowSuccess(false);
    // C1 (§4.2): await the resolve kicked off in applySuccessPath. The
    // in-flight ref is always populated when handleOverlayDone fires
    // (showSuccess is only true after applySuccessPath); no fallback branch
    // per agent-defaults §2.2.
    await awaitResolve();
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
      const next = consumePendingNext();
      if (next) {
        dispatch({ type: 'RESOLVED', next: next.params });
      }
    }
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
    </PrivateGroupThemeProvider>
  );
};
