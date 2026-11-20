export type AdScope = 'public' | 'private';

export type ActiveGroupAdContext = {
  isOwnedByViewer: boolean;
  memberCount: number;
  adCadenceEveryNWins?: number;
};

export type AdSuppressionInput = {
  paidTier: number;
  scope: AdScope;
  activeGroup?: ActiveGroupAdContext | null;
  earnedGroupCreator?: boolean;
  earnedPremium?: boolean;
};

// Mirror of API `Billing::CreatorReward` thresholds (planning §5.1). Client-side
// derivation (`earnedRewardFor`) is for display/progress only — gating truth is
// the server's `earned_group_creator` / `earned_premium` flags; on disagreement,
// server wins. `earnedRewardFor` mirrors the server's single-count ladder: one
// qualifying count, two thresholds (9 → group creator, 19 → + premium).
export const CREATOR_REWARD_GROUP_CREATOR_AT = 9;
export const CREATOR_REWARD_PREMIUM_AT = 19;

// Mirror of API `Billing::CreatorReward` member-cadence thresholds (plan D5,
// same-PR rule, same names). Display/progress-only — gating truth is the
// server's `ad_cadence_every_n_wins` field (absent = default 3); these mirrors
// are dead exports in v1, kept only for the single-source contract.
export const ACTIVITY_MIN_GUESSES = 5;
export const VESTING_DAYS = 14;
export const MEMBER_CADENCE_AT_12_QUALIFYING = 12;
export const MEMBER_CADENCE_AT_19_QUALIFYING = 19;
export const MEMBER_CADENCE_AT_12 = 4;
export const MEMBER_CADENCE_AT_19 = 6;

export function earnedRewardFor(qualifyingCount: number): {
  earnedGroupCreator: boolean;
  earnedPremium: boolean;
} {
  return {
    earnedGroupCreator: qualifyingCount >= CREATOR_REWARD_GROUP_CREATOR_AT,
    earnedPremium: qualifyingCount >= CREATOR_REWARD_PREMIUM_AT,
  };
}

const NO_ADS_TIER = 1;
const PRIVATE_GROUP_CREATOR_TIER = 2;
const PREMIUM_BUNDLE_TIER = 3;
const LARGE_PRIVATE_GROUP_MEMBER_COUNT_THRESHOLD = 5;

function isAlwaysAdFreeTier(paidTier: number): boolean {
  return Number.isFinite(paidTier)
    && (paidTier === NO_ADS_TIER || paidTier === PREMIUM_BUNDLE_TIER);
}

function isCreatorOwnedLargePrivateGroup(input: AdSuppressionInput): boolean {
  return input.paidTier === PRIVATE_GROUP_CREATOR_TIER
    && input.scope === 'private'
    && input.activeGroup?.isOwnedByViewer === true
    && input.activeGroup.memberCount > LARGE_PRIVATE_GROUP_MEMBER_COUNT_THRESHOLD;
}

function hasEarnedReward(input: AdSuppressionInput): boolean {
  return input.earnedPremium === true;
}

export function shouldSuppressAds(input: AdSuppressionInput): boolean {
  return hasEarnedReward(input)
    || isAlwaysAdFreeTier(input.paidTier)
    || isCreatorOwnedLargePrivateGroup(input);
}
