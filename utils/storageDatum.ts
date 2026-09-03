import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths } from "expo-file-system";
import { withScopeLock } from "./scopeMutex";
import {
  readGroupFeedCache,
  markGroupCategoryExhausted,
  isGroupCategoryExhausted,
  clearGroupCategoryExhausted,
  groupGameCursorKey,
} from "../services/groups/groupFeedCache";
import { filterPlayedCards, getPlayedPictureIds, playedPictureIdsKey, PLAYED_PICTURE_IDS_PREFIX } from "./playedPictureIds";
import { SERVING_CYCLE_PREFIX } from "./servingCycle";
import type { CardImage } from "../services/cardDeck";

const E2E_HIDDEN_GUESS_CARD_KEY = 'e2eHiddenGuessCard';
const SESSION_LANGUAGE_FILTER_KEY = 'sessionLanguageFilter';
const PREFERRED_LANGUAGE_KEY = 'preferredLanguage';
const UI_LOCALE_KEY = 'uiLocale';
const ONBOARDING_COMPLETED_KEY = 'onboardingCompleted';
const USER_TAGS_KEY = 'userTags';
const DEFAULT_LANGUAGE = 'en';
export const PUBLIC_FEED_END_CURSOR = '__public_feed_end__';
const IMAGE_LIST_KEY_PREFIX = 'imageList:';
const LAST_IMAGE_UUID_KEY_PREFIX = 'lastImageUuid:';
const EXHAUSTED_CATEGORY_KEY_PREFIX = 'exhaustedCategory:';

type PrivateScope = { kind: 'private'; groupId: string };

function isPrivateScope(scope: unknown): scope is PrivateScope {
  return !!scope && typeof scope === 'object' &&
    (scope as { kind?: unknown }).kind === 'private' &&
    !!(scope as { groupId?: unknown }).groupId;
}

function imageListKey(categoryKey: string | null | undefined, language: string | null | undefined): string {
  return `${IMAGE_LIST_KEY_PREFIX}${categoryKey || 'all'}:${language || 'any'}`;
};

function lastImageUuidKey(categoryKey: string | null | undefined, language: string | null | undefined): string {
  return `${LAST_IMAGE_UUID_KEY_PREFIX}${categoryKey || 'all'}:${language || 'any'}`;
};

export function exhaustedCategoryKey(categoryKey: string | null | undefined, language?: string | null): string {
  return `${EXHAUSTED_CATEGORY_KEY_PREFIX}${categoryKey || 'all'}:${language || 'any'}`;
};

export interface DeckWriteLockScope {
  kind?: string;
  groupId?: string;
}

export interface DeckWriteLockKeyArgs {
  categoryKey?: string | null;
  categoryId?: string | number | null;
  language?: string | null;
  scope?: DeckWriteLockScope | null;
}

/**
 * Build the deck-write lock key for (category, language, scope).
 *
 * Despite the legacy `cardDeck:append:` format (kept for compatibility so
 * in-flight appends and every other deck writer share the SAME key), this
 * key guards ALL persisted-deck writes:
 * - append: `appendCardBatch` (services/cardDeck.ts)
 * - removal: `removeImageFromList` (this file) and
 *   `removeCardFromGroupDeck` (services/cardDeck.ts)
 * - trim: the `getLocalImages` dead-file write-back (this file)
 *
 * `withScopeLock` is NON-REENTRANT: never acquire this key inside a section
 * that already holds it (e.g. `updateImageList` / `readGroupFeedCache` are
 * lock-free internals called INSIDE held sections).
 *
 * @returns `cardDeck:append:public:<categoryKey|'all'>:<language|'any'>`
 *   or `cardDeck:append:private:<groupId>:<categoryId|'all'>:<language|'any'>`.
 */
