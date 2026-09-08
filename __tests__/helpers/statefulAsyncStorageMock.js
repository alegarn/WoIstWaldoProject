function createStatefulAsyncStorageMock({ autoReset = false } = {}) {
  const store = new Map();

  const asyncStorage = {
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

module.exports = createStatefulAsyncStorageMock;
