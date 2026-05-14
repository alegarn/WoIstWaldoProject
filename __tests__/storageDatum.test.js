jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  deleteAsync: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

import {
  clearE2EHiddenGuessCard,
  deleteImageFromStorage,
  emptyImageList,
  getE2EHiddenGuessCard,
  getLastImageId,
  getLastImageUuid,
  getLocalImages,
  removeImageFromList,
  saveE2EHiddenGuessCard,
  saveLastImageUuid,
  storeImageList,
  updateImageList,
} from '../utils/storageDatum';

describe('storageDatum utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.setItem.mockResolvedValue(undefined);
    AsyncStorage.removeItem.mockResolvedValue(undefined);
    FileSystem.deleteAsync.mockResolvedValue(undefined);
  });

  it('reads the local image list and returns null when none is stored', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    expect(await getLocalImages()).toBeNull();

    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([{ listId: 1 }]));
    expect(await getLocalImages()).toEqual([{ listId: 1 }]);
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
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('lastImageUuid', 'uuid-1');

    AsyncStorage.getItem.mockResolvedValueOnce('uuid-1');
    expect(await getLastImageUuid()).toBe('uuid-1');
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

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/a.jpg', { idempotent: true });
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/b.jpg', { idempotent: true });
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('imageList');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('lastImageUuid');
  });

  it('appends new images and removes entries by list id', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([{ listId: 1 }, { listId: 2 }]));

    const updatedList = await updateImageList([{ listId: 3 }]);

    expect(updatedList).toEqual([{ listId: 1 }, { listId: 2 }, { listId: 3 }]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('imageList', JSON.stringify(updatedList));

    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([{ listId: 1 }, { listId: 2 }, { listId: 3 }]));
    await removeImageFromList(2);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('imageList', JSON.stringify([{ listId: 1 }, { listId: 3 }]));
  });

  it('stores image lists and deletes both the cached file and ImagePicker mirror', async () => {
    await storeImageList([{ listId: 7 }]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('imageList', JSON.stringify([{ listId: 7 }]));

    await deleteImageFromStorage('file:///cache/abc.jpg');

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/abc.jpg', { idempotent: true });
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/ImagePicker/abc.jpg', { idempotent: true });
  });
});