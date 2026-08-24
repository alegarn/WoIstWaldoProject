import { fetchCardBatch, appendCardBatch } from './cardDeck';
/**
 * Defense-in-depth per T2.6 (aligns with T1.9): normalize fetched cards at the
 * prefetcher boundary too, so a future regression in `appendCardBatch`'s own
 * normalization cannot leak cards with missing/NaN listIds into storage.
 * Idempotent — normalizing already-normalized cards is a no-op.
 */
import { getRemainingDeckCount, normalizeListIds, isCategoryExhausted, markCategoryExhausted } from '../utils/storageDatum';
import { isE2EMode } from '../utils/e2eMode';

// Refill when only 3 cards remain — combined with NextCardImageWarmer decode prefetch, the user never waits for cold decode or server round-trip.
export const LOW_CARD_THRESHOLD = 4;
/**
 * Single source of truth for the deck-fill target. Gates BOTH the category
 * top-up decision in `prefetchIfLow` (fetch from 'all' when the total deck
 * `(count + appendedCount) < TARGET_BATCH_SIZE`) AND the early-return inside
 * `warmAllDeckIfNeeded` (skip when the 'all' deck already has ≥ target cards).
 */
export const TARGET_BATCH_SIZE = 5;
/**
 * Per-win look-ahead window for image preload (Phase 3, gated on spike).
 * Kept here so threshold tuning lives in one place.
 */
export const LOOKAHEAD_PREFETCH = 3;

export interface PrefetchParams {
  categoryKey: string;
  categoryId?: string | number | null;
  language?: string | null;
  scope?: unknown;
  authContext: unknown;
  currentListId?: number;
}

export type WarmAllParams = Omit<PrefetchParams, 'categoryKey' | 'categoryId'> & {
  /**
   * Cursor-aware listId (RC8/CB3, T2.8). When set, warmAllDeckIfNeeded uses
   * `getRemainingDeckCount({ currentListId })` instead of
   * `getDeckCountForScope`, so a cursor-exhausted 'all' deck (count=N>0 but
   * no listId > currentListId) still warms instead of short-circuiting and
   * starving Tier 3. Mirrors `PrefetchParams.currentListId` (T2.4).
   * Default `undefined` = cursor-agnostic (counts the whole 'all' deck).
   */
  currentListId?: number;
  /**
   * Target deck size for the early-return gate. The function fills the 'all'
   * deck until it has ≥ `target` cards; previously it only warmed when empty
   * (`count > 0` gate skipped any partial deck). Default `TARGET_BATCH_SIZE`.
   * B1/F1: callers pass an explicit remainder to top up a partial deck.
   */
  target?: number;
};

const inFlight = new Map<string, Promise<void>>();
const allWarming = new Map<string, Promise<void>>();

function scopeGroupId(scope: unknown): string | undefined {
  if (scope && typeof scope === 'object' && 'groupId' in scope) {
    const gid = (scope as { groupId?: unknown }).groupId;
    return typeof gid === 'string' ? gid : undefined;
  }
  return undefined;
}

function dedupKey(categoryKey: string, language: string | null | undefined, scope: unknown): string {
  return `${categoryKey}:${language ?? 'any'}:${scopeGroupId(scope) ?? 'public'}`;
}

function warmKey(language: string | null | undefined, scope: unknown): string {
  return `${language ?? 'any'}:${scopeGroupId(scope) ?? 'public'}`;
}

/**
 * Compute the dedup scope key for a prefetch invocation, using the same logic
 * as `prefetchIfLow`'s internal `dedupKey`. Exported so callers outside the
 * prefetcher (notably `foregroundTopUp` in `utils/nextCardAdvancer.ts`) can
 * look up an in-flight prefetch promise for a scope WITHOUT triggering a new
 * prefetch (PB4 / T2.7 Option A).
 */
export function getPrefetchScopeKey(
  args: Pick<PrefetchParams, 'categoryKey' | 'language' | 'scope'>,
): string {
  return dedupKey(args.categoryKey, args.language, args.scope);
}

/**
 * Return the current in-flight prefetch promise for a scope key, or `null` if
 * no prefetch is currently running for that scope. Does NOT mutate the
 * `inFlight` Map and does NOT start a new prefetch. Use this to await an
 * already-running prefetch's result without the side effects of
 * `prefetchIfLow` (which would trigger a new fetch + warm-all cascade when
 * nothing is in-flight). PB4 / T2.7 Option A.
 */
export function getInFlightPrefetch(scopeKey: string): Promise<void> | null {
  return inFlight.get(scopeKey) ?? null;
}

