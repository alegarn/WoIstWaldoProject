// Release kill switch for the whole ads stack (AdMob SDK init, interstitial
// bridge/requests, and the internal "Go Premium" fallback panel). Production
// EAS builds set EXPO_PUBLIC_ADS_DISABLED=true in eas.json; an unset flag or a
// __DEV__ build keeps ads active with Google test ad-unit IDs.

// Env-var check isolated from the __DEV__ global so it stays unit-testable
// (Jest runs with __DEV__ === true).
export function isAdsDisabledFlag(rawFlag: string | undefined): boolean {
  return rawFlag === 'true';
}

export const ADS_DISABLED = !__DEV__ && isAdsDisabledFlag(process.env.EXPO_PUBLIC_ADS_DISABLED);
