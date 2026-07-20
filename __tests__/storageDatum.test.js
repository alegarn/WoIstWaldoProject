jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../services/groups/groupFeedCache', () => ({
  readGroupFeedCache: jest.fn(),
}));

const mockDelete = jest.fn();
let mockFileExists = true;

jest.mock('expo-file-system', () => {
  const File = jest.fn().mockImplementation(function MockFile(firstArg, secondArg) {
    const baseUri = typeof firstArg === 'string' ? firstArg : firstArg?.uri;

    this.uri = secondArg ? `${baseUri}${secondArg}` : baseUri;
    this.exists = mockFileExists;
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
import { readGroupFeedCache } from '../services/groups/groupFeedCache';

import {
  clearE2EHiddenGuessCard,
  deleteImageFromStorage,
  emptyImageList,
  getDeckCountForScope,
  getE2EHiddenGuessCard,
  getLastImageId,
  getLastImageUuid,
  getLocalImages,
  getNextImage,
  getNextImageForScope,
  getOnboardingCompleted,
  getPreferredLanguage,
  getSessionLanguageFilter,
  getUserTags,
  removeImageFromList,
  saveE2EHiddenGuessCard,
  saveLastImageUuid,
  savePreferredLanguage,
  saveSessionLanguageFilter,
  saveUserTag,
  setOnboardingCompleted,
  storeImageList,
  updateImageList,
} from '../utils/storageDatum';

describe('storageDatum utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDelete.mockReset();
    mockFileExists = true;
    AsyncStorage.setItem.mockResolvedValue(undefined);
    AsyncStorage.removeItem.mockResolvedValue(undefined);
    readGroupFeedCache.mockReset();
  });

  it('reads the local image list and returns null when none is stored', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    expect(await getLocalImages()).toBeNull();

    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([{ listId: 1, imageFile: 'file:///cache/1.jpg' }]));
    expect(await getLocalImages()).toEqual([{ listId: 1, imageFile: 'file:///cache/1.jpg' }]);
  });

  it('prunes entries whose cached image file no longer exists and re-stores the trimmed list', async () => {
    mockFileExists = false;
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
      { listId: 1, imageFile: 'file:///cache/gone.jpg' },
      { listId: 2, imageFile: 'file:///cache/also-gone.jpg' },
    ]));

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

  it('empties the stored image list, clears cache files, and removes tracking keys', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
      { imageFile: 'file:///cache/a.jpg' },
      { imageFile: 'file:///cache/b.jpg' },
    ]));

    await emptyImageList();

    expect(File).toHaveBeenCalledWith('file:///cache/a.jpg');
    expect(File).toHaveBeenCalledWith('file:///cache/b.jpg');
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('imageList:all:any');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('lastImageUuid:all:any');
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
});