// Module-level "latest wins" snapshot of the groups hub, shared by every
// useGroupsHub instance: one instance's 200 heals the others on flaky
// networks. Keyed strictly by identityKey (`${token}|${userId}`) so a payload
// can never leak across users.
let latest = null;
const listeners = new Set();

// Module-level registry of the currently-running SHARED network flight
// (fetchGroups + retry/backoff only, no per-instance state application).
// Concurrent useGroupsHub instances with the same identityKey join this
// promise instead of issuing their own GET; it clears itself on completion
// so a later refresh() always starts a fresh flight. A flight started for a
// different identityKey overwrites the registration but never clobbers the
// previous promise (cleared only when still the registered one), and it is
// module-owned so the starting instance unmounting cannot void it.
let sharedFlight = null;

export function getSharedFlight(identityKey) {
  return sharedFlight && sharedFlight.identityKey === identityKey ? sharedFlight : null;
}

export function beginSharedFlight(identityKey, promise) {
  sharedFlight = { identityKey, promise };
  promise.finally(() => {
    if (sharedFlight && sharedFlight.promise === promise) {
      sharedFlight = null;
    }
  });
  return promise;
}

export function getSnapshot() {
  return latest;
}

export function publish(identityKey, data) {
  latest = { identityKey, data, updatedAt: Date.now() };
  listeners.forEach((listener) => listener(latest));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetGroupHubStore() {
  latest = null;
  sharedFlight = null;
  listeners.clear();
}