export async function prefetchIfLow({
  categoryKey,
  categoryId,
  language,
  scope,
  authContext,
  currentListId,
}: PrefetchParams): Promise<void> {
  if (isE2EMode()) {
    return;
  }

  const dk = dedupKey(categoryKey, language, scope);
  const existing = inFlight.get(dk);
  if (existing) {
    return existing;
  }

  const count = await getRemainingDeckCount({
    category: {
      key: categoryKey,
      ...(categoryId != null ? { id: categoryId } : {}),
    },
    language,
    currentListId,
    scope,
  });

  if (count >= LOW_CARD_THRESHOLD) {
    return;
  }

  const raced = inFlight.get(dk);
  if (raced) {
    return raced;
  }

  const p = (async () => {
    let appendedCount = 0;

    // F1/B1: consult C1's exhausted-category cache before the category fetch.
    // If the category is known-empty (cache hit), skip the round-trip and let
    // the top-up below fetch the full TARGET_BATCH_SIZE from 'all'. 'all' is
    // never cached (Tier 3/4 fallback must stay live), so the consult is
    // guarded on `categoryKey !== 'all'`.
    let skipCategoryFetch = false;
    if (categoryKey !== 'all') {
      try {
        skipCategoryFetch = await isCategoryExhausted(categoryKey, language, scope);
      } catch {
        skipCategoryFetch = false;
      }
    }

    if (!skipCategoryFetch) {
      try {
        const r = await fetchCardBatch({
          categoryKey,
          categoryId,
          language,
          scope,
          authContext,
        });
        if (r && !r.isError && r.images?.length) {
          // T2.6 defense-in-depth: normalize before append (aligns with T1.9).
          const cards = normalizeListIds(r.images);
          await appendCardBatch({
            cards,
            categoryKey,
            categoryId,
            language,
            scope,
          });
          appendedCount = cards.length;
        } else if (
          r &&
          !r.isError &&
          Array.isArray(r.images) &&
          r.images.length === 0 &&
          categoryKey !== 'all'
        ) {
          // F3a/B1: server returned genuine empty (NOT a 5xx isError — a
          // transient server blip MUST NOT poison the cache; mirror C1's CC4
          // defensive pin at nextCardAdvancer.ts:142-158). Paired-write note
          // (CC1): utils/nextCardAdvancer.ts#foregroundTopUp writes the SAME
          // cache with a DIFFERENT guard (`pictureIdOverride !== null &&
          // categoryKey !== 'all'` — Tier-4 head path excluded so newly-
          // uploaded images surface). The prefetcher has no pictureIdOverride
          // context (it never runs on the Tier-4 head path), so its guard is
          // `categoryKey !== 'all'` only. Both sites use the SAME helper;
          // first-wins is defense-in-depth. Keep this comment in sync with
          // nextCardAdvancer.ts:144-156.
          await markCategoryExhausted(categoryKey, language, scope).catch(() => {});
        }
      } catch (e) {
        console.warn('[cardPrefetcher] prefetch failed', dk, e);
      }
    }

    // F1/B1: deck-level top-up. When the total deck `(count + appendedCount)`
    // is still below TARGET_BATCH_SIZE AND we are not already on the 'all'
    // deck, fill the remainder from 'all' in the same cycle. The resolver
    // merges category + 'all' decks at read time. Replaces the old
    // side-effect gated on `count < ALL_WARM_THRESHOLD`.
    if (categoryKey !== 'all' && count + appendedCount < TARGET_BATCH_SIZE) {
      const target = TARGET_BATCH_SIZE - (count + appendedCount);
      warmAllDeckIfNeeded({ language, scope, authContext, target });
    }
  })();

  inFlight.set(dk, p);
  p.finally(() => {
    if (inFlight.get(dk) === p) {
      inFlight.delete(dk);
    }
  });

  return p;
}

/**
 * Warm the 'all' deck in the background. Concurrent callers share the in-flight
 * promise, and callers re-check the persisted 'all' deck on each attempt so a
 * drained fallback deck can be warmed again later in the session.
 *
 * B1/F1: contract broadened — fills the 'all' deck until it has ≥ `target`
 * cards (default `TARGET_BATCH_SIZE`). The previous `count > 0` early-return
 * skipped warming whenever the deck had ANY cards, so a partial 'all' deck
 * (e.g. 2 cards) never got topped up to 5. The retuned `count >= target` gate
 * is the actual F1 fix. Name retained to minimize churn.
 */
export async function warmAllDeckIfNeeded({
  language,
  scope,
  authContext,
  currentListId,
  target = TARGET_BATCH_SIZE,
}: WarmAllParams): Promise<void> {
  if (isE2EMode()) {
    return;
  }

  const wk = warmKey(language, scope);
  const existing = allWarming.get(wk);
  if (existing) {
    return existing;
  }

  const count = await getRemainingDeckCount({
    category: { key: 'all' },
    language,
    currentListId,
    scope,
  });
  if (count >= target) {
    return;
  }

  const raced = allWarming.get(wk);
  if (raced) {
    return raced;
  }

  const p = (async () => {
    try {
      const r = await fetchCardBatch({
        categoryKey: 'all',
        language,
        scope,
        authContext,
        pictureIdOverride: null,
      });
      if (r && !r.isError && r.images?.length) {
        // T2.6 defense-in-depth: normalize before append (aligns with T1.9).
        const cards = normalizeListIds(r.images);
        await appendCardBatch({
          cards,
          categoryKey: 'all',
          language,
          scope,
        });
      }
    } catch (e) {
      console.warn('[cardPrefetcher] warm-all failed', wk, e);
    } finally {
      allWarming.delete(wk);
    }
  })();

  allWarming.set(wk, p);
  return p;
}

export function __resetForTests(): void {
  inFlight.clear();
  allWarming.clear();
}