export function deckWriteLockKey({ categoryKey, categoryId, language, scope }: DeckWriteLockKeyArgs = {}): string {
  const lang = language || 'any';
  if (isPrivateScope(scope)) {
    const cid = categoryId === 'all' ? undefined : categoryId;
    return `cardDeck:append:private:${scope.groupId}:${cid ?? 'all'}:${lang}`;
  }
  return `cardDeck:append:public:${categoryKey || 'all'}:${lang}`;
}

/**
 * Mark (categoryKey, language) as server-exhausted for `scope`. PUBLIC scope
 * writes AsyncStorage; PRIVATE scope writes a per-group marker (isolation:
 * group A exhausting category X MUST NOT mark X for group B).
 * @param categoryKey - Category key ('all' is intentionally NEVER cached by callers).
 * @param language - Language code ('any' when unset).
 * @returns {Promise<void>}
 */
export async function markCategoryExhausted(categoryKey: string | null | undefined, language: string | null | undefined, scope: unknown): Promise<void> {
  if (isPrivateScope(scope)) {
    await markGroupCategoryExhausted(scope.groupId, categoryKey, language);
    return;
  }
  await AsyncStorage.setItem(exhaustedCategoryKey(categoryKey, language), '1');
};

/**
 * Read the exhausted flag for (categoryKey, language, scope).
 * @returns {Promise<boolean>}
 */
export async function isCategoryExhausted(categoryKey: string | null | undefined, language: string | null | undefined, scope: unknown): Promise<boolean> {
  if (isPrivateScope(scope)) {
    return isGroupCategoryExhausted(scope.groupId, categoryKey, language);
  }
  return (await AsyncStorage.getItem(exhaustedCategoryKey(categoryKey, language))) === '1';
};

/**
 * Clear the exhausted flag for (categoryKey, language, scope).
 * @returns {Promise<void>}
 */
export async function clearExhaustedCategory(categoryKey: string | null | undefined, language: string | null | undefined, scope: unknown): Promise<void> {
  if (isPrivateScope(scope)) {
    await clearGroupCategoryExhausted(scope.groupId, categoryKey, language);
    return;
  }
  await AsyncStorage.removeItem(exhaustedCategoryKey(categoryKey, language));
};

/**
 * Read the persisted deck for (categoryKey, language) and drop entries whose
 * local image file no longer exists, persisting the trimmed list when needed.
 * @param categoryKey - Category key ('all' for the global deck).
 * @param language - Language code ('any' when unset).
 * @returns Viable cards, or null when none stored/unparseable.
 */
