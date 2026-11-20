// Streak Celebration Policy: tier 0..5 scalar ladder for find-celebration visuals.
// Add a tier by appending one object to CELEBRATION (OCP); keep tiers ascending 0..N.
// Contract: input tier is clamped >= 0; output always contains the 9 fields below.

export type ParticleMode = 'ember' | 'confetti' | 'rain';

export type CelebrationFx = {
  particles: number;
  particleMode: ParticleMode | null;
  rays: number;
  shockwave: boolean;
  tintOpacity: number;
  shakePx: number;
  flash: boolean;
  durationMs: number;
};

type CelebrationRow = CelebrationFx & { tier: number };

export const CELEBRATION: CelebrationRow[] = [
  { tier: 0, particles: 0,  particleMode: null,       rays: 0,  shockwave: false, tintOpacity: 0.0,  shakePx: 0, flash: false, durationMs: 600  },
  { tier: 1, particles: 0,  particleMode: null,       rays: 0,  shockwave: false, tintOpacity: 0.08, shakePx: 0, flash: false, durationMs: 900  },
  { tier: 2, particles: 14, particleMode: 'ember',    rays: 0,  shockwave: false, tintOpacity: 0.14, shakePx: 0, flash: false, durationMs: 1400 },
  { tier: 3, particles: 24, particleMode: 'ember',    rays: 0,  shockwave: true,  tintOpacity: 0.20, shakePx: 0, flash: false, durationMs: 1800 },
  { tier: 4, particles: 34, particleMode: 'confetti', rays: 12, shockwave: true,  tintOpacity: 0.26, shakePx: 5, flash: false, durationMs: 2200 },
  { tier: 5, particles: 40, particleMode: 'rain',     rays: 16, shockwave: true,  tintOpacity: 0.30, shakePx: 9, flash: true,  durationMs: 2600 },
];

const TOP_INDEX = CELEBRATION.length - 1;

export function resolveCelebration(tier: number): CelebrationFx {
  const t = Math.max(0, Math.min(TOP_INDEX, Math.floor(Number(tier) || 0)));
  return CELEBRATION[t];
}
