import AsyncStorage from '@react-native-async-storage/async-storage';
import { withScopeLock } from './scopeMutex';
import type { CardImage } from '../services/cardDeck';

export const PLAYED_PICTURE_IDS_CAP = 200;
export const PLAYED_PICTURE_IDS_PREFIX = 'playedPictureIds';

type PrivateScope = { kind: 'private'; groupId: string };

function isPrivateScope(scope: unknown): scope is PrivateScope {
  return !!scope && typeof scope === 'object' &&
    (scope as { kind?: unknown }).kind === 'private' &&
    !!(scope as { groupId?: unknown }).groupId;
}

export function playedPictureIdsKey(language: string | null | undefined, scope: unknown): string {
  return `${PLAYED_PICTURE_IDS_PREFIX}:${isPrivateScope(scope) ? `group:${scope.groupId}` : 'public'}:${language || 'any'}`;
};

export async function getPlayedPictureIds(language: string | null | undefined, scope: unknown): Promise<string[]> {
  const stored = await AsyncStorage.getItem(playedPictureIdsKey(language, scope));
  if (!stored) {
    return [];
  }
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export async function addPlayedPictureId(pictureId: string | null | undefined, language: string | null | undefined, scope: unknown): Promise<void> {
  if (!pictureId) {
    return;
  }
  const key = playedPictureIdsKey(language, scope);

  await withScopeLock(key, async () => {
    const played = await getPlayedPictureIds(language, scope);
    if (played.includes(pictureId)) {
      return;
    }
    const next = [...played, pictureId].slice(-PLAYED_PICTURE_IDS_CAP);
    await AsyncStorage.setItem(key, JSON.stringify(next));
  });
};

export async function filterPlayedCards(cards: CardImage[], language: string | null | undefined, scope?: unknown): Promise<CardImage[]> {
  if (!Array.isArray(cards)) {
    return [];
  }
  let playedIds: string[];
  try {
    playedIds = await getPlayedPictureIds(language, scope);
  } catch {
    return cards;
  }
  if (playedIds.length === 0) {
    return cards;
  }
  const played = new Set(playedIds);
  return cards.filter((card) => !card?.pictureId || !played.has(card.pictureId));
};

async function removeKeysByPrefix(prefix: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const target = keys.filter((key) => typeof key === 'string' && key.startsWith(prefix));
  if (target.length > 0) {
    await AsyncStorage.multiRemove(target);
  }
};

export async function clearPlayedPictureIdsForGroup(groupId: string): Promise<void> {
  await removeKeysByPrefix(`${PLAYED_PICTURE_IDS_PREFIX}:group:${groupId}:`);
};

export async function clearAllPrivatePlayedPictureIds(): Promise<void> {
  await removeKeysByPrefix(`${PLAYED_PICTURE_IDS_PREFIX}:group:`);
};

// Fix 1 replay-cycle restart: clears the WHOLE scope+language played-set under
// the SAME lock key as addPlayedPictureId, so an in-flight add cannot write
// stale ids after the reset.
export async function resetPlayedPictureIdsForScope(language: string | null | undefined, scope: unknown): Promise<void> {
  const key = playedPictureIdsKey(language, scope);

  await withScopeLock(key, async () => {
    await AsyncStorage.removeItem(key);
  });
};
