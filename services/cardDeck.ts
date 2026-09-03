import { getImages } from '../utils/imagesRequests';
import type { GetImagesFilters } from '../utils/imagesRequests';
import { PUBLIC_FEED_END_CURSOR, clearExhaustedCategory, clearLastImageUuid, deckWriteLockKey, getLastImageUuid, normalizeListIds, storeImageList, updateImageList } from '../utils/storageDatum';
import type { DeckWriteLockScope } from '../utils/storageDatum';
import { filterPlayedCards } from '../utils/playedPictureIds';
import { withScopeLock } from '../utils/scopeMutex';
import { readGroupFeedCache, writeGroupFeedCache } from './groups/groupFeedCache';
import { PRIVATE_FEED_END_CURSOR } from './groups/groupFeedApi';

export interface CardImage {
  listId?: number;
  pictureId?: string;
  imageFile?: string;
  [key: string]: unknown;
}

export interface FetchCardBatchArgs {
  categoryKey?: string;
  categoryId?: string | number | null;
  language?: string | null;
  scope?: unknown;
  authContext?: unknown;
  pictureIdOverride?: string | null;
}

// Error-side `reason` is runtime-narrowed to the values getImages actually
// emits ('network' | 'server' | absent); the old .d.ts said `unknown`.
export type FetchCardBatchResult =
  | { isError: true; title?: string; message?: string; reason?: 'network' | 'server' }
  | { isError: false; reason?: 'empty' | 'played-out'; images: CardImage[] };

export interface AppendCardBatchArgs {
  cards?: CardImage[];
  categoryKey?: string;
  categoryId?: string | number | null;
  language?: string | null;
  scope?: unknown;
}

export interface PersistCardBatchArgs {
  cards?: CardImage[];
  categoryKey?: string;
  categoryId?: string | number | null;
  language?: string | null;
  scope?: unknown;
}

export interface RemoveCardFromGroupDeckArgs {
  groupId?: string;
  categoryId?: string | number | null;
  language?: string | null;
  listId?: number;
}

export interface ProbeAllPoolForUnplayedArgs {
  language?: string | null;
  scope?: unknown;
  authContext?: unknown;
  excludePictureId?: string;
}

export type ProbeAllPoolForUnplayedResult =
  | { status: 'unplayed' }
  | { status: 'exhausted' }
  | { status: 'indeterminate'; reason?: 'network' | 'server' | 'probe-cap' | 'played-out' };

type PrivateScope = { kind: 'private'; groupId: string };

function isPrivateScope(scope: unknown): scope is PrivateScope {
  return !!scope && typeof scope === 'object' &&
    (scope as { kind?: unknown }).kind === 'private' &&
    !!(scope as { groupId?: unknown }).groupId;
}

function normalizeLanguage(language?: string | null): string {
  return language || 'any';
}

/**
 * Server-side language filter. AsyncStorage uses 'any' as the canonical
 * "no language filter" namespace (see normalizeLanguage), but the backend's
 * Image.batch_with_existing_storage applies WHERE language = params[:language]
 * verbatim — and no image row has language='any'. So 'any' must be stripped at
 * the server boundary, or every card query under a no-filter session returns
 * empty. Real codes ('en', 'fr', …) pass through untouched.
 */
function resolveServerLanguage(language?: string | null): string | undefined {
  return language && language !== 'any' ? language : undefined;
}

function resolveCategoryId(categoryId?: string | number | null): string | number | null | undefined {
  return categoryId === 'all' ? undefined : categoryId;
}

/**
 * In-flight dedup for fetchCardBatch. Concurrent callers for the SAME scope
 * AND fetch mode collapse onto ONE in-flight promise; different modes
 * (cursor vs head vs explicit uuid) and different scopes run independently.
 * Mirrors the `inFlight` Map pattern in services/cardPrefetcher.ts.
 *
 * Why: nothing previously deduped concurrent fetchCardBatch calls. When the
 * deck ran low, prefetchIfLow / foregroundTopUp / SwipeImage.loadNewImages
 * all fired near-simultaneously, each reading the SAME persisted cursor
 * (which only advances deep inside getImages) and each POSTing the identical
 * next_image_batch → the same batch downloaded 2×–4×. appendCardBatch's
 * dedup hid the duplicate from the persisted deck but the network work and
 * base64 decode still repeated. Collapsing the callers onto one promise
 * eliminates the duplicate network round-trip at the source.
 */
