import { bufferScore, mintGuessId } from './sessionScoreStore';
import { removeImageFromList, deleteImageFromStorage } from './storageDatum';
import { resolveNextCard } from './nextCardResolver';
import { SPEED_MULTIPLIER_BASE } from './speedMultiplier';

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
    await removeImageFromList(listId, categoryKey, language);
    await deleteImageFromStorage(imageFile);
  } catch (e) {
    console.warn('applySuccessSideEffects: storage cleanup failed (best-effort, score kept buffered)', e);
  }
}

export async function resolveNextGuessParams({ category, language, currentListId, isTutorial, scope }) {
  const result = await resolveNextCard({ category, language, currentListId, scope });
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
