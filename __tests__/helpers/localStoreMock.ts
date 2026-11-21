/**
 * Shared adapter mock for the `utils/localStore` storage seam (MMKV-backed).
 *
 * Two module shapes live here, co-located so `__reset()` can clear both:
 * - the module itself: `jest.mock('../utils/localStore', () => require('<this file>'))`
 *   exports jest.fn spies `getItem`/`setItem`/`removeItem`/`getAllKeys`/`multiRemove`
 *   (async, in-memory-Map backed, spy-compatible: mockResolvedValue/mockRejectedValueOnce/
 *   mockImplementationOnce/mockReset all work), the `__store` Map (named export, hard
 *   contract — suites import it directly), a `default` export with the same five spies
 *   for legacy `import x from '<module>'` bindings, and `__reset()`.
 * - `.storageMigration`: `jest.mock('../utils/storageMigration', () => require('<this file>').storageMigration)`
 *   — no-op `ensureMigrated` spy so suites never run real migration against a mocked
 *   engine. `__reset()` clears `__store` AND resets this spy (history + no-op impl),
 *   which is what `statefulAsyncStorageMock({ autoReset: true })` calls.
 *
 * LSP invariant: `getItem` on an unset key resolves `null`, never `undefined`.
 */

type LocalStoreSpy = jest.Mock;

type LocalStoreMockModule = {
  __esModule: boolean;
  getItem: LocalStoreSpy;
  setItem: LocalStoreSpy;
  removeItem: LocalStoreSpy;
  getAllKeys: LocalStoreSpy;
  multiRemove: LocalStoreSpy;
  __store: Map<string, string>;
  __reset: () => void;
  default: {
    getItem: LocalStoreSpy;
    setItem: LocalStoreSpy;
    removeItem: LocalStoreSpy;
    getAllKeys: LocalStoreSpy;
    multiRemove: LocalStoreSpy;
  };
  storageMigration: {
    __esModule: boolean;
    ensureMigrated: LocalStoreSpy;
  };
};

const store = new Map<string, string>();

const getItem = jest.fn((key: string): Promise<string | null> =>
  Promise.resolve(store.has(key) ? (store.get(key) as string) : null)
);

const setItem = jest.fn((key: string, value: string): Promise<void> => {
  store.set(key, value);
  return Promise.resolve();
});

const removeItem = jest.fn((key: string): Promise<void> => {
  store.delete(key);
  return Promise.resolve();
});

const getAllKeys = jest.fn((): Promise<string[]> => Promise.resolve(Array.from(store.keys())));

const multiRemove = jest.fn((keys: readonly string[]): Promise<void> => {
  for (const key of keys) {
    store.delete(key);
  }
  return Promise.resolve();
});

const storageMigration = {
  __esModule: true,
  ensureMigrated: jest.fn((): Promise<void> => Promise.resolve()),
};

const localStoreMockModule: LocalStoreMockModule = {
  __esModule: true,
  getItem,
  setItem,
  removeItem,
  getAllKeys,
  multiRemove,
  __store: store,
  __reset: () => {
    store.clear();
    storageMigration.ensureMigrated.mockReset();
    storageMigration.ensureMigrated.mockImplementation(() => Promise.resolve());
  },
  default: { getItem, setItem, removeItem, getAllKeys, multiRemove },
  storageMigration,
};

declare const module: { exports: unknown };

export type { LocalStoreMockModule };

module.exports = localStoreMockModule;