export async function getLocalImages(categoryKey: string | null | undefined, language: string | null | undefined): Promise<CardImage[] | null> {
  const listKey = imageListKey(categoryKey, language);
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

  // Cache (Paths.cache) is not durable across restarts/updates, but this list is.
  // Drop entries whose image file is gone and persist the trimmed list so dead
  // uris don't linger and render as blank cards.
  const viable = images.filter((image) => localImageFileExists(image?.imageFile));

  if (viable.length !== images.length) {
    // Review-approved deviation from the plan's wrap-write-only fix: re-read
    // and re-trim under the lock. Persisting the pre-lock snapshot would
    // clobber appends committed while we waited for the lock; re-reading the
    // persisted deck inside the critical section keeps the trim lossless
    // against concurrent deck writers.
    return withScopeLock(
      deckWriteLockKey({ categoryKey, language, scope: null }),
      async () => {
        const latestStored = await AsyncStorage.getItem(listKey);
        if (!latestStored) {
          return [];
        }

        let latestImages;
        try {
          latestImages = JSON.parse(latestStored);
        } catch {
          return [];
        }

        if (!Array.isArray(latestImages)) {
          return [];
        }

        const latestViable = latestImages.filter((image) => localImageFileExists(image?.imageFile));
        if (latestViable.length !== latestImages.length) {
          await AsyncStorage.setItem(listKey, JSON.stringify(latestViable));
        }
        return latestViable;
      },
    );
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
 * @param categoryKey - Category key (use 'all' for the global deck).
 * @param language - Language code ('any' when unset).
 * @param currentListId - Cursor listId; non-finite → deck head.
 * @param excludePictureId - pictureId to filter out before selecting.
 * @returns The next card, or null.
 */
export async function getNextImage(categoryKey: string | null | undefined, language: string | null | undefined, currentListId?: number, excludePictureId?: string): Promise<CardImage | null> {
  const raw = await getLocalImages(categoryKey, language);
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }

  const unplayed = await filterPlayedCards(raw, language);
  const images = excludePictureId
    ? unplayed.filter((image) => image?.pictureId !== excludePictureId)
    : unplayed;
  if (images.length === 0) {
    return null;
  }

  if (Number.isFinite(currentListId)) {
    const cursor = currentListId as number;
    return images.find((image) => (image?.listId ?? -Infinity) > cursor) ?? null;
  }

  return images[0];
};

export interface NextImageForScopeArgs {
  category?: { key?: string; id?: string | number } | null;
  language?: string | null;
  currentListId?: number;
  scope?: unknown;
  excludePictureId?: string;
}

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
 * @returns The next card, or null.
 */
export async function getNextImageForScope({ category, language, currentListId, scope, excludePictureId }: NextImageForScopeArgs): Promise<CardImage | null> {
  if (!isPrivateScope(scope)) {
    return getNextImage(category?.key || 'all', language, currentListId, excludePictureId);
  }

  const categoryId = (category?.key === 'all' ? undefined : category?.id) as string | undefined;
  const cache = await readGroupFeedCache(scope.groupId, { categoryId, language });
  const raw = cache?.images;
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }

  const unplayed = await filterPlayedCards(raw as CardImage[], language, scope);
  const images = excludePictureId
    ? unplayed.filter((image) => image?.pictureId !== excludePictureId)
    : unplayed;
  if (images.length === 0) {
    return null;
  }

  if (Number.isFinite(currentListId)) {
    const cursor = currentListId as number;
    return images.find((image) => (image?.listId ?? -Infinity) > cursor) ?? null;
  }

  return images[0];
};

export interface NextImagesForScopeArgs {
  category?: { key?: string; id?: string | number };
  language?: string | null;
  currentListId?: number;
  scope?: unknown;
  limit?: number;
}

/**
 * Scope-aware BATCH reader — mirrors getNextImageForScope but returns up to
 * `limit` cards whose listId is strictly greater than currentListId (or the
 * deck head when currentListId is not finite). Used by the GuessScreen
 * NextCardImageWarmer to enumerate upcoming card imageFile URIs so RN can
 * pre-decode bitmaps into the in-memory image cache before the advance.
 *
 * Returns [] (never null) for missing/empty decks so the warmer can feed an
 * empty array directly and render nothing without a null-check at the call site.
 */
export async function getNextImagesForScope({ category, language, currentListId, scope, limit = 7 }: NextImagesForScopeArgs): Promise<CardImage[]> {
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 7;

  let images: CardImage[] | null | undefined;
  if (!isPrivateScope(scope)) {
    images = await getLocalImages(category?.key || 'all', language);
  } else {
    const categoryId = (category?.key === 'all' ? undefined : category?.id) as string | undefined;
    const cache = await readGroupFeedCache(scope.groupId, { categoryId, language });
    images = cache?.images as CardImage[] | undefined;
  }

  if (!Array.isArray(images) || images.length === 0) {
    return [];
  }

  const cursor = Number.isFinite(currentListId) ? (currentListId as number) : null;
  const ahead = cursor !== null
    ? images.filter((image) => Number.isFinite(image?.listId) && (image.listId ?? -Infinity) > cursor)
    : images.filter((image) => Number.isFinite(image?.listId));

  return ahead.slice(0, cap);
};

export interface RemainingDeckCategory {
  key: string;
  id?: string | number;
}

export interface RemainingDeckCountArgs {
  category?: RemainingDeckCategory;
  language?: string | null;
  currentListId?: number;
  scope?: unknown;
}

