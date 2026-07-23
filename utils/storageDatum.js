import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths } from "expo-file-system";
import { readGroupFeedCache } from "../services/groups/groupFeedCache";

const E2E_HIDDEN_GUESS_CARD_KEY = 'e2eHiddenGuessCard';
const SESSION_LANGUAGE_FILTER_KEY = 'sessionLanguageFilter';
const PREFERRED_LANGUAGE_KEY = 'preferredLanguage';
const ONBOARDING_COMPLETED_KEY = 'onboardingCompleted';
const USER_TAGS_KEY = 'userTags';
const DEFAULT_LANGUAGE = 'en';
export const PUBLIC_FEED_END_CURSOR = '__public_feed_end__';

function imageListKey(categoryKey, language) {
  return `imageList:${categoryKey || 'all'}:${language || 'any'}`;
};

function lastImageUuidKey(categoryKey, language) {
  return `lastImageUuid:${categoryKey || 'all'}:${language || 'any'}`;
};

/**
 * Read the persisted deck for (categoryKey, language) and drop entries whose
 * local image file no longer exists, persisting the trimmed list when needed.
 * @param {string} categoryKey - Category key ('all' for the global deck).
 * @param {string} language - Language code ('any' when unset).
 * @returns {Promise<Array<object>|null>} Viable cards, or null when none stored/unparseable.
 */
export async function getLocalImages(categoryKey, language) {
  const stored = await AsyncStorage.getItem(imageListKey(categoryKey, language));
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

  // Cache (Paths.cache) is not durable across restarts/updates, but this list is.
  // Drop entries whose image file is gone and persist the trimmed list so dead
  // uris don't linger and render as blank cards.
  const viable = images.filter((image) => localImageFileExists(image?.imageFile));

  if (viable.length !== images.length) {
    await AsyncStorage.setItem(imageListKey(categoryKey, language), JSON.stringify(viable));
  }

  return viable;
};

/**
 * Resolve the next playable card from the persisted deck.
 * Reuses getLocalImages (already drops non-viable/local-missing files). The deck
 * is ordered ascending by listId (see getLastImageId / getLastListId).
 * - currentListId is a finite number → first item whose listId is strictly greater.
 * - otherwise (undefined/null/NaN) → first item of the deck.
 *
 * When `excludePictureId` is provided, any card whose `pictureId === excludePictureId`
 * is dropped BEFORE selection, so the just-played card is never re-served.
 *
 * Returns null when the deck is missing or empty after filtering.
 *
 * @param {string} categoryKey - Category key (use 'all' for the global deck).
 * @param {string} language - Language code ('any' when unset).
 * @param {number} [currentListId] - Cursor listId; non-finite → deck head.
 * @param {string} [excludePictureId] - pictureId to filter out before selecting.
 * @returns {Promise<object|null>} The next card, or null.
 */
export async function getNextImage(categoryKey, language, currentListId, excludePictureId) {
  const raw = await getLocalImages(categoryKey, language);
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }

  const images = excludePictureId
    ? raw.filter((image) => image?.pictureId !== excludePictureId)
    : raw;
  if (images.length === 0) {
    return null;
  }

  if (Number.isFinite(currentListId)) {
    return images.find((image) => image?.listId > currentListId) ?? null;
  }

  return images[0];
};

/**
 * Scope-aware next-card reader. Public scope delegates to getNextImage; private
 * scope reads the group feed cache instead (mirrors SwipeImage's derivation:
 * categoryId is undefined for "all", otherwise the numeric category id).
 *
 * In both branches the `excludePictureId` pre-filter (drop cards whose
 * `pictureId === excludePictureId` BEFORE selection) is applied identically,
 * so the just-played card is never re-served regardless of scope.
 *
 * Read-only.
 *
 * @param {{ category?: { key?: string, id?: unknown }|null, language?: string|null, currentListId?: number, scope?: unknown, excludePictureId?: string }} args
 * @returns {Promise<object|null>} The next card, or null.
 */
