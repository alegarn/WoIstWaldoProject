type StatefulAsyncStorageMock = {
  __esModule: boolean;
  __store: Map<string, string>;
  default: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
    getAllKeys: () => Promise<string[]>;
    multiRemove: (keys: string[]) => Promise<void>;
  };
};

function createStatefulAsyncStorageMock({ autoReset = false }: { autoReset?: boolean } = {}): StatefulAsyncStorageMock {
  const store: Map<string, string> = new Map();

  const asyncStorage = {
    getItem: jest.fn((key: string): Promise<string | null> => Promise.resolve(store.has(key) ? store.get(key) ?? null : null)),
    setItem: jest.fn((key: string, value: string): Promise<void> => {
      store.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string): Promise<void> => {
      store.delete(key);
      return Promise.resolve();
    }),
    getAllKeys: jest.fn((): Promise<string[]> => Promise.resolve(Array.from(store.keys()))),
    multiRemove: jest.fn((keys: string[]): Promise<void> => {
      for (const key of keys) store.delete(key);
      return Promise.resolve();
    }),
  };

  if (autoReset) {
    beforeEach(() => {
      store.clear();
    });
  }

  return {
    __esModule: true,
    __store: store,
    default: asyncStorage,
  };
}

declare const module: { exports: unknown };

export type { StatefulAsyncStorageMock };

module.exports = createStatefulAsyncStorageMock;