export interface ScopeDeckCountArgs {
  category?: RemainingDeckCategory;
  language?: string | null;
  scope?: unknown;
}

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
export async function getDeckCountForScope({ category, language, scope }: ScopeDeckCountArgs): Promise<number> {
  if (!isPrivateScope(scope)) {
    const images = await getLocalImages(category?.key || 'all', language);
    return Array.isArray(images) ? images.length : 0;
  }

  const categoryId = (category?.key === 'all' ? undefined : category?.id) as string | undefined;
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
 */
export async function getRemainingDeckCount({ category, language, currentListId, scope }: RemainingDeckCountArgs): Promise<number> {
  const cursor = Number.isFinite(currentListId) ? (currentListId as number) : -Infinity;

  let images;
  if (!isPrivateScope(scope)) {
    const stored = await AsyncStorage.getItem(imageListKey(category?.key || 'all', language));
    if (!stored) return 0;
    try {
      images = JSON.parse(stored);
    } catch {
      return 0;
    }
  } else {
    const categoryId = (category?.key === 'all' ? undefined : category?.id) as string | undefined;
    const cache = await readGroupFeedCache(scope.groupId, { categoryId, language });
    images = cache?.images;
  }

  if (!Array.isArray(images)) return 0;
  return images.filter((image) => Number.isFinite(image?.listId) && image.listId > cursor).length;
};

function getLastListId(list: CardImage[]): number {
  const lastListId = list.reduce((maxId: number, image: CardImage) => {
    const imageId = image.listId;
    return typeof imageId === 'number' && imageId > maxId ? imageId : maxId;
  }, 0);
  return lastListId
};

export async function getLastImageId(categoryKey: string | null | undefined, language: string | null | undefined): Promise<number> {
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
 * Resolve the feed-cursor storage key for (categoryKey, language, scope).
 * PUBLIC (and legacy no-scope callers) keep the shared
 * `lastImageUuid:<categoryKey|'all'>:<language|'any'>` shape untouched.
 * PRIVATE scopes persist under the group-scoped game-cursor key
 * `groupFeed:<groupId>:game:<categoryKey|'all'>:<language|'any'>:cursor`
 * (F1/F2 review fix) so the private transport cursor never shares — and never
 * poisons — the public cursor namespace.
 */
function lastImageUuidKeyForScope(categoryKey: string | null | undefined, language: string | null | undefined, scope?: unknown): string {
  if (isPrivateScope(scope)) {
    return groupGameCursorKey(scope.groupId, categoryKey, language);
  }
  return lastImageUuidKey(categoryKey, language);
}

/**
 * Persist the feed cursor (last-served image uuid) for (categoryKey, language,
 * scope). PUBLIC scope stores at `lastImageUuid:<categoryKey|'all'>:<language|'any'>`
 * (callers may write the `PUBLIC_FEED_END_CURSOR` sentinel there; readers treat
 * that sentinel as null). PRIVATE scope stores at the group-scoped
 * `groupFeed:<groupId>:game:<categoryKey|'all'>:<language|'any'>:cursor` key,
 * where the `PRIVATE_FEED_END_CURSOR` sentinel lives scope-isolated.
 *
 * Migration note: pre-fix app versions persisted private cursors/sentinels to
 * the unscoped `lastImageUuid:*` keys. Those legacy keys are deliberately dead
 * (no read fallback) — the first scoped read misses, one head probe re-serves,
 * and the scoped cursor is rewritten. Stale legacy keys age out with the next
 * dev wipe.
 *
 * @param imageUuid - Cursor value (or scope-correct feed-end sentinel).
 * @param categoryKey - Category key ('all' for the global deck).
 * @param language - Language code ('any' when unset).
 * @param scope - Private scope object.
 */
export async function saveLastImageUuid(imageUuid: string, categoryKey?: string | null, language?: string | null, scope?: unknown): Promise<null> {
  await AsyncStorage.setItem(lastImageUuidKeyForScope(categoryKey, language, scope), imageUuid);
  return null;
};

/**
 * Read the persisted feed cursor for (categoryKey, language, scope). Key
 * shapes mirror saveLastImageUuid (public `lastImageUuid:*`, private
 * group-scoped `groupFeed:<gid>:game:*:*:cursor`). The public read may return
 * the `PUBLIC_FEED_END_CURSOR` sentinel; callers MUST treat that sentinel as
 * null/exhausted. The private read may return the `PRIVATE_FEED_END_CURSOR`
 * sentinel; its consumer (fetchPrivateFeedPageForGame) treats it as exhausted.
 * @param categoryKey - Category key ('all' for the global deck).
 * @param language - Language code ('any' when unset).
 * @param scope - Private scope object.
 * @returns Stored cursor, sentinel, or null when unset.
 */
export async function getLastImageUuid(categoryKey?: string | null, language?: string | null, scope?: unknown): Promise<string | null> {
  const lastImageUuid = await AsyncStorage.getItem(lastImageUuidKeyForScope(categoryKey, language, scope));
  return lastImageUuid;
};

/**
 * Remove the persisted feed cursor for (categoryKey, language, scope). Key
 * shapes mirror saveLastImageUuid/getLastImageUuid (public `lastImageUuid:*`,
 * private group-scoped `groupFeed:<gid>:game:*:*:cursor`). Removing a REAL
 * cursor is a destructive rewind — callers must only use this to un-stick a
 * feed-end sentinel or an otherwise unusable cursor value.
 * @param categoryKey - Category key ('all' for the global deck).
 * @param language - Language code ('any' when unset).
 * @param scope - Private scope object.
 * @returns {Promise<void>}
 */
export async function clearLastImageUuid(categoryKey?: string | null, language?: string | null, scope?: unknown): Promise<void> {
  await AsyncStorage.removeItem(lastImageUuidKeyForScope(categoryKey, language, scope));
};

export async function getSessionLanguageFilter(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(SESSION_LANGUAGE_FILTER_KEY);

  // Keep "unset" distinct from an explicit language choice.
  // GuessPath/GuessFeed use this to send "any" (no server filter) while still
  // rendering the UI sentinel as English until the user picks a filter.
  return stored || null;
};

export async function saveSessionLanguageFilter(code: string | null): Promise<null> {
  await AsyncStorage.setItem(SESSION_LANGUAGE_FILTER_KEY, code as string);
  return null;
};

export async function getPreferredLanguage(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(PREFERRED_LANGUAGE_KEY);
  return stored || null;
};

export async function savePreferredLanguage(code: string | null): Promise<null> {
  await AsyncStorage.setItem(PREFERRED_LANGUAGE_KEY, code as string);
  return null;
};

export async function getUiLocale(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(UI_LOCALE_KEY);
  return stored || null;
};

export async function saveUiLocale(code: string | null): Promise<null> {
  await AsyncStorage.setItem(UI_LOCALE_KEY, code as string);
  return null;
};

export async function getOnboardingCompleted(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
  return stored === 'true';
}

export async function setOnboardingCompleted(value: boolean): Promise<null> {
  await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, value ? 'true' : 'false');
  return null;
}

function normalizeTagName(name: string | null | undefined): string {
  return String(name || '').trim().toLowerCase();
}

function parseStoredValue(value: string | null): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function normalizeStoredTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map(normalizeTagName).filter(Boolean))];
}