export async function getNextImageForScope({ category, language, currentListId, scope, excludePictureId }) {
  const isPrivate = scope?.kind === 'private' && scope?.groupId;
  if (!isPrivate) {
    return getNextImage(category?.key || 'all', language, currentListId, excludePictureId);
  }

  const categoryId = category?.key === 'all' ? undefined : category?.id;
  const cache = await readGroupFeedCache(scope.groupId, { categoryId, language });
  const raw = cache?.images;
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }

  const images = excludePictureId
    ? raw.filter((image) => image?.pictureId !== excludePictureId)
    : raw;
  if (images.length === 0) {
    return null;
  }

  if (Number.isFinite(currentListId)) {
    return images.find((image) => image?.listId > currentListId) ?? null;
  }

  return images[0];
};

/**
 * Scope-aware BATCH reader — mirrors getNextImageForScope but returns up to
 * `limit` cards whose listId is strictly greater than currentListId (or the
 * deck head when currentListId is not finite). Used by the GuessScreen
 * NextCardImageWarmer to enumerate upcoming card imageFile URIs so RN can
 * pre-decode bitmaps into the in-memory image cache before the advance.
 *
 * Returns [] (never null) for missing/empty decks so the warmer can feed an
 * empty array directly and render nothing without a null-check at the call site.
 *
 * @param {{ category?: { key?: string, id?: unknown }|null, language?: string|null, currentListId?: number, scope?: unknown, limit?: number }} args
 * @returns {Promise<Array<{ listId: number, imageFile: string }>>}
 */
export async function getNextImagesForScope({ category, language, currentListId, scope, limit = 7 }) {
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 7;

  const isPrivate = scope?.kind === 'private' && scope?.groupId;
  let images;
  if (!isPrivate) {
    images = await getLocalImages(category?.key || 'all', language);
  } else {
    const categoryId = category?.key === 'all' ? undefined : category?.id;
    const cache = await readGroupFeedCache(scope.groupId, { categoryId, language });
    images = cache?.images;
  }

  if (!Array.isArray(images) || images.length === 0) {
    return [];
  }

  const ahead = Number.isFinite(currentListId)
    ? images.filter((image) => Number.isFinite(image?.listId) && image.listId > currentListId)
    : images.filter((image) => Number.isFinite(image?.listId));

  return ahead.slice(0, cap);
};

/**
 * @deprecated As of T2.4/T2.8 (streak-continuity Phase 2), the prefetcher uses
 *             `getRemainingDeckCount` (cursor-filtered) instead. This function
 *             returns the TOTAL deck size and does NOT account for cursor
 *             position — using it for prefetch triggers causes RC8 (late-streak
 *             prefetch-never-fires). Retained for back-compat; do NOT add new
 *             callers. Migrate existing callers to `getRemainingDeckCount`.
 *
 *             Returns the total deck size for the (category, language, scope)
 *             tuple by reading AsyncStorage JSON only (no per-file probe).
 *             - Public scope: count getLocalImages(category?.key || 'all', language).
 *             - Private scope: count readGroupFeedCache(scope.groupId, {categoryId, language}).images.
 *             Returns 0 for missing/empty decks. Never throws.
 */
export async function getDeckCountForScope({ category, language, scope }) {
  const isPrivate = scope?.kind === 'private' && scope?.groupId;
  if (!isPrivate) {
    const images = await getLocalImages(category?.key || 'all', language);
    return Array.isArray(images) ? images.length : 0;
  }

  const categoryId = category?.key === 'all' ? undefined : category?.id;
  const cache = await readGroupFeedCache(scope.groupId, { categoryId, language });
  return Array.isArray(cache?.images) ? cache.images.length : 0;
};

