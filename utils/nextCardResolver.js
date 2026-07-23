import { RECENT_ALL_CATEGORY } from '../constants/categories';
import { getNextImageForScope } from './storageDatum';

/**
 * Read-only client resolver: pick the deck to advance in. Never mutates,
 * never fetches.
 *
 * - In "All" → advance WITHIN All using the real cursor (else first-card loop).
 * - In a real category → try it; on the category→'all' cross-fallback pass
 *   `currentListId: undefined` because listIds are per-namespace (meaningless
 *   cross-namespace); `pictureId` is the only cross-namespace identity, so the
 *   All listId space starts at its first card.
 *
 * currentPictureId (the just-played card) is spread as `excludePictureId` into
 * EVERY getNextImageForScope call — both the in-category call and the 'all'
 * cross-fallback — so the just-played card is never re-served. This is the fix
 * for the stuck-on-card bug.
 *
 * @param {object} args - { category, language, currentListId, scope, currentPictureId }
 * @returns {Promise<{card: object, category: object}|null>}
 */
export async function resolveNextCard({ category, language, currentListId, scope, currentPictureId }) {
  const exclude = currentPictureId ? { excludePictureId: currentPictureId } : {};
  const inAll = category?.key === 'all';
  if (inAll) {
    const card = await getNextImageForScope({ category, language, currentListId, scope, ...exclude });
    return card ? { card, category } : null;
  }

  const cat = await getNextImageForScope({ category, language, currentListId, scope, ...exclude });
  if (cat) return { card: cat, category };

  const allCard = await getNextImageForScope({
    category: RECENT_ALL_CATEGORY,
    language,
    currentListId: undefined,
    scope,
    ...exclude,
  });
  return allCard ? { card: allCard, category: RECENT_ALL_CATEGORY } : null;
}