export async function getUserTags(): Promise<string[]> {
  const storedTags = await AsyncStorage.getItem(USER_TAGS_KEY);
  return normalizeStoredTags(parseStoredValue(storedTags));
}

export async function saveUserTag(name: string | null | undefined): Promise<string[]> {
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

export async function saveE2EHiddenGuessCard(payload: unknown): Promise<null> {
  await AsyncStorage.setItem(E2E_HIDDEN_GUESS_CARD_KEY, JSON.stringify(payload));
  return null;
}

export async function getE2EHiddenGuessCard(): Promise<unknown> {
  const storedPayload = await AsyncStorage.getItem(E2E_HIDDEN_GUESS_CARD_KEY);
  return parseStoredValue(storedPayload);
}

export async function clearE2EHiddenGuessCard(): Promise<null> {
  await AsyncStorage.removeItem(E2E_HIDDEN_GUESS_CARD_KEY);
  return null;
}

function deleteFileIfPresent(file: File | null | undefined): void {
  if (file?.exists) {
    file.delete();
  }
}

function localImageFileExists(uri: unknown): boolean {
  try {
    return !!new File(uri as string).exists;
  } catch {
    return false;
  }
}

async function removeFromCache(localUri: string | null | undefined): Promise<void> {
  if (!localUri) {
    return;
  }

  deleteFileIfPresent(new File(localUri));
};

/**
 * Wipe the persisted deck for (categoryKey, language): delete each card's
 * cached image file, drop the deck key, and clear the feed cursor.
 * @param categoryKey - Category key ('all' for the global deck).
 * @param language - Language code ('any' when unset).
 * @returns {Promise<void>}
 */
export async function emptyImageList(categoryKey: string | null | undefined, language: string | null | undefined): Promise<void> {
  const listKey = imageListKey(categoryKey, language);
  const localList = await AsyncStorage.getItem(listKey)
  //console.log("emptyImageList imageList", localList);
  //console.log("if (localList !== null) && (localList !== '[]')", (localList !== null) && (localList !== "[]"));

  if ((localList !== null) && (localList !== "[]")) {
    JSON.parse(localList).forEach( async (image: CardImage) => {
      await removeFromCache(image.imageFile)
    });
  };

  await AsyncStorage.removeItem(listKey);
  await AsyncStorage.removeItem(lastImageUuidKey(categoryKey, language));
  await AsyncStorage.removeItem(exhaustedCategoryKey(categoryKey, language));
  await AsyncStorage.removeItem(playedPictureIdsKey(language, null));
};

/**
 * Delete the local cache files referenced by persisted image-list decks.
 * Silent on unset/empty/corrupt decks — a bad deck must not abort the wipe.
 * @param imageListKeys - AsyncStorage keys of persisted decks.
 * @returns {Promise<void>}
 */
async function deleteDeckCacheFiles(imageListKeys: readonly string[]): Promise<void> {
  for (const listKey of imageListKeys) {
    const localList = await AsyncStorage.getItem(listKey);
    if (localList === null || localList === '[]') {
      continue;
    }

    try {
      const parsed = JSON.parse(localList);
      if (!Array.isArray(parsed)) {
        continue;
      }

      for (const image of parsed) {
        await removeFromCache(image?.imageFile);
      }
    } catch {
    }
  }
}

/**
 * Wipe ALL public guess-side storage: delete every persisted deck's local
 * cache files, then remove every public deck/tracking/cursor key plus every
 * serving-cycle epoch key (public and group — epochs are session state, not
 * per-group content). Private group content (groupFeed:*, groupFeedExhausted:*,
 * playedPictureIds:group:*) is deliberately untouched — it is scoped per group,
 * not per session.
 * @returns {Promise<void>}
 */
export async function wipePublicGuessStorage(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await deleteDeckCacheFiles(keys.filter((key) => typeof key === 'string' && key.startsWith(IMAGE_LIST_KEY_PREFIX)));

  const removalPrefixes = [
    IMAGE_LIST_KEY_PREFIX,
    LAST_IMAGE_UUID_KEY_PREFIX,
    EXHAUSTED_CATEGORY_KEY_PREFIX,
    `${PLAYED_PICTURE_IDS_PREFIX}:public:`,
    `${SERVING_CYCLE_PREFIX}:`,
  ];
  const target = keys.filter((key) =>
    typeof key === 'string' && removalPrefixes.some((prefix) => key.startsWith(prefix))
  );

  if (target.length > 0) {
    await AsyncStorage.multiRemove(target);
  }
}

export async function storeImageList(imageList: CardImage[], categoryKey?: string | null, language?: string | null): Promise<void> {
  await AsyncStorage.setItem(imageListKey(categoryKey, language), JSON.stringify(imageList));
};

function removeObjectById(imageListObject: CardImage[], listId: number): CardImage[] {
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
 * continuing from the deck's current max.
 *
 * ALSO repairs duplicate FINITE listIds (two concurrent writers both numbering
 * from the same base — Fix 3): a single order-preserving pass reassigns every
 * LATER duplicate (and every missing/non-finite id) past the deck's pre-pass max.
 * Healthy decks return the input array by identity (same reference, no copies).
 *
 * Centralized here (the storage-write boundary) so EVERY writer (feed handleData,
 * prefetcher, advance-path foregroundTopUp) produces resolvable, collision-free
 * cards. SwipeImage re-imports this and still calls it read-time as a defensive
 * backstop.
 */
export function normalizeListIds(cards: CardImage[]): CardImage[] {
  if (!Array.isArray(cards) || cards.length === 0) return cards;
  const seen = new Set<number>();
  let next = cards.reduce((max: number, c: CardImage) => (typeof c?.listId === 'number' && c.listId > max ? c.listId : max), 0);
  let changed = false;
  const result = cards.map((c: CardImage) => {
    if (!Number.isFinite(c?.listId) || seen.has(c.listId as number)) {
      changed = true;
      return { ...c, listId: (next += 1) };
    }
    seen.add(c.listId as number);
    return c;
  });
  return changed ? result : cards;
}

/**
 * Drop incoming cards whose `pictureId` already exists in the prior deck.
 *
 * RC10/T4.3 (mirror of services/cardDeck.ts#dedupByPictureId): the server can
 * re-serve a card already in the local deck when the cursor (`getLastImageUuid`)
 * is stale. Without dedup, the duplicate gets a NEW listId (via normalizeListIds)
 * greater than currentListId, and getNextImage returns it → the just-played card
 * repeats. Drop duplicates by `pictureId` so the existing card's listId is
 * preserved and the duplicate never enters the deck.
 *
 * Cards with no `pictureId` (legacy server payloads) pass through — there is no
 * key to dedup against, so dropping them would lose data.
 */
function dedupByPictureId(prior: unknown, incoming: CardImage[]): CardImage[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return [];
  const priorIds = new Set<string>(
    Array.isArray(prior) ? prior.map((c) => c?.pictureId).filter(Boolean) : [],
  );
  return incoming.filter((c) => !c?.pictureId || !priorIds.has(c.pictureId));
}

/**
 * Read-modify-write the deck for (categoryKey, language): read the persisted
 * deck, `dedupByPictureId` the incoming batch against it, `normalizeListIds`
 * the merged result, and write back.
 * @param updatedImageList - Incoming cards to merge.
 * @param categoryKey - Category key ('all' for the global deck).
 * @param language - Language code ('any' when unset).
 * @returns The new persisted deck (post-dedup/normalize).
 */
export async function updateImageList(updatedImageList: CardImage[], categoryKey?: string | null, language?: string | null): Promise<CardImage[]> {
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
 * @param listId - listId of the card to remove.
 * @param categoryKey - Category key ('all' for the global deck).
 * @param language - Language code ('any' when unset).
 * @returns {Promise<null>}
 */
export async function removeImageFromList(listId: number, categoryKey?: string | null, language?: string | null): Promise<null> {
  return withScopeLock(
    deckWriteLockKey({ categoryKey, language, scope: null }),
    async () => {
      const listKey = imageListKey(categoryKey, language);
      const imageList = await AsyncStorage.getItem(listKey);
      if (imageList === null || imageList === undefined) {
        return null;
      };
      const jsonImageList = JSON.parse(imageList);
      const updatedImageList = removeObjectById(jsonImageList, listId);
      await AsyncStorage.setItem(listKey, JSON.stringify(updatedImageList));
      return null;
    },
  );
};

export async function deleteImageFromStorage(imageFilePath: string | null | undefined): Promise<null> {
  if (!imageFilePath) {
    return null;
  }

  deleteFileIfPresent(new File(imageFilePath));
  const fileName = imageFilePath.substring(imageFilePath.lastIndexOf("/") + 1);
  deleteFileIfPresent(new File(Paths.cache, `ImagePicker/${fileName}`));
  return null;
};

// Task 2b: private-* cache files (private feed, thumbnails, home
// backgrounds) are swept by purgeAllPrivateCaches in
// services/groups/groupFeedCache.ts — the public sweep below must never
// touch them.
const PRIVATE_CACHE_FILE_PREFIX = 'private-';
const PLAYED_ORPHAN_SWEEP_NAME_CAP = 200;

function baseNameFromFileName(fileName: string): string | null {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) {
    return null;
  }
  return fileName.slice(0, dotIndex);
};

async function collectDeckedPictureIds(): Promise<Set<string>> {
  const keys = await AsyncStorage.getAllKeys();
  const deckKeys = keys.filter((key) => typeof key === 'string' && key.startsWith(IMAGE_LIST_KEY_PREFIX));
  const deckedNames = new Set<string>();
  for (const listKey of deckKeys) {
    const stored = await AsyncStorage.getItem(listKey);
    if (!stored) {
      continue;
    }
    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        continue;
      }
      for (const card of parsed) {
        if (typeof card?.pictureId === 'string' && card.pictureId.length > 0) {
          deckedNames.add(card.pictureId);
        }
      }
    } catch {
      // skip corrupt decks — a bad deck must not abort the sweep
    }
  }
  return deckedNames;
};

