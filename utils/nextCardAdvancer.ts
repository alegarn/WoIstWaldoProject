// Advance policy: keep the player in-card until the SERVER deck is exhausted.
//
// The read-only resolver (resolveNextGuessParams → resolveNextCard →
// getNextImageForScope) only reads local storage, and played cards are REMOVED
// from storage (applySuccessSideEffects → removeImageFromList), so the local
// deck shrinks as the player wins. When the local deck momentarily hits 0
// (background prefetch hasn't topped it up yet), the read-only resolver returns
// null and the caller would bounce to the feed — even though the server still
// has unplayed cards. This module foreground-fetches the current category/scope
// before giving up, so the player only bounces when the server itself is empty.
//
// Exhaustion contract: null is returned ONLY after a foreground server fetch
// for the current category/scope returns no cards (and, for a non-'all'
// category, the 'all' cross-fallback is also empty).

import { resolveNextGuessParams } from './handleGuessOutcome';
import { fetchCardBatch, appendCardBatch } from '../services/cardDeck';
import { warmAllDeckIfNeeded, getInFlightPrefetch, getPrefetchScopeKey } from '../services/cardPrefetcher';
import { isCategoryExhausted, markCategoryExhausted } from './storageDatum';
import { startNewServingCycle, ServingScope } from './servingCycle';

export type NextGuessResult = { params: Record<string, unknown> } | null | undefined;

export type ResolveNextCardResult =
  | { next: NextGuessResult; reason: 'ok' }
  | { next: null; reason: 'empty' | 'network' | 'server' };

type FailureReason = 'empty' | 'network' | 'server';

function isPrivateScope(scope: unknown): boolean {
  return !!scope && typeof scope === 'object' && scope !== null &&
    (scope as { kind?: string }).kind === 'private' &&
    !!(scope as { groupId?: unknown }).groupId;
}

export type AdvancerArgs = {
  category?: { id?: string | number | null; key?: string } | null;
  language?: string | null;
  currentListId?: number;
  currentPictureId?: string;
  isTutorial?: boolean;
  scope?: unknown;
  authContext?: unknown;
};

export type ForegroundTopUpResult =
  | { ok: true; appended: number }
  | { ok: false; reason: 'empty' | 'network' | 'server' };

/**
 * Inspect a thrown value and decide whether it represents a transport-level
 * network failure (TypeError from fetch, etc.) versus an application-level
 * error. Used by foregroundTopUp to classify typed-result reason.
 */
function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError && /network|fetch|Failed to fetch/i.test(e.message);
}

