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

jest.mock('expo-file-system', () => {
  const cacheStore = {
    uri: 'file:///cache/',
    list: () => [],
    create: jest.fn(),
  };

  return {
    File: jest.fn().mockImplementation(function MockFile(uri) {
      this.uri = typeof uri === 'string' ? uri : uri?.uri;
      this.exists = true;
      this.delete = jest.fn();
    }),
    Paths: class MockPaths {
      static get cache() {
        return cacheStore;
      }
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  readGroupFeedCache,
  writeGroupFeedCache,
  clearGroupFeedCache,
  clearAllGroupFeedCaches,
  purgeAllPrivateCaches,
} from '../../services/groups/groupFeedCache';

describe('services/groups/groupFeedCache — purge behavior', () => {
  beforeEach(() => {
    AsyncStorage.setItem.mockClear();
    AsyncStorage.removeItem.mockClear();
    AsyncStorage.multiRemove.mockClear();
    AsyncStorage.getItem.mockClear();
    AsyncStorage.getAllKeys.mockClear();
  });

  it('writeGroupFeedCache round-trips list+cursor so readGroupFeedCache returns the same payload', async () => {
    await writeGroupFeedCache(
      'g-3',
      { categoryId: 'all', language: 'any' },
      { images: [{ id: 'img-1' }], nextCursor: 'cursor-1' }
    );

    const result = await readGroupFeedCache('g-3', { categoryId: 'all', language: 'any' });

    expect(result.images).toEqual([{ id: 'img-1' }]);
    expect(result.nextCursor).toBe('cursor-1');
  });

  it('clearAllGroupFeedCaches removes every groupFeed:* key while leaving unrelated keys intact', async () => {
    await AsyncStorage.setItem('groupFeed:g-3:all:any', '[]');
    await AsyncStorage.setItem('groupFeed:g-3:all:any:cursor', '{"nextCursor":null}');
    await AsyncStorage.setItem('groupFeed:g-9:nature:fr', '[]');
    await AsyncStorage.setItem('public_guess_cache', 'kept');

    await clearAllGroupFeedCaches();

    const keys = await AsyncStorage.getAllKeys();

    expect(keys).not.toContain('groupFeed:g-3:all:any');
    expect(keys).not.toContain('groupFeed:g-3:all:any:cursor');
    expect(keys).not.toContain('groupFeed:g-9:nature:fr');
    expect(keys).toContain('public_guess_cache');
  });

  it('clearGroupFeedCache scopes the purge to a single groupId', async () => {
    await AsyncStorage.setItem('groupFeed:g-3:all:any', '[]');
    await AsyncStorage.setItem('groupFeed:g-9:all:any', '[]');

    await clearGroupFeedCache('g-3');

    const keys = await AsyncStorage.getAllKeys();

    expect(keys).not.toContain('groupFeed:g-3:all:any');
    expect(keys).toContain('groupFeed:g-9:all:any');
  });

  it('purgeAllPrivateCaches strips every group:* key (logout path) and leaves public caches intact', async () => {
    await AsyncStorage.setItem('groupFeed:g-3:all:any', '[]');
    await AsyncStorage.setItem('groupFeed:g-3:all:any:cursor', '{"nextCursor":null}');
    await AsyncStorage.setItem('public_guess_cache', 'kept');

    await purgeAllPrivateCaches();

    const keys = await AsyncStorage.getAllKeys();

    expect(keys).not.toContain('groupFeed:g-3:all:any');
    expect(keys).not.toContain('groupFeed:g-3:all:any:cursor');
    expect(keys).toContain('public_guess_cache');
  });
});
