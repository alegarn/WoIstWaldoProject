import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { consumeAdSlot as resolveAdSlot } from '../utils/adCadence';
import type { AdScope, ConsumeAdSlotResult } from '../utils/adCadence';
import { shouldSuppressAds, type ActiveGroupAdContext } from '../services/billing/adPolicy';
import type { AuthContextLike } from '../services/billing/entitlements';
import { isE2EMode } from '../utils/e2eMode';
import type { AdSource } from '../services/ads/AdSource';

const IS_ANDROID = Platform.OS === 'android';

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

export function useAdCadence({ scope, activeGroup, authContext, adSource }: UseAdCadenceArgs): UseAdCadenceResult {
  const [successesSinceLastAd, setSuccessesSinceLastAd] = useState(0);
  const successesSinceLastAdRef = useRef(successesSinceLastAd);
  successesSinceLastAdRef.current = successesSinceLastAd;
  const policyScope = resolvePolicyScope(scope);
  const isAdFree = shouldSuppressAds({
    paidTier: authContext?.paidTier ?? 0,
    scope: policyScope,
    activeGroup: policyScope === 'private' ? activeGroup ?? null : null,
  });
  const isE2E = isE2EMode();

  const consumeCurrentAdSlot = useCallback((): ConsumeAdSlotResult => {
    const result = resolveAdSlot({
      successesSinceLastAd: successesSinceLastAdRef.current,
      scope,
      isAdFree,
      isE2E,
      isSourceReady: IS_ANDROID && adSource.isReady(),
    });
    successesSinceLastAdRef.current = result.nextCount;
    setSuccessesSinceLastAd(result.nextCount);
    return result;
  }, [adSource, isAdFree, isE2E, scope]);

  const resetSuccessesSinceLastAd = useCallback(() => {
    successesSinceLastAdRef.current = 0;
    setSuccessesSinceLastAd(0);
  }, []);

  return { consumeAdSlot: consumeCurrentAdSlot, resetSuccessesSinceLastAd };
}
