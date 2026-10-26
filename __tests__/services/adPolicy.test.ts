import {
  ACTIVITY_MIN_GUESSES,
  CREATOR_REWARD_GROUP_CREATOR_AT,
  CREATOR_REWARD_PREMIUM_AT,
  MEMBER_CADENCE_AT_12,
  MEMBER_CADENCE_AT_12_QUALIFYING,
  MEMBER_CADENCE_AT_19,
  MEMBER_CADENCE_AT_19_QUALIFYING,
  VESTING_DAYS,
  earnedRewardFor,
  shouldSuppressAds,
  type ActiveGroupAdContext,
} from '../../services/billing/adPolicy';
import { consumeAdSlot } from '../../utils/adCadence';

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

  it('keeps the tier-2 5-member boundary false even when a cadence override is present', () => {
    expect(
      shouldSuppressAds({
        paidTier: 2,
        scope: 'private',
        activeGroup: { isOwnedByViewer: true, memberCount: 5, adCadenceEveryNWins: 4 },
      })
    ).toBe(false);
  });

  it('keeps the tier-2 6-member boundary true even when a cadence override is present', () => {
    expect(
      shouldSuppressAds({
        paidTier: 2,
        scope: 'private',
        activeGroup: { isOwnedByViewer: true, memberCount: 6, adCadenceEveryNWins: 4 },
      })
    ).toBe(true);
  });
});

describe('earnedRewardFor', () => {
  it('grants nothing at 8 qualifying members', () => {
    expect(earnedRewardFor(8)).toEqual({ earnedGroupCreator: false, earnedPremium: false });
  });

  it('grants group creator only at 9 qualifying members', () => {
    expect(earnedRewardFor(9)).toEqual({ earnedGroupCreator: true, earnedPremium: false });
  });

  it('grants group creator only at 18 qualifying members (no premium count yet)', () => {
    expect(earnedRewardFor(18)).toEqual({ earnedGroupCreator: true, earnedPremium: false });
  });

  it('never grants premium from the cheap count alone (19 with no premium count → false)', () => {
    expect(earnedRewardFor(19)).toEqual({ earnedGroupCreator: true, earnedPremium: false });
  });

  it('requires the premium count to reach 19 (18 → no premium)', () => {
    expect(earnedRewardFor(18, 18)).toEqual({ earnedGroupCreator: true, earnedPremium: false });
  });

  it('grants both rewards at a premium count of 19', () => {
    expect(earnedRewardFor(19, 19)).toEqual({ earnedGroupCreator: true, earnedPremium: true });
  });

  it('grants both rewards above the premium boundary (monotonic)', () => {
    expect(earnedRewardFor(25, 20)).toEqual({ earnedGroupCreator: true, earnedPremium: true });
  });

  it('keeps premium false when the premium count is missing even for a huge cheap count', () => {
    expect(earnedRewardFor(200)).toEqual({ earnedGroupCreator: true, earnedPremium: false });
  });

  it('exposes the mirrored thresholds', () => {
    expect(CREATOR_REWARD_GROUP_CREATOR_AT).toBe(9);
    expect(CREATOR_REWARD_PREMIUM_AT).toBe(19);
  });
});

describe('member-cadence mirrors (D5: same names as API Billing::CreatorReward)', () => {
  it('exposes the mirrored thresholds', () => {
    expect(ACTIVITY_MIN_GUESSES).toBe(5);
    expect(VESTING_DAYS).toBe(14);
    expect(MEMBER_CADENCE_AT_12_QUALIFYING).toBe(12);
    expect(MEMBER_CADENCE_AT_19_QUALIFYING).toBe(19);
    expect(MEMBER_CADENCE_AT_12).toBe(4);
    expect(MEMBER_CADENCE_AT_19).toBe(6);
  });

  it('carries the optional cadence override on ActiveGroupAdContext', () => {
    const activeGroup: ActiveGroupAdContext = {
      isOwnedByViewer: false,
      memberCount: 4,
      adCadenceEveryNWins: 4,
    };
    expect(activeGroup.adCadenceEveryNWins).toBe(4);
  });
});

