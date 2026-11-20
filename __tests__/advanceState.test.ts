import {
  advanceReducer,
  initialAdvance,
  DEFAULT_RETRY_BUDGET,
  type AdvanceSnapshot,
} from '../utils/advanceState';

describe('utils/advanceState', () => {
  describe('initialAdvance', () => {
    it('starts idle with zero retries and null next', () => {
      expect(initialAdvance).toEqual({ state: 'idle', retries: 0, next: null });
    });
  });

  describe('DEFAULT_RETRY_BUDGET', () => {
    it('is 3', () => {
      expect(DEFAULT_RETRY_BUDGET).toBe(3);
    });
  });

  describe('WIN', () => {
    it('transitions idle → advancing', () => {
      const next = advanceReducer(initialAdvance, { type: 'WIN' });
      expect(next).toEqual({ state: 'advancing', retries: 0, next: null });
    });

    it('is REJECTED from advancing (PB2 input gating)', () => {
      const advancing: AdvanceSnapshot = { state: 'advancing', retries: 0, next: null };
      const next = advanceReducer(advancing, { type: 'WIN' });
      expect(next).toBe(advancing);
    });

    it('is REJECTED from warming (PB2 input gating)', () => {
      const warming: AdvanceSnapshot = { state: 'warming', retries: 1, next: null };
      const next = advanceReducer(warming, { type: 'WIN' });
      expect(next).toBe(warming);
    });

    it('is REJECTED from exhausted (PB2 input gating)', () => {
      const exhausted: AdvanceSnapshot = { state: 'exhausted', retries: 3, next: null };
      const next = advanceReducer(exhausted, { type: 'WIN' });
      expect(next).toBe(exhausted);
    });

    it('clears stale next when entering advancing', () => {
      const idleWithStaleNext: AdvanceSnapshot = {
        state: 'idle',
        retries: 0,
        next: { pictureId: 'old' },
      };
      const next = advanceReducer(idleWithStaleNext, { type: 'WIN' });
      expect(next.next).toBeNull();
    });
  });

  describe('RESOLVED', () => {
    const payload = { pictureId: 'p-42', categoryKey: 'all' };

    it('advancing → idle and attaches next payload', () => {
      const advancing: AdvanceSnapshot = { state: 'advancing', retries: 0, next: null };
      const next = advanceReducer(advancing, { type: 'RESOLVED', next: payload });
      expect(next).toEqual({ state: 'idle', retries: 0, next: payload });
    });

    it('warming → idle and attaches next payload (recovery path)', () => {
      const warming: AdvanceSnapshot = { state: 'warming', retries: 2, next: null };
      const next = advanceReducer(warming, { type: 'RESOLVED', next: payload });
      expect(next).toEqual({ state: 'idle', retries: 0, next: payload });
    });

    it('is rejected from idle', () => {
      const next = advanceReducer(initialAdvance, { type: 'RESOLVED', next: payload });
      expect(next).toBe(initialAdvance);
    });

    it('is rejected from exhausted', () => {
      const exhausted: AdvanceSnapshot = { state: 'exhausted', retries: 3, next: null };
      const next = advanceReducer(exhausted, { type: 'RESOLVED', next: payload });
      expect(next).toBe(exhausted);
    });
  });

  describe('FAILED_TRANSIENT', () => {
    it('advancing → warming with retries reset to 0', () => {
      const advancing: AdvanceSnapshot = { state: 'advancing', retries: 0, next: null };
      const next = advanceReducer(advancing, { type: 'FAILED_TRANSIENT' });
      expect(next).toEqual({ state: 'warming', retries: 0, next: null });
    });

    it('is rejected from idle', () => {
      const next = advanceReducer(initialAdvance, { type: 'FAILED_TRANSIENT' });
      expect(next).toBe(initialAdvance);
    });

    it('is rejected from warming (no double-transition)', () => {
      const warming: AdvanceSnapshot = { state: 'warming', retries: 1, next: null };
      const next = advanceReducer(warming, { type: 'FAILED_TRANSIENT' });
      expect(next).toBe(warming);
    });
  });

  describe('RETRY_TICK', () => {
    it('increments retries and stays warming under budget', () => {
      const warming0: AdvanceSnapshot = { state: 'warming', retries: 0, next: null };
      const next = advanceReducer(warming0, { type: 'RETRY_TICK' });
      expect(next).toEqual({ state: 'warming', retries: 1, next: null });
    });

    it('reaches exhausted exactly when retries reach the default budget of 3', () => {
      let snap: AdvanceSnapshot = { state: 'warming', retries: 0, next: null };
      snap = advanceReducer(snap, { type: 'RETRY_TICK' });
      expect(snap.state).toBe('warming');
      expect(snap.retries).toBe(1);

      snap = advanceReducer(snap, { type: 'RETRY_TICK' });
      expect(snap.state).toBe('warming');
      expect(snap.retries).toBe(2);

      snap = advanceReducer(snap, { type: 'RETRY_TICK' });
      expect(snap.state).toBe('exhausted');
      expect(snap.retries).toBe(3);
    });

    it('honours a custom retryBudget from context', () => {
      const warming: AdvanceSnapshot = { state: 'warming', retries: 0, next: null };
      const after1 = advanceReducer(warming, { type: 'RETRY_TICK' }, { retryBudget: 1 });
      expect(after1).toEqual({ state: 'exhausted', retries: 1, next: null });
    });

    it('is rejected from idle', () => {
      const next = advanceReducer(initialAdvance, { type: 'RETRY_TICK' });
      expect(next).toBe(initialAdvance);
    });

    it('is rejected from advancing', () => {
      const advancing: AdvanceSnapshot = { state: 'advancing', retries: 0, next: null };
      const next = advanceReducer(advancing, { type: 'RETRY_TICK' });
      expect(next).toBe(advancing);
    });
  });

  describe('FAILED_PERMANENT', () => {
    it('transitions advancing → exhausted', () => {
      const advancing: AdvanceSnapshot = { state: 'advancing', retries: 0, next: null };
      const next = advanceReducer(advancing, { type: 'FAILED_PERMANENT' });
      expect(next.state).toBe('exhausted');
    });

    it('transitions warming → exhausted preserving retries', () => {
      const warming: AdvanceSnapshot = { state: 'warming', retries: 2, next: null };
      const next = advanceReducer(warming, { type: 'FAILED_PERMANENT' });
      expect(next).toEqual({ state: 'exhausted', retries: 2, next: null });
    });

    it('transitions idle → exhausted (any-state rule)', () => {
      const next = advanceReducer(initialAdvance, { type: 'FAILED_PERMANENT' });
      expect(next.state).toBe('exhausted');
    });

    it('clears next when entering exhausted', () => {
      const idleWithNext: AdvanceSnapshot = {
        state: 'idle',
        retries: 0,
        next: { pictureId: 'x' },
      };
      const next = advanceReducer(idleWithNext, { type: 'FAILED_PERMANENT' });
      expect(next.next).toBeNull();
    });
  });

  describe('LEAVE', () => {
    it('transitions advancing → idle', () => {
      const advancing: AdvanceSnapshot = { state: 'advancing', retries: 0, next: null };
      const next = advanceReducer(advancing, { type: 'LEAVE' });
      expect(next).toEqual({ state: 'idle', retries: 0, next: null });
    });

    it('transitions exhausted → idle', () => {
      const exhausted: AdvanceSnapshot = { state: 'exhausted', retries: 3, next: null };
      const next = advanceReducer(exhausted, { type: 'LEAVE' });
      expect(next).toEqual({ state: 'idle', retries: 0, next: null });
    });

    it('transitions warming → idle', () => {
      const warming: AdvanceSnapshot = { state: 'warming', retries: 2, next: null };
      const next = advanceReducer(warming, { type: 'LEAVE' });
      expect(next).toEqual({ state: 'idle', retries: 0, next: null });
    });
  });

  describe('PLAY', () => {
    it('transitions exhausted → idle (Switch category path)', () => {
      const exhausted: AdvanceSnapshot = { state: 'exhausted', retries: 3, next: null };
      const next = advanceReducer(exhausted, { type: 'PLAY' });
      expect(next).toEqual({ state: 'idle', retries: 0, next: null });
    });

    it('is rejected from idle', () => {
      const next = advanceReducer(initialAdvance, { type: 'PLAY' });
      expect(next).toBe(initialAdvance);
    });

    it('is rejected from advancing', () => {
      const advancing: AdvanceSnapshot = { state: 'advancing', retries: 0, next: null };
      const next = advanceReducer(advancing, { type: 'PLAY' });
      expect(next).toBe(advancing);
    });
  });

  describe('end-to-end advance cycle', () => {
    it('idle → WIN → advancing → RESOLVED → idle (happy path)', () => {
      const payload = { pictureId: 'p-99' };
      let snap = advanceReducer(initialAdvance, { type: 'WIN' });
      expect(snap.state).toBe('advancing');
      snap = advanceReducer(snap, { type: 'RESOLVED', next: payload });
      expect(snap).toEqual({ state: 'idle', retries: 0, next: payload });
    });

    it('idle → WIN → advancing → FAILED_TRANSIENT → warming* → exhausted (full exhaustion)', () => {
      let snap = advanceReducer(initialAdvance, { type: 'WIN' });
      snap = advanceReducer(snap, { type: 'FAILED_TRANSIENT' });
      expect(snap.state).toBe('warming');
      snap = advanceReducer(snap, { type: 'RETRY_TICK' });
      snap = advanceReducer(snap, { type: 'RETRY_TICK' });
      snap = advanceReducer(snap, { type: 'RETRY_TICK' });
      expect(snap.state).toBe('exhausted');
      snap = advanceReducer(snap, { type: 'PLAY' });
      expect(snap.state).toBe('idle');
    });
  });
});