const fetchInFlight = new Map<string, Promise<FetchCardBatchResult>>();

/**
 * Build the dedup key for an in-flight fetchCardBatch call.
 *
 * The key encodes BOTH scope identity and fetch mode so unrelated calls stay
 * independent:
 * - scope: `public`, or `private:<groupId>:<categoryId|all>`.
 * - mode: derived from pictureIdOverride — `'cursor'` when undefined (read
 *   getLastImageUuid), `'head'` when null (fresh-from-start fetch),
 *   `uuid:<id>` when an explicit picture id is requested.
 *
 * Consequence: two concurrent cursor calls for the same scope collapse onto
 * one promise; a cursor call and a head call do NOT (different batches).
 *
 * @returns dedup key used by fetchInFlight
 */
function fetchBatchDedupKey({ categoryKey, categoryId, language, scope, pictureIdOverride }: {
  categoryKey?: string;
  categoryId?: string | number | null;
  language?: string | null;
  scope?: unknown;
  pictureIdOverride?: string | null;
}): string {
  const lang = normalizeLanguage(language);
  const mode = pictureIdOverride === undefined
    ? 'cursor'
    : pictureIdOverride === null
      ? 'head'
      : `uuid:${pictureIdOverride}`;
  let scopePart: string;
  if (isPrivateScope(scope)) {
    scopePart = `private:${scope.groupId}:${resolveCategoryId(categoryId) ?? 'all'}`;
  } else {
    scopePart = 'public';
  }
  return `${categoryKey || 'all'}:${lang}:${scopePart}:${mode}`;
}

/**
 * Shared transport for EVERY card-fetch caller (background prefetcher,
 * foreground top-up, SwipeImage.loadNewImages). Resolves the next batch from
 * the backend for the given scope.
 *
 * pictureIdOverride resolution:
 * - `undefined` → read the persisted cursor via getLastImageUuid.
 * - `null` → head fetch (query from start, ignore cursor).
 * - `PUBLIC_FEED_END_CURSOR` sentinel → coerced to null (legacy self-heal).
 * - any other value → fetch the batch following that exact picture id.
 *
 * In-flight collapse: concurrent callers with the same dedup key share ONE
 * promise. The promise is stored in fetchInFlight BEFORE the first await so
 * the second caller sees it synchronously; the entry is deleted in `.finally`,
 * identity-guarded so a late clear cannot evict a newer promise for the key.
 * Eliminates the duplicate network round-trip + base64 decode that previously
 * occurred when prefetch/top-up/loadNewImages fired near-simultaneously.
 *
 * @returns backend batch response from getImages
 */
