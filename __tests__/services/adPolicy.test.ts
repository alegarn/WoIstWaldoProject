import {
  CREATOR_REWARD_AD_FREE_AT,
  CREATOR_REWARD_PREMIUM_AT,
  earnedRewardFor,
  shouldSuppressAds,
} from '../../services/billing/adPolicy';

describe('services/billing/adPolicy', () => {
  it('returns false for public tier 0', () => {
    expect(shouldSuppressAds({ paidTier: 0, scope: 'public' })).toBe(false);
  });

  it('returns true for public tier 1', () => {
    expect(shouldSuppressAds({ paidTier: 1, scope: 'public' })).toBe(true);
  });

  it('returns false for public tier 2', () => {
    expect(shouldSuppressAds({ paidTier: 2, scope: 'public' })).toBe(false);
  });

  it('returns true for public tier 3', () => {
    expect(shouldSuppressAds({ paidTier: 3, scope: 'public' })).toBe(true);
  });

  it('returns false for private tier 0', () => {
    expect(shouldSuppressAds({ paidTier: 0, scope: 'private' })).toBe(false);
  });

  it('returns true for private tier 1', () => {
    expect(shouldSuppressAds({ paidTier: 1, scope: 'private' })).toBe(true);
  });

  it('returns true for private tier 3', () => {
    expect(shouldSuppressAds({ paidTier: 3, scope: 'private' })).toBe(true);
  });

  it('returns false for private tier 2 when the active group is not owned by the viewer', () => {
    expect(
      shouldSuppressAds({
        paidTier: 2,
        scope: 'private',
        activeGroup: { isOwnedByViewer: false, memberCount: 10 },
      })
    ).toBe(false);
  });

  it('returns false for private tier 2 when the owned active group has 5 members', () => {
    expect(
      shouldSuppressAds({
        paidTier: 2,
        scope: 'private',
        activeGroup: { isOwnedByViewer: true, memberCount: 5 },
      })
    ).toBe(false);
  });

  it('returns true for private tier 2 when the owned active group has more than 5 members', () => {
    expect(
      shouldSuppressAds({
        paidTier: 2,
        scope: 'private',
        activeGroup: { isOwnedByViewer: true, memberCount: 6 },
      })
    ).toBe(true);
  });
});

describe('earnedRewardFor', () => {
  it('grants nothing at 8 qualifying members', () => {
    expect(earnedRewardFor(8)).toEqual({ earnedAdFree: false, earnedPremium: false });
  });

  it('grants ad-free only at 9 qualifying members', () => {
    expect(earnedRewardFor(9)).toEqual({ earnedAdFree: true, earnedPremium: false });
  });

  it('grants ad-free only at 18 qualifying members', () => {
    expect(earnedRewardFor(18)).toEqual({ earnedAdFree: true, earnedPremium: false });
  });

  it('grants both rewards at 19 qualifying members', () => {
    expect(earnedRewardFor(19)).toEqual({ earnedAdFree: true, earnedPremium: true });
  });

  it('exposes the mirrored thresholds', () => {
    expect(CREATOR_REWARD_AD_FREE_AT).toBe(9);
    expect(CREATOR_REWARD_PREMIUM_AT).toBe(19);
  });
});

describe('shouldSuppressAds with earned flags', () => {
  it('suppresses ads for earnedAdFree at tier 0 in public scope', () => {
    expect(
      shouldSuppressAds({ paidTier: 0, scope: 'public', earnedAdFree: true })
    ).toBe(true);
  });

  it('suppresses ads for earnedPremium at tier 0 in public scope', () => {
    expect(
      shouldSuppressAds({ paidTier: 0, scope: 'public', earnedPremium: true })
    ).toBe(true);
  });

  it('suppresses ads for earnedAdFree in private scope without an active group', () => {
    expect(
      shouldSuppressAds({ paidTier: 0, scope: 'private', earnedAdFree: true })
    ).toBe(true);
  });

  it('keeps legacy decision when both flags are false (tier 0, public → false)', () => {
    expect(
      shouldSuppressAds({ paidTier: 0, scope: 'public', earnedAdFree: false, earnedPremium: false })
    ).toBe(false);
  });

  it('keeps legacy decision when flags are absent (tier 0, public → false)', () => {
    expect(shouldSuppressAds({ paidTier: 0, scope: 'public' })).toBe(false);
  });

  it('keeps the memberCount>5 rule when flags are false (owned group of 6 → true)', () => {
    expect(
      shouldSuppressAds({
        paidTier: 2,
        scope: 'private',
        activeGroup: { isOwnedByViewer: true, memberCount: 6 },
        earnedAdFree: false,
        earnedPremium: false,
      })
    ).toBe(true);
  });

  it('keeps the memberCount>5 rule when flags are false (owned group of 5 → false)', () => {
    expect(
      shouldSuppressAds({
        paidTier: 2,
        scope: 'private',
        activeGroup: { isOwnedByViewer: true, memberCount: 5 },
        earnedAdFree: false,
        earnedPremium: false,
      })
    ).toBe(false);
  });
});
