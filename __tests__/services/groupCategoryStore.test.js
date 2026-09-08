jest.mock('@react-native-async-storage/async-storage', () =>
  require('../helpers/statefulAsyncStorageMock')()
);

jest.mock('../../services/groups/groupCategoriesApi', () => ({
  __esModule: true,
  listGroupCategories: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { listGroupCategories } from '../../services/groups/groupCategoriesApi';
import {
  normalizePrivateCategory,
  categoryListSignature,
  loadGroupCategoriesOptimistic,
  refreshGroupCategories,
} from '../../services/groups/groupCategoriesStore';

function resetStore() {
  return AsyncStorage.getAllKeys().then((keys) =>
    AsyncStorage.multiRemove(keys),
  );
}

describe('services/groups/groupCategoriesStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    return resetStore();
  });

  describe('normalizePrivateCategory', () => {
    it('fills key from id when missing and maps snake_case thumbnail_url', () => {
      const result = normalizePrivateCategory({
        id: 'c-1',
        name: 'Nature',
        thumbnail_url: 'https://img/thumb.png',
      });

      expect(result).toEqual({
        id: 'c-1',
        name: 'Nature',
        thumbnail_url: 'https://img/thumb.png',
        key: 'c-1',
        thumbnailUrl: 'https://img/thumb.png',
      });
    });

    it('keeps existing key and thumbnailUrl as-is', () => {
      const result = normalizePrivateCategory({
        id: 'c-1',
        key: 'nature',
        thumbnailUrl: 'https://img/a.png',
      });

      expect(result.key).toBe('nature');
      expect(result.thumbnailUrl).toBe('https://img/a.png');
    });

    it('returns the value unchanged when it is not an object', () => {
      expect(normalizePrivateCategory(null)).toBeNull();
      expect(normalizePrivateCategory(undefined)).toBeUndefined();
    });
  });

  describe('categoryListSignature', () => {
    it('is identical for the same entries in a different order', () => {
      const a = [
        { id: 2, name: 'b', sort_order: 1, thumbnail_image_id: 22 },
        { id: 1, name: 'a', sort_order: 0, thumbnail_image_id: 11 },
      ];
      const b = [
        { id: 1, name: 'a', sort_order: 0, thumbnail_image_id: 11 },
        { id: 2, name: 'b', sort_order: 1, thumbnail_image_id: 22 },
      ];

      expect(categoryListSignature(a)).toBe(categoryListSignature(b));
    });

    it('changes when a meaningful field changes (not thumbnailUrl)', () => {
      const a = [{ id: 1, name: 'a', sort_order: 0, thumbnail_image_id: 11 }];
      const b = [{ id: 1, name: 'a', sort_order: 0, thumbnail_image_id: 99 }];

      expect(categoryListSignature(a)).not.toBe(categoryListSignature(b));
    });
  });

  describe('loadGroupCategoriesOptimistic', () => {
    it('renders cache first, then fresh when fresh differs from cache', async () => {
      const cached = [{ id: 1, name: 'a', sort_order: 0, thumbnail_image_id: 11 }];
      await AsyncStorage.setItem('groupCategories:g-7', JSON.stringify(cached));

      const fresh = [
        { id: 1, name: 'a-renamed', sort_order: 0, thumbnail_image_id: 11 },
        { id: 2, name: 'b', sort_order: 1, thumbnail_image_id: 22 },
      ];
      listGroupCategories.mockResolvedValue({ status: 200, data: fresh });

      const calls = [];
      await loadGroupCategoriesOptimistic({
        context: { token: 't' },
        groupId: 'g-7',
        onCategories: (value) => calls.push(value),
      });

      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual(cached);
      expect(calls[1]).toEqual(fresh.map(normalizePrivateCategory));

      const stored = await AsyncStorage.getItem('groupCategories:g-7');
      expect(JSON.parse(stored)).toEqual(fresh.map(normalizePrivateCategory));
    });

    it('renders cache once and does NOT call onCategories again when fresh === cache', async () => {
      const cached = [
        { id: 1, name: 'a', sort_order: 0, thumbnail_image_id: 11, thumbnailUrl: 'https://x/a.png', key: 1 },
      ];
      await AsyncStorage.setItem('groupCategories:g-7', JSON.stringify(cached));

      const fresh = [
        { id: 1, name: 'a', sort_order: 0, thumbnail_image_id: 11, thumbnail_url: 'https://y/a.png' },
      ];
      listGroupCategories.mockResolvedValue({ status: 200, data: fresh });

      const calls = [];
      await loadGroupCategoriesOptimistic({
        context: { token: 't' },
        groupId: 'g-7',
        onCategories: (value) => calls.push(value),
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual(cached);

      const stored = await AsyncStorage.getItem('groupCategories:g-7');
      expect(JSON.parse(stored)).toEqual(cached);
    });

    it('calls onCategories once with cache and does not throw when the network rejects', async () => {
      const cached = [
        { id: 1, name: 'a', sort_order: 0, thumbnail_image_id: 11, key: 1, thumbnailUrl: null },
      ];
      await AsyncStorage.setItem('groupCategories:g-7', JSON.stringify(cached));

      listGroupCategories.mockRejectedValue(new Error('network down'));

      const calls = [];
      await expect(
        loadGroupCategoriesOptimistic({
          context: { token: 't' },
          groupId: 'g-7',
          onCategories: (value) => calls.push(value),
        }),
      ).resolves.toBeUndefined();

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual(cached);

      const stored = await AsyncStorage.getItem('groupCategories:g-7');
      expect(JSON.parse(stored)).toEqual(cached);
    });

    it('does not call onCategories when there is no cache and the request fails', async () => {
      listGroupCategories.mockRejectedValue(new Error('offline'));

      const calls = [];
      await loadGroupCategoriesOptimistic({
        context: { token: 't' },
        groupId: 'g-empty',
        onCategories: (value) => calls.push(value),
      });

      expect(calls).toHaveLength(0);
    });

    it('resolves and still fetches from the network when the cache read rejects', async () => {
      AsyncStorage.getItem.mockRejectedValueOnce(new Error('storage unavailable'));
      const fresh = [
        { id: 1, name: 'a', sort_order: 0, thumbnail_image_id: 11 },
      ];
      listGroupCategories.mockResolvedValue({ status: 200, data: fresh });

      const calls = [];
      await expect(
        loadGroupCategoriesOptimistic({
          context: { token: 't' },
          groupId: 'g-7',
          onCategories: (value) => calls.push(value),
        }),
      ).resolves.toBeUndefined();

      expect(listGroupCategories).toHaveBeenCalledWith({ token: 't' }, 'g-7');
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual(fresh.map(normalizePrivateCategory));
    });
  });

  describe('refreshGroupCategories', () => {
    it('writes the cache and returns { data } on a 200 response', async () => {
      const fresh = [
        { id: 1, name: 'a', sort_order: 0, thumbnail_image_id: 11 },
        { id: 2, name: 'b', sort_order: 1, thumbnail_image_id: 22 },
      ];
      listGroupCategories.mockResolvedValue({ status: 200, data: fresh });

      const result = await refreshGroupCategories({ context: { token: 't' }, groupId: 'g-7' });

      expect(result).toEqual({ data: fresh.map(normalizePrivateCategory) });

      const stored = await AsyncStorage.getItem('groupCategories:g-7');
      expect(JSON.parse(stored)).toEqual(fresh.map(normalizePrivateCategory));
    });

    it('returns { isError } and does not write cache when the network rejects', async () => {
      listGroupCategories.mockRejectedValue(new Error('offline'));

      const result = await refreshGroupCategories({ context: { token: 't' }, groupId: 'g-7' });

      expect(result).toEqual({ isError: true });

      const stored = await AsyncStorage.getItem('groupCategories:g-7');
      expect(stored).toBeNull();
    });
  });
});
