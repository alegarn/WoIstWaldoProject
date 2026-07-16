import { getImages } from '../utils/imagesRequests';
import { PUBLIC_FEED_END_CURSOR, getLastImageUuid, storeImageList, updateImageList } from '../utils/storageDatum';
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

export async function fetchCardBatch({ categoryKey, categoryId, language, scope, authContext, pictureIdOverride } = {}) {
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

  return getImages(effectivePictureId, authContext, {
    category_id: resolveCategoryId(categoryId),
    category_key: categoryKey || 'all',
    language: resolveServerLanguage(language),
    scope,
  });
}

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
 */
export async function appendCardBatch({ cards, categoryKey, categoryId, language, scope } = {}) {
  const lang = normalizeLanguage(language);

  if (isPrivateScope(scope)) {
    const cid = resolveCategoryId(categoryId);
    const existing = await readGroupFeedCache(scope.groupId, { categoryId: cid, language: lang });
    const prior = existing?.images ?? [];
    const merged = [...prior, ...cards];
    await writeGroupFeedCache(
      scope.groupId,
      { categoryId: cid, language: lang },
      { images: merged, nextCursor: existing?.nextCursor ?? null },
    );
    return null;
  }

  await updateImageList(cards, categoryKey, lang);
  return null;
}
