import { fetchCardBatch, appendCardBatch } from './cardDeck';
import { getDeckCountForScope } from '../utils/storageDatum';
import { isE2EMode } from '../utils/e2eMode';

export const LOW_CARD_THRESHOLD = 5;
export const ALL_WARM_THRESHOLD = 5;

export interface PrefetchParams {
  categoryKey: string;
  categoryId?: string | number | null;
  language?: string | null;
  scope?: unknown;
  authContext: unknown;
}

export type WarmAllParams = Omit<PrefetchParams, 'categoryKey' | 'categoryId'>;

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

export async function prefetchIfLow({
  categoryKey,
  categoryId,
  language,
  scope,
  authContext,
}: PrefetchParams): Promise<void> {
  if (isE2EMode()) {
    return;
  }

  const dk = dedupKey(categoryKey, language, scope);
  const existing = inFlight.get(dk);
  if (existing) {
    return existing;
  }

  const count = await getDeckCountForScope({
    category: {
      key: categoryKey,
      ...(categoryId != null ? { id: categoryId } : {}),
    },
    language,
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
        await appendCardBatch({
          cards: r.images,
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
}: WarmAllParams): Promise<void> {
  if (isE2EMode()) {
    return;
  }

  const wk = warmKey(language, scope);
  const existing = allWarming.get(wk);
  if (existing) {
    return existing;
  }

  const count = await getDeckCountForScope({
    category: { key: 'all' },
    language,
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
        await appendCardBatch({
          cards: r.images,
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