/**
 * Cursor-filtered remaining deck count.
 *
 * Returns the number of cards in the local deck for the given
 * (category, language, scope) tuple whose `listId` is strictly greater
 * than `currentListId` — i.e. the cards the cursor can still advance to.
 *
 * PERF (PT4): unlike `getLocalImages`, this function reads the AsyncStorage
 * JSON ONLY and does NOT perform a per-card `File.exists` probe. The
 * file-exists filter stays at `getLocalImages` call sites for actual card
 * resolution. This divergence is intentional: `getRemainingDeckCount` is
 * called per-win (via prefetchIfLow / warmAllDeckIfNeeded) and the O(N) sync
 * disk probe in `getLocalImages` would block the JS thread on every win.
 * Full fix of R4 is Phase 4 T4.6.
 *
 * Contract: a card is "remaining" if `Number.isFinite(image.listId) && image.listId > currentListId`.
 * Cards with missing or non-finite listId are NOT counted (they are not
 * cursor-resolvable; cardDeck appendCardBatch normalizes them on write).
 *
 * @param {{ category?: string|null, language?: string|null, currentListId?: number, scope?: unknown }} args
 * @returns {Promise<number>}
 */
export async function getRemainingDeckCount({ category, language, currentListId, scope }) {
  const cursor = Number.isFinite(currentListId) ? currentListId : -Infinity;

  const isPrivate = scope?.kind === 'private' && scope?.groupId;
  let images;
  if (!isPrivate) {
    const stored = await AsyncStorage.getItem(imageListKey(category?.key || 'all', language));
    if (!stored) return 0;
    try {
      images = JSON.parse(stored);
    } catch {
      return 0;
    }
  } else {
    const categoryId = category?.key === 'all' ? undefined : category?.id;
    const cache = await readGroupFeedCache(scope.groupId, { categoryId, language });
    images = cache?.images;
  }

  if (!Array.isArray(images)) return 0;
  return images.filter((image) => Number.isFinite(image?.listId) && image.listId > cursor).length;
};

function getLastListId(list) {
  const lastListId = list.reduce((maxId, image) => {
    const imageId = image.listId;
    return imageId > maxId ? imageId : maxId;
  }, 0);
  return lastListId
};

export async function getLastImageId(categoryKey, language) {
  console.log("getLastImageId");
  const localImageList = await AsyncStorage.getItem(imageListKey(categoryKey, language));
  //console.log("getLastImageId localImageList", localImageList);

  if ((localImageList !== null) && (localImageList !== "[]")) {
    const imageListObject = JSON.parse(localImageList);
    const lastListId = getLastListId(imageListObject);
    //console.log("getLastImageId lastListId", lastListId);
    return lastListId;
  };

  return 0;
};

/**
 * Persist the feed cursor (last-served image uuid) for (categoryKey, language).
 * Stored at `lastImageUuid:<categoryKey|'all'>:<language|'any'>`. Callers may
 * write the `PUBLIC_FEED_END_CURSOR` sentinel to mark the public feed as
 * exhausted; readers treat that sentinel as null.
 * @param {string} imageUuid - Cursor value (or PUBLIC_FEED_END_CURSOR sentinel).
 * @param {string} categoryKey - Category key ('all' for the global deck).
 * @param {string} language - Language code ('any' when unset).
 * @returns {Promise<null>}
 */
export async function saveLastImageUuid(imageUuid, categoryKey, language) {
  await AsyncStorage.setItem(lastImageUuidKey(categoryKey, language), imageUuid);
  return null;
};

/**
 * Read the persisted feed cursor for (categoryKey, language).
 * Key: `lastImageUuid:<categoryKey|'all'>:<language|'any'>`. May return the
 * `PUBLIC_FEED_END_CURSOR` sentinel; callers MUST treat that as null/exhausted.
 * @param {string} categoryKey - Category key ('all' for the global deck).
 * @param {string} language - Language code ('any' when unset).
 * @returns {Promise<string|null>} Stored cursor, sentinel, or null when unset.
 */
export async function getLastImageUuid(categoryKey, language) {
  const lastImageUuid = await AsyncStorage.getItem(lastImageUuidKey(categoryKey, language));
  return lastImageUuid;
};

export async function getSessionLanguageFilter() {
  const stored = await AsyncStorage.getItem(SESSION_LANGUAGE_FILTER_KEY);

  // Keep "unset" distinct from an explicit language choice.
  // GuessPath/GuessFeed use this to send "any" (no server filter) while still
  // rendering the UI sentinel as English until the user picks a filter.
  return stored || null;
};

export async function saveSessionLanguageFilter(code) {
  await AsyncStorage.setItem(SESSION_LANGUAGE_FILTER_KEY, code);
  return null;
};

