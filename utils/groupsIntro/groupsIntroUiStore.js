// Module-level "latest wins" singleton for the groups-intro chrome (pulse-ring
// phase + icon tap counter), cloned from services/groups/groupHubStore.ts:
// one module store, every consumer subscribes/unsubscribes itself.
// `tapCount` is event-as-state-diff: the Gate diffs it against a lastTapCount
// ref; phase patches never resemble taps.
const INITIAL_UI_STATE = { ringPhase: 'off', tapCount: 0 };

let latest = { ...INITIAL_UI_STATE };
const listeners = new Set();

export function getUiState() {
  return latest;
}

export function publish(patch) {
  latest = { ...latest, ...patch };
  listeners.forEach((listener) => listener(latest));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function signalIconTap() {
  publish({ tapCount: latest.tapCount + 1 });
}

export function resetGroupsIntroUiStoreForTests() {
  latest = { ...INITIAL_UI_STATE };
  listeners.clear();
}
