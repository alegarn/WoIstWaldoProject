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
