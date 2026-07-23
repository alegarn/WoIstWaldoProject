import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
}));

import SuccessOverlay from '../components/Guess/SuccessOverlay';
import type { StreakTierLike } from '../components/Guess/SuccessOverlay';
import { GlobalStyle } from '../constants/theme';
import { resolveStreakTier, NEUTRAL_TIER } from '../constants/streakTiers';
import { resolveCelebration } from '../constants/streakCelebration';

type OverlayProps = React.ComponentProps<typeof SuccessOverlay>;

function findByTestID(root: ReactTestInstance, testID: string): ReactTestInstance[] {
  return root.findAll(node => node.props && node.props.testID === testID);
}

function findAllTextChildren(root: ReactTestInstance): unknown[] {
  return root.findAllByType(Text).map(node => node.props.children);
}

// Animated.View with a testID appears as 3 nodes (Animated wrapper + 2 internal Views).
// Count distinct animated elements by collapsing the triplet.
function countAnimated(root: ReactTestInstance, testID: string): number {
  return Math.floor(findByTestID(root, testID).length / 3);
}

function render(props: Partial<OverlayProps>): ReactTestRenderer {
  return create(<SuccessOverlay visible={true} onDone={jest.fn()} {...props} />);
}

function pillTextStyle(root: ReactTestInstance): unknown {
  const matches = findByTestID(root, 'guess.success.streak.pill');
  const pill = matches[0];
  const text = pill.findAllByType(Text)[0];
  return text.props.style;
}

