const mockEnigmaOverlay = jest.fn(() => null);
const mockIconButton = jest.fn(() => null);
const mockSpeedRing = jest.fn(() => null);
const mockCenteredModal = jest.fn(() => null);

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
      loop: jest.fn((anim) => ({
        start: () => {},
        stop: () => {},
        reset: () => {},
      })),
      parallel: jest.fn((animations) => ({
        start: (cb) => {
          animations.forEach((a) => a?.start?.());
          cb?.();
        },
      })),
      sequence: jest.fn((animations) => ({
        start: (cb) => {
          animations.forEach((a) => a?.start?.());
          cb?.();
        },
      })),
      View: ({ children, ...props }) => React.createElement('AnimatedView', props, children),
    },
    ImageBackground: ({ children, ...props }) =>
      React.createElement('ImageBackground', props, children),
    Pressable: ({ children, ...props }) => React.createElement('Pressable', props, children),
    StyleSheet: {
      absoluteFill: {},
      absoluteFillObject: {},
      create: (styles) => styles,
    },
    View: ({ children, ...props }) => React.createElement('View', props, children),
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual('react');
  return {
    Gesture: {
      Pan: () => makeChainable(),
      Race: (...gs) => ({ __type: 'race', gestures: gs }),
      Exclusive: (...gs) => ({ __type: 'exclusive', gestures: gs }),
      Simultaneous: (...gs) => ({ __type: 'sim', gestures: gs }),
    },
    GestureDetector: ({ children, ...props }) =>
      React.createElement('GestureDetector', props, children),
    GestureHandlerRootView: ({ children, ...props }) =>
      React.createElement('GestureHandlerRootView', props, children),
  };

  function makeChainable() {
    const obj = function ChainableGesture() {};
    const proxy = new Proxy(obj, {
      get(_t, prop) {
        if (prop === 'then') return undefined;
        return (..._args) => proxy;
      },
    });
    return proxy;
  }
});

jest.mock('../components/Picture/Descriptions/EnigmaOverlay', () => {
  return function MockEnigmaOverlay(props) {
    mockEnigmaOverlay(props);
    return null;
  };
});

jest.mock('../components/UI/IconButton', () => {
  return function MockIconButton(props) {
    mockIconButton(props);
    return null;
  };
});

jest.mock('../components/UI/CenteredModal', () => {
  const React = require('react');
  return function MockCenteredModal(props) {
    mockCenteredModal(props);
    return React.createElement('View', { testID: props.testIDPrefix });
  };
});

