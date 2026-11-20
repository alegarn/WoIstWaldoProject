import {
  STREAK_TIERS,
  NEUTRAL_TIER,
  STREAK_MULTIPLIER_BASE,
  resolveStreakTier,
} from '../constants/streakTiers';

describe('streakTiers', () => {
  describe('constants', () => {
    it('exports STREAK_MULTIPLIER_BASE === 1.0', () => {
      expect(STREAK_MULTIPLIER_BASE).toBe(1.0);
    });

    it('exposes a neutral tier 0 fallback', () => {
      expect(NEUTRAL_TIER).toEqual({
        tier: 0,
        threshold: 0,
        multiplier: 1.0,
        label: '',
        colorKey: 'neutral',
      });
    });

    it('keeps thresholds strictly descending across STREAK_TIERS', () => {
      for (let i = 0; i < STREAK_TIERS.length - 1; i += 1) {
        expect(STREAK_TIERS[i].threshold).toBeGreaterThan(STREAK_TIERS[i + 1].threshold);
      }
    });
  });

  describe('resolveStreakTier — neutral input', () => {
    it('returns neutral tier for streak 0', () => {
      const result = resolveStreakTier(0);
      expect(result.tier).toBe(0);
      expect(result.multiplier).toBe(1.0);
      expect(result.label).toBe('');
      expect(result.colorKey).toBe('neutral');
    });
  });

  describe('resolveStreakTier — boundaries', () => {
    it.each([
      [2, 0, 1.0, '', 'neutral'],
      [3, 1, 2.0, 'Focused', 'blue'],
      [6, 1, 2.0, 'Focused', 'blue'],
      [7, 2, 3.0, 'In the Zone', 'orange'],
      [12, 3, 5.0, 'On Fire', 'red'],
      [20, 4, 7.0, 'Legendary', 'purple'],
      [50, 5, 10.0, "Waldo's Nemesis", 'white'],
    ])(
      'streak %p -> tier %p, multiplier %p, label %p, colorKey %p',
      (streak, tier, multiplier, label, colorKey) => {
        const result = resolveStreakTier(streak);
        expect(result.tier).toBe(tier);
        expect(result.multiplier).toBe(multiplier);
        expect(result.label).toBe(label);
        expect(result.colorKey).toBe(colorKey);
      },
    );
  });

  describe('resolveStreakTier — high values', () => {
    it('returns the top tier for streak 999', () => {
      expect(resolveStreakTier(999).tier).toBe(5);
    });
  });

  describe('resolveStreakTier — clamping', () => {
    it('clamps negative streak to tier 0', () => {
      expect(resolveStreakTier(-5).tier).toBe(0);
    });

    it('floors 2.9 to tier 0 (floor = 2, below threshold 3)', () => {
      expect(resolveStreakTier(2.9).tier).toBe(0);
    });
  });

  describe('resolveStreakTier — contract', () => {
    it.each([-5, 0, 1, 2, 3, 6, 7, 12, 20, 50, 999])(
      'guarantees multiplier >= 1.0 and tier >= 0 for streak %p',
      (streak) => {
        const { tier, multiplier } = resolveStreakTier(streak);
        expect(multiplier).toBeGreaterThanOrEqual(1.0);
        expect(tier).toBeGreaterThanOrEqual(0);
      },
    );
  });
});