describe('shouldSuppressAds with earned flags', () => {
  it('suppresses ads for earnedPremium at tier 0 in public scope', () => {
    expect(
      shouldSuppressAds({ paidTier: 0, scope: 'public', earnedPremium: true })
    ).toBe(true);
  });

  it('suppresses ads for earnedPremium in private scope without an active group', () => {
    expect(
      shouldSuppressAds({ paidTier: 0, scope: 'private', earnedPremium: true })
    ).toBe(true);
  });

  it('does NOT suppress ads for earnedGroupCreator only at tier 0 in public scope (D8: 9–18 band keeps ads)', () => {
    expect(
      shouldSuppressAds({ paidTier: 0, scope: 'public', earnedGroupCreator: true })
    ).toBe(false);
  });

  it('does NOT suppress ads for earnedGroupCreator only in private scope without an active group', () => {
    expect(
      shouldSuppressAds({ paidTier: 0, scope: 'private', earnedGroupCreator: true })
    ).toBe(false);
  });

  it('does NOT suppress ads for earnedGroupCreator only even with an owned active group context', () => {
    expect(
      shouldSuppressAds({
        paidTier: 0,
        scope: 'private',
        earnedGroupCreator: true,
        activeGroup: { isOwnedByViewer: true, memberCount: 6 },
      })
    ).toBe(false);
  });

  it('does NOT suppress ads for earnedGroupCreator only at tier 2 (creator flag never stacks with tiers)', () => {
    expect(
      shouldSuppressAds({
        paidTier: 2,
        scope: 'public',
        earnedGroupCreator: true,
      })
    ).toBe(false);
  });

  it('keeps legacy decision when both flags are false (tier 0, public → false)', () => {
    expect(
      shouldSuppressAds({ paidTier: 0, scope: 'public', earnedGroupCreator: false, earnedPremium: false })
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
        earnedGroupCreator: false,
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
        earnedGroupCreator: false,
        earnedPremium: false,
      })
    ).toBe(false);
  });
});

describe('suppression precedence over cadence (real chain: shouldSuppressAds → consumeAdSlot)', () => {
  it('earnedPremium true + everyNWins 4 → no slot at all (counter frozen, cadence never evaluated)', () => {
    const activeGroup: ActiveGroupAdContext = {
      isOwnedByViewer: false,
      memberCount: 4,
      adCadenceEveryNWins: 4,
    };
    const isAdFree = shouldSuppressAds({
      paidTier: 0,
      scope: 'private',
      activeGroup,
      earnedPremium: true,
    });
    expect(isAdFree).toBe(true);

    const result = consumeAdSlot({
      successesSinceLastAd: 3,
      everyNWins: 4,
      scope: { kind: 'private' },
      isAdFree,
      isE2E: false,
    });
    expect(result).toEqual({ showAd: false, nextCount: 3 });
  });

  it('tier-2 memberCount>5 suppression + everyNWins 4 → no slot at all', () => {
    const isAdFree = shouldSuppressAds({
      paidTier: 2,
      scope: 'private',
      activeGroup: { isOwnedByViewer: true, memberCount: 6, adCadenceEveryNWins: 4 },
    });
    expect(isAdFree).toBe(true);

    const result = consumeAdSlot({
      successesSinceLastAd: 3,
      everyNWins: 4,
      scope: { kind: 'private' },
      isAdFree,
      isE2E: false,
    });
    expect(result).toEqual({ showAd: false, nextCount: 3 });
  });

  it('E2E mode → no slot regardless of override (counter frozen, cadence never evaluated)', () => {
    const result = consumeAdSlot({
      successesSinceLastAd: 3,
      everyNWins: 4,
      scope: { kind: 'private' },
      isAdFree: false,
      isE2E: true,
    });
    expect(result).toEqual({ showAd: false, nextCount: 3 });
  });
});
