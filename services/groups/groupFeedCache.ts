import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { clearAllPrivatePlayedPictureIds, clearPlayedPictureIdsForGroup } from '../../utils/playedPictureIds';
import { clearAllGroupHubCaches } from './groupHubCache';

export type CachedFeedImage = {
  imageFile?: string | null;
  pictureId?: string | null;
  listId?: number;
  [key: string]: unknown;
};

const PREFIX = 'groupFeed';
const EXHAUSTED_PREFIX = 'groupFeedExhausted';

function groupFeedListKey(groupId: string | number, categoryKey?: string | null, language?: string | null) {
  return `${PREFIX}:${groupId}:${categoryKey || 'all'}:${language || 'any'}`;
}

function groupFeedCursorKey(groupId: string | number, categoryKey?: string | null, language?: string | null) {
  return `${groupFeedListKey(groupId, categoryKey, language)}:cursor`;
}

/**
 * Game-path TRANSPORT cursor key (private serving cursor, F1/F2 review fix).
 * Distinct from groupFeedCursorKey (deck-cache `{nextCursor}` JSON written by
 * writeGroupFeedCache) via the `game:` category-segment marker, and shaped to
 * match the servingCycle group-branch clear (`groupFeed:<gid>:*:<lang>:cursor`)
 * so a cycle transition wipes it together with the other group cursors.
 */
function groupGameCursorKey(groupId: string | number, categoryKey?: string | null, language?: string | null) {
  return `${PREFIX}:${groupId}:game:${categoryKey || 'all'}:${language || 'any'}:cursor`;
}

function groupFeedExhaustedKey(groupId: string | number, categoryKey?: string | null, language?: string | null) {
  return `${EXHAUSTED_PREFIX}:${groupId}:${categoryKey || 'all'}:${language || 'any'}`;
}

export { groupFeedListKey, groupFeedCursorKey, groupGameCursorKey, groupFeedExhaustedKey };

function localFileExists(uri: string) {
  try {
    return !!new File(uri).exists;
  } catch {
    return false;
  }
}

function deleteFileIfPresent(uri: string) {
  try {
    const file = new File(uri);
    if (file?.exists) {
      file.delete();
    }
  } catch {
    // best-effort
  }
}

export async function readGroupFeedCache(
  groupId: string | number,
  { categoryId, language }: { categoryId?: string | null; language?: string | null } = {}
): Promise<{ images: CachedFeedImage[]; nextCursor: string | null } | null> {
  const categoryKey = categoryId || 'all';
  const languageKey = language || 'any';
  const listKey = groupFeedListKey(groupId, categoryKey, languageKey);
  const cursorKey = groupFeedCursorKey(groupId, categoryKey, languageKey);

  const stored = await AsyncStorage.getItem(listKey);
  if (!stored) {
    return null;
  }

  let images;
  try {
    images = JSON.parse(stored);
  } catch {
    return null;
  }

  if (!Array.isArray(images)) {
    return null;
  }

  const viable = images.filter((image) => localFileExists(image?.imageFile));

  if (viable.length !== images.length) {
    await AsyncStorage.setItem(listKey, JSON.stringify(viable));
  }

  const cursorStored = await AsyncStorage.getItem(cursorKey);
  let nextCursor = null;
  try {
    nextCursor = JSON.parse(cursorStored ?? 'null')?.nextCursor ?? null;
  } catch {
    nextCursor = null;
  }

  return { images: viable, nextCursor };
}

export async function writeGroupFeedCache(
  groupId: string | number,
  { categoryId, language }: { categoryId?: string | null; language?: string | null } = {},
  { images, nextCursor }: { images?: CachedFeedImage[]; nextCursor?: string | null } = {}
) {
  const categoryKey = categoryId || 'all';
  const languageKey = language || 'any';

  await AsyncStorage.setItem(
    groupFeedListKey(groupId, categoryKey, languageKey),
    JSON.stringify(Array.isArray(images) ? images : []),
  );
  await AsyncStorage.setItem(
    groupFeedCursorKey(groupId, categoryKey, languageKey),
    JSON.stringify({ nextCursor: nextCursor ?? null }),
  );
}

export async function clearGroupFeedCache(groupId: string | number) {
  const keys = await AsyncStorage.getAllKeys();
  const target = keys.filter((key) => typeof key === 'string' && key.startsWith(`${PREFIX}:${groupId}:`));

  if (target.length > 0) {
    await AsyncStorage.multiRemove(target);
  }

  await clearPlayedPictureIdsForGroup(groupId as string);
}

export async function clearAllGroupFeedCaches() {
  const keys = await AsyncStorage.getAllKeys();
  const target = keys.filter((key) => typeof key === 'string' && key.startsWith(`${PREFIX}:`));

  if (target.length > 0) {
    await AsyncStorage.multiRemove(target);
  }
}

export async function markGroupCategoryExhausted(groupId: string | number, categoryKey?: string | null, language?: string | null) {
  await AsyncStorage.setItem(groupFeedExhaustedKey(groupId, categoryKey, language), '1');
}

export async function isGroupCategoryExhausted(groupId: string | number, categoryKey?: string | null, language?: string | null) {
  return (await AsyncStorage.getItem(groupFeedExhaustedKey(groupId, categoryKey, language))) === '1';
}

export async function clearGroupCategoryExhausted(groupId: string | number, categoryKey?: string | null, language?: string | null) {
  await AsyncStorage.removeItem(groupFeedExhaustedKey(groupId, categoryKey, language));
}

export async function clearAllGroupFeedExhaustedMarkers() {
  const keys = await AsyncStorage.getAllKeys();
  const target = keys.filter((key) => typeof key === 'string' && key.startsWith(`${EXHAUSTED_PREFIX}:`));

  if (target.length > 0) {
    await AsyncStorage.multiRemove(target);
  }
}

// Private group feed images are written under Paths.cache with a `private-`
// basename prefix (see services/groups/groupFeedApi downloadImageToFile) so the
// purge below can target them without touching public cache files written by
// utils/imagesRequests. Pre-existing private entries written before the
// prefix was introduced are intentionally left alone and will age out.
const PRIVATE_CACHE_PREFIX = 'private-';

function isPrivateCacheUri(uri: unknown) {
  if (typeof uri !== 'string') {
    return false;
  }

  const segments = uri.split('/');
  const name = segments[segments.length - 1];

  return name.startsWith(PRIVATE_CACHE_PREFIX);
}

export async function purgeAllPrivateCaches() {
  await clearAllGroupFeedCaches();
  await clearAllGroupFeedExhaustedMarkers();
  await clearAllPrivatePlayedPictureIds();
  await clearAllGroupHubCaches();

  try {
    Paths.cache.create({ idempotent: true, intermediates: true });
    const cacheDir = Paths.cache;
    const entries = typeof cacheDir?.list === 'function' ? cacheDir.list() : [];

    if (Array.isArray(entries)) {
      for (const entry of entries) {
        const uri = typeof entry === 'string' ? entry : entry?.uri;
        if (isPrivateCacheUri(uri)) {
          deleteFileIfPresent(uri);
        }
      }
    }
  } catch {
    // best-effort
  }
}
