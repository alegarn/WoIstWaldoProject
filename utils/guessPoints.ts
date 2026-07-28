import { resolveStreakTier } from '../constants/streakTiers';

/**
 * Guess points combine the speed bonus and the current streak tier.
 * Shared helper so overlay preview and persisted score use one formula.
 */
export function computePoints(speedMultiplier: number, streakMultiplier: number): number {
  return Math.round(speedMultiplier * streakMultiplier);
}

export type ResolveCorrectGuessOutcomeArgs = {
  multiplier: number;
  currentStreak: number;
};

export type CorrectGuessOutcome = {
  nextStreak: number;
  nextTier: ReturnType<typeof resolveStreakTier>;
  finalPoints: number;
};

/**
 * Resolve the next streak state and final score for a correct guess.
 * Shared pure helper so lifecycle code stays focused on async coordination.
 */
export function resolveCorrectGuessOutcome({ multiplier, currentStreak }: ResolveCorrectGuessOutcomeArgs): CorrectGuessOutcome {
  const nextStreak = currentStreak + 1;
  const nextTier = resolveStreakTier(nextStreak);
  const finalPoints = computePoints(multiplier, nextTier.multiplier);
  return { nextStreak, nextTier, finalPoints };
}