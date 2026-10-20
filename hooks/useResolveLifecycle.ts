import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { applySuccessSideEffects } from '../utils/handleGuessOutcome';
import { resolveNextCardWithServerFallback } from '../utils/nextCardAdvancer';
import type { NextGuessResult } from '../utils/nextCardAdvancer';
import { DEFAULT_RETRY_BUDGET } from '../utils/advanceState';
import type { AdvanceEvent, AdvanceState } from '../utils/advanceState';
import type { AdScope, ConsumeAdSlotResult } from '../utils/adCadence';
import type { AuthContextLike } from '../services/billing/entitlements';

// Exponential retry cadence for the `warming` state (§5.3 + §8 risk row).
// 3 attempts total, 1s/2s/4s. After the budget is consumed the reducer
// transitions to `exhausted` via the final RETRY_TICK (no further resolve).
const RETRY_DELAYS_MS = [1000, 2000, 4000];

type GuessCategory = { id?: string; key?: string };

type ResolveArgs = {
  category?: GuessCategory;
  language?: string;
  // Session filter mode (D8) — NEVER named `mode`, which is the card's mode.
  filterMode?: string;
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
  // Session filter mode (D8) — keys the played-card deck removal namespace.
  filterMode?: string;
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
  onWin: () => void;
  resolveArgs: ResolveArgs;
  sideEffectArgs: SideEffectArgs;
  // Cadence state stays owned by useAdCadence; the lifecycle only asks it to
  // consume the current slot after success side effects commit.
  consumeAdSlot: () => ConsumeAdSlotResult;
  // F4: mirrors `showSuccess` from GuessScreen as a synchronous ref so the
  // warming-retry commit gate can read overlay visibility WITHOUT waiting for
  // a passive effect flush. Writer lives in GuessScreen (`applyShowSuccess`);
  // a useEffect([showSuccess]) mirror is kept there as belt-and-suspenders.
  overlayVisibleRef: RefObject<boolean>;
};

export type UseResolveLifecycleResult = {
  kickoffResolve: () => void;
  awaitResolve: () => Promise<void>;
  consumePendingNext: () => NonNullable<NextGuessResult> | null;
  handleAdDone: () => void;
  clearRetryTimer: () => void;
  clearPendingNext: () => void;
  /**
   * F1 (G1): single-read-and-reset of the deferred-ad flag. Returns true when
   * the showAd branch staged the next on pendingNextRef BUT deferred
   * setAdPhase('showing') because overlayVisibleRef.current was true at
   * resolve time. handleOverlayDone calls this after applyShowSuccess(false)
   * so the ad trigger lands only after the success burst has dismissed.
   */
  consumeDeferredAd: () => boolean;
};

