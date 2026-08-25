jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('../services/groups/groupFeedCache', () => {
  const actual = jest.requireActual('../services/groups/groupFeedCache');
  return {
    ...actual,
    readGroupFeedCache: jest.fn(),
    writeGroupFeedCache: jest.fn(),
    markGroupCategoryExhausted: jest.fn(),
    isGroupCategoryExhausted: jest.fn(),
    clearGroupCategoryExhausted: jest.fn(),
  };
});

jest.mock('../utils/imagesRequests', () => ({
  getImages: jest.fn(),
}));

const mockDelete = jest.fn();
let mockFileExists = true;
let mockFileExistsByUri = null;

jest.mock('expo-file-system', () => {
  const File = jest.fn().mockImplementation(function MockFile(firstArg, secondArg) {
    const baseUri = typeof firstArg === 'string' ? firstArg : firstArg?.uri;

    this.uri = secondArg ? `${baseUri}${secondArg}` : baseUri;
    this.exists = mockFileExistsByUri ? !!mockFileExistsByUri[this.uri] : mockFileExists;
    this.delete = mockDelete;
  });

  return {
    File,
    Paths: class MockPaths {
      static get cache() {
        return { uri: 'file:///cache/' };
      }
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { readGroupFeedCache, markGroupCategoryExhausted, isGroupCategoryExhausted, clearGroupCategoryExhausted } from '../services/groups/groupFeedCache';

import {
  clearE2EHiddenGuessCard,
  clearExhaustedCategory,
  clearLastImageUuid,
  deleteImageFromStorage,
  emptyImageList,
  deckWriteLockKey,
  exhaustedCategoryKey,
  getDeckCountForScope,
  getE2EHiddenGuessCard,
  getLastImageId,
  getLastImageUuid,
  getLocalImages,
  getNextImage,
  getNextImageForScope,
  getNextImagesForScope,
  getOnboardingCompleted,
  getPreferredLanguage,
  getRemainingDeckCount,
  getSessionLanguageFilter,
  getUserTags,
  isCategoryExhausted,
  markCategoryExhausted,
  normalizeListIds,
  removeImageFromList,
  saveE2EHiddenGuessCard,
  saveLastImageUuid,
  savePreferredLanguage,
  saveSessionLanguageFilter,
  saveUserTag,
  setOnboardingCompleted,
  storeImageList,
  updateImageList,
  wipePublicGuessStorage,
} from '../utils/storageDatum';
import { appendCardBatch } from '../services/cardDeck';

describe('storageDatum utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDelete.mockReset();
    mockFileExists = true;
    mockFileExistsByUri = null;
    AsyncStorage.setItem.mockResolvedValue(undefined);
    AsyncStorage.removeItem.mockResolvedValue(undefined);
    AsyncStorage.getAllKeys.mockResolvedValue([]);
    AsyncStorage.multiRemove.mockResolvedValue(undefined);
    readGroupFeedCache.mockReset();
    markGroupCategoryExhausted.mockReset();
    isGroupCategoryExhausted.mockReset();
    clearGroupCategoryExhausted.mockReset();
    markGroupCategoryExhausted.mockResolvedValue(undefined);
    isGroupCategoryExhausted.mockResolvedValue(false);
    clearGroupCategoryExhausted.mockResolvedValue(undefined);
  });

  it('reads the local image list and returns null when none is stored', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    expect(await getLocalImages()).toBeNull();

    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([{ listId: 1, imageFile: 'file:///cache/1.jpg' }]));
    expect(await getLocalImages()).toEqual([{ listId: 1, imageFile: 'file:///cache/1.jpg' }]);
  });

  it('prunes entries whose cached image file no longer exists and re-stores the trimmed list', async () => {
    mockFileExists = false;
    const stored = JSON.stringify([
      { listId: 1, imageFile: 'file:///cache/gone.jpg' },
      { listId: 2, imageFile: 'file:///cache/also-gone.jpg' },
    ]);
    AsyncStorage.getItem.mockImplementation(async (key) => (key === 'imageList:all:any' ? stored : null));

    const result = await getLocalImages('all', 'any');

    expect(result).toEqual([]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('imageList:all:any', JSON.stringify([]));
  });

  it('derives the highest stored image id and falls back to zero for an empty list', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
      { listId: 1 },
      { listId: 9 },
      { listId: 4 },
    ]));

    expect(await getLastImageId()).toBe(9);

    AsyncStorage.getItem.mockResolvedValueOnce('[]');
    expect(await getLastImageId()).toBe(0);
  });

  it('stores and reads the last downloaded image uuid', async () => {
    await saveLastImageUuid('uuid-1');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('lastImageUuid:all:any', 'uuid-1');

    AsyncStorage.getItem.mockResolvedValueOnce('uuid-1');
    expect(await getLastImageUuid()).toBe('uuid-1');
  });

  it('clearLastImageUuid removes the scoped cursor key (public + private)', async () => {
    await clearLastImageUuid('all', 'fr');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('lastImageUuid:all:fr');

    await clearLastImageUuid('all', 'fr', { kind: 'private', groupId: 'g-9' });
    expect(AsyncStorage.removeItem).toHaveBeenLastCalledWith('groupFeed:g-9:game:all:fr:cursor');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('private game-path cursor round-trip persists under the groupFeed-scoped key, not lastImageUuid', async () => {
    const scope = { kind: 'private', groupId: 'g-9' };

    await saveLastImageUuid('cursor-42', 'cat-uuid-7', 'fr', scope);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('groupFeed:g-9:game:cat-uuid-7:fr:cursor', 'cursor-42');

    await saveLastImageUuid('cursor-a', undefined, undefined, { kind: 'private', groupId: 'gA' });
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('groupFeed:gA:game:all:any:cursor', 'cursor-a');

    AsyncStorage.getItem.mockResolvedValueOnce('cursor-42');
    expect(await getLastImageUuid('cat-uuid-7', 'fr', scope)).toBe('cursor-42');
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('groupFeed:g-9:game:cat-uuid-7:fr:cursor');
  });

  it('private END sentinel lands in the group-scoped key; the public all cursor stays untouched (no poisoning)', async () => {
    const scope = { kind: 'private', groupId: 'g-9' };

    await saveLastImageUuid('__private_feed_end__', 'all', 'fr', scope);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('groupFeed:g-9:game:all:fr:cursor', '__private_feed_end__');

    // Asymmetry preserved: the PUBLIC 'all' cursor read must not see the
    // private sentinel (pre-fix the sentinel was written to
    // lastImageUuid:all:<lang> and poisoned the public feed cursor).
    AsyncStorage.getItem.mockImplementation(async (key) => (
      key === 'groupFeed:g-9:game:all:fr:cursor' ? '__private_feed_end__' : null
    ));
    expect(await getLastImageUuid('all', 'fr')).toBeNull();
    expect(await getLastImageUuid('all', 'fr', scope)).toBe('__private_feed_end__');
  });

  it('round-trips the session language filter and returns null when unset', async () => {
    await saveSessionLanguageFilter('fr');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('sessionLanguageFilter', 'fr');

    AsyncStorage.getItem.mockResolvedValueOnce('fr');
    expect(await getSessionLanguageFilter()).toBe('fr');

    AsyncStorage.getItem.mockResolvedValueOnce(null);
    expect(await getSessionLanguageFilter()).toBeNull();
  });

  it('round-trips the preferred language and returns null when unset', async () => {
    await savePreferredLanguage('de');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('preferredLanguage', 'de');

    AsyncStorage.getItem.mockResolvedValueOnce('de');
    expect(await getPreferredLanguage()).toBe('de');

    AsyncStorage.getItem.mockResolvedValueOnce(null);
    expect(await getPreferredLanguage()).toBeNull();
  });

  it('stores onboarding completion as string booleans and treats missing values as false', async () => {
    await setOnboardingCompleted(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('onboardingCompleted', 'true');

    await setOnboardingCompleted(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('onboardingCompleted', 'false');

    AsyncStorage.getItem.mockResolvedValueOnce('true');
    expect(await getOnboardingCompleted()).toBe(true);

    AsyncStorage.getItem.mockResolvedValueOnce('false');
    expect(await getOnboardingCompleted()).toBe(false);

    AsyncStorage.getItem.mockResolvedValueOnce(null);
    expect(await getOnboardingCompleted()).toBe(false);
  });

  it('reads saved user tags and falls back to an empty list when unset or invalid', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['city', 'museum']));
    expect(await getUserTags()).toEqual(['city', 'museum']);

    AsyncStorage.getItem.mockResolvedValueOnce(null);
    expect(await getUserTags()).toEqual([]);

    AsyncStorage.getItem.mockResolvedValueOnce('{bad json');
    expect(await getUserTags()).toEqual([]);
  });

  it('appends unique lowercase user tags', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['city']));
    expect(await saveUserTag('  Museum  ')).toEqual(['city', 'museum']);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('userTags', JSON.stringify(['city', 'museum']));

    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['city']));
    expect(await saveUserTag('CITY')).toEqual(['city']);
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('userTags', JSON.stringify(['city']));
  });

  it('stores, reads, and clears the saved e2e hidden guess payload', async () => {
    const payload = { uri: 'file:///guess.jpg', hiddenLocation: { x: 0.3, y: 0.7 } };

    await saveE2EHiddenGuessCard(payload);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('e2eHiddenGuessCard', JSON.stringify(payload));

    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(payload));
    expect(await getE2EHiddenGuessCard()).toEqual(payload);

    await clearE2EHiddenGuessCard();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('e2eHiddenGuessCard');
  });

  it('empties the stored image list for one tuple, clears cache files, and removes exact tracking keys', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
      { imageFile: 'file:///cache/a.jpg' },
      { imageFile: 'file:///cache/b.jpg' },
    ]));

    await emptyImageList('city', 'fr');

    expect(File).toHaveBeenCalledWith('file:///cache/a.jpg');
    expect(File).toHaveBeenCalledWith('file:///cache/b.jpg');
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('imageList:city:fr');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('lastImageUuid:city:fr');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('exhaustedCategory:city:fr');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('playedPictureIds:public:fr');
  });

  it('wipes public guess storage across namespaces and deletes cached deck files', async () => {
    AsyncStorage.getAllKeys.mockResolvedValue([
      'imageList:interior:en',
      'imageList:city:fr',
      'lastImageUuid:interior:en',
      'lastImageUuid:private-category:en',
      'exhaustedCategory:city:fr',
      'playedPictureIds:public:en',
      'playedPictureIds:public:any',
      'groupFeed:g1:all:any',
      'groupFeedExhausted:g1:city:fr',
      'playedPictureIds:group:g1:en',
    ]);
    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (key === 'imageList:interior:en') {
        return JSON.stringify([
          { imageFile: 'file:///cache/interior-a.jpg' },
          { imageFile: 'file:///cache/interior-b.jpg' },
        ]);
      }
      if (key === 'imageList:city:fr') {
        return JSON.stringify([{ imageFile: 'file:///cache/city-a.jpg' }]);
      }
      return null;
    });

    await wipePublicGuessStorage();

    expect(File).toHaveBeenCalledWith('file:///cache/interior-a.jpg');
    expect(File).toHaveBeenCalledWith('file:///cache/interior-b.jpg');
    expect(File).toHaveBeenCalledWith('file:///cache/city-a.jpg');
    expect(mockDelete).toHaveBeenCalledTimes(3);
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(expect.arrayContaining([
      'imageList:interior:en',
      'imageList:city:fr',
      'lastImageUuid:interior:en',
      'lastImageUuid:private-category:en',
      'exhaustedCategory:city:fr',
      'playedPictureIds:public:en',
      'playedPictureIds:public:any',
    ]));
    const removedKeys = AsyncStorage.multiRemove.mock.calls[0][0];
    expect(removedKeys).not.toContain('groupFeed:g1:all:any');
    expect(removedKeys).not.toContain('groupFeedExhausted:g1:city:fr');
    expect(removedKeys).not.toContain('playedPictureIds:group:g1:en');
  });

  it('wipePublicGuessStorage removes servingCycle: keys (public and group)', async () => {
    AsyncStorage.getAllKeys.mockResolvedValue([
      'servingCycle:public:fr',
      'servingCycle:public:any',
      'servingCycle:group:g1:fr',
    ]);

    await wipePublicGuessStorage();

    expect(AsyncStorage.multiRemove).toHaveBeenCalledTimes(1);
    const removedKeys = AsyncStorage.multiRemove.mock.calls[0][0];
    expect(removedKeys).toEqual(
      expect.arrayContaining([
        'servingCycle:public:fr',
        'servingCycle:public:any',
        'servingCycle:group:g1:fr',
      ]),
    );
  });

  it('wipe leaves group deck/played keys untouched (existing pin stays)', async () => {
    AsyncStorage.getAllKeys.mockResolvedValue([
      'groupFeed:g1:all:any',
      'groupFeedExhausted:g1:city:fr',
      'playedPictureIds:group:g1:en',
      'servingCycle:group:g1:fr',
    ]);

    await wipePublicGuessStorage();

    const removedKeys = AsyncStorage.multiRemove.mock.calls[0][0];
    expect(removedKeys).not.toContain('groupFeed:g1:all:any');
    expect(removedKeys).not.toContain('groupFeedExhausted:g1:city:fr');
    expect(removedKeys).not.toContain('playedPictureIds:group:g1:en');
  });

  it('appends new images and removes entries by list id', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([{ listId: 1 }, { listId: 2 }]));

    const updatedList = await updateImageList([{ listId: 3 }]);

    expect(updatedList).toEqual([{ listId: 1 }, { listId: 2 }, { listId: 3 }]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('imageList:all:any', JSON.stringify(updatedList));

    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([{ listId: 1 }, { listId: 2 }, { listId: 3 }]));
    await removeImageFromList(2);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('imageList:all:any', JSON.stringify([{ listId: 1 }, { listId: 3 }]));
  });

  it('treats a missing stored list as empty and creates it on append', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    const updatedList = await updateImageList([{ listId: 5 }], 'city', 'fr');
    expect(updatedList).toEqual([{ listId: 5 }]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('imageList:city:fr', JSON.stringify([{ listId: 5 }]));
  });

  it('assigns sequential listIds (continuing from the deck max) to appended cards that lack one', async () => {
    // Background-prefetched + foreground-fetched cards arrive without a synthetic
    // listId. getNextImage filters by listId > currentListId, so without assignment
    // here they'd be invisible to the guess resolver. Normalize at write time.
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([{ listId: 7 }, { listId: 12 }]));

    const updatedList = await updateImageList([
      { pictureId: 'a' },
      { pictureId: 'b', listId: null },
      { pictureId: 'c' },
    ], 'all', 'fr');

    expect(updatedList).toEqual([
      { listId: 7 },
      { listId: 12 },
      { pictureId: 'a', listId: 13 },
      { pictureId: 'b', listId: 14 },
      { pictureId: 'c', listId: 15 },
    ]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('imageList:all:fr', JSON.stringify(updatedList));
  });

  it('does not throw or write when no image list is stored for the namespace', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    await expect(removeImageFromList(2, 'city', 'fr')).resolves.toBe(null);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('namespaces image lists by category and language without colliding', async () => {
    const cityList = [{ listId: 1 }];
    const natureList = [{ listId: 2 }];

    await storeImageList(cityList, 'city', 'fr');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('imageList:city:fr', JSON.stringify(cityList));

    await storeImageList(natureList, 'nature', 'fr');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('imageList:nature:fr', JSON.stringify(natureList));

    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('imageList:city:fr', JSON.stringify(natureList));

    await storeImageList([{ listId: 9 }]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('imageList:all:any', JSON.stringify([{ listId: 9 }]));
  });

  it('stores image lists and deletes both the cached file and ImagePicker mirror', async () => {
    await storeImageList([{ listId: 7 }]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('imageList:all:any', JSON.stringify([{ listId: 7 }]));

    await deleteImageFromStorage('file:///cache/abc.jpg');

    expect(File).toHaveBeenNthCalledWith(1, 'file:///cache/abc.jpg');
    expect(File).toHaveBeenNthCalledWith(2, expect.objectContaining({ uri: 'file:///cache/' }), 'ImagePicker/abc.jpg');
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });

  it('returns the first remaining image when the played card has already been removed', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
      { listId: 2, imageFile: 'file:///cache/2.jpg' },
      { listId: 3, imageFile: 'file:///cache/3.jpg' },
    ]));

    expect(await getNextImage('all', 'any')).toEqual({ listId: 2, imageFile: 'file:///cache/2.jpg' });
  });

  it('returns the first image whose listId is strictly greater than currentListId', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
      { listId: 1, imageFile: 'file:///cache/1.jpg' },
      { listId: 2, imageFile: 'file:///cache/2.jpg' },
      { listId: 3, imageFile: 'file:///cache/3.jpg' },
    ]));

    expect(await getNextImage('all', 'any', 2)).toEqual({ listId: 3, imageFile: 'file:///cache/3.jpg' });
  });

  it('returns null when the deck is missing or empty', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    expect(await getNextImage('all', 'any')).toBeNull();

    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([]));
    expect(await getNextImage('all', 'any')).toBeNull();
  });

  describe('getNextImageForScope', () => {
    it('delegates to getNextImage on the public path and returns the next card', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
        { listId: 1, imageFile: 'file:///cache/1.jpg' },
        { listId: 2, imageFile: 'file:///cache/2.jpg' },
      ]));

      const card = await getNextImageForScope({ category: { key: 'all' }, language: 'any', currentListId: 1, scope: { kind: 'public' } });

      expect(card).toEqual({ listId: 2, imageFile: 'file:///cache/2.jpg' });
      expect(readGroupFeedCache).not.toHaveBeenCalled();
    });

    it('returns null on the public path when the deck is exhausted', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
        { listId: 1, imageFile: 'file:///cache/1.jpg' },
      ]));

      const card = await getNextImageForScope({ category: { key: 'all' }, language: 'any', currentListId: 5, scope: { kind: 'public' } });

      expect(card).toBeNull();
    });

    it('reads the private group feed cache and returns the next card for a private scope', async () => {
      readGroupFeedCache.mockResolvedValueOnce({
        images: [
          { listId: 1, imageFile: 'file:///cache/p1.jpg' },
          { listId: 2, imageFile: 'file:///cache/p2.jpg' },
        ],
        nextCursor: null,
      });

      const card = await getNextImageForScope({
        category: { key: 'city', id: 7 },
        language: 'fr',
        currentListId: 1,
        scope: { kind: 'private', groupId: 'g-3' },
      });

      expect(card).toEqual({ listId: 2, imageFile: 'file:///cache/p2.jpg' });
      expect(readGroupFeedCache).toHaveBeenCalledWith('g-3', { categoryId: 7, language: 'fr' });
    });

    it('returns null for a private scope when no card has a greater listId', async () => {
      readGroupFeedCache.mockResolvedValueOnce({
        images: [{ listId: 1, imageFile: 'file:///cache/p1.jpg' }],
        nextCursor: null,
      });

      const card = await getNextImageForScope({
        category: { key: 'city', id: 7 },
        language: 'fr',
        currentListId: 9,
        scope: { kind: 'private', groupId: 'g-3' },
      });

      expect(card).toBeNull();
    });

    it('returns null for a private scope when the cache is empty or missing', async () => {
      readGroupFeedCache.mockResolvedValueOnce({ images: [], nextCursor: null });
      const cardEmpty = await getNextImageForScope({
        category: { key: 'all' },
        language: 'fr',
        currentListId: 1,
        scope: { kind: 'private', groupId: 'g-3' },
      });
      expect(cardEmpty).toBeNull();

      readGroupFeedCache.mockResolvedValueOnce(null);
      const cardMissing = await getNextImageForScope({
        category: { key: 'all' },
        language: 'fr',
        currentListId: 1,
        scope: { kind: 'private', groupId: 'g-3' },
      });
      expect(cardMissing).toBeNull();
    });

    it('returns the first image for a private scope when currentListId is not finite', async () => {
      readGroupFeedCache.mockResolvedValueOnce({
        images: [
          { listId: 7, imageFile: 'file:///cache/p7.jpg' },
          { listId: 8, imageFile: 'file:///cache/p8.jpg' },
        ],
        nextCursor: null,
      });

      const card = await getNextImageForScope({
        category: { key: 'all' },
        language: 'fr',
        currentListId: undefined,
        scope: { kind: 'private', groupId: 'g-3' },
      });

      expect(card).toEqual({ listId: 7, imageFile: 'file:///cache/p7.jpg' });
    });
  });

  describe('getNextImagesForScope', () => {
    it('returns the next N public-scope cards with listId strictly greater than currentListId', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
        { listId: 1, imageFile: 'file:///cache/1.jpg' },
        { listId: 2, imageFile: 'file:///cache/2.jpg' },
        { listId: 3, imageFile: 'file:///cache/3.jpg' },
        { listId: 4, imageFile: 'file:///cache/4.jpg' },
      ]));

      const cards = await getNextImagesForScope({
        category: { key: 'all' },
        language: 'any',
        currentListId: 1,
        limit: 3,
        scope: { kind: 'public' },
      });

      expect(cards).toEqual([
        { listId: 2, imageFile: 'file:///cache/2.jpg' },
        { listId: 3, imageFile: 'file:///cache/3.jpg' },
        { listId: 4, imageFile: 'file:///cache/4.jpg' },
      ]);
      expect(readGroupFeedCache).not.toHaveBeenCalled();
    });

    it('caps the result at limit and never returns more than what the deck holds', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
        { listId: 2, imageFile: 'file:///cache/2.jpg' },
        { listId: 3, imageFile: 'file:///cache/3.jpg' },
      ]));

      const cards = await getNextImagesForScope({
        category: { key: 'all' },
        language: 'any',
        currentListId: 1,
        limit: 5,
        scope: { kind: 'public' },
      });

      expect(cards).toHaveLength(2);
    });

    it('returns [] when the public deck is missing, empty, or has no further cards', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(null);
      expect(await getNextImagesForScope({
        category: { key: 'all' }, language: 'any', currentListId: 1, limit: 3, scope: { kind: 'public' },
      })).toEqual([]);

      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([]));
      expect(await getNextImagesForScope({
        category: { key: 'all' }, language: 'any', currentListId: 1, limit: 3, scope: { kind: 'public' },
      })).toEqual([]);

      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([{ listId: 1, imageFile: 'file:///cache/1.jpg' }]));
      expect(await getNextImagesForScope({
        category: { key: 'all' }, language: 'any', currentListId: 5, limit: 3, scope: { kind: 'public' },
      })).toEqual([]);
    });

    it('starts from the deck head when currentListId is not finite', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
        { listId: 7, imageFile: 'file:///cache/7.jpg' },
        { listId: 8, imageFile: 'file:///cache/8.jpg' },
      ]));

      const cards = await getNextImagesForScope({
        category: { key: 'all' },
        language: 'any',
        currentListId: undefined,
        limit: 2,
        scope: { kind: 'public' },
      });

      expect(cards).toEqual([
        { listId: 7, imageFile: 'file:///cache/7.jpg' },
        { listId: 8, imageFile: 'file:///cache/8.jpg' },
      ]);
    });

    it('reads the private group feed cache and returns the next N cards', async () => {
      readGroupFeedCache.mockResolvedValueOnce({
        images: [
          { listId: 1, imageFile: 'file:///cache/p1.jpg' },
          { listId: 2, imageFile: 'file:///cache/p2.jpg' },
          { listId: 3, imageFile: 'file:///cache/p3.jpg' },
        ],
        nextCursor: null,
      });

      const cards = await getNextImagesForScope({
        category: { key: 'city', id: 7 },
        language: 'fr',
        currentListId: 1,
        limit: 2,
        scope: { kind: 'private', groupId: 'g-3' },
      });

      expect(cards).toEqual([
        { listId: 2, imageFile: 'file:///cache/p2.jpg' },
        { listId: 3, imageFile: 'file:///cache/p3.jpg' },
      ]);
      expect(readGroupFeedCache).toHaveBeenCalledWith('g-3', { categoryId: 7, language: 'fr' });
    });

    it('returns [] for a private scope when the cache is empty or missing', async () => {
      readGroupFeedCache.mockResolvedValueOnce({ images: [], nextCursor: null });
      expect(await getNextImagesForScope({
        category: { key: 'all' }, language: 'fr', currentListId: 1, limit: 3, scope: { kind: 'private', groupId: 'g-3' },
      })).toEqual([]);

      readGroupFeedCache.mockResolvedValueOnce(null);
      expect(await getNextImagesForScope({
        category: { key: 'all' }, language: 'fr', currentListId: 1, limit: 3, scope: { kind: 'private', groupId: 'g-3' },
      })).toEqual([]);
    });
  });

  describe('getDeckCountForScope', () => {
    it('returns the getLocalImages array length for the public scope', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
        { listId: 1, imageFile: 'file:///cache/1.jpg' },
        { listId: 2, imageFile: 'file:///cache/2.jpg' },
        { listId: 3, imageFile: 'file:///cache/3.jpg' },
      ]));

      const count = await getDeckCountForScope({
        category: { key: 'all' },
        language: 'any',
        scope: { kind: 'public' },
      });

      expect(count).toBe(3);
      expect(readGroupFeedCache).not.toHaveBeenCalled();
    });

    it('returns 0 for the public scope when the deck is missing', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(null);

      const count = await getDeckCountForScope({
        category: { key: 'all' },
        language: 'any',
        scope: { kind: 'public' },
      });

      expect(count).toBe(0);
    });

    it('returns 0 for the public scope when the deck is an empty array', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([]));

      const count = await getDeckCountForScope({
        category: { key: 'all' },
        language: 'any',
        scope: { kind: 'public' },
      });

      expect(count).toBe(0);
    });

    it('uses category.key for the public scope lookup', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
        { listId: 1, imageFile: 'file:///cache/1.jpg' },
      ]));

      await getDeckCountForScope({
        category: { key: 'city', id: 7 },
        language: 'fr',
        scope: { kind: 'public' },
      });

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('imageList:city:fr');
    });

    it('falls back to the "all" category key when category is missing', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
        { listId: 1, imageFile: 'file:///cache/1.jpg' },
      ]));

      await getDeckCountForScope({
        category: null,
        language: 'fr',
        scope: { kind: 'public' },
      });

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('imageList:all:fr');
    });

    it('returns the readGroupFeedCache images length for a private scope', async () => {
      readGroupFeedCache.mockResolvedValueOnce({
        images: [{ listId: 1, imageFile: 'file:///cache/p1.jpg' }],
        nextCursor: 'x',
      });

      const count = await getDeckCountForScope({
        category: { key: 'city', id: 7 },
        language: 'fr',
        scope: { kind: 'private', groupId: 'g-3' },
      });

      expect(count).toBe(1);
    });

    it('returns 0 for a private scope when the cache is missing', async () => {
      readGroupFeedCache.mockResolvedValueOnce(null);

      const count = await getDeckCountForScope({
        category: { key: 'city', id: 7 },
        language: 'fr',
        scope: { kind: 'private', groupId: 'g-3' },
      });

      expect(count).toBe(0);
    });

    it('resolves category.key === "all" to categoryId undefined for a private scope', async () => {
      readGroupFeedCache.mockResolvedValueOnce({ images: [], nextCursor: null });

      await getDeckCountForScope({
        category: { key: 'all' },
        language: 'fr',
        scope: { kind: 'private', groupId: 'g-3' },
      });

      expect(readGroupFeedCache).toHaveBeenCalledWith('g-3', { categoryId: undefined, language: 'fr' });
    });

    it('passes category.id as categoryId for a private scope with a real category', async () => {
      readGroupFeedCache.mockResolvedValueOnce({ images: [], nextCursor: null });

      await getDeckCountForScope({
        category: { key: 'city', id: 42 },
        language: 'de',
        scope: { kind: 'private', groupId: 'g-9' },
      });

      expect(readGroupFeedCache).toHaveBeenCalledWith('g-9', { categoryId: 42, language: 'de' });
    });

    it('passes language through unchanged to both readers', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
        { listId: 1, imageFile: 'file:///cache/1.jpg' },
      ]));

      await getDeckCountForScope({
        category: { key: 'all' },
        language: 'fr',
        scope: { kind: 'public' },
      });

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('imageList:all:fr');

      readGroupFeedCache.mockResolvedValueOnce({ images: [], nextCursor: null });

      await getDeckCountForScope({
        category: { key: 'all' },
        language: undefined,
        scope: { kind: 'private', groupId: 'g-1' },
      });

      expect(readGroupFeedCache).toHaveBeenCalledWith('g-1', { categoryId: undefined, language: undefined });
    });
  });

  describe('getRemainingDeckCount', () => {
    it('filters by currentListId and returns only cards with a strictly greater listId', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
        { listId: 10 },
        { listId: 20 },
        { listId: 30 },
        { listId: 40 },
      ]));

      const count = await getRemainingDeckCount({
        category: { key: 'all' },
        language: 'any',
        currentListId: 20,
        scope: { kind: 'public' },
      });

      expect(count).toBe(2);
    });

    it('returns 0 when no cards have a listId greater than currentListId', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
        { listId: 10 },
        { listId: 20 },
        { listId: 30 },
      ]));

      const count = await getRemainingDeckCount({
        category: { key: 'all' },
        language: 'any',
        currentListId: 30,
        scope: { kind: 'public' },
      });

      expect(count).toBe(0);
    });

    it('skips cards with non-finite listIds', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
        { listId: 10 },
        { listId: null },
        { listId: undefined },
        { listId: NaN },
        { listId: 'abc' },
        { listId: 30 },
      ]));

      const count = await getRemainingDeckCount({
        category: { key: 'all' },
        language: 'any',
        currentListId: 0,
        scope: { kind: 'public' },
      });

      expect(count).toBe(2);
    });

    it('returns 0 when storage is empty or missing', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(null);
      const countMissing = await getRemainingDeckCount({
        category: { key: 'all' },
        language: 'any',
        currentListId: 1,
        scope: { kind: 'public' },
      });
      expect(countMissing).toBe(0);

      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([]));
      const countEmpty = await getRemainingDeckCount({
        category: { key: 'all' },
        language: 'any',
        currentListId: 1,
        scope: { kind: 'public' },
      });
      expect(countEmpty).toBe(0);
    });

    it('does not perform a per-card File.exists probe (perf contract)', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
        { listId: 1, imageFile: 'file:///cache/1.jpg' },
        { listId: 2, imageFile: 'file:///cache/2.jpg' },
        { listId: 3, imageFile: 'file:///cache/3.jpg' },
      ]));

      const count = await getRemainingDeckCount({
        category: { key: 'all' },
        language: 'any',
        currentListId: 0,
        scope: { kind: 'public' },
      });

      expect(count).toBe(3);
      expect(File).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe('exhaustedCategory cache (F3a)', () => {
    it('exhaustedCategoryKey mirrors lastImageUuidKey format and falls back to all/any', () => {
      expect(exhaustedCategoryKey('city', 'fr')).toBe('exhaustedCategory:city:fr');
      expect(exhaustedCategoryKey(undefined, undefined)).toBe('exhaustedCategory:all:any');
      expect(exhaustedCategoryKey(null, null)).toBe('exhaustedCategory:all:any');
    });

    it('PUBLIC scope round-trips mark → is → clear against AsyncStorage', async () => {
      await markCategoryExhausted('city', 'fr', { kind: 'public' });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('exhaustedCategory:city:fr', '1');

      AsyncStorage.getItem.mockResolvedValueOnce('1');
      expect(await isCategoryExhausted('city', 'fr', { kind: 'public' })).toBe(true);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('exhaustedCategory:city:fr');

      AsyncStorage.getItem.mockResolvedValueOnce(null);
      expect(await isCategoryExhausted('city', 'fr', { kind: 'public' })).toBe(false);

      await clearExhaustedCategory('city', 'fr', { kind: 'public' });
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('exhaustedCategory:city:fr');
    });

    it('PRIVATE scope delegates to groupFeedCache helpers with scope.groupId (isolation)', async () => {
      const privateScope = { kind: 'private', groupId: 'g-7' };

      await markCategoryExhausted('city', 'fr', privateScope);
      expect(markGroupCategoryExhausted).toHaveBeenCalledWith('g-7', 'city', 'fr');
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();

      await isCategoryExhausted('city', 'fr', privateScope);
      expect(isGroupCategoryExhausted).toHaveBeenCalledWith('g-7', 'city', 'fr');

      await clearExhaustedCategory('city', 'fr', privateScope);
      expect(clearGroupCategoryExhausted).toHaveBeenCalledWith('g-7', 'city', 'fr');
      expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('exhaustedCategory:city:fr');
    });

    it('PUBLIC scope without kind still uses AsyncStorage (defensive default)', async () => {
      await markCategoryExhausted('city', 'fr', undefined);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('exhaustedCategory:city:fr', '1');
      expect(markGroupCategoryExhausted).not.toHaveBeenCalled();
    });

    it('emptyImageList now also drops the public exhausted key for the tuple', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(null);

      await emptyImageList('city', 'fr');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('exhaustedCategory:city:fr');
    });
  });

  describe('normalizeListIds collision repair (Fix 3)', () => {
    it('(a) reassigns LATER duplicate finite ids beyond the deck max, order preserved', () => {
      const result = normalizeListIds([
        { pictureId: 'a', listId: 1 },
        { pictureId: 'b', listId: 2 },
        { pictureId: 'c', listId: 1 },
        { pictureId: 'd', listId: 2 },
      ]);

      expect(result.map((c) => [c.pictureId, c.listId])).toEqual([
        ['a', 1],
        ['b', 2],
        ['c', 3],
        ['d', 4],
      ]);
    });

    it('(b) healthy deck returns the SAME reference (identity no-op)', () => {
      const cards = [{ listId: 1 }, { listId: 2 }, { listId: 3 }];
      expect(normalizeListIds(cards)).toBe(cards);
    });

    it('(c) repairs a missing + duplicate mix in one pass', () => {
      const result = normalizeListIds([
        { pictureId: 'a', listId: 3 },
        { pictureId: 'b' },
        { pictureId: 'c', listId: 3 },
        { pictureId: 'd', listId: null },
      ]);

      expect(result.map((c) => c.listId)).toEqual([3, 4, 5, 6]);
    });

    it('(d) all-finite all-duplicate deck is repaired (no missing-id early return)', () => {
      const result = normalizeListIds([
        { pictureId: 'a', listId: 1 },
        { pictureId: 'b', listId: 1 },
      ]);

      expect(result.map((c) => c.listId)).toEqual([1, 2]);
    });
  });

  describe('played-picture set (Fix 2b)', () => {
    it('(c) getNextImage skips a played card and serves the next one', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
        { listId: 1, pictureId: 'a', imageFile: 'file:///cache/1.jpg' },
        { listId: 2, pictureId: 'b', imageFile: 'file:///cache/2.jpg' },
      ]));
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['a']));

      expect(await getNextImage('all', 'any')).toEqual({ listId: 2, pictureId: 'b', imageFile: 'file:///cache/2.jpg' });
    });

    it('(d) getNextImageForScope skips a played card on the private branch', async () => {
      readGroupFeedCache.mockResolvedValueOnce({
        images: [
          { listId: 1, pictureId: 'a', imageFile: 'file:///cache/p1.jpg' },
          { listId: 2, pictureId: 'b', imageFile: 'file:///cache/p2.jpg' },
        ],
        nextCursor: null,
      });
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['a']));

      const card = await getNextImageForScope({
        category: { key: 'all' },
        language: 'fr',
        scope: { kind: 'private', groupId: 'g-3' },
      });

      expect(card).toEqual({ listId: 2, pictureId: 'b', imageFile: 'file:///cache/p2.jpg' });
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('playedPictureIds:group:g-3:fr');
    });

    it('(f) emptyImageList clears the public played key for the language and NO group key', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(null);

      await emptyImageList('city', 'fr');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('playedPictureIds:public:fr');
      const removedKeys = AsyncStorage.removeItem.mock.calls.map(([key]) => key);
      expect(removedKeys.some((key) => key.startsWith('playedPictureIds:group:'))).toBe(false);
    });

    it('(g) clearGroupFeedCache clears only that group\'s played-set (public + other groups untouched)', async () => {
      const { clearGroupFeedCache } = jest.requireActual('../services/groups/groupFeedCache');
      AsyncStorage.getAllKeys.mockResolvedValue([
        'playedPictureIds:group:gA:fr',
        'playedPictureIds:group:gB:fr',
        'playedPictureIds:public:fr',
        'groupFeed:gA:all:any',
        'groupFeed:gB:all:any',
      ]);

      await clearGroupFeedCache('gA');

      const removed = AsyncStorage.multiRemove.mock.calls.map(([keys]) => keys).flat();
      expect(removed).toContain('playedPictureIds:group:gA:fr');
      expect(removed).toContain('groupFeed:gA:all:any');
      expect(removed).not.toContain('playedPictureIds:group:gB:fr');
      expect(removed).not.toContain('playedPictureIds:public:fr');
      expect(removed).not.toContain('groupFeed:gB:all:any');
    });

    it('(h) purgeAllPrivateCaches clears all group played-sets, public untouched', async () => {
      const { purgeAllPrivateCaches } = jest.requireActual('../services/groups/groupFeedCache');
      AsyncStorage.getAllKeys.mockResolvedValue([
        'playedPictureIds:group:gA:fr',
        'playedPictureIds:group:gB:en',
        'playedPictureIds:public:any',
      ]);

      await purgeAllPrivateCaches();

      const removed = AsyncStorage.multiRemove.mock.calls.map(([keys]) => keys).flat();
      expect(removed).toContain('playedPictureIds:group:gA:fr');
      expect(removed).toContain('playedPictureIds:group:gB:en');
      expect(removed).not.toContain('playedPictureIds:public:any');
    });
  });

  describe('deck write lock — removal serialization (Fix 1 D1)', () => {
    const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

    it('(a) RACE: removal write held open + concurrent appendCardBatch on the same key → final deck keeps BOTH batches minus the removed card', async () => {
      let store = JSON.stringify([{ listId: 1 }, { listId: 2 }]);
      let releaseRemovalWrite;
      const removalWriteGate = new Promise((resolve) => { releaseRemovalWrite = resolve; });
      let removalWriteGated = false;

      AsyncStorage.getItem.mockImplementation(async (key) => (key === 'imageList:city:fr' ? store : null));
      AsyncStorage.setItem.mockImplementation(async (key, value) => {
        if (key !== 'imageList:city:fr') return;
        if (!removalWriteGated) {
          removalWriteGated = true;
          await removalWriteGate;
        }
        store = value;
      });

      const removal = removeImageFromList(1, 'city', 'fr');
      await flushMicrotasks();
      await flushMicrotasks();

      const append = appendCardBatch({
        cards: [{ listId: 3 }],
        categoryKey: 'city',
        language: 'fr',
        scope: { kind: 'public' },
      });
      await flushMicrotasks();
      await flushMicrotasks();
      // The append RMW must queue behind the in-flight removal (same lock
      // key): without the lock it would already have read the stale deck.
      expect(AsyncStorage.getItem.mock.calls.filter(([key]) => key === 'imageList:city:fr')).toHaveLength(1);

      releaseRemovalWrite();
      await removal;
      await append;

      expect(JSON.parse(store)).toEqual([{ listId: 2 }, { listId: 3 }]);
    });

    it('(b) two concurrent removals both land (serialized read-modify-write)', async () => {
      let store = JSON.stringify([{ listId: 1 }, { listId: 2 }, { listId: 3 }]);
      let releaseFirstWrite;
      const firstWriteGate = new Promise((resolve) => { releaseFirstWrite = resolve; });
      let firstWriteGated = false;

      AsyncStorage.getItem.mockImplementation(async (key) => (key === 'imageList:nature:fr' ? store : null));
      AsyncStorage.setItem.mockImplementation(async (key, value) => {
        if (key !== 'imageList:nature:fr') return;
        if (!firstWriteGated) {
          firstWriteGated = true;
          await firstWriteGate;
        }
        store = value;
      });

      const first = removeImageFromList(1, 'nature', 'fr');
      await flushMicrotasks();
      await flushMicrotasks();

      const second = removeImageFromList(2, 'nature', 'fr');
      await flushMicrotasks();
      await flushMicrotasks();
      expect(AsyncStorage.getItem.mock.calls.filter(([key]) => key === 'imageList:nature:fr')).toHaveLength(1);

      releaseFirstWrite();
      await first;
      await second;

      expect(JSON.parse(store)).toEqual([{ listId: 3 }]);
    });
  });

  describe('deck write lock — trim serialization (Fix 2 D2)', () => {
    const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

    it('(b) all-viable deck read performs NO write-back (steady-state reads stay lock-free)', async () => {
      const stored = [
        { listId: 1, imageFile: 'file:///cache/1.jpg' },
        { listId: 2, imageFile: 'file:///cache/2.jpg' },
      ];
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(stored));

      const result = await getLocalImages('all', 'any');

      expect(result).toEqual(stored);
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
      expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
    });

    it('re-reads and trims the latest persisted deck under the lock so concurrent appends survive', async () => {
      mockFileExistsByUri = {
        'file:///cache/gone.jpg': false,
        'file:///cache/live.jpg': true,
        'file:///cache/new.jpg': true,
      };

      let store = JSON.stringify([
        { listId: 1, imageFile: 'file:///cache/gone.jpg' },
        { listId: 2, imageFile: 'file:///cache/live.jpg' },
      ]);
      let releaseAppendWrite;
      const appendWriteGate = new Promise((resolve) => {
        releaseAppendWrite = resolve;
      });
      let appendWriteGated = false;

      AsyncStorage.getItem.mockImplementation(async (key) => {
        if (key === 'imageList:city:fr') {
          return store;
        }
        if (key === 'playedPictureIds:public:fr') {
          return null;
        }
        return null;
      });
      AsyncStorage.setItem.mockImplementation(async (key, value) => {
        if (key !== 'imageList:city:fr') {
          return;
        }
        if (!appendWriteGated) {
          appendWriteGated = true;
          await appendWriteGate;
        }
        store = value;
      });

      const append = appendCardBatch({
        cards: [{ listId: 3, imageFile: 'file:///cache/new.jpg' }],
        categoryKey: 'city',
        language: 'fr',
        scope: { kind: 'public' },
      });
      await flushMicrotasks();
      await flushMicrotasks();

      const read = getLocalImages('city', 'fr');
      await flushMicrotasks();
      await flushMicrotasks();

      releaseAppendWrite();
      const result = await read;
      await append;

      expect(result).toEqual([
        { listId: 2, imageFile: 'file:///cache/live.jpg' },
        { listId: 3, imageFile: 'file:///cache/new.jpg' },
      ]);
      expect(JSON.parse(store)).toEqual([
        { listId: 2, imageFile: 'file:///cache/live.jpg' },
        { listId: 3, imageFile: 'file:///cache/new.jpg' },
      ]);
    });
  });

  describe('deckWriteLockKey', () => {
    it('matches the shared public and private key format used by every deck writer', () => {
      expect(deckWriteLockKey({ categoryKey: 'city', language: 'fr', scope: null })).toBe('cardDeck:append:public:city:fr');
      expect(deckWriteLockKey({ categoryId: 7, language: 'fr', scope: { kind: 'private', groupId: 'g-1' } })).toBe('cardDeck:append:private:g-1:7:fr');
      expect(deckWriteLockKey({ categoryId: 'all', language: undefined, scope: { kind: 'private', groupId: 'g-1' } })).toBe('cardDeck:append:private:g-1:all:any');
    });
  });
});