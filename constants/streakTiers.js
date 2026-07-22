// Streak Tier Policy: longer correct-find streaks unlock higher score multipliers and display tiers.
// Tier table: thresholds 3/7/12/20/50 -> multipliers 2.0/3.0/5.0/7.0/10.0 (highest threshold first).
// Add a tier by appending one object to STREAK_TIERS (OCP); keep highest threshold first.
// Contract: input streak >= 0 (clamped); output always { tier>=0, multiplier>=1.0, label, colorKey }.

export const STREAK_TIERS = [
  { tier: 5, threshold: 50, multiplier: 10.0, label: "Waldo's Nemesis", colorKey: 'white'  },
  { tier: 4, threshold: 20, multiplier: 7.0,  label: 'Legendary',       colorKey: 'purple' },
  { tier: 3, threshold: 12, multiplier: 5.0,  label: 'On Fire',         colorKey: 'red'    },
  { tier: 2, threshold: 7,  multiplier: 3.0,  label: 'In the Zone',     colorKey: 'orange' },
  { tier: 1, threshold: 3,  multiplier: 2.0,  label: 'Focused',         colorKey: 'blue'   },
];

export const NEUTRAL_TIER = { tier: 0, threshold: 0, multiplier: 1.0, label: '', colorKey: 'neutral' };

export const STREAK_MULTIPLIER_BASE = NEUTRAL_TIER.multiplier;

export function resolveStreakTier(streak) {
  const s = Math.max(0, Math.floor(Number(streak) || 0));
  const match = STREAK_TIERS.find(t => s >= t.threshold);
  return match ?? NEUTRAL_TIER;
}
