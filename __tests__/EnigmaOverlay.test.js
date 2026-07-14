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
      View: ({ children, ...props }) => React.createElement('AnimatedView', props, children),
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

function handlePanResponder() {
  return mockCapturedPanResponders[0];
}

function dismissPanResponder() {
  return mockCapturedPanResponders[1];
}

describe('EnigmaOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCapturedPanResponders = [];
  });

  async function renderOverlay(props = {}) {
    let renderer;
    await act(async () => {
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

  it('renders the enigma text in the open panel', async () => {
    const renderer = await renderOverlay({ defaultOpen: true });

    expect(renderer.root.findByProps({ testID: 'guess.enigma.panel' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'guess.enigma.text' }).props.children).toBe(DESCRIPTION);
  });

  it('shows "No description" when the description is empty', async () => {
    const renderer = await renderOverlay({ description: '', defaultOpen: true });

    expect(renderer.root.findByProps({ testID: 'guess.enigma.text' }).props.children).toBe('No description');
  });

  it('starts closed when defaultOpen is falsy (panel absent, handle present)', async () => {
    const renderer = await renderOverlay();

    expect(renderer.root.findByProps({ testID: 'guess.enigma.handle' })).toBeTruthy();
    expect(() => renderer.root.findByProps({ testID: 'guess.enigma.panel' })).toThrow();
  });

  it('starts open when defaultOpen is true and shows the description', async () => {
    const renderer = await renderOverlay({ defaultOpen: true });

    expect(renderer.root.findByProps({ testID: 'guess.enigma.panel' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'guess.enigma.text' }).props.children).toBe(DESCRIPTION);
  });

  it('opens when the handle sees an up-swipe', async () => {
    const renderer = await renderOverlay();

    await act(async () => {
      handlePanResponder().onPanResponderRelease(null, { dx: 0, dy: -60 });
    });

    expect(renderer.root.findByProps({ testID: 'guess.enigma.panel' })).toBeTruthy();
  });

  it('does NOT open on a horizontal swipe', async () => {
    const renderer = await renderOverlay();

    await act(async () => {
      handlePanResponder().onPanResponderRelease(null, { dx: 80, dy: -10 });
    });

    expect(() => renderer.root.findByProps({ testID: 'guess.enigma.panel' })).toThrow();
  });

  it('does NOT open on a tap', async () => {
    const renderer = await renderOverlay();

    await act(async () => {
      handlePanResponder().onPanResponderRelease(null, { dx: 2, dy: -2 });
    });

    expect(() => renderer.root.findByProps({ testID: 'guess.enigma.panel' })).toThrow();
  });

  it('closes when the close button is pressed', async () => {
    const renderer = await renderOverlay({ defaultOpen: true });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess.enigma.close' }).props.onPress();
    });

    expect(() => renderer.root.findByProps({ testID: 'guess.enigma.panel' })).toThrow();
  });

  it('closes when the panel/scrim sees a down-swipe', async () => {
    const renderer = await renderOverlay({ defaultOpen: true });

    await act(async () => {
      dismissPanResponder().onPanResponderRelease(null, { dx: 0, dy: 60 });
    });

    expect(() => renderer.root.findByProps({ testID: 'guess.enigma.panel' })).toThrow();
  });

  it('renders open by default when defaultOpen=true and exposes the scrim', async () => {
    const renderer = await renderOverlay({ defaultOpen: true });

    expect(renderer.root.findByProps({ testID: 'guess.enigma.scrim' })).toBeTruthy();
  });

  it('calls onClose when the panel is dismissed via the scrim', async () => {
    const onClose = jest.fn();
    const renderer = await renderOverlay({ defaultOpen: true, onClose });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess.enigma.scrim' }).props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close chevron is pressed', async () => {
    const onClose = jest.fn();
    const renderer = await renderOverlay({ defaultOpen: true, onClose });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess.enigma.close' }).props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when onClose is not provided (no throw)', async () => {
    const renderer = await renderOverlay({ defaultOpen: true });

    await expect(
      act(async () => {
        renderer.root.findByProps({ testID: 'guess.enigma.scrim' }).props.onPress();
      })
    ).resolves.toBeUndefined();
  });

  it('renders closed (handle only) when defaultOpen=false', async () => {
    const renderer = await renderOverlay({ defaultOpen: false });

    expect(renderer.root.findByProps({ testID: 'guess.enigma.handle' })).toBeTruthy();
    expect(() => renderer.root.findByProps({ testID: 'guess.enigma.scrim' })).toThrow();
  });
});