// Owns the resolve-lifecycle machinery: the in-flight next-card Promise ref,
// the staged pending-next ref consumed by both ad/non-ad RESOLVED dispatch
// paths, the warming-retry timer + count, and the mountedRef abort guard.
export function useResolveLifecycle({
  dispatch,
  advanceStateRef,
  setAdPhase,
  onWin,
  resolveArgs,
  sideEffectArgs,
  consumeAdSlot,
  overlayVisibleRef,
}: UseResolveLifecycleArgs): UseResolveLifecycleResult {
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef<number>(0);
  // Holds the in-flight next-card resolve Promise kicked off in
  // applySuccessPath so handleOverlayDone can await it instead of re-entering
  // the cascade at dismiss. Discarded on unmount so a swipe-home during the
  // overlay never lands a setState-after-unmount when the trailing resolve
  // settles.
  const nextCardResolveRef = useRef<Promise<void> | null>(null);
  // WIN-CREDIT CONTRACT (bug-2 fix, reverses the old PB6/C1 abort decision):
  // the score is buffered at WIN time in GuessScreen's applySuccessPath —
  // BEFORE this resolve even starts — so a swipe-home/leave mid-advance or a
  // last/only card (advance → exhausted) can no longer lose the win. PT6
  // cleanup still nulls nextCardResolveRef on unmount and the mountedRef
  // guard below stops the post-win side effects (deck mutation, file delete,
  // ad/UI state) from firing after teardown; the credit itself already
  // happened. Flipped to false in the PT6 cleanup below; checked at the top
  // of onAdvanceResolved.
  const mountedRef = useRef(true);
  // C2 (ad-in-screen-overlay §4.4): holds the resolved next card so the
  // post-ad RESOLVED dispatch can fire from handleAdDone — the advance state
  // machine stays in `advancing` during the ad (no premature setParams), then
  // lands in `idle` on dismiss. The same ref is borrowed by the non-ad path's
  // deferred RESOLVED (staged in onAdvanceResolved, consumed by
  // handleOverlayDone via consumePendingNext).
  const pendingNextRef = useRef<NonNullable<NextGuessResult> | null>(null);
  // F1 (G1): mirror of the no-ad branch's overlayVisibleRef commit gate,
  // applied to the showAd branch's setAdPhase('showing') trigger. Set when
  // the ad slot is consumed while the SuccessOverlay is still animating;
  // consumed by handleOverlayDone after applyShowSuccess(false) so the
  // interstitial never mounts under the success burst. Drained on terminal
  // transitions + unmount so a backgrounded cycle cannot orphan an ad.
  const adDeferredRef = useRef<boolean>(false);

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
      // F4 nit: drop a staged next on unmount so a warming-stages-next +
      // background orphan cannot leak across screen lifetime.
      pendingNextRef.current = null;
      // F1 (G1): also drop a deferred-ad flag so a re-mount cannot observe a
      // stale deferred state from the prior instance.
      adDeferredRef.current = false;
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
  // scheduled retry tick (state=warming). Side effects (streak commit,
  // advance cleanup, ad cadence, setParams/navigation) fire ONLY on a
  // successful resolve — see onAdvanceResolved. The score is NOT credited
  // here: it was banked at win time (GuessScreen applySuccessPath).
  async function runResolveCycle() {
    const { next, reason } = await resolveNextCardWithServerFallback({
      category: resolveArgs.category,
      language: resolveArgs.language,
      mode: resolveArgs.filterMode,
      currentListId: resolveArgs.currentListId,
      currentPictureId: resolveArgs.currentPictureId,
      isTutorial: resolveArgs.isTutorial,
      scope: resolveArgs.scope,
      authContext: resolveArgs.authContext,
    });

    if (next) {
      await onAdvanceResolved(next);
      return;
    }

    // F3b: retry only on network. The cascade (nextCardAdvancer) already tried
    // Tier 3 'all' cross-fallback + Tier 4 looping-replay before returning null,
    // so a non-network null is deterministic — retrying just burns 1s+2s+4s.
    // 'empty' | 'server' (and any unmapped reason) → FAILED_PERMANENT → exhausted.
    if (reason === 'network') {
      dispatch({ type: 'FAILED_TRANSIENT' });
      scheduleRetry();
      return;
    }
    // F4 nit: terminal transition — drop any staged next so a
    // staged-next-then-background orphan cannot leak (the next WIN overwrites
    // the ref before read, but null-on-terminal is cheap defense).
    pendingNextRef.current = null;
    // F1 (G1): clear the deferred-ad flag on terminal transition so a later
    // handleOverlayDone (overlay animation completing post-backgrounding)
    // cannot orphan an ad on top of the exhausted panel.
    adDeferredRef.current = false;
    dispatch({ type: 'FAILED_PERMANENT' });
  }

  // PB6 (revised by the bug-2 win-credit contract): advance-gated side
  // effects — streak-state commit + best-effort cleanup — live here, only on
  // a successfully resolved next card. Pairs with the cadence rollback (no
  // commit) on null advance. The SCORE is not advance-gated anymore: it was
  // banked at win time (GuessScreen applySuccessPath).
  async function onAdvanceResolved(next: NonNullable<NextGuessResult>) {
    // A7 (Phase 2 review): the in-flight resolve may complete AFTER AppState
    // backgrounding forced FAILED_PERMANENT → `exhausted`. Without this guard,
    // onWin / applySuccessSideEffects / decideAdSlot / setAdPhase would all
    // fire on stale state. Bail before any side effect. Both 'advancing'
    // (initial resolve) and 'warming' (retry recovery) are valid resolving
    // states — the reducer accepts RESOLVED from either.
    if (advanceStateRef.current !== 'advancing' && advanceStateRef.current !== 'warming') return;
    // mountedRef guard: a swipe-home during SuccessOverlay nulls nextCardResolveRef
    // but does NOT cancel the in-flight Promise. applySuccessSideEffects mutates
    // the local deck + the filesystem — those must NOT fire post-unmount. The
    // score is safe regardless: it was banked at win time.
    if (!mountedRef.current) return;
    onWin();
    await applySuccessSideEffects({
      listId: sideEffectArgs.listId,
      categoryKey: sideEffectArgs.categoryKey,
      language: sideEffectArgs.language,
      mode: sideEffectArgs.filterMode,
      imageFile: sideEffectArgs.imageFile,
      pictureId: sideEffectArgs.pictureId,
      scope: sideEffectArgs.scope,
      userId: sideEffectArgs.userId,
    });

    // Unmount can happen while the persistent side effects await. Bail before
    // cadence/state updates so no ad/UI state mutates after teardown.
    if (!mountedRef.current) return;

    const { showAd } = consumeAdSlot();

    // F4 (ref-as-control-flow): the no-ad commit gate reads
    // `overlayVisibleRef.current` (a synchronous mirror of GuessScreen's
    // `showSuccess` state) instead of `advanceStateRef.current`. This unifies
    // the advancing + warming branches into a single rule and closes the
    // animation-overlap race: for tier1+ wins the SuccessOverlay dismisses at
    // ~1200-2600ms while the first warming retry fires at 1000ms, so the retry
    // can land WHILE the overlay is still animating. The previous
    // `advanceStateRef.current === 'advancing'` predicate was FALSE for warming,
    // so the warming branch fell through to an UNCONDITIONAL `RESOLVED` dispatch
    // → the next image swapped behind the still-visible overlay. Now: when the
    // overlay is up (advancing OR warming retry mid-overlay) → stage on
    // pendingNextRef (commit deferred to handleOverlayDone after the fade); when
    // the overlay is already down (success-first-try with no overlay, OR a
    // warming retry landing after overlay dismissed) → dispatch immediately.
    if (!showAd) {
      if (overlayVisibleRef.current) {
        pendingNextRef.current = next;
        return;
      }
      dispatch({ type: 'RESOLVED', next: next.params });
      return;
    }

    // C2 (ad-in-screen-overlay §3.2 step 3-5) + F1 (G1): showAd branch stages
    // the resolved next on pendingNextRef for handleAdDone. setAdPhase('showing')
    // is gated on overlayVisibleRef.current (mirror of the no-ad branch's
    // commit gate at :225-229) so AdInterstitial never mounts under the
    // still-animating success burst. When the overlay is up at resolve time,
    // the trigger is deferred to handleOverlayDone via adDeferredRef; when the
    // overlay is already down (slow resolve past tier-0 duration, or a
    // no-overlay win path), the ad mounts immediately. RESOLVED is always
    // deferred to handleAdDone.
    pendingNextRef.current = next;
    if (overlayVisibleRef.current) {
      adDeferredRef.current = true;
      return;
    }
    setAdPhase('showing');
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
      dispatch({ type: 'RETRY_TICK' });
      if (n < DEFAULT_RETRY_BUDGET) {
        void runResolveCycle();
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

  const kickoffResolve = () => {
    retryCountRef.current = 0;
    // F1 (G1): reset the deferred-ad flag at cycle start so a stale flag from
    // a prior win cannot leak across consecutive cycles. Belt-and-suspenders
    // alongside the advancing/warming tap-gate (disabled={state !== 'idle'}).
    adDeferredRef.current = false;
    nextCardResolveRef.current = runResolveCycle();
  };

  const awaitResolve = async () => {
    await nextCardResolveRef.current;
  };

  const consumePendingNext = () => {
    const next = pendingNextRef.current;
    pendingNextRef.current = null;
    return next;
  };

  // F1 (G1): single-read-and-reset of the deferred-ad flag. Mirrors
  // consumePendingNext's pattern so handleOverlayDone can decide whether to
  // trigger the deferred ad or fall through to the no-ad RESOLVED dispatch.
  const consumeDeferredAd = () => {
    const prev = adDeferredRef.current;
    adDeferredRef.current = false;
    return prev;
  };

  // F4 nit: terminal-cleanup callback for call sites that dispatch
  // FAILED_PERMANENT directly (GuessScreen's AppState backgrounding listener)
  // so they also drop any staged next — mirrors the nulling done at the hook's
  // own FAILED_PERMANENT dispatch and at unmount. F1 (G1): also clears the
  // deferred-ad flag for the same orphan-prevention reason. Single helper for
  // both refs minimizes call-site churn.
  const clearPendingNext = useCallback(() => {
    pendingNextRef.current = null;
    adDeferredRef.current = false;
  }, []);

  return {
    kickoffResolve,
    awaitResolve,
    consumePendingNext,
    handleAdDone,
    clearRetryTimer,
    clearPendingNext,
    consumeDeferredAd,
  };
}
