import { getMmkv } from './mmkvStore';
import { ensureMigrated, MIGRATION_FLAG_KEY } from './storageMigration';

export async function getItem(key: string): Promise<string | null> {
  await ensureMigrated();
  return getMmkv().getString(key) ?? null;
}

export async function setItem(key: string, value: string): Promise<void> {
  await ensureMigrated();
  if (typeof value !== 'string') {
    throw new TypeError(
      `localStore.setItem only accepts string values, received ${typeof value}`
    );
  }
  getMmkv().set(key, value);
}

export function getItemSync(key: string): string | null {
  return getMmkv().getString(key) ?? null;
}

export function setItemSync(key: string, value: string): void {
  if (typeof value !== 'string') {
    throw new TypeError(
      `localStore.setItemSync only accepts string values, received ${typeof value}`
    );
  }
  getMmkv().set(key, value);
}

export async function removeItem(key: string): Promise<void> {
  await ensureMigrated();
  getMmkv().remove(key);
}

export async function getAllKeys(): Promise<readonly string[]> {
  await ensureMigrated();
  return getMmkv().getAllKeys().filter((key) => key !== MIGRATION_FLAG_KEY);
}

export async function multiRemove(keys: readonly string[]): Promise<void> {
  await ensureMigrated();
  const mmkv = getMmkv();
  for (const key of keys) {
    mmkv.remove(key);
  }
}
