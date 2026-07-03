import { getImages } from '../utils/imagesRequests';
import { getLastImageUuid, storeImageList } from '../utils/storageDatum';
import { writeGroupFeedCache } from './groups/groupFeedCache';

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