export function fetchCardBatch({ categoryKey, categoryId, language, scope, authContext, pictureIdOverride }: FetchCardBatchArgs = {}): Promise<FetchCardBatchResult> {
  const key = fetchBatchDedupKey({ categoryKey, categoryId, language, scope, pictureIdOverride });
  const existing = fetchInFlight.get(key);
  if (existing) {
    return existing;
  }

  const p = (async () => {
    const lang = normalizeLanguage(language);
    // Scope-aware cursor read (F1/F2): private scopes read the group-scoped
    // game-cursor key (same key saveLastImageUuid writes on the private
    // transport path); public/undefined scope keeps the shared
    // `lastImageUuid:<cat>:<lang>` shape.
    const lastImageUuid = await getLastImageUuid(categoryKey, lang, scope);
    // Fix 2a: a head fetch (pictureIdOverride === null) over ANY stored cursor
    // value (real uuid or either feed-end sentinel) is a head REPLAY —
    // persisting the head batch's tail would rewind the cursor and re-download
    // the whole feed on the next top-up. Pass persistCursor:false so getImages
    // leaves the stored cursor untouched. The conditional spread keeps
    // non-replay calls 3-arg (existing call-shape pins stay green).
    const isHeadReplay = pictureIdOverride === null && !!lastImageUuid;
    const pictureId = pictureIdOverride !== undefined ? pictureIdOverride : lastImageUuid;

    // Legacy self-heal: prior app versions persisted PUBLIC_FEED_END_CURSOR to
    // mark a category exhausted. The cold-mount path now bypasses the cursor
    // (always passes null), but refillOrFallback's foreground load and the
    // background prefetcher still call fetchCardBatch with no override. Treat
    // the stale sentinel as a fresh cursor so those paths also re-query from
    // head; the next non-empty batch overwrites the stale key with a real uuid.
    const effectivePictureId = pictureId === PUBLIC_FEED_END_CURSOR ? null : pictureId;

    // getImages' declared result is a loose `isError: boolean` interface; the
    // runtime shapes coincide with the tagged union above (success ⇒ images
    // array present, error ⇒ reason 'network'|'server'|absent).
    return getImages(
      effectivePictureId,
      authContext,
      buildFeedFilters({
        categoryKey, categoryId, language, scope,
      }),
      ...(isHeadReplay ? [{ persistCursor: false }] as [{ persistCursor: boolean }] : []),
    ) as unknown as Promise<FetchCardBatchResult>;
  })();

  fetchInFlight.set(key, p);
  p.finally(() => {
    if (fetchInFlight.get(key) === p) {
      fetchInFlight.delete(key);
    }
  });

  return p;
}

/**
 * Build the `getImages` filters object for the current scope. PRIVATE scopes
 * keep using `category_id` (server UUID); PUBLIC scopes switched to
 * `category_key` (bundled string key) and stopped sending `category_id`. The
 * 'all' pseudo-category sends neither key nor id (backend returns all).
 *
 * @returns filters object forwarded to getImages
 */
function buildFeedFilters({ categoryKey, categoryId, language, scope }: {
  categoryKey?: string;
  categoryId?: string | number | null;
  language?: string | null;
  scope?: unknown;
}): GetImagesFilters {
  const filters: GetImagesFilters = {
    language: resolveServerLanguage(language),
    scope: scope as GetImagesFilters['scope'],
  };
  if (isPrivateScope(scope)) {
    filters.category_id = resolveCategoryId(categoryId) as string | undefined;
    return filters;
  }
  if (categoryKey && categoryKey !== 'all') {
    filters.category_key = categoryKey;
  }
  return filters;
}

/**
 * Clear the exhausted-category marker whenever a NON-EMPTY batch for a real
 * category lands at a deck-write boundary. Paired writers of the marker —
 * services/cardPrefetcher.ts:190 (empty background prefetch) and
 * utils/nextCardAdvancer.ts:169 (empty Tier-2 foreground fetch) — must not
 * outlive proof that the server still serves the category: a stale marker
 * blocks every subsequent top-up, so new uploads never surface (Fix 1).
 * appendCardBatch clears on the RAW incoming batch length (pre-dedup — the
 * server proved the category non-empty regardless of local duplicates).
 * Fire-and-forget: the clear is advisory and must never reject the write path.
 */
function clearExhaustedMarkerIfLanded(cards: unknown, categoryKey?: string | null, lang?: string | null, scope?: unknown): void {
  if (!(Array.isArray(cards) && cards.length > 0 && categoryKey && categoryKey !== 'all')) {
    return;
  }
  clearExhaustedCategory(categoryKey, lang, scope).catch(() => {});
}

/**
 * Overwrite (not append) the persisted deck for the scope with the given cards.
 * Public scope → storeImageList; private scope → writeGroupFeedCache.
 * Returns the merged deck's normalized cards; callers (SwipeImage.handleData)
 * use the RETURN as the numbering source of truth (Fix 3 single-writer).
 *
 * @returns The normalized persisted cards.
 */
