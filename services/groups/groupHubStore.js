// Module-level "latest wins" snapshot of the groups hub, shared by every
// useGroupsHub instance: one instance's 200 heals the others on flaky
// networks. Keyed strictly by identityKey (`${token}|${userId}`) so a payload
// can never leak across users.
let latest = null;
const listeners = new Set();

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
  listeners.clear();
}
