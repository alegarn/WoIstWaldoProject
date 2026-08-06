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

  function buildAnimation(value, config) {
    return {
      start: (callback) => {
        if (typeof config?.toValue !== 'undefined' && value?.setValue) {
          value.setValue(config.toValue);
        }
        callback?.();
      },
    };
  }

  return {
    Animated: {
      Value: MockAnimatedValue,
      timing: jest.fn((value, config) => buildAnimation(value, config)),
      parallel: jest.fn((animations) => ({
        start: (callback) => {
          animations.forEach((animation) => animation?.start?.());
          callback?.();
        },
      })),
      View: ({ children, ...props }) => React.createElement('AnimatedView', props, children),
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 320, height: 640, scale: 1, fontScale: 1 })),
    },
    Pressable: ({ children, ...props }) => React.createElement('Pressable', props, children),
    StyleSheet: {
      absoluteFill: {},
      absoluteFillObject: {},
      create: (styles) => styles,
    },
    Text: ({ children, ...props }) => React.createElement('Text', props, children),
    View: ({ children, ...props }) => React.createElement('View', props, children),
  };
});

jest.mock('../components/Guess/SwipeHaloHint', () => {
  const React = require('react');
  return function MockSwipeHaloHint(props) {
    return React.createElement('SwipeHaloHint', props);
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import GuessExitSwipeMenu from '../components/Guess/GuessExitSwipeMenu';

describe('GuessExitSwipeMenu (controlled)', () => {
  function renderMenu(props = {}) {
    let renderer;
    act(() => {
      renderer = create(
        <GuessExitSwipeMenu
          onHome={jest.fn()}
          onClose={jest.fn()}
          {...props}
        />
      );
    });
    return renderer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides the panel, scrim, close, and Home when isOpen=false', () => {
    const renderer = renderMenu({ isOpen: false });

    expect(() => renderer.root.findByProps({ testID: 'guess.exit.panel' })).toThrow();
    expect(() => renderer.root.findByProps({ testID: 'guess.exit.scrim' })).toThrow();
    expect(() => renderer.root.findByProps({ testID: 'guess.exit.close' })).toThrow();
    expect(() => renderer.root.findByProps({ testID: 'guess.exit.home' })).toThrow();
  });

  it('does NOT render the legacy edge strip', () => {
    const renderer = renderMenu({ isOpen: false });
    expect(() => renderer.root.findByProps({ testID: 'guess.exit.edge' })).toThrow();
  });

  it('renders scrim + panel + close + Home when isOpen=true', () => {
    const renderer = renderMenu({ isOpen: true });

    expect(renderer.root.findByProps({ testID: 'guess.exit.panel' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'guess.exit.scrim' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'guess.exit.close' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'guess.exit.home' })).toBeTruthy();
  });

  it('calls onClose when the scrim is tapped', () => {
    const onClose = jest.fn();
    const renderer = renderMenu({ isOpen: true, onClose });

    act(() => {
      renderer.root.findByProps({ testID: 'guess.exit.scrim' }).props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = jest.fn();
    const renderer = renderMenu({ isOpen: true, onClose });

    act(() => {
      renderer.root.findByProps({ testID: 'guess.exit.close' }).props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onHome exactly once when the Home button is pressed', () => {
    const onHome = jest.fn();
    const renderer = renderMenu({ isOpen: true, onHome });

    act(() => {
      renderer.root.findByProps({ testID: 'guess.exit.home' }).props.onPress();
    });

    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('fires onInteract when isOpen flips to true (hint dismissal)', () => {
    const onInteract = jest.fn();
    let renderer;
    act(() => {
      renderer = create(
        <GuessExitSwipeMenu
          isOpen={false}
          onHome={jest.fn()}
          onClose={jest.fn()}
          onInteract={onInteract}
        />
      );
    });
    expect(onInteract).not.toHaveBeenCalled();

    act(() => {
      renderer.update(
        <GuessExitSwipeMenu
          isOpen={true}
          onHome={jest.fn()}
          onClose={jest.fn()}
          onInteract={onInteract}
        />
      );
    });

    expect(onInteract).toHaveBeenCalledTimes(1);
  });
});
