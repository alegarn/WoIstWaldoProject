export type AdScope = 'public' | 'private';

export type ActiveGroupAdContext = {
  isOwnedByViewer: boolean;
  memberCount: number;
};

export type AdSuppressionInput = {
  paidTier: number;
  scope: AdScope;
  activeGroup?: ActiveGroupAdContext | null;
  earnedAdFree?: boolean;
  earnedPremium?: boolean;
};

// Mirror of API `Billing::CreatorReward` thresholds (planning §5.1). Client-side
// derivation (`earnedRewardFor`) is for display/progress only — gating truth is
// the server's `earned_ad_free` / `earned_premium` flags; on disagreement,
// server wins. The optional flags are tri-state: only an explicit `true`
// suppresses; `false`/absent fall through to the purchase-derived legacy
// branches below.
export const CREATOR_REWARD_AD_FREE_AT = 9;
export const CREATOR_REWARD_PREMIUM_AT = 19;

export function earnedRewardFor(qualifyingCount: number): {
  earnedAdFree: boolean;
  earnedPremium: boolean;
} {
  return {
    earnedAdFree: qualifyingCount >= CREATOR_REWARD_AD_FREE_AT,
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
  return input.earnedAdFree === true || input.earnedPremium === true;
}

export function shouldSuppressAds(input: AdSuppressionInput): boolean {
  return hasEarnedReward(input)
    || isAlwaysAdFreeTier(input.paidTier)
    || isCreatorOwnedLargePrivateGroup(input);
}