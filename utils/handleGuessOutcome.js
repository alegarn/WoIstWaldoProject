import { bufferScore, mintGuessId } from './sessionScoreStore';
import { addPlayedPictureId, removeImageFromList, deleteImageFromStorage } from './storageDatum';
import { resolveNextCard } from './nextCardResolver';
import { SPEED_MULTIPLIER_BASE } from './speedMultiplier';

/**
 * Best-effort side effects of a correct guess: buffer the score, remove the
 * played card from its OWN deck namespace (removeImageFromList by listId) so
 * the deck advances past it, and delete the cached image file. Score buffering
 * runs first; storage cleanup is wrapped so a failure there cannot unwind an
 * already-buffered score.
 *
 * @param {object} args - { listId, categoryKey, language, imageFile, pictureId, scope, userId, points, multiplier, streak, streakMultiplier }
 * @returns {Promise<void>}
 */
export async function applySuccessSideEffects({ listId, categoryKey, language, imageFile, pictureId, scope, userId, points = SPEED_MULTIPLIER_BASE, multiplier, streak = 0, streakMultiplier }) {
  await bufferScore({
    guessId: mintGuessId(),
    imageName: pictureId,
    imageId: scope?.kind === 'private' ? pictureId : undefined,
    pictureId,
    scope,
    points,
    ...(multiplier !== undefined ? { multiplier } : {}),
    streak,
    ...(streakMultiplier !== undefined ? { streakMultiplier } : {}),
    ts: Date.now(),
    userId,
  });

  try {
    addPlayedPictureId(pictureId, language, scope).catch(() => {});
    await removeImageFromList(listId, categoryKey, language);
    await deleteImageFromStorage(imageFile);
  } catch (e) {
    console.warn('applySuccessSideEffects: storage cleanup failed (best-effort, score kept buffered)', e);
  }
}

/**
 * Resolve the params for the next card after a guess. Forwards
 * currentPictureId (the just-played card) into resolveNextCard so it can be
 * excluded from the next pick. Read-only: performs no network or storage
 * mutation. Returns null if no next card is available.
 *
 * @param {object} args - { category, language, currentListId, isTutorial, scope, currentPictureId }
 * @returns {Promise<{params: Object<string, *>}|null>}
 */
export async function resolveNextGuessParams({ category, language, currentListId, isTutorial, scope, currentPictureId }) {
  const result = await resolveNextCard({ category, language, currentListId, scope, currentPictureId });
  if (!result || !result.card) return null;

  const card = result.card;
  return {
    params: {
      ...card,
      hiddenLocation: card.hiddenLocation ?? card.touchLocation,
      category: result.category,
      language,
      isTutorial,
      skipInstructions: true,
      ...(scope?.kind === 'private' ? { scope } : {}),
    },
  };
}
