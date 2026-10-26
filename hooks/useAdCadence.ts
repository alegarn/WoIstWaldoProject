import { useCallback, useRef, useState } from 'react';

import { AD_EVERY_N_SUCCESSES, consumeAdSlot as resolveAdSlot } from '../utils/adCadence';
import type { AdScope, ConsumeAdSlotResult } from '../utils/adCadence';
import { shouldSuppressAds, type ActiveGroupAdContext } from '../services/billing/adPolicy';
import { isFlagExplicitlyOn, type AuthContextLike } from '../services/billing/entitlements';
import { isE2EMode } from '../utils/e2eMode';
import type { AdSource } from '../services/ads/AdSource';

type UseAdCadenceArgs = {
  scope?: AdScope;
  activeGroup?: ActiveGroupAdContext | null;
  authContext: AuthContextLike;
  adSource: AdSource;
};

type UseAdCadenceResult = {
  consumeAdSlot: () => ConsumeAdSlotResult;
  resetSuccessesSinceLastAd: () => void;
};

// §2.3 (3): owns the ad-cadence counter state and its two state transitions:
// consume one success slot after a committed win, or reset the counter after a
// miss. Callers do not thread the current count around manually anymore.
function resolvePolicyScope(scope?: AdScope): 'public' | 'private' {
  return scope?.kind === 'private' ? 'private' : 'public';
}

// Member cadence override: private scope only, positive server value only;
// anything else falls back to the default denominator. Suppression stays
// upstream (suppressed ⇒ slot inactive ⇒ cadence irrelevant).
function resolveEveryNWins(
  policyScope: 'public' | 'private',
  activeGroup?: ActiveGroupAdContext | null
): number {
  const override = activeGroup?.adCadenceEveryNWins;
  return policyScope === 'private' && typeof override === 'number' && override > 0
    ? override
    : AD_EVERY_N_SUCCESSES;
}

export function useAdCadence({ scope, activeGroup, authContext, adSource }: UseAdCadenceArgs): UseAdCadenceResult {
  const [successesSinceLastAd, setSuccessesSinceLastAd] = useState(0);
  const successesSinceLastAdRef = useRef(successesSinceLastAd);
  successesSinceLastAdRef.current = successesSinceLastAd;
  const policyScope = resolvePolicyScope(scope);
  const everyNWins = resolveEveryNWins(policyScope, activeGroup);
  const isAdFree = shouldSuppressAds({
    paidTier: authContext?.paidTier ?? 0,
    scope: policyScope,
    activeGroup: policyScope === 'private' ? activeGroup ?? null : null,
    earnedPremium: isFlagExplicitlyOn(authContext?.earnedPremium),
  });
  const isE2E = isE2EMode();

  const consumeCurrentAdSlot = useCallback((): ConsumeAdSlotResult => {
    // isSourceReady is platform-agnostic: the composite adSource.isReady() is
    // true on every platform (InternalProAdSource.isReady() is always true →
    // fallback panel always eligible), and on Android a loaded AdMob
    // interstitial takes precedence via the bridge snapshot. Gating on the
    // platform here previously made iOS permanently isSourceReady=false and
    // suppressed every ad; paid tier and e2e are still skipped by consumeAdSlot.
    const result = resolveAdSlot({
      successesSinceLastAd: successesSinceLastAdRef.current,
      everyNWins,
      scope,
      isAdFree,
      isE2E,
      isSourceReady: adSource.isReady(),
    });
    successesSinceLastAdRef.current = result.nextCount;
    setSuccessesSinceLastAd(result.nextCount);
    return result;
  }, [adSource, everyNWins, isAdFree, isE2E, scope]);

  const resetSuccessesSinceLastAd = useCallback(() => {
    successesSinceLastAdRef.current = 0;
    setSuccessesSinceLastAd(0);
  }, []);

  return { consumeAdSlot: consumeCurrentAdSlot, resetSuccessesSinceLastAd };
}