// Foreground-fetch a category/scope and append to the local deck. Returns a
// typed result so the caller can distinguish "server empty" from "transport
// failure" instead of treating every failure as a silent false. Mirrors
// SwipeImage's fetch+append, but inline (the advance path is sequential — one
// win at a time — so no dedup is needed here). `pictureIdOverride: null`
// resets the cursor to head (used by the looping tier to replay already-played
// cards).
//
// PB4 (T2.7) Option A: before issuing its own fetch, foregroundTopUp consults
// the prefetcher's in-flight dedup via `getInFlightPrefetch`. If a prefetch is
// already running for the same scope, awaiting it (a) lets its appended cards
// become visible to the recheck below, and (b) prevents our fetch from racing
// the prefetch for the same server cursor. Critically, foregroundTopUp does
// NOT call `prefetchIfLow` itself — that would re-introduce the race window
// where the outside caller's inFlight entry settles+clears before our call
// reaches its `inFlight.get` recheck, letting a 2nd fetch slip through. It
// also avoids the side effects of `prefetchIfLow` (warm-all cascade) when
// there is no outside caller. If no prefetch is in-flight, foregroundTopUp
// simply proceeds with its own fetch — the caller is the sole concurrent
// caller for this scope. After the await, Tier 2 re-checks the local deck via
// `resolveNextGuessParams`; if the prefetch landed a card, short-circuit with
// `appended: 0` and let the caller reap the card (no redundant foreground
// fetch). Tier 4 (head replay) skips the recheck — the prefetch is
// cursor-based and cannot satisfy a head-replay.
async function foregroundTopUp(
  args: AdvancerArgs,
  categoryKey: string,
  pictureIdOverride?: string | null,
): Promise<ForegroundTopUpResult> {
  // Tier 4 (looping replay) passes pictureIdOverride: null to reset the cursor
  // to head. The exhausted-category cache is meaningless there — newly-uploaded
  // cards must surface — so gate every cache interaction on !isHeadReplay.
  // Tier 2 passes pictureIdOverride: undefined; the local distinguishes null
  // (head replay) from undefined (cursor advance).
  const isHeadReplay = pictureIdOverride === null;

  // PB4 (T2.7) Option A: consult the prefetcher's in-flight dedup WITHOUT
  // triggering a new prefetch. The scopeKey derivation must match
  // `prefetchIfLow`'s internal `dedupKey` (shared via `getPrefetchScopeKey`).
  const inFlight = getInFlightPrefetch(getPrefetchScopeKey({
    categoryKey,
    language: args.language,
    scope: args.scope,
  }));
  if (inFlight) {
    // A prefetch is already running for this scope — await it so its appended
    // cards become visible to the Tier 2 recheck below. The `.catch(() => {})`
    // swallows transient prefetch failures; the foreground fetch is still the
    // source of truth for "do we have cards?" via the post-fetch resolve the
    // caller already performs.
    await inFlight.catch(() => {});
  }

  // F3a: short-circuit exhausted non-'all' categories before issuing a server
  // round-trip. Only the cursor-based Tier 2 path (no head replay) and only a
  // real category (the 'all' deck is the Tier 3/4 fallback and must stay live
  // so newly-uploaded images surface). On hit, returns 'empty' so control
  // flows straight to the Tier 3 'all' cross-fallback below.
  if (!isHeadReplay && categoryKey !== 'all' && await isCategoryExhausted(categoryKey, args.language, args.scope)) {
    return { ok: false, reason: 'empty' };
  }

  // PB4 (T2.7): Tier 2 short-circuit. After the prefetch-await, re-check the
  // local deck; if the prefetch just landed a resolvable card, skip our own
  // fetch entirely. Only the cursor-based Tier 2 path (no pictureIdOverride)
  // benefits — Tier 4 explicitly resets the cursor to head, which the
  // cursor-based prefetch cannot satisfy.
  if (pictureIdOverride === undefined) {
    const rechecked = await resolveNextGuessParams({
      category: args.category,
      language: args.language,
      currentListId: args.currentListId,
      currentPictureId: args.currentPictureId,
      isTutorial: args.isTutorial,
      scope: args.scope,
    });
    if (rechecked) {
      return { ok: true, appended: 0 };
    }
  }

  try {
    // B2: PUBLIC scope threads categoryKey only (bundled string keys, no
    // server UUID). PRIVATE scope keeps categoryId (UUID). Mirrors the
    // cardDeck.buildFeedFilters split so the advancer never leaks a public
    // id into the private-only category_id server param.
    const fetchArgs: Parameters<typeof fetchCardBatch>[0] = {
      categoryKey,
      language: args.language,
      scope: args.scope,
      authContext: args.authContext,
      ...(isPrivateScope(args.scope) ? { categoryId: args.category?.id } : {}),
      ...(pictureIdOverride !== undefined ? { pictureIdOverride } : {}),
    };
    const r = await fetchCardBatch(fetchArgs);
    // H1: getImages now distinguishes network-class download failure
    // (reason: 'network') from server-class. Forward it so callers get the
    // retry affordance; anything else stays 'server'.
    if (!r || r.isError === true) return { ok: false, reason: r?.reason === 'network' ? 'network' : 'server' };
    if (!r.images || r.images.length === 0) {
      // F3a: cache the empty result so subsequent advances short-circuit at
      // Tier 2 with zero server round-trips. ONLY the genuine-empty branch
      // writes — the 5xx branch above MUST NOT poison the cache (a transient
      // server blip must not permanently mark a category exhausted). 'all' and
      // Tier-4 head-replay paths are excluded so newly-uploaded cards surface.
      // Paired-write note (CC1): services/cardPrefetcher.ts (B1) writes the
      // SAME cache with a DIFFERENT guard (categoryKey !== 'all' only — the
      // prefetcher has no pictureIdOverride context and never runs on the
      // Tier-4 head path). Both sites use the SAME helper; first-wins is
      // defense-in-depth. Keep this comment in sync with the prefetcher site.
      if (!isHeadReplay && categoryKey !== 'all') {
        await markCategoryExhausted(categoryKey, args.language, args.scope).catch(() => {});
      }
      return { ok: false, reason: 'empty' };
    }
    await appendCardBatch({
      cards: r.images,
      categoryKey,
      ...(isPrivateScope(args.scope) ? { categoryId: args.category?.id } : {}),
      language: args.language,
      scope: args.scope,
    });
    return { ok: true, appended: r.images.length };
  } catch (e) {
    if (isNetworkError(e)) {
      return { ok: false, reason: 'network' };
    }
    return { ok: false, reason: 'server' };
  }
}

