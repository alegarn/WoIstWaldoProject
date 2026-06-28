jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
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

import {
  clearE2EHiddenGuessCard,
  deleteImageFromStorage,
  emptyImageList,
  getE2EHiddenGuessCard,
  getLastImageId,
  getLastImageUuid,
  getLocalImages,
  getNextImage,
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

  it('round-trips the session language filter and defaults to en when unset', async () => {
    await saveSessionLanguageFilter('fr');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('sessionLanguageFilter', 'fr');

    AsyncStorage.getItem.mockResolvedValueOnce('fr');
    expect(await getSessionLanguageFilter()).toBe('fr');

    AsyncStorage.getItem.mockResolvedValueOnce(null);
    expect(await getSessionLanguageFilter()).toBe('en');
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
});