export async function persistCardBatch({ cards, categoryKey, categoryId, language, scope }: PersistCardBatchArgs = {}): Promise<CardImage[]> {
  const lang = normalizeLanguage(language);
  const normalized = normalizeListIds(Array.isArray(cards) ? cards : []);
  clearExhaustedMarkerIfLanded(cards, categoryKey, lang, scope);

  if (isPrivateScope(scope)) {
    await writeGroupFeedCache(
      scope.groupId,
      { categoryId: resolveCategoryId(categoryId) as string | undefined, language: lang },
      { images: normalized, nextCursor: null },
    );
    return normalized;
  }

  await storeImageList(normalized, categoryKey, lang);
  return normalized;
}

/**
 * Remove one card from the persisted private-group deck under the shared deck
 * write lock. Re-reads the PERSISTED deck inside the lock so a stale in-memory
 * component list cannot erase concurrently prefetched cards.
 *
 * @returns {Promise<void>}
 */
export async function removeCardFromGroupDeck({ groupId, categoryId, language, listId }: RemoveCardFromGroupDeckArgs = {}): Promise<void> {
  if (!groupId) {
    return;
  }

  const lang = normalizeLanguage(language);
  const cid = resolveCategoryId(categoryId) as string | undefined;

  await withScopeLock(
    deckWriteLockKey({ categoryId: cid, language: lang, scope: { kind: 'private', groupId } }),
    async () => {
      const existing = await readGroupFeedCache(groupId, { categoryId: cid, language: lang });
      if (!existing) {
        return;
      }

      const prior = Array.isArray(existing.images) ? existing.images : [];
      const images = prior.filter((card) => card?.listId !== listId);
      await writeGroupFeedCache(
        groupId,
        { categoryId: cid, language: lang },
        { images, nextCursor: existing?.nextCursor ?? null },
      );
    },
  );
}

/**
 * Append a batch to the persisted deck, scope-aware (mirrors persistCardBatch
 * but appends instead of overwriting). Dedups incoming cards against the
 * existing deck via dedupByPictureId, then serializes the read-modify-write
 * per scope under withScopeLock(deckWriteLockKey(...)) — the SHARED deck-write
 * lock (see utils/storageDatum.ts#deckWriteLockKey). Without the lock, two
 * concurrent appendCardBatch calls for the same scope would both read the
 * prior deck, each concat its own batch, and the later write wins → the
 * earlier batch is orphaned on disk and the deck stays empty. The append lock
 * key is deliberately separate from the fetch dedup key (fetchBatchDedupKey),
 * so the append lock never blocks the fetch path — no deadlock.
 *
 * Returns the merged deck; callers use it as the numbering source of truth
 * (Fix 3: the storage boundary is the SINGLE listId writer).
 *
 * @returns The new persisted deck (post-dedup/normalize).
 */
export async function appendCardBatch({ cards, categoryKey, categoryId, language, scope }: AppendCardBatchArgs = {}): Promise<CardImage[]> {
  const lang = normalizeLanguage(language);

  return withScopeLock(
    deckWriteLockKey({ categoryKey, categoryId, language: lang, scope: scope as DeckWriteLockScope }),
    async () => {
      clearExhaustedMarkerIfLanded(cards, categoryKey, lang, scope);
      const incoming = Array.isArray(cards) ? await filterPlayedCards(cards, lang, scope) : [];
      if (isPrivateScope(scope)) {
        const cid = resolveCategoryId(categoryId) as string | undefined;
        const existing = await readGroupFeedCache(scope.groupId, { categoryId: cid, language: lang });
        const prior = (existing?.images ?? []) as CardImage[];
        const deduped = dedupByPictureId(prior, incoming);
        const merged = normalizeListIds([...prior, ...deduped]);
        await writeGroupFeedCache(
          scope.groupId,
          { categoryId: cid, language: lang },
          { images: merged, nextCursor: existing?.nextCursor ?? null },
        );
        return merged;
      }

      return await updateImageList(incoming, categoryKey, lang);
    },
  );
}

