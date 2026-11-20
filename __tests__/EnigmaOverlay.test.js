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
      View: ({ children, ...props }) => React.createElement('AnimatedView', props, children),
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

jest.mock('../components/UI/IconButton', () => {
  const React = require('react');
  return function MockIconButton(props) {
    return React.createElement('IconButton', props);
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import EnigmaOverlay from '../components/Picture/Descriptions/EnigmaOverlay';

const DESCRIPTION = 'Solve the riddle to find the spot';
const SCREEN_HEIGHT = 640;

describe('EnigmaOverlay (controlled)', () => {
  function renderOverlay(props = {}) {
    let renderer;
    act(() => {
      renderer = create(
        <EnigmaOverlay
          description={DESCRIPTION}
          screenHeight={SCREEN_HEIGHT}
          {...props}
        />
      );
    });
    return renderer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the panel + scrim + description text when isOpen=true', () => {
    const renderer = renderOverlay({ isOpen: true });

    expect(renderer.root.findByProps({ testID: 'guess.enigma.panel' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'guess.enigma.scrim' })).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'guess.enigma.text' }).props.children
    ).toBe(DESCRIPTION);
  });

  it('shows "No description" when description is empty', () => {
    const renderer = renderOverlay({ description: '', isOpen: true });

    expect(
      renderer.root.findByProps({ testID: 'guess.enigma.text' }).props.children
    ).toBe('No description');
  });

  it('renders nothing (no panel, no scrim) when isOpen=false', () => {
    const renderer = renderOverlay({ isOpen: false });

    expect(() => renderer.root.findByProps({ testID: 'guess.enigma.panel' })).toThrow();
    expect(() => renderer.root.findByProps({ testID: 'guess.enigma.scrim' })).toThrow();
  });

  it('does NOT render the legacy handle strip', () => {
    const renderer = renderOverlay({ isOpen: false });
    expect(() => renderer.root.findByProps({ testID: 'guess.enigma.handle' })).toThrow();
  });

  it('calls onClose when the scrim is tapped', () => {
    const onClose = jest.fn();
    const renderer = renderOverlay({ isOpen: true, onClose });

    act(() => {
      renderer.root.findByProps({ testID: 'guess.enigma.scrim' }).props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close chevron is pressed', () => {
    const onClose = jest.fn();
    const renderer = renderOverlay({ isOpen: true, onClose });

    act(() => {
      renderer.root.findByProps({ testID: 'guess.enigma.close' }).props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onClose is not provided', () => {
    const renderer = renderOverlay({ isOpen: true });
    expect(() => {
      act(() => {
        renderer.root.findByProps({ testID: 'guess.enigma.scrim' }).props.onPress();
      });
    }).not.toThrow();
  });
});
