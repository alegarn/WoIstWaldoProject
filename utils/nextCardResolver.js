import { RECENT_ALL_CATEGORY } from '../constants/categories';
import { getNextImageForScope } from './storageDatum';

/**
 * Read-only orchestrator: pick the deck to advance in.
 * - In "All" → advance WITHIN All using the real cursor (else first-card loop).
 * - In a real category → try it; on the category/All boundary pass undefined so
 *   the separate All listId space starts at its first card.
 * Returns { card, category } | null. Never mutates, never fetches.
 */
export async function resolveNextCard({ category, language, currentListId, scope }) {
  const inAll = category?.key === 'all';
  if (inAll) {
    const card = await getNextImageForScope({ category, language, currentListId, scope });
    return card ? { card, category } : null;
  }

  const cat = await getNextImageForScope({ category, language, currentListId, scope });
  if (cat) return { card: cat, category };

  const allCard = await getNextImageForScope({
    category: RECENT_ALL_CATEGORY,
    language,
    currentListId: undefined,
    scope,
  });
  return allCard ? { card: allCard, category: RECENT_ALL_CATEGORY } : null;
}
