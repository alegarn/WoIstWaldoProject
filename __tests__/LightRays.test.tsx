import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

import LightRays from '../components/Guess/celebration/LightRays';

type LightRaysProps = React.ComponentProps<typeof LightRays>;

const RAY_TEST_ID = 'guess.success.celebration.ray';
const SQUARE_TEST_ID = 'guess.success.celebration.rays';
const COLOR = '#FF6A00';

function findByTestID(root: ReactTestInstance, testID: string): ReactTestInstance[] {
  return root.findAll(node => node.props && node.props.testID === testID);
}

function countAnimated(root: ReactTestInstance, testID: string): number {
  return Math.floor(findByTestID(root, testID).length / 3);
}

function outerRayNodes(root: ReactTestInstance): ReactTestInstance[] {
  return findByTestID(root, RAY_TEST_ID).filter((_, i) => i % 3 === 0);
}

const PROPS: LightRaysProps = {
  visible: true,
  color: COLOR,
  count: 4,
  size: 800,
  durationMs: 2000,
};

function render(overrides: Partial<LightRaysProps>): ReactTestRenderer {
  return create(<LightRays {...PROPS} {...overrides} />);
}

describe('LightRays', () => {
  let renderer: ReactTestRenderer | null;
  afterEach(() => {
    if (renderer) {
      const r = renderer;
      act(() => { r.unmount(); });
    }
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

  it('renders exactly count rays when visible and count > 0', () => {
    act(() => {
      renderer = render({ count: 4 });
    });
    expect(countAnimated(renderer!.root, RAY_TEST_ID)).toBe(4);
  });

  it('scales ray count with the count prop', () => {
    act(() => {
      renderer = render({ count: 6 });
    });
    expect(countAnimated(renderer!.root, RAY_TEST_ID)).toBe(6);
  });

  it('exposes the guess.success.celebration.rays testID on the square root', () => {
    act(() => {
      renderer = render({ count: 4 });
    });
    expect(countAnimated(renderer!.root, SQUARE_TEST_ID)).toBe(1);
  });

  it('each ray transform contains a rotate (deg output range, z-axis)', () => {
    act(() => {
      renderer = render({ count: 4 });
    });
    const rays = outerRayNodes(renderer!.root);
    expect(rays.length).toBe(4);
    rays.forEach(node => {
      const flat = StyleSheet.flatten(node.props.style);
      expect(Array.isArray(flat.transform)).toBe(true);
      const rotate = flat.transform.find((t: { rotate?: unknown }) => t && typeof t.rotate === 'string');
      expect(rotate).toBeDefined();
      expect(rotate!.rotate).toMatch(/deg$/);
    });
  });

  it('fans rays radially via i*(360/count)deg static rotation', () => {
    const count = 4;
    act(() => {
      renderer = render({ count });
    });
    const rays = outerRayNodes(renderer!.root);
    const step = 360 / count;
    rays.forEach((node, i) => {
      const flat = StyleSheet.flatten(node.props.style);
      const rotate = flat.transform.find((t: { rotate?: unknown }) => t && typeof t.rotate === 'string');
      expect(rotate!.rotate).toBe(`${i * step}deg`);
    });
  });

  it('uses the color prop as the static backgroundColor of every ray', () => {
    act(() => {
      renderer = render({ color: '#123456', count: 4 });
    });
    const rays = outerRayNodes(renderer!.root);
    expect(rays.length).toBe(4);
    rays.forEach(node => {
      const flat = StyleSheet.flatten(node.props.style);
      expect(flat.backgroundColor).toBe('#123456');
    });
  });

  it('sizes the square root to size x size', () => {
    act(() => {
      renderer = render({ size: 1024, count: 4 });
    });
    const squares = findByTestID(renderer!.root, SQUARE_TEST_ID).filter((_, i) => i % 3 === 0);
    expect(squares.length).toBe(1);
    const flat = StyleSheet.flatten(squares[0].props.style);
    expect(flat.width).toBe(1024);
    expect(flat.height).toBe(1024);
  });

  it('starts and stops the rotation loop without throwing on mount/unmount', () => {
    expect(() => {
      act(() => {
        renderer = render({ count: 4 });
      });
      act(() => {
        renderer!.unmount();
      });
    }).not.toThrow();
    renderer = null;
  });

  it('does not throw under the jest Animated mock when durationMs is short', () => {
    expect(() => {
      act(() => {
        renderer = render({ count: 4, durationMs: 400 });
      });
    }).not.toThrow();
  });
});
