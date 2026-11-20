// Pure cadence state-machine for the non-blocking-guess ad slot.
// No React, no AdMob, no AsyncStorage. All inputs injected.

export type AdScope = { kind: 'private' | 'public'; [key: string]: unknown };

export type AdSlotInput = { scope?: AdScope; isAdFree: boolean; isE2E: boolean };

export type ConsumeAdSlotInput = AdSlotInput & {
  successesSinceLastAd: number;
  everyNWins?: number;
  isSourceReady?: boolean;
};

export type ConsumeAdSlotResult = { showAd: boolean; nextCount: number };

export const AD_EVERY_N_SUCCESSES = 3;

// Non-positive/non-finite overrides clamp to the default so the pure machine
// never sees an unsafe denominator.
function resolveEveryNWins(everyNWins?: number): number {
  if (everyNWins === undefined || !Number.isFinite(everyNWins) || everyNWins <= 0) {
    return AD_EVERY_N_SUCCESSES;
  }
  return everyNWins;
}

function isE2EModeActive({ isE2E }: { isE2E: boolean }): boolean {
  return isE2E === true;
}

// Single source of skip-condition truth. Consumed internally by consumeAdSlot;
// exported for direct unit testing of the skip predicate in isolation.
// Skip conditions are ONLY isAdFree and isE2E.
// Scope-specific billing rules live in services/billing/adPolicy and are resolved
// upstream into the isAdFree flag passed here.
export function isAdSlotActive({ scope, isAdFree, isE2E }: AdSlotInput): boolean {
  if (isE2EModeActive({ isE2E })) return false;
  if (isAdFree) return false;
  // scope retained as game context; cadence itself does not decide billing policy.
  return true;
}

// Pure introspection (tests + debugging). Does NOT mutate.
export function isAdDue({
  successesSinceLastAd,
  everyNWins,
}: {
  successesSinceLastAd: number;
  everyNWins?: number;
}): boolean {
  return (successesSinceLastAd + 1) >= resolveEveryNWins(everyNWins);
}

// Full state-machine: tick + due-check + reset-on-consume whether or not source displayed.
// Returns { showAd: boolean, nextCount: number }.
export function consumeAdSlot({
  successesSinceLastAd,
  everyNWins,
  scope,
  isAdFree,
  isE2E,
  isSourceReady = true,
}: ConsumeAdSlotInput): ConsumeAdSlotResult {
  if (!isAdSlotActive({ scope, isAdFree, isE2E })) {
    return { showAd: false, nextCount: successesSinceLastAd };
  }

  const nextCount = successesSinceLastAd + 1;

  if (!isAdDue({ successesSinceLastAd, everyNWins })) {
    return { showAd: false, nextCount };
  }

  // Due. Source not ready → consume the slot anyway (reset to 0), show no ad.
  if (!isSourceReady) {
    return { showAd: false, nextCount: 0 };
  }

  return { showAd: true, nextCount: 0 };
}
