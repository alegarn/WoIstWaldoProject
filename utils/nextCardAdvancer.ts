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
import { warmAllDeckIfNeeded } from '../services/cardPrefetcher';

export type NextGuessResult = { params: Record<string, unknown> } | null | undefined;

export type AdvancerArgs = {
  category?: { id?: string | number | null; key?: string } | null;
  language?: string | null;
  currentListId?: number;
  isTutorial?: boolean;
  scope?: unknown;
  authContext?: unknown;
};

// Foreground-fetch a category/scope and append to the local deck. Returns true
// when new cards were appended (caller should re-resolve). Mirrors SwipeImage's
// fetch+append, but inline (the advance path is sequential — one win at a time
// — so no dedup is needed here). `pictureIdOverride: null` resets the cursor to
// head (used by the looping tier to replay already-played cards).
async function foregroundTopUp(
  args: AdvancerArgs,
  categoryKey: string,
  pictureIdOverride?: string | null,
): Promise<boolean> {
  try {
    const r = await fetchCardBatch({
      categoryKey,
      categoryId: args.category?.id,
      language: args.language,
      scope: args.scope,
      authContext: args.authContext,
      ...(pictureIdOverride !== undefined ? { pictureIdOverride } : {}),
    });
    if (!r || r.isError || !r.images || r.images.length === 0) return false;
    await appendCardBatch({
      cards: r.images,
      categoryKey,
      categoryId: args.category?.id,
      language: args.language,
      scope: args.scope,
    });
    return true;
  } catch {
    // Transient network/server failure: treat as "no new cards" so the caller
    // proceeds to the cross-fallback (or null) rather than throwing mid-advance.
    return false;
  }
}

export async function resolveNextCardWithServerFallback({
  category,
  language,
  currentListId,
  isTutorial,
  scope,
  authContext,
}: AdvancerArgs): Promise<NextGuessResult> {
  const categoryKey = category?.key || 'all';
  const resolveArgs = { category, language, currentListId, isTutorial, scope };
  const topUpArgs: AdvancerArgs = { ...resolveArgs, authContext };

  // Tier 1 — local deck.
  let next = await resolveNextGuessParams(resolveArgs);
  if (next) return next;

  // Tier 2 — foreground-fetch the CURRENT category/scope. The server may still
  // have unplayed cards even though the background prefetcher hasn't topped up
  // local storage yet. (updateImageList assigns listIds so these are visible.)
  if (await foregroundTopUp(topUpArgs, categoryKey)) {
    next = await resolveNextGuessParams(resolveArgs);
    if (next) return next;
  }

  // Tier 3 — for a real category, cross-fall-back to the warmed 'all' deck.
  if (categoryKey !== 'all') {
    await warmAllDeckIfNeeded({ language, scope, authContext }).catch(() => {});
    next = await resolveNextGuessParams(resolveArgs);
    if (next) return next;
  }

  // Tier 4 — looping replay. Every server deck is exhausted for the cursor; the
  // server still HOLDS every card (client plays are local-only), so re-fetch
  // 'all' from HEAD and replay. Per-call bound: one fetch + one resolve. If the
  // head re-fetch itself is empty, the server truly has no cards for the
  // language/scope and we return null (the only legitimate bounce).
  if (await foregroundTopUp(topUpArgs, 'all', null)) {
    return resolveNextGuessParams(resolveArgs);
  }

  return null;
}
