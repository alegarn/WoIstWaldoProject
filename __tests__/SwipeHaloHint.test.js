jest.mock('react-native', () => {
  const actualRN = jest.requireActual('react-native');
  const noopAnimation = { start: () => {}, stop: () => {}, reset: () => {} };
  actualRN.Animated.loop = () => noopAnimation;
  actualRN.Animated.parallel = () => noopAnimation;
  actualRN.Animated.sequence = () => noopAnimation;
  actualRN.Animated.timing = () => noopAnimation;
  actualRN.Animated.delay = () => noopAnimation;
  return actualRN;
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import SwipeHaloHint from '../components/Guess/SwipeHaloHint';

describe('SwipeHaloHint', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders nothing when visible is false', async () => {
    let renderer;

    await act(async () => {
      renderer = create(<SwipeHaloHint visible={false} />);
    });

    expect(renderer.root.findAllByProps({ testID: 'guess.hint.swipe-halo' })).toHaveLength(0);
    expect(renderer.toJSON()).toBeNull();
  });

  it('renders a non-interactive overlay with the swipe-halo testID when visible', async () => {
    let renderer;

    await act(async () => {
      renderer = create(<SwipeHaloHint visible={true} />);
    });

    const overlay = renderer.root.findByProps({ testID: 'guess.hint.swipe-halo' });
    expect(overlay.props.pointerEvents).toBe('none');
  });

  it('starts the animated loop without errors when visible', async () => {
    let renderer;

    await act(async () => {
      renderer = create(<SwipeHaloHint visible={true} />);
    });

    expect(renderer.root.findByProps({ testID: 'guess.hint.swipe-halo' })).toBeTruthy();

    await act(async () => {
      renderer.unmount();
    });
  });
});
