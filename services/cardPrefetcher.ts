import { fetchCardBatch, appendCardBatch } from './cardDeck';
/**
 * Defense-in-depth per T2.6 (aligns with T1.9): normalize fetched cards at the
 * prefetcher boundary too, so a future regression in `appendCardBatch`'s own
 * normalization cannot leak cards with missing/NaN listIds into storage.
 * Idempotent — normalizing already-normalized cards is a no-op.
 */
import { getRemainingDeckCount, normalizeListIds } from '../utils/storageDatum';
import { isE2EMode } from '../utils/e2eMode';

// Refill when only 3 cards remain — combined with NextCardImageWarmer decode prefetch, the user never waits for cold decode or server round-trip.
export const LOW_CARD_THRESHOLD = 3;
/**
 * Cross-fallback warm-'all'-on-low trigger. Intentionally higher than
 * LOW_CARD_THRESHOLD — gates the 'all' deck warming, not per-win prefetch.
 */
export const ALL_WARM_THRESHOLD = 5;
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
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('[cardPrefetcher] prefetch failed', dk, e);
      }
    }
  })();

  inFlight.set(dk, p);
  p.finally(() => {
    if (inFlight.get(dk) === p) {
      inFlight.delete(dk);
    }
  });

  if (categoryKey !== 'all' && count < ALL_WARM_THRESHOLD) {
    warmAllDeckIfNeeded({ language, scope, authContext });
  }

  return p;
}

/**
 * Warm the 'all' deck in the background. Concurrent callers share the in-flight
 * promise, and callers re-check the persisted 'all' deck on each attempt so a
 * drained fallback deck can be warmed again later in the session.
 */
export async function warmAllDeckIfNeeded({
  language,
  scope,
  authContext,
  currentListId,
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
  if (count > 0) {
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
      if (__DEV__) {
        console.warn('[cardPrefetcher] warm-all failed', wk, e);
      }
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
