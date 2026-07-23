import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { applySuccessSideEffects } from '../utils/handleGuessOutcome';
import { resolveNextCardWithServerFallback } from '../utils/nextCardAdvancer';
import type { NextGuessResult } from '../utils/nextCardAdvancer';
import { DEFAULT_RETRY_BUDGET } from '../utils/advanceState';
import type { AdvanceEvent, AdvanceState } from '../utils/advanceState';
import type { AdScope, ConsumeAdSlotResult } from '../utils/adCadence';
import { resolveCorrectGuessOutcome } from '../utils/guessPoints';
import type { AuthContextLike } from '../services/billing/entitlements';

// Exponential retry cadence for the `warming` state (§5.3 + §8 risk row).
// 3 attempts total, 1s/2s/4s. After the budget is consumed the reducer
// transitions to `exhausted` via the final RETRY_TICK (no further resolve).
const RETRY_DELAYS_MS = [1000, 2000, 4000];

type GuessCategory = { id?: string; key?: string };

type ResolveArgs = {
  category?: GuessCategory;
  language?: string;
  currentListId?: number;
  currentPictureId?: string;
  isTutorial?: boolean;
  scope?: AdScope;
  authContext: AuthContextLike;
};

type SideEffectArgs = {
  listId?: number;
  categoryKey?: string;
  language?: string;
  imageFile?: string;
  pictureId?: string;
  scope?: AdScope;
  userId: string;
};

type AdPhase = 'idle' | 'showing';

export type UseResolveLifecycleArgs = {
  dispatch: (event: AdvanceEvent) => void;
  advanceStateRef: RefObject<AdvanceState>;
  setAdPhase: (phase: AdPhase) => void;
  currentStreak: number;
  onWin: () => void;
  resolveArgs: ResolveArgs;
  sideEffectArgs: SideEffectArgs;
  // Cadence state stays owned by useAdCadence; the lifecycle only asks it to
  // consume the current slot after success side effects commit.
  consumeAdSlot: () => ConsumeAdSlotResult;
};

export type UseResolveLifecycleResult = {
  kickoffResolve: (multiplier: number) => void;
  awaitResolve: () => Promise<void>;
  consumePendingNext: () => NonNullable<NextGuessResult> | null;
  handleAdDone: () => void;
  clearRetryTimer: () => void;
};