export async function resolveNextCardWithServerFallback({
  category,
  language,
  currentListId,
  currentPictureId,
  isTutorial,
  scope,
  authContext,
}: AdvancerArgs): Promise<ResolveNextCardResult> {
  const categoryKey = category?.key || 'all';
  const resolveArgs = { category, language, currentListId, currentPictureId, isTutorial, scope };
  const topUpArgs: AdvancerArgs = { ...resolveArgs, authContext };

  // Tier 1 — local deck.
  let next = await resolveNextGuessParams(resolveArgs);
  if (next) return { next, reason: 'ok' };

  // Track most informative failure reason across top-up tiers, in case all
  // tiers fail. Priority: 'empty' (server genuinely has no cards) > 'server'
  // (server-side error) > 'network' (transport error).
  const failureReasons: Array<FailureReason | null> = [];

  // Tier 2 — foreground-fetch the CURRENT category/scope. The server may still
  // have unplayed cards even though the background prefetcher hasn't topped up
  // local storage yet. (updateImageList assigns listIds so these are visible.)
  const tier2 = await foregroundTopUp(topUpArgs, categoryKey);
  if (tier2.ok) {
    next = await resolveNextGuessParams(resolveArgs);
    if (next) return { next, reason: 'ok' };
  } else {
    failureReasons.push(tier2.reason);
  }

  // Tier 3 — for a real category, cross-fall-back to the warmed 'all' deck.
  if (categoryKey !== 'all') {
    await warmAllDeckIfNeeded({ language, scope, authContext, currentListId }).catch(() => {});
    next = await resolveNextGuessParams(resolveArgs);
    if (next) return { next, reason: 'ok' };
  }

  // Tier 4 — looping replay. Every server deck is exhausted for the cursor; the
  // server still HOLDS every card (client plays are local-only), so re-fetch
  // 'all' from HEAD and replay. Per-call bound: one fetch + one resolve. If the
  // head re-fetch itself is empty, the server truly has no cards for the
  // language/scope and we return { next: null, reason }.
  //
  // Tier 4 category bug (Phase 2 review): override the category to { key: 'all' }
  // so fetchCardBatch sends NO category_id (server returns 'all' cards) and
  // appendCardBatch writes to the 'all' namespace. Passing the original category
  // here leaks sports/etc. ids into both the server query and the 'all' write.
  const tier4Args: AdvancerArgs = { ...topUpArgs, category: { key: 'all' } };
  const tier4 = await foregroundTopUp(tier4Args, 'all', null);
  if (tier4.ok) {
    next = await resolveNextGuessParams(resolveArgs);
    if (next) return { next, reason: 'ok' };

    // Cycle transition (B1, epoch-bookkept): tier4.ok && !next is the
    // ALL_EXHAUSTED proof — the server served ≥1 card yet nothing resolves,
    // i.e. isCycleExhausted(tier4.appended, 0): every servable card sits in
    // the played-set. startNewServingCycle bumps the cycle epoch and clears
    // the scope+language played-set + stale cursors/markers ONCE
    // (cross-category is intended: Tier 4 only fires once the category AND
    // 'all' are exhausted), so looping 'all' starts a NEW cycle at the deck
    // head. tier4.ok === false NEVER transitions: TRANSIENT_EMPTY
    // (network/server) and genuine empty keep the existing failureReasons
    // flow — no epoch bump, no played-set clear.
    // Head-cursor args (currentListId: undefined): the fresh deck renumbers
    // listIds 1..N, and the just-played currentListId can be ≥ the fresh max
    // (listId wrap at the cycle boundary) — a stale cursor would re-dead-end
    // the resolve. resolveArgs.currentPictureId exclusion survives via the
    // spread. The free local re-resolve runs BEFORE any retry: the 'all' deck
    // retains cross-namespace played cards now servable in the new cycle, at
    // zero extra roundtrips. Bound: at most ONE extra head fetch per cycle
    // exhaustion (the single retry below) — never more.
    await startNewServingCycle(language, scope as ServingScope).catch(() => {});
    const headCursorArgs = { ...resolveArgs, currentListId: undefined };
    next = await resolveNextGuessParams(headCursorArgs);
    if (next) return { next, reason: 'ok' };

    const tier4Retry = await foregroundTopUp(tier4Args, 'all', null);
    if (tier4Retry.ok) {
      next = await resolveNextGuessParams(headCursorArgs);
      if (next) return { next, reason: 'ok' };
    }
  } else {
    failureReasons.push(tier4.reason);
  }

  return { next: null, reason: pickFailureReason(failureReasons) };
}

function pickFailureReason(reasons: Array<FailureReason | null>): FailureReason {
  if (reasons.includes('empty')) return 'empty';
  if (reasons.includes('server')) return 'server';
  if (reasons.includes('network')) return 'network';
  return 'empty';
}
