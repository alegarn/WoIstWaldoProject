export const CREATOR_MIN_TIER = 2;
export const FREE_MEMBER_CAP = 10;
export const CREATOR_MEMBER_CAP = 30;

export function canPersonalizeGroup(paidTier: number): boolean {
  return Number.isFinite(paidTier) && paidTier >= CREATOR_MIN_TIER;
}

export function memberCapFor(paidTier: number): number {
  return canPersonalizeGroup(paidTier) ? CREATOR_MEMBER_CAP : FREE_MEMBER_CAP;
}
