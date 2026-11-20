import type { MMKV, Configuration } from 'react-native-mmkv';

let instance: MMKV | null = null;

export function getMmkv(): MMKV {
  if (instance === null) {
    instance = createInstance();
  }
  return instance;
}

function createInstance(): MMKV {
  const { isTest } = require('react-native-mmkv/src/isTest');
  if (isTest()) {
    const { createMockMMKV } = require('react-native-mmkv/src/createMMKV/createMockMMKV');
    return createMockMMKV();
  }
  const { createMMKV }: { createMMKV: (configuration?: Configuration) => MMKV } =
    require('react-native-mmkv');
  return createMMKV();
}
