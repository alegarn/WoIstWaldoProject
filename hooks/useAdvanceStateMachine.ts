import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { RefObject } from 'react';

import { advanceReducer, initialAdvance } from '../utils/advanceState';
import type { AdvanceEvent, AdvanceSnapshot, AdvanceState } from '../utils/advanceState';

type AdvanceStateMachineNavigation = {
  setParams(params: Record<string, unknown>): void;
};

type UseAdvanceStateMachineArgs = {
  navigation: AdvanceStateMachineNavigation;
};

type UseAdvanceStateMachineResult = {
  advance: AdvanceSnapshot;
  dispatch: (event: AdvanceEvent) => void;
  advanceStateRef: RefObject<AdvanceState>;
};

// Owns the pure advance reducer + its dispatch wrapper + the synchronous
// snapshot refs the AppState listener and onAdvanceResolved read, plus the
// idle-entry setParams side effect. Navigation is injected so the hook stays
// free of RN/router coupling beyond the single setParams seam.
export function useAdvanceStateMachine({
  navigation,
}: UseAdvanceStateMachineArgs): UseAdvanceStateMachineResult {
  const [advance, dispatchAdvance] = useReducer(
    (prev: AdvanceSnapshot, event: AdvanceEvent) => advanceReducer(prev, event),
    initialAdvance,
  );

  // Mirror advance.state into a ref so the AppState listener (mounted once) can
  // read the latest state without re-subscribing on every transition.
  const advanceStateRef = useRef<AdvanceState>(advance.state);
  // Snapshot ref used by `dispatch` to compute the next state synchronously.
  // useEffect([advance.state]) updates advanceStateRef AFTER commit, but an
  // awaited async chain (e.g. runResolveCycle → onAdvanceResolved) continues
  // on the microtask queue before passive effects run, leaving the ref stale.
  // dispatch updates both refs synchronously so the A7 guard inside
  // onAdvanceResolved and the AppState listener see the post-event state
  // immediately. The useEffect below is defense-in-depth (re-syncs from the
  // committed advance in case the optimistic update diverged).
  const advanceSnapRef = useRef<AdvanceSnapshot>(advance);
  const dispatch = useCallback((event: AdvanceEvent) => {
    const next = advanceReducer(advanceSnapRef.current, event);
    advanceSnapRef.current = next;
    advanceStateRef.current = next.state;
    dispatchAdvance(event);
  }, [dispatchAdvance]);

  useEffect(() => {
    advanceSnapRef.current = advance;
    advanceStateRef.current = advance.state;
  }, [advance]);

  // PB1: the advance reducer is the single source of truth for advance. The reducer
  // itself is pure (no navigation); this idle-entry side-effect consumes a staged
  // `advance.next` via setParams whenever the machine lands in `idle` with a non-null
  // payload. Identity-tracked (single-apply-per-resolve latch) so a re-dispatch with
  // the same `next` reference (e.g. test mocks returning a shared object, or any
  // future code path that re-stages without a new reference) does not double-apply
  // setParams. The latch's premise is now the in-overlay RESOLVED dispatch — the
  // AdScreen round-trip is gone, but the single-apply invariant still holds.
  const appliedNextRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (advance.state === 'idle' && advance.next && appliedNextRef.current !== advance.next) {
      appliedNextRef.current = advance.next;
      navigation.setParams(advance.next);
    }
  }, [advance.state, advance.next, navigation]);

  return { advance, dispatch, advanceStateRef };
}