describe('SuccessOverlay', () => {
  let renderer: ReactTestRenderer | null;
  afterEach(() => {
    if (renderer) act(() => { renderer!.unmount(); });
    renderer = null;
  });

  it('renders the +1 label and no speed burst when multiplier is 1 (default)', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={jest.fn()} multiplier={1} points={1} />);
    });
    const texts = findAllTextChildren(renderer!.root);
    expect(texts).toContain('+1');
    expect(findByTestID(renderer!.root, 'guess.success.speed-burst')).toHaveLength(0);
  });

  it('renders the +2 label and a speed burst when multiplier is 2', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={jest.fn()} multiplier={2} points={2} />);
    });
    const texts = findAllTextChildren(renderer!.root);
    expect(texts).toContain('+2');
    expect(findByTestID(renderer!.root, 'guess.success.speed-burst').length).toBeGreaterThan(0);
    expect(texts).toContain('×2');
  });

  it('shows the ×2 speed badge and chrono when multiplier is 2', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={jest.fn()} multiplier={2} points={2} />);
    });
    expect(findByTestID(renderer!.root, 'guess.success.speed-badge').length).toBeGreaterThan(0);
    const texts = findAllTextChildren(renderer!.root);
    expect(texts).toContain('×2');
    expect(findByTestID(renderer!.root, 'guess.success.speed-chrono').length).toBeGreaterThan(0);
  });

  it('hides the speed badge when multiplier is 1', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={jest.fn()} multiplier={1} points={1} />);
    });
    expect(findByTestID(renderer!.root, 'guess.success.speed-badge')).toHaveLength(0);
    const texts = findAllTextChildren(renderer!.root);
    expect(texts).not.toContain('×2');
  });

  it('shows ×N matching the multiplier (decoupled from points)', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={jest.fn()} multiplier={3} points={5} />);
    });
    expect(findByTestID(renderer!.root, 'guess.success.speed-badge').length).toBeGreaterThan(0);
    const texts = findAllTextChildren(renderer!.root);
    expect(texts).toContain('×3');
    expect(texts).not.toContain('×2');
  });

  it('renders the label from points independently of multiplier (decoupled presenter)', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={jest.fn()} multiplier={2} points={5} />);
    });
    const texts = findAllTextChildren(renderer!.root);
    expect(texts).toContain('+5');
    expect(findByTestID(renderer!.root, 'guess.success.speed-burst').length).toBeGreaterThan(0);
  });

  it('renders nothing when visible is false', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={false} onDone={jest.fn()} multiplier={2} />);
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  it('renders no streak pill when streakTier is the neutral default (tier 0)', () => {
    act(() => {
      renderer = render({ multiplier: 1, points: 1, streakTier: NEUTRAL_TIER });
    });
    expect(findByTestID(renderer!.root, 'guess.success.streak.pill')).toHaveLength(0);
    expect(findByTestID(renderer!.root, 'guess.success.streak.ring')).toHaveLength(0);
  });

  it('renders no streak pill when streakTier prop is omitted (back-compat)', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={jest.fn()} multiplier={1} points={1} />);
    });
    expect(findByTestID(renderer!.root, 'guess.success.streak.pill')).toHaveLength(0);
  });

  it('renders the streak pill with the Focused label and blue flame color at tier 1', () => {
    const tier = resolveStreakTier(3) as StreakTierLike;
    expect(tier.tier).toBe(1);
    act(() => {
      renderer = render({ multiplier: 1, points: 1, streakTier: tier });
    });
    expect(countAnimated(renderer!.root, 'guess.success.streak.pill')).toBe(1);
    expect(countAnimated(renderer!.root, 'guess.success.streak.ring')).toBe(0);
    const texts = findAllTextChildren(renderer!.root);
    expect(texts.some(t => typeof t === 'string' && t.includes('Focused'))).toBe(true);
    expect(pillTextStyle(renderer!.root)).toEqual(
      expect.arrayContaining([{ color: GlobalStyle.color.streak.blue }])
    );
  });

  it('renders pill + 2 glow rings with orange flame color at tier 2', () => {
    const tier = resolveStreakTier(7) as StreakTierLike;
    expect(tier.tier).toBe(2);
    act(() => {
      renderer = render({ multiplier: 1, points: 1, streakTier: tier });
    });
    expect(countAnimated(renderer!.root, 'guess.success.streak.pill')).toBe(1);
    expect(countAnimated(renderer!.root, 'guess.success.streak.ring')).toBe(2);
    expect(pillTextStyle(renderer!.root)).toEqual(
      expect.arrayContaining([{ color: GlobalStyle.color.streak.orange }])
    );
  });

  it('renders pill + 2 glow rings with red flame color at tier 3 (v1 fallback)', () => {
    const tier = resolveStreakTier(12) as StreakTierLike;
    expect(tier.tier).toBe(3);
    act(() => {
      renderer = render({ multiplier: 1, points: 1, streakTier: tier });
    });
    expect(countAnimated(renderer!.root, 'guess.success.streak.pill')).toBe(1);
    expect(countAnimated(renderer!.root, 'guess.success.streak.ring')).toBe(2);
    expect(pillTextStyle(renderer!.root)).toEqual(
      expect.arrayContaining([{ color: GlobalStyle.color.streak.red }])
    );
  });

  it('renders pill with purple flame color at tier 4', () => {
    const tier = resolveStreakTier(20) as StreakTierLike;
    expect(tier.tier).toBe(4);
    act(() => {
      renderer = render({ multiplier: 1, points: 1, streakTier: tier });
    });
    expect(countAnimated(renderer!.root, 'guess.success.streak.pill')).toBe(1);
    expect(pillTextStyle(renderer!.root)).toEqual(
      expect.arrayContaining([{ color: GlobalStyle.color.streak.purple }])
    );
  });

  it('renders pill with white flame color at tier 5', () => {
    const tier = resolveStreakTier(50) as StreakTierLike;
    expect(tier.tier).toBe(5);
    act(() => {
      renderer = render({ multiplier: 1, points: 1, streakTier: tier });
    });
    expect(countAnimated(renderer!.root, 'guess.success.streak.pill')).toBe(1);
    expect(pillTextStyle(renderer!.root)).toEqual(
      expect.arrayContaining([{ color: GlobalStyle.color.streak.white }])
    );
  });

  it('renders the speed ×N pill independently of the streak tier', () => {
    const tier = resolveStreakTier(7) as StreakTierLike;
    act(() => {
      renderer = render({ multiplier: 3, points: 5, streakTier: tier });
    });
    expect(findByTestID(renderer!.root, 'guess.success.speed-badge').length).toBeGreaterThan(0);
    const texts = findAllTextChildren(renderer!.root);
    expect(texts).toContain('×3');
    expect(countAnimated(renderer!.root, 'guess.success.streak.pill')).toBe(1);
  });

  // Celebration layer presence is driven by resolveCelebration(tier) (constants/streakCelebration.js).
  // ParticleField renders each particle as ONE Animated.View with testID
  // 'guess.success.celebration.particle'; under react-test-renderer an Animated.View
  // with a testID shows up as 3 nodes (Animated wrapper + 2 internal Views), so the
  // /3 rule in countAnimated yields the true particle count. Same rule applies to
  // bg / shockwave / rays / ray / flash (all Animated.View). ScreenShake is asserted
  // via findByTestID(...).length > 0 since its render presence is what matters.
  const celebrationCases: Array<[number, StreakTierLike]> = [
    [0, NEUTRAL_TIER],
    [1, resolveStreakTier(3) as StreakTierLike],
    [2, resolveStreakTier(7) as StreakTierLike],
    [3, resolveStreakTier(12) as StreakTierLike],
    [4, resolveStreakTier(20) as StreakTierLike],
    [5, resolveStreakTier(50) as StreakTierLike],
  ];
  it.each(celebrationCases)('renders celebration layers matching resolveCelebration(tier) config at tier %i', (tierNum, tier) => {
    const fx = resolveCelebration(tierNum);
    act(() => {
      renderer = render({ multiplier: 1, points: 1, streakTier: tier });
    });
    // bg present iff tintOpacity > 0
    expect(countAnimated(renderer!.root, 'guess.success.celebration.bg')).toBe(fx.tintOpacity > 0 ? 1 : 0);
    // shockwave renders 2 ring Animated.Views when active, 0 otherwise
    expect(countAnimated(renderer!.root, 'guess.success.celebration.shockwave')).toBe(fx.shockwave ? 2 : 0);
    // particle count matches config (0 → absent)
    expect(countAnimated(renderer!.root, 'guess.success.celebration.particle')).toBe(fx.particles);
    // rays container present iff rays > 0
    expect(countAnimated(renderer!.root, 'guess.success.celebration.rays')).toBe(fx.rays > 0 ? 1 : 0);
    // individual ray count matches config
    expect(countAnimated(renderer!.root, 'guess.success.celebration.ray')).toBe(fx.rays);
    // flash present iff fx.flash
    expect(countAnimated(renderer!.root, 'guess.success.celebration.flash')).toBe(fx.flash ? 1 : 0);
    // shake wrapper present iff shakePx > 0
    expect(findByTestID(renderer!.root, 'guess.success.celebration.shake').length > 0).toBe(fx.shakePx > 0);
  });

  it('fires onDone exactly once for tier 5 (longest durationMs)', () => {
    jest.useFakeTimers();
    try {
      const onDone = jest.fn();
      const tier = resolveStreakTier(50) as StreakTierLike;
      act(() => {
        renderer = render({ multiplier: 1, points: 1, streakTier: tier, onDone });
      });
      // Real Animated (not mocked) drives the base sequence via setTimeout/spring
      // frames; flush past tier-5 durationMs (2600ms) so the spring + tier-aware
      // fade-out completion lands and onDone fires.
      act(() => { jest.advanceTimersByTime(3000); });
      expect(onDone).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does NOT fire onDone when visible flips false mid-animation (swipe-home contract)', () => {
    jest.useFakeTimers();
    try {
      const onDone = jest.fn();
      const tier = resolveStreakTier(50) as StreakTierLike;
      act(() => {
        renderer = render({ multiplier: 1, points: 1, streakTier: tier, onDone });
      });
      // Advance partway — before the base sequence completes. NB: under fake
      // timers RAF is mocked as setTimeout(0), so the spring+timing sequence
      // resolves in ~tens of ms (well ahead of fx.durationMs=2600); 10ms is
      // safely pre-completion.
      act(() => { jest.advanceTimersByTime(10); });
      expect(onDone).toHaveBeenCalledTimes(0);
      // Swipe home: visible flips false → useEffect cleanup stops the animation,
      // so the completion callback receives { finished: false } and the
      // `if (finished)` guard blocks onDone (useResolveLifecycle mountedRef relies on this).
      act(() => {
        renderer!.update(
          <SuccessOverlay visible={false} onDone={onDone} multiplier={1} points={1} streakTier={tier} />
        );
      });
      // Advance well past the would-be completion; onDone must remain unfired.
      act(() => { jest.advanceTimersByTime(3000); });
      expect(onDone).toHaveBeenCalledTimes(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('exposes the neutral tier as NEUTRAL_TIER constant for callers', () => {
    expect(NEUTRAL_TIER.tier).toBe(0);
  });
});
