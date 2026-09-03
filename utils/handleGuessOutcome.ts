import { bufferScore, mintGuessId } from './sessionScoreStore';
import { removeImageFromList, deleteImageFromStorage, sweepPlayedOrphanCacheFiles } from './storageDatum';
import { addPlayedPictureId } from './playedPictureIds';
import { resolveNextCard } from './nextCardResolver';
import { SPEED_MULTIPLIER_BASE } from './speedMultiplier';

function isPrivateKind(scope: unknown): boolean {
  return !!scope && typeof scope === 'object' &&
    (scope as { kind?: unknown }).kind === 'private';
}

export interface ApplySuccessSideEffectsArgs {
  listId?: number;
  categoryKey?: string | null;
  language?: string | null;
  imageFile?: string | null;
  pictureId?: string | null;
  scope?: unknown;
  userId?: unknown;
  points?: number;
  multiplier?: number;
  streak?: number;
  streakMultiplier?: number;
}

export interface ResolveNextGuessParamsArgs {
  category?: { id?: string | number | null; key?: string } | null;
  language?: string | null;
  currentListId?: number;
  isTutorial?: boolean;
  scope?: unknown;
  currentPictureId?: string;
}

export interface ResolveNextGuessParamsResult {
  params: Record<string, unknown>;
}

/**
 * Best-effort side effects of a correct guess: buffer the score, remove the
 * played card from its OWN deck namespace (removeImageFromList by listId) so
 * the deck advances past it, and delete the cached image file. Score buffering
 * runs first; storage cleanup is wrapped so a failure there cannot unwind an
 * already-buffered score.
 *
 * @returns {Promise<void>}
 */
export async function applySuccessSideEffects({ listId, categoryKey, language, imageFile, pictureId, scope, userId, points = SPEED_MULTIPLIER_BASE, multiplier, streak = 0, streakMultiplier }: ApplySuccessSideEffectsArgs): Promise<void> {
  await bufferScore({
    guessId: mintGuessId(),
    imageName: pictureId,
    imageId: isPrivateKind(scope) ? pictureId : undefined,
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
    await removeImageFromList(listId as number, categoryKey, language);
    await deleteImageFromStorage(imageFile);
    // Task 2b: public-only played-orphan sweep (private-* cache files are
    // owned by purgeAllPrivateCaches).
    if (!(isPrivateKind(scope) && !!(scope as { groupId?: unknown }).groupId)) {
      await sweepPlayedOrphanCacheFiles(language);
    }
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
 * @returns {Promise<{params: Record<string, unknown>}|null>}
 */
export async function resolveNextGuessParams({ category, language, currentListId, isTutorial, scope, currentPictureId }: ResolveNextGuessParamsArgs): Promise<ResolveNextGuessParamsResult | null> {
  const result = await resolveNextCard({ category, language, currentListId, scope, currentPictureId });
  if (!result || !result.card) return null;

  const card = result.card as Record<string, unknown>;
  return {
    params: {
      ...card,
      hiddenLocation: card.hiddenLocation ?? card.touchLocation,
      category: result.category,
      language,
      isTutorial,
      skipInstructions: true,
      ...(isPrivateKind(scope) ? { scope } : {}),
    },
  };
}
