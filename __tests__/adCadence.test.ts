import {
  AD_EVERY_N_SUCCESSES,
  consumeAdSlot,
  isAdSlotActive,
  isAdDue,
  type AdSlotInput,
} from '../utils/adCadence';

const NO_SKIP: AdSlotInput = { scope: undefined, isAdFree: false, isE2E: false };

describe('utils/adCadence', () => {
  describe('AD_EVERY_N_SUCCESSES constant', () => {
    it('is locked at 3 (Q5 decision)', () => {
      expect(AD_EVERY_N_SUCCESSES).toBe(3);
    });
  });

  describe('consumeAdSlot happy path (no skip conditions)', () => {
    it('ticks 0 → 1 (no ad)', () => {
      const result = consumeAdSlot({ successesSinceLastAd: 0, ...NO_SKIP });
      expect(result).toEqual({ showAd: false, nextCount: 1 });
    });

    it('ticks 1 → 2 (no ad)', () => {
      const result = consumeAdSlot({ successesSinceLastAd: 1, ...NO_SKIP });
      expect(result).toEqual({ showAd: false, nextCount: 2 });
    });

    it('returns showAd:true and resets counter to 0 on the 3rd success', () => {
      const result = consumeAdSlot({
        successesSinceLastAd: 2,
        ...NO_SKIP,
        isSourceReady: true,
      });
      expect(result).toEqual({ showAd: true, nextCount: 0 });
    });

    it('ticks 5 → resets to 0 with ad (overshoot path: counter above threshold still fires once, then resets)', () => {
      const result = consumeAdSlot({
        successesSinceLastAd: 5,
        ...NO_SKIP,
        isSourceReady: true,
      });
      expect(result).toEqual({ showAd: true, nextCount: 0 });
    });

    it('private scope can still show ads when policy passes isAdFree=false: at threshold it shows an ad and resets', () => {
      const result = consumeAdSlot({
        successesSinceLastAd: 2,
        scope: { kind: 'private', groupId: 'g-1' },
        isAdFree: false,
        isE2E: false,
      });
      expect(result).toEqual({ showAd: true, nextCount: 0 });
    });

    it('private scope can still show ads when policy passes isAdFree=false: above threshold it fires and resets', () => {
      const result = consumeAdSlot({
        successesSinceLastAd: 4,
        scope: { kind: 'private', groupId: 'g-1' },
        isAdFree: false,
        isE2E: false,
      });
      expect(result).toEqual({ showAd: true, nextCount: 0 });
    });
  });

  describe('source-not-ready at threshold', () => {
    it('still consumes the slot (resets to 0) but shows no ad', () => {
      const result = consumeAdSlot({
        successesSinceLastAd: 2,
        ...NO_SKIP,
        isSourceReady: false,
      });
      expect(result).toEqual({ showAd: false, nextCount: 0 });
    });

    it('below threshold: source readiness is irrelevant, just ticks', () => {
      const result = consumeAdSlot({
        successesSinceLastAd: 0,
        ...NO_SKIP,
        isSourceReady: false,
      });
      expect(result).toEqual({ showAd: false, nextCount: 1 });
    });
  });

  describe('isSourceReady default', () => {
    it('defaults to true when omitted', () => {
      const result = consumeAdSlot({ successesSinceLastAd: 2, ...NO_SKIP });
      expect(result.showAd).toBe(true);
    });
  });

  describe('skip conditions freeze the counter (do not tick)', () => {
    it('isAdFree=true: counter frozen, no ad', () => {
      const result = consumeAdSlot({
        successesSinceLastAd: 2,
        scope: undefined,
        isAdFree: true,
        isE2E: false,
      });
      expect(result).toEqual({ showAd: false, nextCount: 2 });
    });

    it('isE2E=true: counter frozen, no ad', () => {
      const result = consumeAdSlot({
        successesSinceLastAd: 2,
        scope: undefined,
        isAdFree: false,
        isE2E: true,
      });
      expect(result).toEqual({ showAd: false, nextCount: 2 });
    });
  });

  describe('isAdDue (pure introspection)', () => {
    it('false when next tick would be below threshold', () => {
      expect(isAdDue({ successesSinceLastAd: 0 })).toBe(false);
      expect(isAdDue({ successesSinceLastAd: 1 })).toBe(false);
    });

    it('true when next tick reaches threshold', () => {
      expect(isAdDue({ successesSinceLastAd: 2 })).toBe(true);
      expect(isAdDue({ successesSinceLastAd: 5 })).toBe(true);
    });
  });

  describe('everyNWins override (default = AD_EVERY_N_SUCCESSES)', () => {
    it('omitted override behaves as the default 3 (3rd success shows ad)', () => {
      const result = consumeAdSlot({
        successesSinceLastAd: 2,
        everyNWins: undefined,
        ...NO_SKIP,
        isSourceReady: true,
      });
      expect(result).toEqual({ showAd: true, nextCount: 0 });
    });

    it('override 4: not due on 3rd success, ad due on 4th', () => {
      const tick = consumeAdSlot({ successesSinceLastAd: 2, everyNWins: 4, ...NO_SKIP });
      expect(tick).toEqual({ showAd: false, nextCount: 3 });

      const due = consumeAdSlot({
        successesSinceLastAd: 3,
        everyNWins: 4,
        ...NO_SKIP,
        isSourceReady: true,
      });
      expect(due).toEqual({ showAd: true, nextCount: 0 });
    });

    it('override 4: resets after consume, next cycle restarts at 1/4', () => {
      const result = consumeAdSlot({ successesSinceLastAd: 0, everyNWins: 4, ...NO_SKIP });
      expect(result).toEqual({ showAd: false, nextCount: 1 });
    });

    it('override 6: not due on 5th success, ad due on 6th', () => {
      const tick = consumeAdSlot({ successesSinceLastAd: 4, everyNWins: 6, ...NO_SKIP });
      expect(tick).toEqual({ showAd: false, nextCount: 5 });

      const due = consumeAdSlot({
        successesSinceLastAd: 5,
        everyNWins: 6,
        ...NO_SKIP,
        isSourceReady: true,
      });
      expect(due).toEqual({ showAd: true, nextCount: 0 });
    });

    it('clamps 0 to the default 3', () => {
      const tick = consumeAdSlot({ successesSinceLastAd: 1, everyNWins: 0, ...NO_SKIP });
      expect(tick).toEqual({ showAd: false, nextCount: 2 });

      const due = consumeAdSlot({
        successesSinceLastAd: 2,
        everyNWins: 0,
        ...NO_SKIP,
        isSourceReady: true,
      });
      expect(due).toEqual({ showAd: true, nextCount: 0 });
    });

    it('clamps -1 to the default 3', () => {
      const tick = consumeAdSlot({ successesSinceLastAd: 1, everyNWins: -1, ...NO_SKIP });
      expect(tick).toEqual({ showAd: false, nextCount: 2 });

      const due = consumeAdSlot({
        successesSinceLastAd: 2,
        everyNWins: -1,
        ...NO_SKIP,
        isSourceReady: true,
      });
      expect(due).toEqual({ showAd: true, nextCount: 0 });
    });

    it('clamps NaN to the default 3', () => {
      const tick = consumeAdSlot({ successesSinceLastAd: 1, everyNWins: NaN, ...NO_SKIP });
      expect(tick).toEqual({ showAd: false, nextCount: 2 });

      const due = consumeAdSlot({
        successesSinceLastAd: 2,
        everyNWins: NaN,
        ...NO_SKIP,
        isSourceReady: true,
      });
      expect(due).toEqual({ showAd: true, nextCount: 0 });
    });

    it('skip conditions precede cadence: isAdFree=true freezes counter despite override', () => {
      const result = consumeAdSlot({
        successesSinceLastAd: 3,
        everyNWins: 4,
        scope: undefined,
        isAdFree: true,
        isE2E: false,
      });
      expect(result).toEqual({ showAd: false, nextCount: 3 });
    });

    it('skip conditions precede cadence: isE2E=true freezes counter despite override', () => {
      const result = consumeAdSlot({
        successesSinceLastAd: 3,
        everyNWins: 4,
        scope: undefined,
        isAdFree: false,
        isE2E: true,
      });
      expect(result).toEqual({ showAd: false, nextCount: 3 });
    });

    it('source-not-ready still consumes the slot at the overridden boundary', () => {
      const result = consumeAdSlot({
        successesSinceLastAd: 3,
        everyNWins: 4,
        ...NO_SKIP,
        isSourceReady: false,
      });
      expect(result).toEqual({ showAd: false, nextCount: 0 });
    });
  });

  describe('isAdDue with everyNWins (pure introspection)', () => {
    it('override 4: due at 3 successes, not at 2', () => {
      expect(isAdDue({ successesSinceLastAd: 2, everyNWins: 4 })).toBe(false);
      expect(isAdDue({ successesSinceLastAd: 3, everyNWins: 4 })).toBe(true);
    });

    it('override 6: due at 5 successes, not at 4', () => {
      expect(isAdDue({ successesSinceLastAd: 4, everyNWins: 6 })).toBe(false);
      expect(isAdDue({ successesSinceLastAd: 5, everyNWins: 6 })).toBe(true);
    });

    it('clamped overrides are due at the default boundary', () => {
      expect(isAdDue({ successesSinceLastAd: 2, everyNWins: 0 })).toBe(true);
      expect(isAdDue({ successesSinceLastAd: 1, everyNWins: 0 })).toBe(false);
      expect(isAdDue({ successesSinceLastAd: 2, everyNWins: NaN })).toBe(true);
      expect(isAdDue({ successesSinceLastAd: 1, everyNWins: NaN })).toBe(false);
    });
  });

  describe('isAdSlotActive (skip predicate)', () => {
    it('active on public scope, non-ad-free, non-e2e', () => {
      expect(isAdSlotActive(NO_SKIP)).toBe(true);
    });

    it('active for private scope', () => {
      expect(isAdSlotActive({ scope: { kind: 'private' }, isAdFree: false, isE2E: false })).toBe(true);
    });

    it('inactive when ad-free', () => {
      expect(isAdSlotActive({ scope: undefined, isAdFree: true, isE2E: false })).toBe(false);
    });

    it('inactive when e2e', () => {
      expect(isAdSlotActive({ scope: undefined, isAdFree: false, isE2E: true })).toBe(false);
    });
  });
});