// Owns the resolve-lifecycle machinery: the in-flight next-card Promise ref,
// the staged pending-next ref consumed by both ad/non-ad RESOLVED dispatch
// paths, the warming-retry timer + count, and the mountedRef abort guard.
// `multiplier` is threaded explicitly through runResolveCycle → onAdvanceResolved
// → scheduleRetry → runResolveCycle so the success-time value survives the
// retry loop without a parallel multiplier mirror ref (§2.4 option c).
export function useResolveLifecycle({
  dispatch,
  advanceStateRef,
  setAdPhase,
  currentStreak,
  onWin,
  resolveArgs,
  sideEffectArgs,
  consumeAdSlot,
}: UseResolveLifecycleArgs): UseResolveLifecycleResult {
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef<number>(0);
  // Holds the in-flight next-card resolve Promise kicked off in
  // applySuccessPath so handleOverlayDone can await it instead of re-entering
  // the cascade at dismiss. Discarded on unmount so a swipe-home during the
  // overlay never lands a setState-after-unmount when the trailing resolve
  // settles.
  const nextCardResolveRef = useRef<Promise<void> | null>(null);
  // CONCERN #1 (post-implementation verification pass): PT6 cleanup nulls
  // nextCardResolveRef but cannot cancel the in-flight runResolveCycle()
  // Promise. When it settles post-unmount, onAdvanceResolved would fire
  // applySuccessSideEffects → bufferScore (AsyncStorage) + removeImageFromList
  // (deck mutation) + deleteImageFromStorage (file delete). User decision:
  // ABORT the win-credit on swipe-home. Flipped to false in the PT6 cleanup
  // below; checked at the top of onAdvanceResolved.
  const mountedRef = useRef(true);
  // C2 (ad-in-screen-overlay §4.4): holds the resolved next card so the
  // post-ad RESOLVED dispatch can fire from handleAdDone — the advance state
  // machine stays in `advancing` during the ad (no premature setParams), then
  // lands in `idle` on dismiss. The same ref is borrowed by the non-ad path's
  // deferred RESOLVED (staged in onAdvanceResolved, consumed by
  // handleOverlayDone via consumePendingNext).
  const pendingNextRef = useRef<NonNullable<NextGuessResult> | null>(null);

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

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // Drives the advance state machine from a single resolve attempt. Called
  // initially by handleOverlayDone (state=advancing) and re-entered on each
  // scheduled retry tick (state=warming). Side effects (streak commit, score
  // buffer, ad cadence, setParams/navigation) fire ONLY on a successful
  // resolve — see onAdvanceResolved (PB6). `multiplier` is threaded in (not
  // read from a ref) so the retry-loop recovery credits the success-time
  // multiplier even if state has since moved on.
  async function runResolveCycle(multiplier: number) {
    const { next } = await resolveNextCardWithServerFallback({
      category: resolveArgs.category,
      language: resolveArgs.language,
      currentListId: resolveArgs.currentListId,
      currentPictureId: resolveArgs.currentPictureId,
      isTutorial: resolveArgs.isTutorial,
      scope: resolveArgs.scope,
      authContext: resolveArgs.authContext,
    });

    if (next) {
      await onAdvanceResolved(next, multiplier);
      return;
    }

    // P1 (ad-overlay post-fix §1 C1): all non-ok reasons are transient.
    // FAILED_TRANSIENT is a no-op when already in warming (reducer rejects it);
    // legal only from advancing.
    dispatch({ type: 'FAILED_TRANSIENT' });
    scheduleRetry(multiplier);
  }

  // PB6: streak + score commit lives here — only on a successfully resolved
  // next card. Pairs with the cadence rollback (no commit) on null advance.
  async function onAdvanceResolved(next: NonNullable<NextGuessResult>, multiplier: number) {
    // A7 (Phase 2 review): the in-flight resolve may complete AFTER AppState
    // backgrounding forced FAILED_PERMANENT → `exhausted`. Without this guard,
    // onWin / applySuccessSideEffects / decideAdSlot / setAdPhase would all
    // fire on stale state. Bail before any side effect. Both 'advancing'
    // (initial resolve) and 'warming' (retry recovery) are valid resolving
    // states — the reducer accepts RESOLVED from either.
    if (advanceStateRef.current !== 'advancing' && advanceStateRef.current !== 'warming') return;
    // mountedRef guard: a swipe-home during SuccessOverlay nulls nextCardResolveRef
    // but does NOT cancel the in-flight Promise. applySuccessSideEffects mutates
    // AsyncStorage + the local deck + the filesystem — those must NOT fire post-unmount.
    if (!mountedRef.current) return;
    const { nextStreak, nextTier, finalPoints } = resolveCorrectGuessOutcome({ multiplier, currentStreak });
    onWin();
    await applySuccessSideEffects({
      listId: sideEffectArgs.listId,
      categoryKey: sideEffectArgs.categoryKey,
      language: sideEffectArgs.language,
      imageFile: sideEffectArgs.imageFile,
      pictureId: sideEffectArgs.pictureId,
      scope: sideEffectArgs.scope,
      userId: sideEffectArgs.userId,
      points: finalPoints,
      multiplier,
      streak: nextStreak,
      streakMultiplier: nextTier.multiplier,
    });

    // Unmount can happen while the persistent side effects await. Bail before
    // cadence/state updates so no ad/UI state mutates after teardown.
    if (!mountedRef.current) return;

    const { showAd } = consumeAdSlot();

    // P2: when no ad is due, RESOLVED is NOT dispatched here in the INITIAL
    // resolve (state=advancing) — the resolved next is staged on
    // pendingNextRef and the dispatch is deferred to handleOverlayDone
    // (mirrors the ad-path defer to handleAdDone) so the next image's
    // imageFile URI does not land in route.params while the SuccessOverlay is
    // still animating. The ad branch below stages on the same ref + flips
    // adPhase → 'showing'; RESOLVED fires from handleAdDone after the ad
    // dismisses.
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

  // Schedule the next warming retry. Exponential backoff 1s/2s/4s. After the
  // budget is consumed, the final RETRY_TICK transitions the reducer to
  // `exhausted` and we do not issue another resolve. `multiplier` is carried
  // through to the retried runResolveCycle so the success-time value is used
  // at recovery time (§2.4 option c — explicit arg, no mirror ref).
  function scheduleRetry(multiplier: number) {
    retryCountRef.current += 1;
    const n = retryCountRef.current;
    const delay = RETRY_DELAYS_MS[n - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      dispatch({ type: 'RETRY_TICK' });
      if (n < DEFAULT_RETRY_BUDGET) {
        void runResolveCycle(multiplier);
      }
    }, delay);
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
  }, [dispatch, setAdPhase]);

  const kickoffResolve = (multiplier: number) => {
    retryCountRef.current = 0;
    nextCardResolveRef.current = runResolveCycle(multiplier);
  };

  const awaitResolve = async () => {
    await nextCardResolveRef.current;
  };

  const consumePendingNext = () => {
    const next = pendingNextRef.current;
    pendingNextRef.current = null;
    return next;
  };

  return {
    kickoffResolve,
    awaitResolve,
    consumePendingNext,
    handleAdDone,
    clearRetryTimer,
  };
}