/**
 * Task 2b (Option C) public orphan sweep: after a win, delete cache files
 * whose name is in the public played set but NOT in any persisted deck —
 * bytes that were downloaded before the played filter (Task 1) existed, or
 * that lost their deck entry. Single pass, bounded by the played-set cap
 * (200 names). Safe: Task 1 filters played rows before download, so a swept
 * file is never re-fetched unless cap-eviction resurrects its id (then it
 * re-downloads on demand). Best-effort — never throws.
 * @param language - Language code ('any' when unset).
 * @returns {Promise<void>}
 */
export async function sweepPlayedOrphanCacheFiles(language: string | null | undefined): Promise<void | null> {
  let played = [];
  try {
    played = await getPlayedPictureIds(language, null);
  } catch {
    return;
  }
  if (!Array.isArray(played) || played.length === 0) {
    return;
  }
  const playedNames = new Set(played.slice(-PLAYED_ORPHAN_SWEEP_NAME_CAP));

  let deckedNames;
  try {
    deckedNames = await collectDeckedPictureIds();
  } catch {
    return;
  }

  try {
    const entries = typeof Paths.cache?.list === 'function' ? Paths.cache.list() : [];
    if (!Array.isArray(entries)) {
      return;
    }
    for (const entry of entries) {
      const uri = typeof entry === 'string' ? entry : entry?.uri;
      if (typeof uri !== 'string' || uri.length === 0) {
        continue;
      }
      const fileName = uri.substring(uri.lastIndexOf('/') + 1);
      if (fileName.length === 0 || fileName.endsWith('.download')) {
        continue;
      }
      if (fileName.startsWith(PRIVATE_CACHE_FILE_PREFIX)) {
        continue;
      }
      const baseName = baseNameFromFileName(fileName);
      if (baseName === null || !playedNames.has(baseName) || deckedNames.has(baseName)) {
        continue;
      }
      deleteFileIfPresent(new File(Paths.cache, fileName));
    }
  } catch {
    // best-effort
  }
  return null;
};
