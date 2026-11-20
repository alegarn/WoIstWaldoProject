import { CELEBRATION, resolveCelebration } from '../constants/streakCelebration';
import type { CelebrationFx } from '../constants/streakCelebration';

type ResolvedRow = CelebrationFx & { tier: number };
type LadderCase = [number, ResolvedRow];

const ladderCases: LadderCase[] = [
  [0, { tier: 0, particles: 0,  particleMode: null,       rays: 0,  shockwave: false, tintOpacity: 0.0,  shakePx: 0, flash: false, durationMs: 600  }],
  [1, { tier: 1, particles: 0,  particleMode: null,       rays: 0,  shockwave: false, tintOpacity: 0.08, shakePx: 0, flash: false, durationMs: 900  }],
  [2, { tier: 2, particles: 14, particleMode: 'ember',    rays: 0,  shockwave: false, tintOpacity: 0.14, shakePx: 0, flash: false, durationMs: 1400 }],
  [3, { tier: 3, particles: 24, particleMode: 'ember',    rays: 0,  shockwave: true,  tintOpacity: 0.20, shakePx: 0, flash: false, durationMs: 1800 }],
  [4, { tier: 4, particles: 34, particleMode: 'confetti', rays: 12, shockwave: true,  tintOpacity: 0.26, shakePx: 5, flash: false, durationMs: 2200 }],
  [5, { tier: 5, particles: 40, particleMode: 'rain',     rays: 16, shockwave: true,  tintOpacity: 0.30, shakePx: 9, flash: true,  durationMs: 2600 }],
];

describe('streakCelebration', () => {
  describe('CELEBRATION table', () => {
    it('exposes 6 rows indexed tier 0..5', () => {
      expect(CELEBRATION).toHaveLength(6);
      CELEBRATION.forEach((row, tier) => {
        expect(row.tier).toBe(tier);
      });
    });
  });

  describe('resolveCelebration — exact ladder', () => {
    it.each(ladderCases)('tier %p returns documented scalars exactly', (tier, expected) => {
      expect(resolveCelebration(tier)).toEqual(expected);
    });
  });

  describe('resolveCelebration — clamping', () => {
    it('clamps negative tier to tier 0 config', () => {
      expect(resolveCelebration(-1)).toEqual(resolveCelebration(0));
    });

    it('clamps -999 to tier 0 config', () => {
      expect((resolveCelebration(-999) as ResolvedRow).tier).toBe(0);
    });
  });

  describe('resolveCelebration — high values', () => {
    it('returns tier 5 config for tier 6', () => {
      expect(resolveCelebration(6)).toEqual(resolveCelebration(5));
    });

    it('returns tier 5 config for tier 999', () => {
      expect((resolveCelebration(999) as ResolvedRow).tier).toBe(5);
    });
  });

  describe('resolveCelebration — purity', () => {
    it('returns structurally equal results for the same input', () => {
      expect(resolveCelebration(3)).toEqual(resolveCelebration(3));
    });
  });
});
