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
  earnedAdFree?: boolean;
  earnedPremium?: boolean;
};

export function isFlagExplicitlyOn(flag: unknown): boolean {
  return flag === true;
}