jest.mock('../components/Guess/SpeedRing', () => {
  return function MockSpeedRing(props) {
    mockSpeedRing(props);
    return null;
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import ShowPicture from '../components/Picture/ShowPicture';

function findByTestID(renderer, testID) {
  return renderer.root.findByProps({ testID });
}

function findAllByType(renderer, type) {
  return renderer.root.findAllByType(type);
}

describe('ShowPicture', () => {
  const baseProps = {
    uri: 'file:///pic.jpg',
    guess: true,
    description: 'Find it',
    touchLocation: { x: '0.5', y: '0.5' },
    handlePress: jest.fn(),
    handleLongPress: jest.fn(),
    target: {
      targetSize: 16,
      dragSize: 32,
      dragStyle: { position: 'absolute', left: 100, top: 50, width: 32, height: 32 },
    },
    handleIconPress: jest.fn(),
    showModal: false,
    handleConfirm: jest.fn(),
    onCancel: jest.fn(),
    imageDimensionStyle: { width: 200, height: 400 },
    targetGesture: { __id: 'target-pan-gesture' },
    defaultOpen: false,
    onDescriptionClosed: jest.fn(),
    onEdgeSwipe: jest.fn(),
  };

  function renderShowPicture(overrides = {}) {
    let renderer;
    act(() => {
      renderer = create(<ShowPicture {...baseProps} {...overrides} />);
    });
    return renderer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wraps the picture surface in a GestureDetector carrying the Race(edgeSwipe, handleSwipe) surface gesture', () => {
    const renderer = renderShowPicture();
    const detectors = findAllByType(renderer, 'GestureDetector');
    expect(detectors.length).toBeGreaterThanOrEqual(2);

    // The OUTER detector wraps the surface (pressable); its gesture is a Race.
    const surfaceDetector = detectors.find((d) => {
      const g = d.props.gesture;
      return g && g.__type === 'race';
    });
    expect(surfaceDetector).toBeTruthy();
    const race = surfaceDetector.props.gesture;
    expect(race.gestures.length).toBe(2);
  });

  it('wraps the target circle in an INNER GestureDetector carrying the target drag gesture from props', () => {
    const renderer = renderShowPicture();
    const detectors = findAllByType(renderer, 'GestureDetector');
    const targetDetector = detectors.find((d) => d.props.gesture === baseProps.targetGesture);
    expect(targetDetector).toBeTruthy();
    expect(() => findByTestID(renderer, 'game.picture.guess-target-wrap')).not.toThrow();
  });

  it('preserves the e2e Pressable on the surface (onPress/onLongPress)', () => {
    const renderer = renderShowPicture();
    const surface = findByTestID(renderer, 'game.picture.guess-surface');
    expect(surface.props.onPress).toBe(baseProps.handlePress);
    expect(surface.props.onLongPress).toBe(baseProps.handleLongPress);
  });

  it('passes isOpen={enigmaOpen} and onClose to EnigmaOverlay (controlled) and starts closed by default', () => {
    const renderer = renderShowPicture();
    const calls = mockEnigmaOverlay.mock.calls;
    const last = calls[calls.length - 1][0];
    expect(last.isOpen).toBe(false);
    expect(last.description).toBe('Find it');
    expect(last.screenHeight).toBe(400);
    expect(typeof last.onClose).toBe('function');
  });

  it('initial enigmaOpen mirrors defaultOpen=true', () => {
    const renderer = renderShowPicture({ defaultOpen: true });
    const last = mockEnigmaOverlay.mock.calls[mockEnigmaOverlay.mock.calls.length - 1][0];
    expect(last.isOpen).toBe(true);
  });

  it('flips enigmaOpen=true when defaultOpen flips from false to true (existing-instance sync)', () => {
    let renderer;
    act(() => {
      renderer = create(<ShowPicture {...baseProps} defaultOpen={false} />);
    });
    let last = mockEnigmaOverlay.mock.calls[mockEnigmaOverlay.mock.calls.length - 1][0];
    expect(last.isOpen).toBe(false);

    act(() => {
      renderer.update(<ShowPicture {...baseProps} defaultOpen={true} />);
    });

    last = mockEnigmaOverlay.mock.calls[mockEnigmaOverlay.mock.calls.length - 1][0];
    expect(last.isOpen).toBe(true);
  });

  it('EnigmaOverlay onClose calls onDescriptionClosed AND closes (isOpen flips false)', () => {
    const onDescriptionClosed = jest.fn();
    let renderer;
    act(() => {
      renderer = create(
        <ShowPicture {...baseProps} defaultOpen={true} onDescriptionClosed={onDescriptionClosed} />,
      );
    });
    let last = mockEnigmaOverlay.mock.calls[mockEnigmaOverlay.mock.calls.length - 1][0];
    expect(last.isOpen).toBe(true);

    act(() => {
      last.onClose();
    });

    expect(onDescriptionClosed).toHaveBeenCalledTimes(1);
    last = mockEnigmaOverlay.mock.calls[mockEnigmaOverlay.mock.calls.length - 1][0];
    expect(last.isOpen).toBe(false);
  });

  it('still renders the target wrap, modal, and image when guessing (testIDs preserved)', () => {
    const renderer = renderShowPicture({ showModal: true });
    expect(() => findByTestID(renderer, 'game.picture.guess-surface')).not.toThrow();
    expect(() => findByTestID(renderer, 'game.picture.guess-image')).not.toThrow();
    expect(() => findByTestID(renderer, 'game.picture.guess-target-wrap')).not.toThrow();
    expect(() => findByTestID(renderer, 'game.picture.guess-modal')).not.toThrow();
  });
});
