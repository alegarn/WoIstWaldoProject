import {
  SPEED_BONUS_THRESHOLD_MS,
  SHAPE_SPEED_BONUS_THRESHOLD_MS,
  SPEED_WINDOW_MS,
  SPEED_MULTIPLIER_BASE,
  SPEED_MULTIPLIER_FAST,
  computeMultiplier,
  isSpeedBonus,
  computeSpeedPoints,
  ringProgress,
} from '../utils/speedMultiplier';

describe('speedMultiplier', () => {
  describe('constants', () => {
    it('exports the spec values', () => {
      expect(SPEED_BONUS_THRESHOLD_MS).toBe(5000);
      expect(SPEED_WINDOW_MS).toBe(5000);
      expect(SPEED_MULTIPLIER_BASE).toBe(1);
      expect(SPEED_MULTIPLIER_FAST).toBe(2);
      expect(SHAPE_SPEED_BONUS_THRESHOLD_MS).toBe(10000);
    });
  });

  describe('computeMultiplier', () => {
    it.each([
      [0, 2],
      [1, 2],
      [4999, 2],
      [5000, 1],
      [99999, 1],
    ])('returns %p for elapsed %p', (elapsed, expected) => {
      expect(computeMultiplier(elapsed)).toBe(expected);
    });

    it('clamps negative elapsed to 0 (bonus applies)', () => {
      expect(computeMultiplier(-100)).toBe(2);
    });

    it('keeps the point-mode default at the 5000 boundary', () => {
      expect(computeMultiplier(4999)).toBe(2);
      expect(computeMultiplier(5000)).toBe(1);
    });

    it('applies the shape window at the 10000 boundary', () => {
      expect(computeMultiplier(9999, SHAPE_SPEED_BONUS_THRESHOLD_MS)).toBe(2);
      expect(computeMultiplier(10000, SHAPE_SPEED_BONUS_THRESHOLD_MS)).toBe(1);
    });

    it('separates the two windows between 5s and 10s', () => {
      expect(computeMultiplier(6000)).toBe(1);
      expect(computeMultiplier(6000, SHAPE_SPEED_BONUS_THRESHOLD_MS)).toBe(2);
    });
  });

  describe('isSpeedBonus', () => {
    it.each([
      [2, true],
      [3, true],
      [1, false],
      [0, false],
    ])('returns %p for multiplier %p', (multiplier, expected) => {
      expect(isSpeedBonus(multiplier)).toBe(expected);
    });
  });

  describe('computeSpeedPoints', () => {
    it.each([
      [1, 2, 2],
      [1, 1, 1],
      [5, 3, 15],
    ])('(%p, %p) -> %p', (base, mult, expected) => {
      expect(computeSpeedPoints(base, mult)).toBe(expected);
    });
  });

  describe('ringProgress', () => {
    it('returns 1 at the start of the window', () => {
      expect(ringProgress(0)).toBe(1);
    });

    it('returns 0 at the end of the window', () => {
      expect(ringProgress(SPEED_WINDOW_MS)).toBe(0);
    });

    it('returns 0.5 at half the window', () => {
      expect(ringProgress(SPEED_WINDOW_MS / 2)).toBe(0.5);
    });

    it('clamps to 0 past the window', () => {
      expect(ringProgress(SPEED_WINDOW_MS * 2)).toBe(0);
    });

    it('clamps negative elapsed to 1', () => {
      expect(ringProgress(-500)).toBe(1);
    });

    it('returns 0 when windowMs <= 0', () => {
      expect(ringProgress(0, 0)).toBe(0);
      expect(ringProgress(100, -1)).toBe(0);
    });
  });
});