export async function getPreferredLanguage() {
  const stored = await AsyncStorage.getItem(PREFERRED_LANGUAGE_KEY);
  return stored || null;
};

export async function savePreferredLanguage(code) {
  await AsyncStorage.setItem(PREFERRED_LANGUAGE_KEY, code);
  return null;
};

export async function getOnboardingCompleted() {
  const stored = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
  return stored === 'true';
}

export async function setOnboardingCompleted(value) {
  await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, value ? 'true' : 'false');
  return null;
}

function normalizeTagName(name) {
  return String(name || '').trim().toLowerCase();
}

function parseStoredValue(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function normalizeStoredTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map(normalizeTagName).filter(Boolean))];
}

export async function getUserTags() {
  const storedTags = await AsyncStorage.getItem(USER_TAGS_KEY);
  return normalizeStoredTags(parseStoredValue(storedTags));
}

export async function saveUserTag(name) {
  const normalizedName = normalizeTagName(name);
  const currentTags = await getUserTags();

  if (!normalizedName) {
    return currentTags;
  }

  const nextTags = currentTags.includes(normalizedName)
    ? currentTags
    : [...currentTags, normalizedName];

  await AsyncStorage.setItem(USER_TAGS_KEY, JSON.stringify(nextTags));
  return nextTags;
}

export async function saveE2EHiddenGuessCard(payload) {
  await AsyncStorage.setItem(E2E_HIDDEN_GUESS_CARD_KEY, JSON.stringify(payload));
  return null;
}

export async function getE2EHiddenGuessCard() {
  const storedPayload = await AsyncStorage.getItem(E2E_HIDDEN_GUESS_CARD_KEY);
  return parseStoredValue(storedPayload);
}

export async function clearE2EHiddenGuessCard() {
  await AsyncStorage.removeItem(E2E_HIDDEN_GUESS_CARD_KEY);
  return null;
}

function deleteFileIfPresent(file) {
  if (file?.exists) {
    file.delete();
  }
}

function localImageFileExists(uri) {
  try {
    return !!new File(uri).exists;
  } catch {
    return false;
  }
}

async function removeFromCache(localUri) {
  if (!localUri) {
    return;
  }

  deleteFileIfPresent(new File(localUri));
};

/**
 * Wipe the persisted deck for (categoryKey, language): delete each card's
 * cached image file, drop the deck key, and clear the feed cursor.
 * @param {string} categoryKey - Category key ('all' for the global deck).
 * @param {string} language - Language code ('any' when unset).
 * @returns {Promise<void>}
 */
export async function emptyImageList(categoryKey, language) {
  const listKey = imageListKey(categoryKey, language);
  const localList = await AsyncStorage.getItem(listKey)
  //console.log("emptyImageList imageList", localList);
  //console.log("if (localList !== null) && (localList !== '[]')", (localList !== null) && (localList !== "[]"));

  if ((localList !== null) && (localList !== "[]")) {
    JSON.parse(localList).forEach( async (image) => {
      await removeFromCache(image.imageFile)
    });
  };

  await AsyncStorage.removeItem(listKey);
  await AsyncStorage.removeItem(lastImageUuidKey(categoryKey, language));
};

export async function storeImageList(imageList, categoryKey, language) {
  await AsyncStorage.setItem(imageListKey(categoryKey, language), JSON.stringify(imageList));
};

function removeObjectById(imageListObject, listId) {
  if (!Array.isArray(imageListObject)) return imageListObject;
  for (let i = 0; i < imageListObject.length; i++) {
    if (imageListObject[i].listId === listId) {
      imageListObject.splice(i, 1);
      break;
    };
  };
  return imageListObject;
};

/**
 * Guarantee every card has a finite, unique listId. Background-prefetched and
 * foreground-fetched cards are persisted without one (the server has no synthetic
 * listId), and getNextImage filters by `listId > currentListId` — so cards lacking
 * a finite listId would be invisible to the guess resolver. Assign sequential ids
 * continuing from the deck's current max: a stable no-op for already-healthy decks
 * and a one-time self-heal for null/missing/non-finite listId cards.
 *
 * Centralized here (the storage-write boundary) so EVERY writer (feed handleData,
 * prefetcher, advance-path foregroundTopUp) produces resolvable cards. SwipeImage
 * re-imports this and still calls it read-time as a defensive backstop.
 */
