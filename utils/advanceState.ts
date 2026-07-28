// Pure advance state-machine for the guess-path "next card" flow.
// No React, no RN, no navigation. All side effects (setParams / popToTop)
// are interpreted by the caller from the returned snapshot.

export type AdvanceState = 'idle' | 'advancing' | 'warming' | 'exhausted';

export type AdvanceSnapshot = {
  state: AdvanceState;
  retries: number;
  next?: Record<string, unknown> | null;
};

export type AdvanceContext = { retryBudget?: number };

export type AdvanceEvent =
  | { type: 'WIN' }
  | { type: 'RESOLVED'; next: Record<string, unknown> | null }
  | { type: 'FAILED_TRANSIENT' }
  | { type: 'RETRY_TICK' }
  | { type: 'FAILED_PERMANENT' }
  | { type: 'LEAVE' }
  | { type: 'PLAY' };

export const DEFAULT_RETRY_BUDGET = 3;

export const initialAdvance: AdvanceSnapshot = {
  state: 'idle',
  retries: 0,
  next: null,
};

// Reducer is total: every event is handled from every state. Defensively
// rejects events that are illegal in the current state (returns prev unchanged).
// Notable guards (PB2): WIN only from idle; RESOLVED only from advancing|warming;
// FAILED_TRANSIENT only from advancing; RETRY_TICK only from warming;
// PLAY only from exhausted. FAILED_PERMANENT and LEAVE apply from any state.
export function advanceReducer(
  prev: AdvanceSnapshot,
  event: AdvanceEvent,
  ctx?: AdvanceContext,
): AdvanceSnapshot {
  const budget = ctx?.retryBudget ?? DEFAULT_RETRY_BUDGET;

  switch (event.type) {
    case 'WIN': {
      if (prev.state !== 'idle') return prev;
      return { state: 'advancing', retries: 0, next: null };
    }

    case 'RESOLVED': {
      if (prev.state !== 'advancing' && prev.state !== 'warming') return prev;
      return { state: 'idle', retries: 0, next: event.next };
    }

    case 'FAILED_TRANSIENT': {
      if (prev.state !== 'advancing') return prev;
      return { state: 'warming', retries: 0, next: null };
    }

    case 'RETRY_TICK': {
      if (prev.state !== 'warming') return prev;
      const retries = prev.retries + 1;
      if (retries >= budget) {
        return { state: 'exhausted', retries, next: null };
      }
      return { state: 'warming', retries, next: prev.next };
    }

    case 'FAILED_PERMANENT':
      return { state: 'exhausted', retries: prev.retries, next: null };

    case 'LEAVE':
      return { state: 'idle', retries: 0, next: null };

    case 'PLAY': {
      if (prev.state !== 'exhausted') return prev;
      return { state: 'idle', retries: 0, next: null };
    }

    default: {
      // Exhaustiveness check: adding a new AdvanceEvent variant without a
      // matching case here produces a compile error (event is `never` only
      // when every variant in the union is handled above).
      const _exhaustive: never = event;
      return prev;
    }
  }
}
