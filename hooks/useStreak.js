import { useCallback, useState } from 'react';

import { resolveStreakTier } from '../constants/streakTiers';

// useStreak: tracks consecutive wins for the current sitting.
// Pure state machine — no UI, no network, no tier table literal (DIP via constants/streakTiers).
export function useStreak(initial = 0) {
  const [streak, setStreak] = useState(initial);
  const onWin = useCallback(() => setStreak(s => s + 1), []);
  const onLose = useCallback(() => setStreak(0), []);
  const reset = useCallback(() => setStreak(0), []);
  const tier = resolveStreakTier(streak);
  return { streak, tier, multiplier: tier.multiplier, onWin, onLose, reset };
}
