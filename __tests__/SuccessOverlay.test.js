jest.mock('react-native', () => {
  const React = require('react');

  class MockAnimatedValue {
    constructor(value) {
      this._value = value;
    }

    setValue = (nextValue) => {
      this._value = nextValue;
    };
  }

  return {
    Animated: {
      Value: MockAnimatedValue,
      View: ({ children, ...props }) => React.createElement('AnimatedView', props, children),
      spring: jest.fn(),
      timing: jest.fn(),
      sequence: jest.fn(),
    },
    StyleSheet: {
      absoluteFill: {},
      absoluteFillObject: {},
      create: (styles) => styles,
    },
    View: ({ children, ...props }) => React.createElement('View', props, children),
    Text: ({ children, ...props }) => React.createElement('Text', props, children),
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';
import { Animated } from 'react-native';

import SuccessOverlay from '../components/Guess/SuccessOverlay';

function makeAnim(duration) {
  let id = null;
  let stopped = false;
  return {
    start(cb) {
      id = setTimeout(() => {
        id = null;
        if (!stopped && typeof cb === 'function') cb({ finished: true });
      }, duration);
    },
    stop() {
      stopped = true;
      if (id !== null) {
        clearTimeout(id);
        id = null;
      }
    },
  };
}

function setupAnimatedMocks() {
  Animated.spring.mockImplementation(() => makeAnim(0));
  Animated.timing.mockImplementation((_value, config) => makeAnim(config?.duration ?? 0));
  Animated.sequence.mockImplementation((anims) => ({
    start(cb) {
      let i = 0;
      const step = () => {
        if (i >= anims.length) {
          if (typeof cb === 'function') cb({ finished: true });
          return;
        }
        anims[i].start(({ finished }) => {
          if (!finished) {
            if (typeof cb === 'function') cb({ finished: false });
            return;
          }
          step();
        });
        i += 1;
      };
      step();
    },
    stop() {
      anims.forEach((a) => {
        if (a && typeof a.stop === 'function') a.stop();
      });
    },
  }));
}

function findByTestID(root, testID) {
  try {
    return root.findByProps({ testID });
  } catch {
    return null;
  }
}

describe('SuccessOverlay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    setupAnimatedMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when visible is false', () => {
    let renderer;
    act(() => {
      renderer = create(<SuccessOverlay visible={false} onDone={jest.fn()} />);
    });

    expect(findByTestID(renderer.root, 'guess.success.overlay')).toBeNull();
  });

  it('renders the overlay node when visible is true', () => {
    let renderer;
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={jest.fn()} />);
    });

    expect(findByTestID(renderer.root, 'guess.success.overlay')).not.toBeNull();
  });

  it('invokes onDone exactly once after the animation completes', () => {
    const onDone = jest.fn();
    let renderer;
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={onDone} />);
    });

    expect(onDone).not.toHaveBeenCalled();

    act(() => {
      jest.runAllTimers();
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('fires onDone once per visible cycle and never for stale cycles', () => {
    const onDone = jest.fn();
    let renderer;
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={onDone} />);
    });
    act(() => {
      jest.runAllTimers();
    });

    expect(onDone).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.update(<SuccessOverlay visible={false} onDone={onDone} />);
    });
    act(() => {
      jest.runAllTimers();
    });

    expect(onDone).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.update(<SuccessOverlay visible={true} onDone={onDone} />);
    });
    act(() => {
      jest.runAllTimers();
    });

    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it('invokes the latest onDone identity (no stale closure)', () => {
    const first = jest.fn();
    const second = jest.fn();
    let renderer;
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={first} />);
    });

    act(() => {
      renderer.update(<SuccessOverlay visible={true} onDone={second} />);
    });

    act(() => {
      jest.runAllTimers();
    });

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('does not fire onDone after unmount mid-animation', () => {
    const onDone = jest.fn();
    let renderer;
    act(() => {
      renderer = create(<SuccessOverlay visible={true} onDone={onDone} />);
    });

    act(() => {
      renderer.unmount();
    });
    act(() => {
      jest.runAllTimers();
    });

    expect(onDone).not.toHaveBeenCalled();
  });
});
