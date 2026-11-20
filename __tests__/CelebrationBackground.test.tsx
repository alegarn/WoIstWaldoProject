import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

import CelebrationBackground, { type CelebrationBackgroundProps } from '../components/Guess/celebration/CelebrationBackground';

const TEST_ID = 'guess.success.celebration.bg';
const COLOR = '#FF6A00';

function findByTestID(root: ReactTestInstance, testID: string): ReactTestInstance[] {
  return root.findAll(node => node.props && node.props.testID === testID);
}

function bgNode(root: ReactTestInstance): ReactTestInstance | null {
  const matches = findByTestID(root, TEST_ID);
  return matches[0] || null;
}

type PartialProps = Partial<CelebrationBackgroundProps>;

function render(props?: PartialProps): ReactTestRenderer {
  return create(
    <CelebrationBackground
      visible={true}
      color={COLOR}
      opacity={0.4}
      durationMs={600}
      {...props}
    />
  );
}

describe('CelebrationBackground', () => {
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

  it('renders null when peakOpacity is 0', () => {
    act(() => {
      renderer = render({ opacity: 0 });
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  it('renders when visible is true and peakOpacity > 0', () => {
    act(() => {
      renderer = render({ visible: true, opacity: 0.5 });
    });
    expect(findByTestID(renderer!.root, TEST_ID).length).toBeGreaterThan(0);
  });

  it('exposes the guess.success.celebration.bg testID', () => {
    act(() => {
      renderer = render();
    });
    expect(findByTestID(renderer!.root, TEST_ID).length).toBeGreaterThan(0);
  });

  it('uses the color prop as static backgroundColor', () => {
    act(() => {
      renderer = render({ color: '#123456' });
    });
    const node = bgNode(renderer!.root);
    expect(node).not.toBeNull();
    const flat = StyleSheet.flatten(node!.props.style);
    expect(flat.backgroundColor).toBe('#123456');
  });

  it('does not throw on mount and unmount under the default Animated mock', () => {
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
