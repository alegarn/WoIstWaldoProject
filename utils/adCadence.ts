// Pure cadence state-machine for the non-blocking-guess ad slot.
// No React, no AdMob, no AsyncStorage. All inputs injected.

export type AdScope = { kind: 'private' | 'public'; [key: string]: unknown };

export type AdSlotInput = { scope?: AdScope; isAdFree: boolean; isE2E: boolean };

export type ConsumeAdSlotInput = AdSlotInput & {
  successesSinceLastAd: number;
  isSourceReady?: boolean;
};

export type ConsumeAdSlotResult = { showAd: boolean; nextCount: number };

export const AD_EVERY_N_SUCCESSES = 3;

function isE2EModeActive({ isE2E }: { isE2E: boolean }): boolean {
  return isE2E === true;
}

// Single source of skip-condition truth. Consumed internally by consumeAdSlot;
// exported for direct unit testing of the skip predicate in isolation.
// Skip conditions are ONLY isAdFree and isE2E: private scope no longer suppresses
// ads (private games show ads like public ones).
// `scope` is retained for game context but no longer gates ads.
export function isAdSlotActive({ scope, isAdFree, isE2E }: AdSlotInput): boolean {
  if (isE2EModeActive({ isE2E })) return false;
  if (isAdFree) return false;
  // scope retained as game context; no longer suppresses ads.
  return true;
}

// Pure introspection (tests + debugging). Does NOT mutate.
export function isAdDue({ successesSinceLastAd }: { successesSinceLastAd: number }): boolean {
  return (successesSinceLastAd + 1) >= AD_EVERY_N_SUCCESSES;
}

// Full state-machine: tick + due-check + reset-on-consume whether or not source displayed.
// Returns { showAd: boolean, nextCount: number }.
export function consumeAdSlot({
  successesSinceLastAd,
  scope,
  isAdFree,
  isE2E,
  isSourceReady = true,
}: ConsumeAdSlotInput): ConsumeAdSlotResult {
  if (!isAdSlotActive({ scope, isAdFree, isE2E })) {
    return { showAd: false, nextCount: successesSinceLastAd };
  }

  const nextCount = successesSinceLastAd + 1;

  if (!isAdDue({ successesSinceLastAd })) {
    return { showAd: false, nextCount };
  }

  // Due. Source not ready → consume the slot anyway (reset to 0), show no ad.
  if (!isSourceReady) {
    return { showAd: false, nextCount: 0 };
  }

  return { showAd: true, nextCount: 0 };
}