/**
 * Drop incoming cards whose `pictureId` already exists in the prior deck.
 *
 * RC10/T4.3: the server can re-serve a card already in the local deck when
 * the cursor (`getLastImageUuid`) is stale. Without dedup, the duplicate
 * gets a NEW listId (via normalizeListIds) greater than currentListId, and
 * getNextImage returns it → the just-played card repeats. Drop duplicates
 * by `pictureId` so the existing card's listId is preserved and the
 * duplicate never enters the deck.
 *
 * Cards with no `pictureId` (legacy server payloads) pass through — there is
 * no key to dedup against, so dropping them would lose data.
 */
function dedupByPictureId(prior: CardImage[], incoming: CardImage[]): CardImage[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return [];
  const priorIds = new Set(
    Array.isArray(prior) ? prior.map((c) => c?.pictureId).filter(Boolean) : [],
  );
  return incoming.filter((c) => !c?.pictureId || !priorIds.has(c.pictureId));
}

/**
 * Upper bound on how many all-played batches probeAllPoolForUnplayed pages
 * through before giving up. A cap hit yields 'indeterminate' (fail OPEN: no
 * cycle transition follows — worst case an exhausted panel, never a repeat),
 * never a false 'exhausted'.
 */
export const PROBE_MAX_BATCHES = 20;

/**
 * Sound exhaustion proof for the 'all' pool: page the cursor forward
 * (cursor-mode fetches only — pictureIdOverride stays undefined, NEVER null)
 * until either an UNPLAYED card lands (pool not exhausted) or the server
 * returns an empty batch (pool drained — the only valid exhaustion signal).
 *
 * Replaces the unsound one-head-batch proof (`tier4.ok && !next`,
 * `isCycleExhausted(headDeck.length, filtered)`) that treated ONE
 * played-filtered head batch as whole-pool exhaustion and triggered
 * premature cycle transitions (validated images re-served, category-only
 * wipe loop).
 *
 * Writes ONLY the feed cursor: the transport's own batch-tail persist plus
 * one sentinel clear. No cycle-state writes, no servingCycle import
 * (cycle policy stays storage-only in utils/servingCycle.ts). Transient
 * fetch failures return 'indeterminate' and mutate nothing (I7).
 *
 * Sentinel pre-clear: a stored feed-end cursor (PUBLIC or PRIVATE sentinel)
 * makes every cursor-mode fetch a no-advance replay (public) or an
 * exhausted short-circuit (private) — the probe could never move. The mount
 * path writes that sentinel unsoundly, and clearing a feed-end marker never
 * rewinds a real cursor (I5 intact).
 *
 * @param excludePictureId - Just-played card, not yet in the
 *   played-set at advance time — excluded from the unplayed CHECK only (the
 *   full batch is still appended through appendCardBatch on success).
 */
export async function probeAllPoolForUnplayed({ language, scope, authContext, excludePictureId }: ProbeAllPoolForUnplayedArgs = {}): Promise<ProbeAllPoolForUnplayedResult> {
  const lang = normalizeLanguage(language);

  const cursor = await getLastImageUuid('all', lang, scope);
  if (cursor === PUBLIC_FEED_END_CURSOR || cursor === PRIVATE_FEED_END_CURSOR) {
    await clearLastImageUuid('all', lang, scope);
  }

  for (let fetched = 0; fetched < PROBE_MAX_BATCHES; fetched++) {
    const result = await fetchCardBatch({ categoryKey: 'all', language: lang, scope, authContext });

    if (!result || result.isError === true) {
      return { status: 'indeterminate', reason: result?.reason ?? 'server' };
    }

    const batch = Array.isArray(result.images) ? result.images : [];
    if (batch.length === 0) {
      if (result.reason === 'played-out') {
        return { status: 'indeterminate', reason: 'played-out' };
      }
      return { status: 'exhausted' };
    }

    const unplayed = await filterPlayedCards(batch, lang, scope);
    const candidates = excludePictureId
      ? unplayed.filter((card) => card?.pictureId !== excludePictureId)
      : unplayed;
    if (candidates.length > 0) {
      await appendCardBatch({ cards: batch, categoryKey: 'all', language: lang, scope });
      return { status: 'unplayed' };
    }
  }

  return { status: 'indeterminate', reason: 'probe-cap' };
}
