import type { GroupsHubData } from '../../types/groups';

// Module-level "latest wins" snapshot of the groups hub, shared by every
// useGroupsHub instance: one instance's 200 heals the others on flaky
// networks. Keyed strictly by identityKey (`${token}|${userId}`) so a payload
// can never leak across users.
export type HubSnapshot = {
  identityKey: string;
  data: GroupsHubData | null;
  updatedAt: number;
};

// Module-level registry of the currently-running SHARED network flight
// (fetchGroups + retry/backoff only, no per-instance state application).
// Concurrent useGroupsHub instances with the same identityKey join this
// promise instead of issuing their own GET; it clears itself on completion
// so a later refresh() always starts a fresh flight. A flight started for a
// different identityKey overwrites the registration but never clobbers the
// previous promise (cleared only when still the registered one), and it is
// module-owned so the starting instance unmounting cannot void it.
// The resolution value is opaque to the store: callers register and await
// their own flight outcome shape.
export type SharedFlight = {
  identityKey: string;
  promise: Promise<any>;
};

let latest: HubSnapshot | null = null;
const listeners = new Set<(snapshot: HubSnapshot) => void>();

let sharedFlight: SharedFlight | null = null;

export function getSharedFlight(identityKey: string): SharedFlight | null {
  return sharedFlight && sharedFlight.identityKey === identityKey ? sharedFlight : null;
}

export function beginSharedFlight(identityKey: string, promise: SharedFlight['promise']): SharedFlight['promise'] {
  sharedFlight = { identityKey, promise };
  promise.finally(() => {
    if (sharedFlight && sharedFlight.promise === promise) {
      sharedFlight = null;
    }
  });
  return promise;
}

export function getSnapshot(): HubSnapshot | null {
  return latest;
}

export function publish(identityKey: string, data: GroupsHubData | null): void {
  const snapshot: HubSnapshot = { identityKey, data, updatedAt: Date.now() };
  latest = snapshot;
  listeners.forEach((listener) => listener(snapshot));
}

export function subscribe(listener: (snapshot: HubSnapshot) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetGroupHubStore(): void {
  latest = null;
  sharedFlight = null;
  listeners.clear();
}
