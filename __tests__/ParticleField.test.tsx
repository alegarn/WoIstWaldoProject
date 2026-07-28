import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

import ParticleField, {
  pickDuration,
  pickDelay,
  seedParticle,
} from '../components/Guess/celebration/ParticleField';
import type { ParticleMode } from '../constants/streakCelebration';

const TEST_ID = 'guess.success.celebration.particle';

type AnyProps = Record<string, unknown>;

function findByTestID(root: ReactTestInstance, testID: string): ReactTestInstance[] {
  return root.findAll(node => Boolean(node.props && node.props.testID === testID));
}

// Animated.View with a testID appears as 3 nodes (Animated wrapper + internal Views).
// Count distinct particles by collapsing the triplet.
function countAnimated(root: ReactTestInstance, testID: string): number {
  return Math.floor(findByTestID(root, testID).length / 3);
}

type ParticleFieldProps = {
  visible: boolean;
  count: number;
  color: string;
  mode: ParticleMode;
  width: number;
  height: number;
  durationMs: number;
};

const PROPS: ParticleFieldProps = {
  visible: true,
  count: 3,
  color: '#FF6A00',
  mode: 'ember',
  width: 360,
  height: 640,
  durationMs: 1200,
};

function render(overrides: Partial<ParticleFieldProps>): ReactTestRenderer {
  return create(<ParticleField {...PROPS} {...overrides} />);
}

describe('ParticleField', () => {
  let renderer: ReactTestRenderer | null;
  afterEach(() => {
    if (renderer) act(() => { renderer!.unmount(); });
    renderer = null;
  });

  it('renders null when visible is false', () => {
    act(() => {
      renderer = render({ visible: false });
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  it('renders null when count is 0', () => {
    act(() => {
      renderer = render({ count: 0 });
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  it('renders exactly count particles when visible and count > 0', () => {
    act(() => {
      renderer = render({ count: 3 });
    });
    expect(countAnimated(renderer!.root, TEST_ID)).toBe(3);
  });

  it('scales particle count with the count prop', () => {
    act(() => {
      renderer = render({ count: 5 });
    });
    expect(countAnimated(renderer!.root, TEST_ID)).toBe(5);
  });

  it('uses the color prop as the static backgroundColor of every particle', () => {
    act(() => {
      renderer = render({ color: '#123456', count: 3 });
    });
    const nodes = findByTestID(renderer!.root, TEST_ID);
    expect(nodes.length).toBeGreaterThan(0);
    // Every 3rd node (index 0, 3, 6, ...) is the outer Animated.View.
    const outerNodes = nodes.filter((_, i) => i % 3 === 0);
    outerNodes.forEach(node => {
      const flat = StyleSheet.flatten(node.props.style as Parameters<typeof StyleSheet.flatten>[0]) as { backgroundColor?: string };
      expect(flat.backgroundColor).toBe('#123456');
    });
  });

  it('does not throw on mount and unmount under the default Animated mock', () => {
    expect(() => {
      act(() => {
        renderer = render({});
      });
      act(() => {
        renderer!.unmount();
      });
    }).not.toThrow();
    renderer = null;
  });

  it('does not throw when mode is confetti', () => {
    expect(() => {
      act(() => {
        renderer = render({ mode: 'confetti' });
      });
    }).not.toThrow();
  });

  it('does not throw when mode is rain', () => {
    expect(() => {
      act(() => {
        renderer = render({ mode: 'rain' });
      });
    }).not.toThrow();
  });

  describe('duration bounds (delay + dur <= durationMs)', () => {
    it('pickDuration stays within [MIN, durationMs*0.6] and never exceeds durationMs', () => {
      const durationMs = 1200;
      const ceil = Math.floor(durationMs * 0.6);
      for (let i = 0; i < 100; i += 1) {
        const d = pickDuration(durationMs);
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(ceil);
        expect(d).toBeLessThanOrEqual(durationMs);
      }
    });

    it('pickDuration never exceeds durationMs even for small durationMs', () => {
      for (let i = 0; i < 50; i += 1) {
        const d = pickDuration(600);
        expect(d).toBeLessThanOrEqual(600);
      }
    });

    it('pickDelay satisfies delay + dur <= durationMs across many rolls', () => {
      const durationMs = 1000;
      for (let i = 0; i < 100; i += 1) {
        const dur = pickDuration(durationMs);
        const delay = pickDelay(durationMs, dur);
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay + dur).toBeLessThanOrEqual(durationMs);
      }
    });

    it('seedParticle honors delay + dur <= durationMs for ember mode', () => {
      for (let i = 0; i < 50; i += 1) {
        const p = seedParticle('ember', 360, 640, 1400);
        expect(p.delay + p.dur).toBeLessThanOrEqual(1400);
        expect(p.size).toBeGreaterThanOrEqual(4);
        expect(p.size).toBeLessThanOrEqual(10);
      }
    });

    it('seedParticle honors delay + dur <= durationMs for confetti and rain modes', () => {
      for (let i = 0; i < 50; i += 1) {
        const c = seedParticle('confetti', 360, 640, 2200);
        const r = seedParticle('rain', 360, 640, 2600);
        expect(c.delay + c.dur).toBeLessThanOrEqual(2200);
        expect(r.delay + r.dur).toBeLessThanOrEqual(2600);
      }
    });

    it('seedParticle ember produces a rising drift (dy < 0)', () => {
      for (let i = 0; i < 20; i += 1) {
        const p = seedParticle('ember', 360, 640, 1400);
        expect(p.dy).toBeLessThan(0);
      }
    });

    it('seedParticle rain produces a falling drift (dy > 0)', () => {
      for (let i = 0; i < 20; i += 1) {
        const p = seedParticle('rain', 360, 640, 2600);
        expect(p.dy).toBeGreaterThan(0);
      }
    });
  });
});
