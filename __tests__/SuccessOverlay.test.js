import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
}));

import SuccessOverlay from '../components/Guess/SuccessOverlay';
import { GlobalStyle } from '../constants/theme';
import { resolveStreakTier, NEUTRAL_TIER } from '../constants/streakTiers';

function findByTestID(root, testID) {
  return root.findAll(node => node.props && node.props.testID === testID);
}

function findAllTextChildren(root) {
  return root.findAllByType(Text).map(node => node.props.children);
}

// Animated.View with a testID appears as 3 nodes (Animated wrapper + 2 internal Views).
// Count distinct animated elements by collapsing the triplet.
function countAnimated(root, testID) {
  return Math.floor(findByTestID(root, testID).length / 3);
}

function render(props) {
  return create(<SuccessOverlay visible={true} onDone={jest.fn()} {...props} />);
}

function pillTextStyle(root) {
  const matches = findByTestID(root, 'guess.success.streak.pill');
  const pill = matches[0];
  const text = pill.findAllByType(Text)[0];
  return text.props.style;
}

describe('SuccessOverlay', () => {
  let renderer;
  afterEach(() => {
    if (renderer) act(() => { renderer.unmount(); });
    renderer = null;
  });

  it('renders the +1 label and no speed burst when multiplier is 1 (default)', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={jest.fn()} multiplier={1} points={1} />);
    });
    const texts = findAllTextChildren(renderer.root);
    expect(texts).toContain('+1');
    expect(findByTestID(renderer.root, 'guess.success.speed-burst')).toHaveLength(0);
  });

  it('renders the +2 label and a speed burst when multiplier is 2', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={jest.fn()} multiplier={2} points={2} />);
    });
    const texts = findAllTextChildren(renderer.root);
    expect(texts).toContain('+2');
    expect(findByTestID(renderer.root, 'guess.success.speed-burst').length).toBeGreaterThan(0);
    expect(texts).toContain('×2');
  });

  it('shows the ×2 speed badge and chrono when multiplier is 2', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={jest.fn()} multiplier={2} points={2} />);
    });
    expect(findByTestID(renderer.root, 'guess.success.speed-badge').length).toBeGreaterThan(0);
    const texts = findAllTextChildren(renderer.root);
    expect(texts).toContain('×2');
    expect(findByTestID(renderer.root, 'guess.success.speed-chrono').length).toBeGreaterThan(0);
  });

  it('hides the speed badge when multiplier is 1', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={jest.fn()} multiplier={1} points={1} />);
    });
    expect(findByTestID(renderer.root, 'guess.success.speed-badge')).toHaveLength(0);
    const texts = findAllTextChildren(renderer.root);
    expect(texts).not.toContain('×2');
  });

  it('shows ×N matching the multiplier (decoupled from points)', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={jest.fn()} multiplier={3} points={5} />);
    });
    expect(findByTestID(renderer.root, 'guess.success.speed-badge').length).toBeGreaterThan(0);
    const texts = findAllTextChildren(renderer.root);
    expect(texts).toContain('×3');
    expect(texts).not.toContain('×2');
  });

  it('renders the label from points independently of multiplier (decoupled presenter)', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={jest.fn()} multiplier={2} points={5} />);
    });
    const texts = findAllTextChildren(renderer.root);
    expect(texts).toContain('+5');
    expect(findByTestID(renderer.root, 'guess.success.speed-burst').length).toBeGreaterThan(0);
  });

  it('renders nothing when visible is false', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={false} onDone={jest.fn()} multiplier={2} />);
    });
    expect(renderer.toJSON()).toBeNull();
  });

  it('renders no streak pill when streakTier is the neutral default (tier 0)', () => {
    act(() => {
      renderer = render({ multiplier: 1, points: 1, streakTier: NEUTRAL_TIER });
    });
    expect(findByTestID(renderer.root, 'guess.success.streak.pill')).toHaveLength(0);
    expect(findByTestID(renderer.root, 'guess.success.streak.ring')).toHaveLength(0);
  });

  it('renders no streak pill when streakTier prop is omitted (back-compat)', () => {
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={jest.fn()} multiplier={1} points={1} />);
    });
    expect(findByTestID(renderer.root, 'guess.success.streak.pill')).toHaveLength(0);
  });

  it('renders the streak pill with the Focused label and blue flame color at tier 1', () => {
    const tier = resolveStreakTier(3);
    expect(tier.tier).toBe(1);
    act(() => {
      renderer = render({ multiplier: 1, points: 1, streakTier: tier });
    });
    expect(countAnimated(renderer.root, 'guess.success.streak.pill')).toBe(1);
    expect(countAnimated(renderer.root, 'guess.success.streak.ring')).toBe(0);
    const texts = findAllTextChildren(renderer.root);
    expect(texts.some(t => typeof t === 'string' && t.includes('Focused'))).toBe(true);
    expect(pillTextStyle(renderer.root)).toEqual(
      expect.arrayContaining([{ color: GlobalStyle.color.streak.blue }])
    );
  });

  it('renders pill + 2 glow rings with orange flame color at tier 2', () => {
    const tier = resolveStreakTier(7);
    expect(tier.tier).toBe(2);
    act(() => {
      renderer = render({ multiplier: 1, points: 1, streakTier: tier });
    });
    expect(countAnimated(renderer.root, 'guess.success.streak.pill')).toBe(1);
    expect(countAnimated(renderer.root, 'guess.success.streak.ring')).toBe(2);
    expect(pillTextStyle(renderer.root)).toEqual(
      expect.arrayContaining([{ color: GlobalStyle.color.streak.orange }])
    );
  });

  it('renders pill + 2 glow rings with red flame color at tier 3 (v1 fallback)', () => {
    const tier = resolveStreakTier(12);
    expect(tier.tier).toBe(3);
    act(() => {
      renderer = render({ multiplier: 1, points: 1, streakTier: tier });
    });
    expect(countAnimated(renderer.root, 'guess.success.streak.pill')).toBe(1);
    expect(countAnimated(renderer.root, 'guess.success.streak.ring')).toBe(2);
    expect(pillTextStyle(renderer.root)).toEqual(
      expect.arrayContaining([{ color: GlobalStyle.color.streak.red }])
    );
  });

  it('renders pill with purple flame color at tier 4', () => {
    const tier = resolveStreakTier(20);
    expect(tier.tier).toBe(4);
    act(() => {
      renderer = render({ multiplier: 1, points: 1, streakTier: tier });
    });
    expect(countAnimated(renderer.root, 'guess.success.streak.pill')).toBe(1);
    expect(pillTextStyle(renderer.root)).toEqual(
      expect.arrayContaining([{ color: GlobalStyle.color.streak.purple }])
    );
  });

  it('renders pill with white flame color at tier 5', () => {
    const tier = resolveStreakTier(50);
    expect(tier.tier).toBe(5);
    act(() => {
      renderer = render({ multiplier: 1, points: 1, streakTier: tier });
    });
    expect(countAnimated(renderer.root, 'guess.success.streak.pill')).toBe(1);
    expect(pillTextStyle(renderer.root)).toEqual(
      expect.arrayContaining([{ color: GlobalStyle.color.streak.white }])
    );
  });

  it('renders the speed ×N pill independently of the streak tier', () => {
    const tier = resolveStreakTier(7);
    act(() => {
      renderer = render({ multiplier: 3, points: 5, streakTier: tier });
    });
    expect(findByTestID(renderer.root, 'guess.success.speed-badge').length).toBeGreaterThan(0);
    const texts = findAllTextChildren(renderer.root);
    expect(texts).toContain('×3');
    expect(countAnimated(renderer.root, 'guess.success.streak.pill')).toBe(1);
  });

  it('exposes the neutral tier as NEUTRAL_TIER constant for callers', () => {
    expect(NEUTRAL_TIER.tier).toBe(0);
  });
});
