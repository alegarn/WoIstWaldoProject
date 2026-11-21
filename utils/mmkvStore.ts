import type { MMKV, Configuration } from 'react-native-mmkv';

let instance: MMKV | null = null;

export function getMmkv(): MMKV {
  if (instance === null) {
    instance = createInstance();
  }
  return instance;
}

function createInstance(): MMKV {
  // NOTE: these two deep imports reach `react-native-mmkv/src/...` internals
  // (private API) so the test env can use the library's own mock engine.
  // Verified against react-native-mmkv@^4.3.2 — re-check both paths on bump.
  const { isTest } = require('react-native-mmkv/src/isTest');
  if (isTest()) {
    const { createMockMMKV } = require('react-native-mmkv/src/createMMKV/createMockMMKV');
    return createMockMMKV();
  }
  const { createMMKV }: { createMMKV: (configuration?: Configuration) => MMKV } =
    require('react-native-mmkv');
  return createMMKV();
}
