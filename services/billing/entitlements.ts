// Mobile ad-suppression gate.
// Gate is premiumTier >= 1, NOT a no_ads entitlement check.
// Rationale: docs/billing-system.md §4 "Important consequence for the client" + §8 gotcha
// "no_ads ad-suppression is NOT enforced client-side". A tier-2 (creator) user has no
// no_ads entitlement active in the 1:1 model, but they are still ad-free by tier.
// Prefers `premiumTier` over `isPremium` because `premiumTier` is expiration-aware
// (per docs/billing-system.md §8 gotcha: `active_window?` flows into tier, not into isPremium).

export const AD_FREE_TIER_THRESHOLD = 1;

// Minimal slice of the AuthContext value from store/auth-context.js that this module reads.
// Permissive on purpose so the full AuthContext value satisfies it without coupling here.
export type AuthContextLike = { premiumTier?: number };

// Pure core. No React, no AsyncStorage, no network.
export function isAdFreeTier(premiumTier: number): boolean {
  return Number.isFinite(premiumTier) && premiumTier >= AD_FREE_TIER_THRESHOLD;
}

// Wrapper reading the AuthContext shape from store/auth-context.js (premiumTier at line 409).
// `authContext?.premiumTier` may be undefined; Number.isFinite(undefined) === false in the
// original JS, so an explicit undefined short-circuit preserves byte-identical behavior.
export function shouldSuppressAds(authContext: AuthContextLike | null | undefined): boolean {
  const premiumTier = authContext?.premiumTier;
  return premiumTier === undefined ? false : isAdFreeTier(premiumTier);
}
