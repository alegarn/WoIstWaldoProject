jest.mock('../utils/mmkvStore', () => {
  let map: Map<string, string> | null = null;
  let engine: Record<string, unknown> | null = null;
  let constructionError: Error | null = null;

  const buildEngine = () => {
    map = new Map<string, string>();
    engine = {
      getString: jest.fn((key: string) => {
        const stored = (map as Map<string, string>).get(key);
        return typeof stored === 'string' ? stored : undefined;
      }),
      set: jest.fn((key: string, value: string) => {
        (map as Map<string, string>).set(key, value);
      }),
      remove: jest.fn((key: string) => {
        (map as Map<string, string>).delete(key);
      }),
      getAllKeys: jest.fn(() =>
        Array.from((map as Map<string, string>).keys())
      ),
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
    __failConstruction: (error: Error) => {
      constructionError = error;
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  let store = new Map<string, string>();
  const api = {
    getItem: jest.fn((key: string) =>
      Promise.resolve(store.has(key) ? (store.get(key) as string) : null)
    ),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve(undefined);
    }),
    removeItem: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(undefined);
    }),
    getAllKeys: jest.fn(() => Promise.resolve(Array.from(store.keys()))),
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
  };
});

type MmkvStoreMock = {
  getMmkv: () => any;
  __seed: (entries: Record<string, string>) => void;
  __map: () => Map<string, string> | null;
  __engine: () => Record<string, unknown> | null;
  __failConstruction: (error: Error) => void;
};

type AsyncStorageMock = {
  __setStore: (entries: Record<string, string>) => void;
};

describe('localStore (MMKV-backed storage seam)', () => {
  let localStore: typeof import('../utils/localStore');
  let mmkvStoreMock: MmkvStoreMock;
  let asyncStorageMock: AsyncStorageMock;

  beforeEach(() => {
    jest.resetModules();
    asyncStorageMock = require('@react-native-async-storage/async-storage') as AsyncStorageMock;
    mmkvStoreMock = require('../utils/mmkvStore') as unknown as MmkvStoreMock;
    localStore = require('../utils/localStore');
  });

  it('getItem resolves null — never undefined — on unset key', async () => {
    const value = await localStore.getItem('unset:key');

    expect(value).not.toBeUndefined();
    expect(value).toBeNull();
  });

  it('round-trips a value through the MMKV engine', async () => {
    await localStore.setItem('k', 'v');

    await expect(localStore.getItem('k')).resolves.toBe('v');
    expect(mmkvStoreMock.__engine()!.set as jest.Mock).toHaveBeenCalledWith('k', 'v');

    await localStore.removeItem('k');
    await expect(localStore.getItem('k')).resolves.toBeNull();
  });

  it('setItem rejects non-string values with TypeError', async () => {
    await expect(
      localStore.setItem('k', null as unknown as string)
    ).rejects.toThrow(TypeError);
    await expect(
      localStore.setItem('k', 42 as unknown as string)
    ).rejects.toThrow(TypeError);
    expect(mmkvStoreMock.__map()!.has('k')).toBe(false);
  });

  it('getAllKeys filters the mmkv_migrated marker out of the shared keyspace', async () => {
    mmkvStoreMock.__seed({ mmkv_migrated: 'true', a: '1', b: '2' });

    await expect(localStore.getAllKeys()).resolves.toEqual(['a', 'b']);
  });

  it('multiRemove removes the whole batch inside one sync slice', async () => {
    await localStore.getItem('__prime__');
    mmkvStoreMock.__seed({ a: '1', b: '2', c: '3', keep: '4' });
    const map = mmkvStoreMock.__map() as Map<string, string>;
    const engine = mmkvStoreMock.__engine()!;
    let sawLastKeyAtProbe: boolean | null = null;
    (engine.remove as jest.Mock).mockImplementation((key: string) => {
      map.delete(key);
      if (key === 'a') {
        Promise.resolve().then(() => {
          sawLastKeyAtProbe = map.has('c');
        });
      }
    });

    await localStore.multiRemove(['a', 'b', 'c']);

    expect(engine.remove).toHaveBeenCalledTimes(3);
    expect(sawLastKeyAtProbe).toBe(false);
    expect(map.has('a')).toBe(false);
    expect(map.has('b')).toBe(false);
    expect(map.has('c')).toBe(false);
    expect(map.get('keep')).toBe('4');
  });

  it('every adapter op awaits migration first, so legacy keys are visible', async () => {
    asyncStorageMock.__setStore({ legacyKey: 'legacyValue' });

    await expect(localStore.getItem('legacyKey')).resolves.toBe('legacyValue');
    await expect(localStore.getAllKeys()).resolves.toContain('legacyKey');
    await expect(localStore.getItem('unset:key')).resolves.toBeNull();

    await localStore.multiRemove(['legacyKey']);
    await expect(localStore.getAllKeys()).resolves.not.toContain('legacyKey');

    await localStore.setItem('freshKey', 'freshValue');
    await expect(localStore.getItem('freshKey')).resolves.toBe('freshValue');

    await localStore.removeItem('freshKey');
    await expect(localStore.getItem('freshKey')).resolves.toBeNull();
  });

  it('surfaces MMKV construction failure as a rejected adapter call', async () => {
    mmkvStoreMock.__failConstruction(new Error('MMKV construction failed'));

    await expect(localStore.getItem('k')).rejects.toThrow('MMKV construction failed');
    await expect(localStore.setItem('k', 'v')).rejects.toThrow('MMKV construction failed');
    await expect(localStore.removeItem('k')).rejects.toThrow('MMKV construction failed');
    await expect(localStore.getAllKeys()).rejects.toThrow('MMKV construction failed');
    await expect(localStore.multiRemove(['k'])).rejects.toThrow('MMKV construction failed');
  });
});
