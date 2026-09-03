/**
 * Type declarations for `utils/speedMultiplier.js`. The runtime module is
 * plain JavaScript; these declarations pin the scoring-constant and
 * multiplier contract used by `utils/handleGuessOutcome.ts`,
 * `screens/GuessScreens/GuessScreen.tsx`, and `components/Picture/GuessPicture.tsx`.
 */

export const SPEED_BONUS_THRESHOLD_MS: number;
export const SPEED_WINDOW_MS: number;
export const SPEED_MULTIPLIER_BASE: number;
export const SPEED_MULTIPLIER_FAST: number;

export function computeMultiplier(elapsedMs: number): number;
export function isSpeedBonus(multiplier: number): boolean;
export function computeSpeedPoints(basePoints: number, multiplier: number): number;
export function ringProgress(elapsedMs: number, windowMs?: number): number;
