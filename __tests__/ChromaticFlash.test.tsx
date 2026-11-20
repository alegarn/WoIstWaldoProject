import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

import ChromaticFlash from '../components/Guess/celebration/ChromaticFlash';

const TEST_ID = 'guess.success.celebration.flash';

type FlashProps = { visible?: boolean };

function findByTestID(root: ReactTestInstance, testID: string): ReactTestInstance[] {
  return root.findAll(node => typeof node === 'object' && node.props && node.props.testID === testID);
}

function flashNode(root: ReactTestInstance): ReactTestInstance | null {
  const matches = findByTestID(root, TEST_ID);
  return matches[0] || null;
}

function render(props: FlashProps = {}): ReactTestRenderer {
  return create(<ChromaticFlash visible={true} {...props} />);
}

describe('ChromaticFlash', () => {
  let renderer: ReactTestRenderer | null;
  afterEach(() => {
    const r = renderer;
    if (r) act(() => { r.unmount(); });
    renderer = null;
  });

  it('renders when visible is true', () => {
    act(() => {
      renderer = render({ visible: true });
    });
    expect(findByTestID(renderer!.root, TEST_ID).length).toBeGreaterThan(0);
  });

  it('renders null when visible is false', () => {
    act(() => {
      renderer = render({ visible: false });
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  it('uses static #FFFFFF backgroundColor on the flash view', () => {
    act(() => {
      renderer = render();
    });
    const node = flashNode(renderer!.root);
    expect(node).not.toBeNull();
    const flat = StyleSheet.flatten(node!.props.style);
    expect(flat.backgroundColor).toBe('#FFFFFF');
  });

  it('exposes the guess.success.celebration.flash testID', () => {
    act(() => {
      renderer = render();
    });
    expect(findByTestID(renderer!.root, TEST_ID).length).toBeGreaterThan(0);
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
