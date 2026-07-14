// Speed Multiplier: faster finds earn a higher score multiplier.
// A correct find within SPEED_BONUS_THRESHOLD_MS (5s) yields SPEED_MULTIPLIER_FAST (x2).
// The countdown ring window equals SPEED_WINDOW_MS (same 5s).

export const SPEED_BONUS_THRESHOLD_MS = 5000;
export const SPEED_WINDOW_MS = 5000;
export const SPEED_MULTIPLIER_BASE = 1;
export const SPEED_MULTIPLIER_FAST = 2;

export function computeMultiplier(elapsedMs) {
  const clamped = Math.max(0, elapsedMs);
  if (clamped < SPEED_BONUS_THRESHOLD_MS) {
    return SPEED_MULTIPLIER_FAST;
  }
  return SPEED_MULTIPLIER_BASE;
}

export function isSpeedBonus(multiplier) {
  return multiplier > SPEED_MULTIPLIER_BASE;
}

export function computeSpeedPoints(basePoints, multiplier) {
  return basePoints * multiplier;
}

export function ringProgress(elapsedMs, windowMs = SPEED_WINDOW_MS) {
  if (windowMs <= 0) return 0;
  const ratio = 1 - elapsedMs / windowMs;
  return Math.min(1, Math.max(0, ratio));
}
