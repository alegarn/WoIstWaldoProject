export type AdScope = 'public' | 'private';

export type ActiveGroupAdContext = {
  isOwnedByViewer: boolean;
  memberCount: number;
};

export type AdSuppressionInput = {
  paidTier: number;
  scope: AdScope;
  activeGroup?: ActiveGroupAdContext | null;
};

function isAlwaysAdFreeTier(paidTier: number): boolean {
  return Number.isFinite(paidTier) && (paidTier === 1 || paidTier === 3);
}

function isCreatorOwnedLargePrivateGroup(input: AdSuppressionInput): boolean {
  return input.paidTier === 2
    && input.scope === 'private'
    && input.activeGroup?.isOwnedByViewer === true
    && input.activeGroup.memberCount > 5;
}

export function shouldSuppressAds(input: AdSuppressionInput): boolean {
  return isAlwaysAdFreeTier(input.paidTier) || isCreatorOwnedLargePrivateGroup(input);
}