jest.mock('react-native', () => {
  const actualRN = jest.requireActual('react-native');
  const noopAnimation = { start: () => {}, stop: () => {}, reset: () => {} };
  actualRN.Animated.timing = () => noopAnimation;
  return actualRN;
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import SpeedRing from '../components/Guess/SpeedRing';

describe('SpeedRing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders a container with the default testID when size and durationMs are positive', async () => {
    let renderer;

    await act(async () => {
      renderer = create(<SpeedRing size={64} />);
    });

    expect(renderer.root.findByProps({ testID: 'guess.speed-ring' })).toBeTruthy();
  });

  it('returns null when size <= 0', async () => {
    let renderer;

    await act(async () => {
      renderer = create(<SpeedRing size={0} durationMs={1000} />);
    });

    expect(renderer.toJSON()).toBeNull();
  });

  it('returns null when durationMs <= 0', async () => {
    let renderer;

    await act(async () => {
      renderer = create(<SpeedRing size={64} durationMs={0} />);
    });

    expect(renderer.toJSON()).toBeNull();
  });

  it('forwards a custom testID', async () => {
    let renderer;

    await act(async () => {
      renderer = create(<SpeedRing size={64} testID="custom.ring" />);
    });

    expect(renderer.root.findByProps({ testID: 'custom.ring' })).toBeTruthy();
  });

  it('does not throw with default props and unmounts cleanly', async () => {
    let renderer;

    await act(async () => {
      renderer = create(<SpeedRing size={32} />);
    });

    await act(async () => {
      renderer.unmount();
    });
  });
});
