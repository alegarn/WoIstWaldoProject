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

declare const require: (moduleId: string) => unknown;
declare const module: { exports: unknown };

function createStatefulAsyncStorageMock({ autoReset = false }: { autoReset?: boolean } = {}): StatefulAsyncStorageMock {
  const adapterMock = require('./localStoreMock') as StatefulAsyncStorageMock & { __reset: () => void };

  if (autoReset) {
    beforeEach(() => {
      adapterMock.__reset();
    });
  }

  return adapterMock;
}

export type { StatefulAsyncStorageMock };

module.exports = createStatefulAsyncStorageMock;
