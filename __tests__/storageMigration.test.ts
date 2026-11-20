jest.unmock('../utils/storageMigration');
jest.unmock('../utils/localStore');

jest.mock('../utils/mmkvStore', () => {
  let map: Map<string, string> | null = null;
  let engine: Record<string, unknown> | null = null;
  let constructionError: Error | null = null;
  const snapshotBeforeFlagSet: Array<Set<string>> = [];

  const buildEngine = () => {
    map = new Map<string, string>();
    const set = jest.fn((key: string, value: string) => {
      snapshotBeforeFlagSet.push(new Set(map.keys()));
      map.set(key, value);
    });
    engine = {
      getString: jest.fn((key: string) => (map as Map<string, string>).get(key)),
      set,
      remove: jest.fn((key: string) => {
        (map as Map<string, string>).delete(key);
      }),
      getAllKeys: jest.fn(() => Array.from(map as Map<string, string>).map(([k]) => k)),
    };
  };

  return {
    getMmkv: () => {
      if (constructionError) throw constructionError;
      if (!engine) buildEngine();
      return engine;
    },
    __seed: (entries: Record<string, string>) => {
      if (!engine) buildEngine();
      for (const [key, value] of Object.entries(entries)) {
        (map as Map<string, string>).set(key, value);
      }
    },
    __map: () => map,
    __engine: () => engine,
    __snapshotsBeforeFlagSet: () => snapshotBeforeFlagSet,
    __failConstruction: (error: Error) => {
      constructionError = error;
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  let store = new Map<string, string>();
  const failures: { getAllKeys?: Error; getItem?: Error } = {};
  const api = {
    getItem: jest.fn((key: string) => {
      if (failures.getItem) return Promise.reject(failures.getItem);
      return Promise.resolve(store.has(key) ? (store.get(key) as string) : null);
    }),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve(undefined);
    }),
    removeItem: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(undefined);
    }),
    getAllKeys: jest.fn(() => {
      if (failures.getAllKeys) return Promise.reject(failures.getAllKeys);
      return Promise.resolve(Array.from(store.keys()));
    }),
    multiRemove: jest.fn((keys: readonly string[]) => {
      keys.forEach((key) => store.delete(key));
      return Promise.resolve(undefined);
    }),
  };
  return {
    __esModule: true,
    default: api,
    __setStore: (entries: Record<string, string>) => {
      store = new Map(Object.entries(entries));
    },
    __failOn: (method: 'getAllKeys' | 'getItem', error: Error | null) => {
      if (error === null) {
        delete failures[method];
        return;
      }
      failures[method] = error;
    },
    __getAllKeysMock: () => api.getAllKeys,
    __getItemMock: () => api.getItem,
  };
});

type MmkvEngineMock = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
  getAllKeys: () => string[];
};

type MmkvStoreMock = {
  getMmkv: () => MmkvEngineMock;
  __seed: (entries: Record<string, string>) => void;
  __map: () => Map<string, string> | null;
  __engine: () => Record<string, unknown> | null;
  __snapshotsBeforeFlagSet: () => Array<Set<string>>;
  __failConstruction: (error: Error) => void;
};

type AsyncStorageMock = {
  default: { getAllKeys: jest.Mock; getItem: jest.Mock };
  __setStore: (entries: Record<string, string>) => void;
  __failOn: (method: 'getAllKeys' | 'getItem', error: Error | null) => void;
  __getAllKeysMock: () => jest.Mock;
  __getItemMock: () => jest.Mock;
};

