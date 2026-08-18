import { getImages } from '../utils/imagesRequests';
import { PUBLIC_FEED_END_CURSOR, getLastImageUuid, normalizeListIds, storeImageList, updateImageList } from '../utils/storageDatum';
import { withScopeLock } from '../utils/scopeMutex';
import { readGroupFeedCache, writeGroupFeedCache } from './groups/groupFeedCache';

function normalizeLanguage(language) {
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
function resolveServerLanguage(language) {
  return language && language !== 'any' ? language : undefined;
}

function resolveCategoryId(categoryId) {
  return categoryId === 'all' ? undefined : categoryId;
}

function isPrivateScope(scope) {
  return !!scope && scope.kind === 'private' && !!scope.groupId;
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
const fetchInFlight = new Map();

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
 * @param {object} args - { categoryKey, categoryId, language, scope, pictureIdOverride }
 * @returns {string} dedup key used by fetchInFlight
 */
function fetchBatchDedupKey({ categoryKey, categoryId, language, scope, pictureIdOverride }) {
  const lang = normalizeLanguage(language);
  const mode = pictureIdOverride === undefined
    ? 'cursor'
    : pictureIdOverride === null
      ? 'head'
      : `uuid:${pictureIdOverride}`;
  let scopePart;
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
 * @param {object} opts - { categoryKey, categoryId, language, scope, authContext, pictureIdOverride }
 * @returns {Promise<object>} backend batch response from getImages
 */
export function fetchCardBatch({ categoryKey, categoryId, language, scope, authContext, pictureIdOverride } = {}) {
  const key = fetchBatchDedupKey({ categoryKey, categoryId, language, scope, pictureIdOverride });
  const existing = fetchInFlight.get(key);
  if (existing) {
    return existing;
  }

  const p = (async () => {
    const lang = normalizeLanguage(language);
    const lastImageUuid = await getLastImageUuid(categoryKey, lang);
    const pictureId = pictureIdOverride !== undefined ? pictureIdOverride : lastImageUuid;

    // Legacy self-heal: prior app versions persisted PUBLIC_FEED_END_CURSOR to
    // mark a category exhausted. The cold-mount path now bypasses the cursor
    // (always passes null), but refillOrFallback's foreground load and the
    // background prefetcher still call fetchCardBatch with no override. Treat
    // the stale sentinel as a fresh cursor so those paths also re-query from
    // head; the next non-empty batch overwrites the stale key with a real uuid.
    const effectivePictureId = pictureId === PUBLIC_FEED_END_CURSOR ? null : pictureId;

    return getImages(effectivePictureId, authContext, buildFeedFilters({
      categoryKey, categoryId, language, scope,
    }));
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
 * @param {object} args - { categoryKey, categoryId, language, scope }
 * @returns {object} filters object forwarded to getImages
 */
function buildFeedFilters({ categoryKey, categoryId, language, scope }) {
  const filters = {
    language: resolveServerLanguage(language),
    scope,
  };
  if (isPrivateScope(scope)) {
    filters.category_id = resolveCategoryId(categoryId);
    return filters;
  }
  if (categoryKey && categoryKey !== 'all') {
    filters.category_key = categoryKey;
  }
  return filters;
}

/**
 * Overwrite (not append) the persisted deck for the scope with the given cards.
 * Public scope → storeImageList; private scope → writeGroupFeedCache.
 * Always returns null (callers ignore the deck contents here).
 *
 * @param {object} args - { cards, categoryKey, categoryId, language, scope }
 * @returns {Promise<null>}
 */
export async function persistCardBatch({ cards, categoryKey, categoryId, language, scope } = {}) {
  const lang = normalizeLanguage(language);

  if (isPrivateScope(scope)) {
    await writeGroupFeedCache(
      scope.groupId,
      { categoryId: resolveCategoryId(categoryId), language: lang },
      { images: cards, nextCursor: null },
    );
    return null;
  }

  await storeImageList(cards, categoryKey, lang);
  return null;
}

/**
 * Append a card batch to the persisted deck (scope-aware). Mirrors persistCardBatch
 * scope branching but appends instead of overwriting. Used by background prefetch
 * (cardPrefetcher) to grow the deck without losing existing cards.
 * - Public scope: reuses updateImageList (already appends to AsyncStorage).
 * - Private scope: reads the group feed cache, concatenates, writes back.
 * Returns null (matches persistCardBatch return contract).
 *
 * The RMW window (read → concat → write) is serialized per scope via
 * withScopeLock. Key derivation mirrors getDeckCountForScope / groupFeedListKey:
 * (categoryKey|categoryId, language, groupId) → one lock per scope. Closes R2:
 * without the lock, two concurrent appendCardBatch calls for the same scope
 * would both read the prior deck, each concat its own batch, and the later
 * write wins → the earlier batch is orphaned on disk and the deck stays empty.
 */
function appendCardBatchLockKey({ categoryKey, categoryId, language, scope }) {
  const lang = normalizeLanguage(language);
  if (isPrivateScope(scope)) {
    const cid = resolveCategoryId(categoryId);
    return `cardDeck:append:private:${scope.groupId}:${cid ?? 'all'}:${lang}`;
  }
  return `cardDeck:append:public:${categoryKey || 'all'}:${lang}`;
}

/**
 * Append a batch to the persisted deck, scope-aware (mirrors persistCardBatch
 * but appends instead of overwriting). Dedups incoming cards against the
 * existing deck via dedupByPictureId, then serializes the read-modify-write
 * per scope under withScopeLock. The append lock key (appendCardBatchLockKey)
 * is deliberately separate from the fetch dedup key (fetchBatchDedupKey), so
 * the append lock never blocks the fetch path — no deadlock.
 *
 * @param {object} args - { cards, categoryKey, categoryId, language, scope }
 * @returns {Promise<null>} always null (matches persistCardBatch contract)
 */
export async function appendCardBatch({ cards, categoryKey, categoryId, language, scope } = {}) {
  const lang = normalizeLanguage(language);

  return withScopeLock(appendCardBatchLockKey({ categoryKey, categoryId, language, scope }), async () => {
    if (isPrivateScope(scope)) {
      const cid = resolveCategoryId(categoryId);
      const existing = await readGroupFeedCache(scope.groupId, { categoryId: cid, language: lang });
      const prior = existing?.images ?? [];
      const deduped = dedupByPictureId(prior, cards);
      const merged = normalizeListIds([...prior, ...deduped]);
      await writeGroupFeedCache(
        scope.groupId,
        { categoryId: cid, language: lang },
        { images: merged, nextCursor: existing?.nextCursor ?? null },
      );
      return null;
    }

    await updateImageList(cards, categoryKey, lang);
    return null;
  });
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
function dedupByPictureId(prior, incoming) {
  if (!Array.isArray(incoming) || incoming.length === 0) return [];
  const priorIds = new Set(
    Array.isArray(prior) ? prior.map((c) => c?.pictureId).filter(Boolean) : [],
  );
  return incoming.filter((c) => !c?.pictureId || !priorIds.has(c.pictureId));
}
