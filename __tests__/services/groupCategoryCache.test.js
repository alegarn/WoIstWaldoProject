jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();

  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key) => Promise.resolve(store.has(key) ? store.get(key) : null)),
      setItem: jest.fn((key, value) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn((key) => {
        store.delete(key);
        return Promise.resolve();
      }),
      getAllKeys: jest.fn(() => Promise.resolve(Array.from(store.keys()))),
      multiRemove: jest.fn((keys) => {
        for (const key of keys) store.delete(key);
        return Promise.resolve();
      }),
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  readGroupCategoryCache,
  writeGroupCategoryCache,
  clearGroupCategoryCache,
  clearAllGroupCategoryCaches,
} from '../../services/groups/groupCategoryCache';

describe('services/groups/groupCategoryCache', () => {
  beforeEach(() => {
    AsyncStorage.setItem.mockClear();
    AsyncStorage.removeItem.mockClear();
    AsyncStorage.multiRemove.mockClear();
    AsyncStorage.getItem.mockClear();
    AsyncStorage.getAllKeys.mockClear();
  });

  it('writeGroupCategoryCache round-trips so readGroupCategoryCache returns the same array', async () => {
    const categories = [
      { id: 'c-1', name: 'Nature', sort_order: 0 },
      { id: 'c-2', name: 'Cities', sort_order: 1 },
    ];

    await writeGroupCategoryCache('g-7', categories);

    const result = await readGroupCategoryCache('g-7');

    expect(result).toEqual(categories);
  });

  it('writeGroupCategoryCache coerces non-arrays to []', async () => {
    await writeGroupCategoryCache('g-7', null);

    const result = await readGroupCategoryCache('g-7');

    expect(result).toEqual([]);
  });

  it('readGroupCategoryCache returns null when no entry exists', async () => {
    const result = await readGroupCategoryCache('g-missing');

    expect(result).toBeNull();
  });

  it('readGroupCategoryCache returns null on bad JSON', async () => {
    await AsyncStorage.setItem('groupCategories:g-7', '{not valid json');

    const result = await readGroupCategoryCache('g-7');

    expect(result).toBeNull();
  });

  it('readGroupCategoryCache returns null when stored value is not an array', async () => {
    await AsyncStorage.setItem('groupCategories:g-7', '{"id":"c-1"}');

    const result = await readGroupCategoryCache('g-7');

    expect(result).toBeNull();
  });

  it('clearGroupCategoryCache removes only the target group key', async () => {
    await writeGroupCategoryCache('g-7', [{ id: 'c-1' }]);
    await writeGroupCategoryCache('g-9', [{ id: 'c-2' }]);

    await clearGroupCategoryCache('g-7');

    const keys = await AsyncStorage.getAllKeys();

    expect(keys).not.toContain('groupCategories:g-7');
    expect(keys).toContain('groupCategories:g-9');
  });

  it('clearAllGroupCategoryCaches removes every groupCategories:* key while leaving unrelated keys intact', async () => {
    await writeGroupCategoryCache('g-7', [{ id: 'c-1' }]);
    await writeGroupCategoryCache('g-9', [{ id: 'c-2' }]);
    await AsyncStorage.setItem('groupFeed:g-7:all:any', '[]');
    await AsyncStorage.setItem('public_guess_cache', 'kept');

    await clearAllGroupCategoryCaches();

    const keys = await AsyncStorage.getAllKeys();

    expect(keys).not.toContain('groupCategories:g-7');
    expect(keys).not.toContain('groupCategories:g-9');
    expect(keys).toContain('groupFeed:g-7:all:any');
    expect(keys).toContain('public_guess_cache');
  });
});
