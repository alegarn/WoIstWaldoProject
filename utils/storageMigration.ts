import { getMmkv } from './mmkvStore';

export const MIGRATION_FLAG_KEY = 'mmkv_migrated';
export const MIGRATION_FLAG_VALUE = 'true';

let migrated = false;
let migrating: Promise<void> | null = null;

export function ensureMigrated(): Promise<void> {
  if (migrated) {
    return Promise.resolve();
  }
  if (migrating === null) {
    migrating = runMigration()
      .then(() => {
        migrated = true;
      })
      .finally(() => {
        migrating = null;
      });
  }
  return migrating;
}

async function runMigration(): Promise<void> {
  const mmkv = getMmkv();
  if (mmkv.getString(MIGRATION_FLAG_KEY) === MIGRATION_FLAG_VALUE) {
    return;
  }
  const AsyncStorageModule = require('@react-native-async-storage/async-storage');
  const AsyncStorage: { getAllKeys: () => Promise<string[]>; getItem: (key: string) => Promise<string | null> } =
    AsyncStorageModule.default ?? AsyncStorageModule;
  const keys: string[] = await AsyncStorage.getAllKeys();
  for (const key of keys) {
    const value: string | null = await AsyncStorage.getItem(key);
    if (value !== null && value !== undefined) {
      mmkv.set(key, value);
    }
  }
  mmkv.set(MIGRATION_FLAG_KEY, MIGRATION_FLAG_VALUE);
}
