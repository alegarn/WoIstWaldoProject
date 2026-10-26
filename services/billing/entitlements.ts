// Minimal slice of the AuthContext value from store/auth-context.js that this
// module (and its importers) reads. Kept as a tiny module so billing helpers
// and upload services can depend on the auth shape without pulling store code
// into pure policy modules. `token` covers transport-level callers
// (e.g. services/groups/categoryThumbnailUpload.ts).
// Also carries the one shared earned-flag normalizer: both the wire mapper
// (utils/purchases.js) and the ad-cadence hook (hooks/useAdCadence.ts) must
// apply the same tri-state rule as adPolicy — only an explicit `true` counts;
// `false`/absent stay off.
export type AuthContextLike = {
  paidTier?: number;
  token?: string | null;
  earnedGroupCreator?: boolean;
  earnedPremium?: boolean;
};

export function isFlagExplicitlyOn(flag: unknown): boolean {
  return flag === true;
}

// Effective tier folds earned rights into the paid ladder: creator rung is
// tier-2-equivalent, premium rung is tier-3-equivalent; paid tier never loses
// to an earned rung. Single helper for every capability-surface consumer.
// Earned rungs sit at fixed points of the paid ladder (groupPersonalization
// CREATOR_MIN_TIER = 2, adPolicy PREMIUM_BUNDLE_TIER = 3); named locally to
// keep this pure policy module import-free.
const EARNED_CREATOR_TIER = 2;
const EARNED_PREMIUM_TIER = 3;

export function effectiveTierFor({
  paidTier,
  earnedGroupCreator,
  earnedPremium,
}: {
  paidTier?: number;
  earnedGroupCreator?: boolean;
  earnedPremium?: boolean;
}): number {
  const paid = Number.isFinite(paidTier) ? (paidTier as number) : 0;
  const earnedTier =
    earnedPremium === true ? EARNED_PREMIUM_TIER : earnedGroupCreator === true ? EARNED_CREATOR_TIER : 0;
  return Math.max(paid, earnedTier);
}
