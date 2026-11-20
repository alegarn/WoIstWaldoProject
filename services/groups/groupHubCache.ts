import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Group, GroupsHubData } from '../../types/groups';

const PREFIX = 'groupsHub';

function groupHubKey(userId: string | null | undefined): string {
  return `${PREFIX}:${userId}`;
}


function isValidHubPayload(payload: unknown): payload is GroupsHubData & { owned: Group[]; joined: Group[] } {
  return !!payload
    && typeof payload === 'object'
    && Array.isArray((payload as GroupsHubData).owned)
    && Array.isArray((payload as GroupsHubData).joined);
}

export async function readGroupHubCache(userId: string | null | undefined): Promise<GroupsHubData | null> {
  if (userId === null || userId === undefined || userId === '') {
    return null;
  }

  const stored = await AsyncStorage.getItem(groupHubKey(userId));
  if (!stored) {
    return null;
  }

  let hub;
  try {
    hub = JSON.parse(stored);
  } catch {
    return null;
  }

  if (!isValidHubPayload(hub)) {
    return null;
  }

  // A cached empty provides zero value (instant-render only helps when rows
  // exist) and is the exact poison vector left over from pre-validation
  // sessions, so treat it as no cache. Writing an accepted legit empty stays
  // harmless because reads ignore it.
  if (hub.owned.length === 0 && hub.joined.length === 0) {
    return null;
  }

  return hub;
}

export async function writeGroupHubCache(userId: string | null | undefined, hub: GroupsHubData): Promise<void> {
  // Writing an accepted legit empty is harmless: reads ignore empty entries,
  // so a written empty never hydrates a degraded render.
  if (userId === null || userId === undefined || userId === '' || !isValidHubPayload(hub)) {
    return;
  }

  await AsyncStorage.setItem(groupHubKey(userId), JSON.stringify(hub));
}

export async function clearGroupHubCache(userId: string | null | undefined): Promise<void> {
  await AsyncStorage.removeItem(groupHubKey(userId));
}

export async function clearAllGroupHubCaches(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const target = keys.filter((key) => typeof key === 'string' && key.startsWith(`${PREFIX}:`));

  if (target.length > 0) {
    await AsyncStorage.multiRemove(target);
  }
}