export function normalizeListIds(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return cards;
  const hasMissing = cards.some((c) => c?.listId == null || !Number.isFinite(c.listId));
  if (!hasMissing) return cards;
  let next = cards.reduce((max, c) => (Number.isFinite(c?.listId) && c.listId > max ? c.listId : max), 0);
  return cards.map((c) => (Number.isFinite(c?.listId) ? c : { ...c, listId: (next += 1) }));
}

/**
 * Drop incoming cards whose `pictureId` already exists in the prior deck.
 *
 * RC10/T4.3 (mirror of services/cardDeck.js#dedupByPictureId): the server can
 * re-serve a card already in the local deck when the cursor (`getLastImageUuid`)
 * is stale. Without dedup, the duplicate gets a NEW listId (via normalizeListIds)
 * greater than currentListId, and getNextImage returns it → the just-played card
 * repeats. Drop duplicates by `pictureId` so the existing card's listId is
 * preserved and the duplicate never enters the deck.
 *
 * Cards with no `pictureId` (legacy server payloads) pass through — there is no
 * key to dedup against, so dropping them would lose data.
 */
function dedupByPictureId(prior, incoming) {
  if (!Array.isArray(incoming) || incoming.length === 0) return [];
  const priorIds = new Set(
    Array.isArray(prior) ? prior.map((c) => c?.pictureId).filter(Boolean) : [],
  );
  return incoming.filter((c) => !c?.pictureId || !priorIds.has(c.pictureId));
}

/**
 * Read-modify-write the deck for (categoryKey, language): read the persisted
 * deck, `dedupByPictureId` the incoming batch against it, `normalizeListIds`
 * the merged result, and write back.
 * @param {Array<object>} updatedImageList - Incoming cards to merge.
 * @param {string} categoryKey - Category key ('all' for the global deck).
 * @param {string} language - Language code ('any' when unset).
 * @returns {Promise<Array<object>>} The new persisted deck (post-dedup/normalize).
 */
export async function updateImageList(updatedImageList, categoryKey, language) {
  const listKey = imageListKey(categoryKey, language);
  const imageList = await AsyncStorage.getItem(listKey);
  const jsonImageList = imageList ? JSON.parse(imageList) : [];
  const deduped = dedupByPictureId(jsonImageList, updatedImageList);
  const newImageList = normalizeListIds([...jsonImageList, ...deduped]);
  await AsyncStorage.setItem(listKey, JSON.stringify(newImageList));
  return newImageList;
};


/**
 * Splice the card whose `listId === listId` out of the persisted deck for
 * (categoryKey, language). NOTE: removes from ONE (categoryKey, language)
 * namespace only — used to drop the just-played card from its own category.
 * No-op (returns null) when the deck key is unset.
 * @param {number} listId - listId of the card to remove.
 * @param {string} categoryKey - Category key ('all' for the global deck).
 * @param {string} language - Language code ('any' when unset).
 * @returns {Promise<null>}
 */
export async function removeImageFromList(listId, categoryKey, language) {
  const listKey = imageListKey(categoryKey, language);
  const imageList = await AsyncStorage.getItem(listKey);
  if (imageList === null || imageList === undefined) {
    return null;
  };
  const jsonImageList = JSON.parse(imageList);
  const updatedImageList = removeObjectById(jsonImageList, listId);
  await AsyncStorage.setItem(listKey, JSON.stringify(updatedImageList));
  return null;
};

export async function deleteImageFromStorage(imageFilePath) {
  if (!imageFilePath) {
    return null;
  }

  deleteFileIfPresent(new File(imageFilePath));
  const fileName = imageFilePath.substring(imageFilePath.lastIndexOf("/") + 1);
  deleteFileIfPresent(new File(Paths.cache, `ImagePicker/${fileName}`));
  return null;
};