import { getImages } from '../utils/imagesRequests';
import { getLastImageUuid, storeImageList, updateImageList } from '../utils/storageDatum';
import { readGroupFeedCache, writeGroupFeedCache } from './groups/groupFeedCache';

function normalizeLanguage(language) {
  return language || 'any';
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

  return getImages(pictureId, authContext, {
    category_id: resolveCategoryId(categoryId),
    category_key: categoryKey || 'all',
    language,
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
