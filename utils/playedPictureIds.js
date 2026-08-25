import AsyncStorage from '@react-native-async-storage/async-storage';
import { withScopeLock } from './scopeMutex';

const PLAYED_PICTURE_IDS_CAP = 200;
export const PLAYED_PICTURE_IDS_PREFIX = 'playedPictureIds';

function isPrivateScope(scope) {
  return scope?.kind === 'private' && scope?.groupId;
}

export function playedPictureIdsKey(language, scope) {
  return `${PLAYED_PICTURE_IDS_PREFIX}:${isPrivateScope(scope) ? `group:${scope.groupId}` : 'public'}:${language || 'any'}`;
};

export async function getPlayedPictureIds(language, scope) {
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

export async function addPlayedPictureId(pictureId, language, scope) {
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

export async function filterPlayedCards(cards, language, scope) {
  if (!Array.isArray(cards)) {
    return [];
  }
  let playedIds;
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

async function removeKeysByPrefix(prefix) {
  const keys = await AsyncStorage.getAllKeys();
  const target = keys.filter((key) => typeof key === 'string' && key.startsWith(prefix));
  if (target.length > 0) {
    await AsyncStorage.multiRemove(target);
  }
};

export async function clearPlayedPictureIdsForGroup(groupId) {
  await removeKeysByPrefix(`${PLAYED_PICTURE_IDS_PREFIX}:group:${groupId}:`);
};

export async function clearAllPrivatePlayedPictureIds() {
  await removeKeysByPrefix(`${PLAYED_PICTURE_IDS_PREFIX}:group:`);
};

export async function resetPlayedPictureIdsForScope(language, scope) {
  const key = playedPictureIdsKey(language, scope);

  await withScopeLock(key, async () => {
    await AsyncStorage.removeItem(key);
  });
};
