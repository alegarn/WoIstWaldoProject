import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

import ShockwaveRing from '../components/Guess/celebration/ShockwaveRing';

const TEST_ID = 'guess.success.celebration.shockwave';
const COLOR = '#FF6A00';

function findByTestID(root: ReactTestInstance, testID: string): ReactTestInstance[] {
  return root.findAll(node => node.props && node.props.testID === testID);
}

function render(props: Partial<React.ComponentProps<typeof ShockwaveRing>> = {}): ReactTestRenderer {
  return create(
    <ShockwaveRing
      visible={true}
      color={COLOR}
      width={400}
      height={800}
      {...props}
    />
  );
}

describe('ShockwaveRing', () => {
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

  it('renders null when width is falsy', () => {
    act(() => {
      renderer = render({ width: 0 });
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  it('renders null when height is falsy', () => {
    act(() => {
      renderer = render({ height: 0 });
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  it('renders the shockwave ring when visible and dimensions are present', () => {
    act(() => {
      renderer = render({ visible: true, width: 400, height: 800 });
    });
    expect(findByTestID(renderer!.root, TEST_ID).length).toBeGreaterThan(0);
  });

  it('exposes the guess.success.celebration.shockwave testID', () => {
    act(() => {
      renderer = render();
    });
    expect(findByTestID(renderer!.root, TEST_ID).length).toBeGreaterThan(0);
  });

  it('sizes the ring diameter to Math.max(width, height)', () => {
    act(() => {
      renderer = render({ width: 400, height: 800 });
    });
    const nodes = findByTestID(renderer!.root, TEST_ID);
    const flat = StyleSheet.flatten(nodes[0].props.style);
    const expected = Math.max(400, 800);
    expect(flat.width).toBe(expected);
    expect(flat.height).toBe(expected);
  });

  it('uses the larger dimension when width > height', () => {
    act(() => {
      renderer = render({ width: 1024, height: 768 });
    });
    const nodes = findByTestID(renderer!.root, TEST_ID);
    const flat = StyleSheet.flatten(nodes[0].props.style);
    expect(flat.width).toBe(1024);
    expect(flat.height).toBe(1024);
  });

  it('keeps borderColor static (never animated) and derived from color prop', () => {
    act(() => {
      renderer = render({ color: '#123456' });
    });
    const nodes = findByTestID(renderer!.root, TEST_ID);
    const flat = StyleSheet.flatten(nodes[0].props.style);
    expect(flat.borderColor).toBe('#123456');
  });

  it('keeps borderWidth static and small (2-3px)', () => {
    act(() => {
      renderer = render();
    });
    const nodes = findByTestID(renderer!.root, TEST_ID);
    const flat = StyleSheet.flatten(nodes[0].props.style);
    expect(flat.borderWidth).toBeGreaterThanOrEqual(2);
    expect(flat.borderWidth).toBeLessThanOrEqual(3);
  });

  it('sets borderRadius to half the diameter', () => {
    act(() => {
      renderer = render({ width: 400, height: 800 });
    });
    const nodes = findByTestID(renderer!.root, TEST_ID);
    const flat = StyleSheet.flatten(nodes[0].props.style);
    const diameter = Math.max(400, 800);
    expect(flat.borderRadius).toBe(diameter / 2);
  });

  it('does not throw on mount and unmount', () => {
    expect(() => {
      act(() => {
        renderer = render();
      });
      act(() => {
        renderer!.unmount();
      });
    }).not.toThrow();
    renderer = null;
  });
});
