import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

const PREFIX = 'groupFeed';

function groupFeedListKey(groupId, categoryKey, language) {
  return `${PREFIX}:${groupId}:${categoryKey || 'all'}:${language || 'any'}`;
}

function groupFeedCursorKey(groupId, categoryKey, language) {
  return `${groupFeedListKey(groupId, categoryKey, language)}:cursor`;
}

export { groupFeedListKey, groupFeedCursorKey };

function localFileExists(uri) {
  try {
    return !!new File(uri).exists;
  } catch {
    return false;
  }
}

function deleteFileIfPresent(uri) {
  try {
    const file = new File(uri);
    if (file?.exists) {
      file.delete();
    }
  } catch {
    // best-effort
  }
}

export async function readGroupFeedCache(groupId, { categoryId, language } = {}) {
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
    nextCursor = JSON.parse(cursorStored)?.nextCursor ?? null;
  } catch {
    nextCursor = null;
  }

  return { images: viable, nextCursor };
}

export async function writeGroupFeedCache(groupId, { categoryId, language } = {}, { images, nextCursor } = {}) {
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

export async function clearGroupFeedCache(groupId) {
  const keys = await AsyncStorage.getAllKeys();
  const target = keys.filter((key) => typeof key === 'string' && key.startsWith(`${PREFIX}:${groupId}:`));

  if (target.length > 0) {
    await AsyncStorage.multiRemove(target);
  }
}

export async function clearAllGroupFeedCaches() {
  const keys = await AsyncStorage.getAllKeys();
  const target = keys.filter((key) => typeof key === 'string' && key.startsWith(`${PREFIX}:`));

  if (target.length > 0) {
    await AsyncStorage.multiRemove(target);
  }
}

export async function purgeAllPrivateCaches() {
  await clearAllGroupFeedCaches();

  try {
    Paths.cache.create({ idempotent: true, intermediates: true });
    const cacheDir = Paths.cache;
    const entries = typeof cacheDir?.list === 'function' ? cacheDir.list() : [];

    if (Array.isArray(entries)) {
      for (const entry of entries) {
        const uri = typeof entry === 'string' ? entry : entry?.uri;
        if (typeof uri === 'string') {
          deleteFileIfPresent(uri);
        }
      }
    }
  } catch {
    // best-effort
  }
}
