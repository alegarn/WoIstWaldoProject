let mockCapturedPanResponders;

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
    PanResponder: {
      create: jest.fn((config) => {
        mockCapturedPanResponders.push(config);
        return { panHandlers: {} };
      }),
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

import React from 'react';
import { act, create } from 'react-test-renderer';

import GuessExitSwipeMenu from '../components/Guess/GuessExitSwipeMenu';

function edgePanResponder() {
  return mockCapturedPanResponders[0];
}

function scrimPanResponder() {
  return mockCapturedPanResponders[1];
}

describe('GuessExitSwipeMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCapturedPanResponders = [];
  });

  async function renderMenu(props = {}) {
    let renderer;

    await act(async () => {
      renderer = create(<GuessExitSwipeMenu onHome={jest.fn()} {...props} />);
    });

    return renderer;
  }

  function openViaEdgeSwipe() {
    edgePanResponder().onPanResponderRelease(null, { x0: 20, dx: 50, dy: 0 });
  }

  it('hides the panel and Home button by default', async () => {
    const renderer = await renderMenu();

    expect(renderer.root.findByProps({ testID: 'guess.exit.edge' })).toBeTruthy();
    expect(() => renderer.root.findByProps({ testID: 'guess.exit.panel' })).toThrow();
    expect(() => renderer.root.findByProps({ testID: 'guess.exit.home' })).toThrow();
  });

  it('opens the panel on a valid left-edge swipe-right', async () => {
    const renderer = await renderMenu();

    expect(edgePanResponder().onStartShouldSetPanResponder(null, { x0: 20 })).toBe(true);

    await act(async () => {
      openViaEdgeSwipe();
    });

    expect(renderer.root.findByProps({ testID: 'guess.exit.panel' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'guess.exit.home' })).toBeTruthy();
  });

  it('does not open on a non-edge gesture (x0 > EDGE_WIDTH)', async () => {
    const renderer = await renderMenu();

    expect(edgePanResponder().onStartShouldSetPanResponder(null, { x0: 50 })).toBe(false);
    expect(() => renderer.root.findByProps({ testID: 'guess.exit.panel' })).toThrow();
  });

  it('does not open on a rightward swipe just under the threshold', async () => {
    const renderer = await renderMenu();

    expect(edgePanResponder().onStartShouldSetPanResponder(null, { x0: 20 })).toBe(true);

    await act(async () => {
      edgePanResponder().onPanResponderRelease(null, { x0: 20, dx: 39, dy: 0 });
    });

    expect(() => renderer.root.findByProps({ testID: 'guess.exit.panel' })).toThrow();
  });

  it('does not open on a mostly-vertical gesture even in the edge zone', async () => {
    const renderer = await renderMenu();

    expect(edgePanResponder().onStartShouldSetPanResponder(null, { x0: 20 })).toBe(true);

    await act(async () => {
      edgePanResponder().onPanResponderRelease(null, { x0: 20, dx: 50, dy: 80 });
    });

    expect(() => renderer.root.findByProps({ testID: 'guess.exit.panel' })).toThrow();
  });

  it('closes the panel on a swipe-left while open', async () => {
    const renderer = await renderMenu();

    await act(async () => {
      openViaEdgeSwipe();
    });

    await act(async () => {
      scrimPanResponder().onPanResponderRelease(null, { dx: -50, dy: 0 });
    });

    expect(() => renderer.root.findByProps({ testID: 'guess.exit.panel' })).toThrow();
  });

  it('does not close on a leftward swipe just under the close threshold', async () => {
    const renderer = await renderMenu();

    await act(async () => {
      openViaEdgeSwipe();
    });

    await act(async () => {
      scrimPanResponder().onPanResponderRelease(null, { dx: -39, dy: 0 });
    });

    expect(renderer.root.findByProps({ testID: 'guess.exit.panel' })).toBeTruthy();
  });

  it('closes the panel when the scrim is tapped', async () => {
    const renderer = await renderMenu();

    await act(async () => {
      openViaEdgeSwipe();
    });

    await act(async () => {
      scrimPanResponder().onPanResponderRelease(null, { dx: 0, dy: 0 });
    });

    expect(() => renderer.root.findByProps({ testID: 'guess.exit.panel' })).toThrow();
  });

  it('closes the panel when the Close button is pressed', async () => {
    const renderer = await renderMenu();

    await act(async () => {
      openViaEdgeSwipe();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess.exit.close' }).props.onPress();
    });

    expect(() => renderer.root.findByProps({ testID: 'guess.exit.panel' })).toThrow();
  });

  it('calls onHome exactly once when the Home action is pressed', async () => {
    const onHome = jest.fn();
    const renderer = await renderMenu({ onHome });

    await act(async () => {
      openViaEdgeSwipe();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess.exit.home' }).props.onPress();
    });

    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
