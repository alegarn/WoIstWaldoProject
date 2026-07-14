import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
}));

import SuccessOverlay from '../components/Guess/SuccessOverlay';

function findByTestID(root, testID) {
  return root.findAll(node => node.props && node.props.testID === testID);
}

function findAllTextChildren(root) {
  return root.findAllByType(Text).map(node => node.props.children);
}

describe('SuccessOverlay', () => {
  let renderer;
  afterEach(() => {
    if (renderer) act(() => { renderer.unmount(); });
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
});
