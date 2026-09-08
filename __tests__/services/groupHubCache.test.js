jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();

  return {
    __esModule: true,
    __store: store,
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

import AsyncStorage, { __store as asyncStorageStore } from '@react-native-async-storage/async-storage';
import {
  readGroupHubCache,
  writeGroupHubCache,
  clearGroupHubCache,
  clearAllGroupHubCaches,
} from '../../services/groups/groupHubCache';

const HUB = {
  owned: [{ id: 'g-1', role: 'owner' }],
  joined: [{ id: 'g-2', role: 'member' }],
  pendingInvites: [],
};

describe('services/groups/groupHubCache', () => {
  beforeEach(() => {
    asyncStorageStore.clear();
    AsyncStorage.setItem.mockClear();
    AsyncStorage.removeItem.mockClear();
    AsyncStorage.multiRemove.mockClear();
    AsyncStorage.getItem.mockClear();
    AsyncStorage.getAllKeys.mockClear();
  });

  it('writeGroupHubCache round-trips so readGroupHubCache returns the same payload', async () => {
    await writeGroupHubCache('user-1', HUB);

    const result = await readGroupHubCache('user-1');

    expect(result).toEqual(HUB);
  });

  it('writeGroupHubCache is best-effort: malformed payloads are not stored and do not throw', async () => {
    await expect(writeGroupHubCache('user-1', null)).resolves.toBeUndefined();
    await expect(writeGroupHubCache('user-1', { owned: 'nope' })).resolves.toBeUndefined();

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    const result = await readGroupHubCache('user-1');

    expect(result).toBeNull();
  });

  it('readGroupHubCache returns null when no entry exists', async () => {
    const result = await readGroupHubCache('user-missing');

    expect(result).toBeNull();
  });

  it('readGroupHubCache returns null on bad JSON', async () => {
    await AsyncStorage.setItem('groupsHub:user-1', '{not valid json');

    const result = await readGroupHubCache('user-1');

    expect(result).toBeNull();
  });

  it('readGroupHubCache returns null when the stored value is not a hub payload', async () => {
    await AsyncStorage.setItem('groupsHub:user-1', '{"owned":"nope"}');

    const result = await readGroupHubCache('user-1');

    expect(result).toBeNull();
  });

  it('readGroupHubCache returns null without a userId so caches never leak across users', async () => {
    await writeGroupHubCache('user-1', HUB);

    expect(await readGroupHubCache(null)).toBeNull();
    expect(await readGroupHubCache(undefined)).toBeNull();
  });

  it('readGroupHubCache treats a cached empty hub as no cache', async () => {
    await AsyncStorage.setItem(
      'groupsHub:user-1',
      JSON.stringify({ owned: [], joined: [], pendingInvites: [] })
    );

    const result = await readGroupHubCache('user-1');

    expect(result).toBeNull();
  });

  it('readGroupHubCache returns a cached hub that has rows in either bucket', async () => {
    const joinedOnly = { owned: [], joined: [{ id: 'g-2', role: 'member' }], pendingInvites: [] };
    await AsyncStorage.setItem('groupsHub:user-1', JSON.stringify(joinedOnly));

    expect(await readGroupHubCache('user-1')).toEqual(joinedOnly);
  });

  it('caches are namespaced per userId and clearGroupHubCache removes only the target user key', async () => {
    await writeGroupHubCache('user-1', HUB);
    await writeGroupHubCache('user-2', { owned: [], joined: [], pendingInvites: [] });

    // The written empty entry stays on disk (write logic unchanged) but reads ignore it.
    expect(await readGroupHubCache('user-2')).toBeNull();

    await clearGroupHubCache('user-1');

    const keys = await AsyncStorage.getAllKeys();

    expect(keys).not.toContain('groupsHub:user-1');
    expect(keys).toContain('groupsHub:user-2');
    expect(await readGroupHubCache('user-1')).toBeNull();
  });

  it('clearAllGroupHubCaches removes every groupsHub:* key while leaving unrelated keys intact', async () => {
    await writeGroupHubCache('user-1', HUB);
    await writeGroupHubCache('user-2', HUB);
    await AsyncStorage.setItem('groupCategories:g-7', '[]');
    await AsyncStorage.setItem('groupFeed:g-7:all:any', '[]');

    await clearAllGroupHubCaches();

    const keys = await AsyncStorage.getAllKeys();

    expect(keys).not.toContain('groupsHub:user-1');
    expect(keys).not.toContain('groupsHub:user-2');
    expect(keys).toContain('groupCategories:g-7');
    expect(keys).toContain('groupFeed:g-7:all:any');
  });
});