describe('storageMigration (AsyncStorage → MMKV copy-all)', () => {
  let storageMigration: typeof import('../utils/storageMigration');
  let localStore: typeof import('../utils/localStore');
  let mmkvStoreMock: MmkvStoreMock;
  let asyncStorageMock: AsyncStorageMock;

  beforeEach(() => {
    jest.resetModules();
    asyncStorageMock = require('@react-native-async-storage/async-storage') as AsyncStorageMock;
    mmkvStoreMock = require('../utils/mmkvStore') as unknown as MmkvStoreMock;
    storageMigration = require('../utils/storageMigration');
    localStore = require('../utils/localStore');
  });

  it('copies every AsyncStorage key verbatim into MMKV before setting the flag', async () => {
    const cursorKey = 'groupFeed:7:game:cat:en:any:cursor';
    const cursorValue = 'QUJDREVGRw==:c3RhcnQ=';
    asyncStorageMock.__setStore({
      plain: 'hello',
      [cursorKey]: cursorValue,
      json: '{"a":1,"b":[2,3]}',
    });

    await storageMigration.ensureMigrated();

    const map = mmkvStoreMock.__map() as Map<string, string>;
    expect(map.get('plain')).toBe('hello');
    expect(map.get(cursorKey)).toBe(cursorValue);
    expect(map.get('json')).toBe('{"a":1,"b":[2,3]}');
  });

  it('sets mmkv_migrated only after the full copy', async () => {
    asyncStorageMock.__setStore({ one: '1', two: '2' });

    await storageMigration.ensureMigrated();

    const snapshots = mmkvStoreMock.__snapshotsBeforeFlagSet();
    const flagCallIndex = (mmkvStoreMock.__engine()!.set as jest.Mock).mock.calls.findIndex(
      ([key]: [string]) => key === 'mmkv_migrated'
    );
    expect(flagCallIndex).toBeGreaterThanOrEqual(0);
    expect(snapshots).toHaveLength((mmkvStoreMock.__engine()!.set as jest.Mock).mock.calls.length);
    const keysBeforeFlag = snapshots[flagCallIndex];
    expect(keysBeforeFlag.has('one')).toBe(true);
    expect(keysBeforeFlag.has('two')).toBe(true);
    expect(keysBeforeFlag.has('mmkv_migrated')).toBe(false);
  });

  it('is a no-op after the first success', async () => {
    asyncStorageMock.__setStore({ one: '1' });
    await storageMigration.ensureMigrated();

    asyncStorageMock.__getAllKeysMock().mockClear();
    asyncStorageMock.__getItemMock().mockClear();
    asyncStorageMock.__setStore({ one: 'changed-after-migration' });

    await storageMigration.ensureMigrated();

    expect(asyncStorageMock.__getAllKeysMock()).not.toHaveBeenCalled();
    expect(asyncStorageMock.__getItemMock()).not.toHaveBeenCalled();
    expect(mmkvStoreMock.__map()!.get('one')).toBe('1');
  });

  it('skips migration entirely when the MMKV flag is already set', async () => {
    mmkvStoreMock.__seed({ mmkv_migrated: 'true' });

    await storageMigration.ensureMigrated();

    expect(asyncStorageMock.__getAllKeysMock()).not.toHaveBeenCalled();
    expect(asyncStorageMock.__getItemMock()).not.toHaveBeenCalled();
  });

  it('shares one in-flight migration between concurrent callers', async () => {
    asyncStorageMock.__setStore({ one: '1', two: '2' });

    await Promise.all([
      storageMigration.ensureMigrated(),
      storageMigration.ensureMigrated(),
      storageMigration.ensureMigrated(),
    ]);

    expect(asyncStorageMock.__getAllKeysMock()).toHaveBeenCalledTimes(1);
    expect(mmkvStoreMock.__map()!.get('one')).toBe('1');
    expect(mmkvStoreMock.__map()!.get('two')).toBe('2');
  });

  it('keeps the flag unset and gated adapter ops reject when migration throws', async () => {
    asyncStorageMock.__setStore({ one: '1' });
    asyncStorageMock.__failOn('getAllKeys', new Error('getAllKeys boom'));

    await expect(storageMigration.ensureMigrated()).rejects.toThrow('getAllKeys boom');
    expect(mmkvStoreMock.__map()!.has('mmkv_migrated')).toBe(false);
    expect(mmkvStoreMock.__map()!.has('one')).toBe(false);

    await expect(localStore.getItem('one')).rejects.toThrow('getAllKeys boom');
  });

  it('recovers on a later call after a failed migration attempt', async () => {
    asyncStorageMock.__setStore({ one: '1' });
    asyncStorageMock.__failOn('getAllKeys', new Error('getAllKeys boom'));
    await expect(storageMigration.ensureMigrated()).rejects.toThrow('getAllKeys boom');

    asyncStorageMock.__failOn('getAllKeys', null);
    await expect(localStore.getItem('one')).resolves.toBe('1');
    expect(mmkvStoreMock.__map()!.get('mmkv_migrated')).toBe('true');
  });

  it('rejects when MMKV construction fails, without touching AsyncStorage', async () => {
    mmkvStoreMock.__failConstruction(new Error('MMKV construction failed'));

    await expect(storageMigration.ensureMigrated()).rejects.toThrow('MMKV construction failed');
    expect(asyncStorageMock.__getAllKeysMock()).not.toHaveBeenCalled();
  });
});
