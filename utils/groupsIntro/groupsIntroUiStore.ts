// Module-level "latest wins" singleton for the groups-intro chrome (pulse-ring
// phase + icon tap counter), cloned from services/groups/groupHubStore.ts:
// one module store, every consumer subscribes/unsubscribes itself.
// `tapCount` is event-as-state-diff: the Gate diffs it against a lastTapCount
// ref; phase patches never resemble taps.
export type GroupsIntroRingPhase = 'off' | 'active' | 'settle';

export type GroupsIntroUiState = {
  ringPhase: GroupsIntroRingPhase;
  tapCount: number;
};

const INITIAL_UI_STATE: GroupsIntroUiState = { ringPhase: 'off', tapCount: 0 };

let latest: GroupsIntroUiState = { ...INITIAL_UI_STATE };
const listeners = new Set<(state: GroupsIntroUiState) => void>();

export function getUiState(): GroupsIntroUiState {
  return latest;
}

export function publish(patch: Partial<GroupsIntroUiState>) {
  latest = { ...latest, ...patch };
  listeners.forEach((listener) => listener(latest));
}

export function subscribe(listener: (state: GroupsIntroUiState) => void): () => void {
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
