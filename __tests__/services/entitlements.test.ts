import {
  AD_FREE_TIER_THRESHOLD,
  isAdFreeTier,
  shouldSuppressAds,
  type AuthContextLike,
} from '../../services/billing/entitlements';

describe('services/billing/entitlements', () => {
  describe('AD_FREE_TIER_THRESHOLD constant', () => {
    it('is locked at 1 (gate = premiumTier >= 1, see docs/billing-system.md §4)', () => {
      expect(AD_FREE_TIER_THRESHOLD).toBe(1);
    });
  });

  describe('isAdFreeTier (pure core)', () => {
    it('false for tier 0 (free)', () => {
      expect(isAdFreeTier(0)).toBe(false);
    });
    it('true for tier 1 (no_ads)', () => {
      expect(isAdFreeTier(1)).toBe(true);
    });
    it('true for tier 2 (private_group_creator — ad-free by tier, not by entitlement)', () => {
      expect(isAdFreeTier(2)).toBe(true);
    });
    it('true for tier 3 (creator + extension)', () => {
      expect(isAdFreeTier(3)).toBe(true);
    });
    it('false for null', () => {
      expect(isAdFreeTier(null as unknown as number)).toBe(false);
    });
    it('false for undefined', () => {
      expect(isAdFreeTier(undefined as unknown as number)).toBe(false);
    });
    it('false for NaN-producing string', () => {
      expect(isAdFreeTier('not-a-number' as unknown as number)).toBe(false);
    });
    it('false for negative tier (-1)', () => {
      expect(isAdFreeTier(-1)).toBe(false);
    });
    it('true for non-integer tier (1.5 — Number.isFinite passes, >= 1)', () => {
      expect(isAdFreeTier(1.5)).toBe(true);
    });
  });

  describe('shouldSuppressAds (wrapper reading authContext.premiumTier)', () => {
    it('true when authContext.premiumTier is 1', () => {
      expect(shouldSuppressAds({ premiumTier: 1 })).toBe(true);
    });
    it('true when authContext.premiumTier is 2', () => {
      expect(shouldSuppressAds({ premiumTier: 2 })).toBe(true);
    });
    it('false when authContext.premiumTier is 0', () => {
      expect(shouldSuppressAds({ premiumTier: 0 })).toBe(false);
    });
    it('false when authContext is null', () => {
      expect(shouldSuppressAds(null)).toBe(false);
    });
    it('false when authContext is {}', () => {
      expect(shouldSuppressAds({})).toBe(false);
    });
    it('false when premiumTier is missing', () => {
      expect(shouldSuppressAds({ userId: 'u-1' } as AuthContextLike)).toBe(false);
    });
    it('true when authContext.premiumTier is 3 (top tier)', () => {
      expect(shouldSuppressAds({ premiumTier: 3 })).toBe(true);
    });
  });
});
