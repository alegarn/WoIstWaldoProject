let capturedPanResponder;

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
      timing: jest.fn(),
      spring: jest.fn(),
    },
    PanResponder: {
      create: jest.fn((config) => {
        capturedPanResponder = config;
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

import MovableTextBox from '../components/UI/MovableTextBox';

const DESCRIPTION = 'Solve the riddle to find the spot';
const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 640;

function findTextNode(root) {
  return root.findByType('Text');
}

function flattenStyle(style) {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean));
  }
  return style || {};
}

function getTextStyle(root) {
  return flattenStyle(findTextNode(root).props.style);
}

describe('MovableTextBox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedPanResponder = undefined;
  });

  async function renderBox(props = {}) {
    let renderer;
    await act(async () => {
      renderer = create(
        <MovableTextBox
          description={DESCRIPTION}
          screenWidth={SCREEN_WIDTH}
          screenHeight={SCREEN_HEIGHT}
          {...props}
        />
      );
    });
    return renderer;
  }

  it('renders the description by default', async () => {
    const renderer = await renderBox();

    expect(findTextNode(renderer.root).props.children).toBe(DESCRIPTION);
  });

  it('starts collapsed (narrow) on first paint', async () => {
    const renderer = await renderBox();

    expect(getTextStyle(renderer.root).maxWidth).toBe(30 * 0.75);
  });

  it('starts wide (open) when defaultOpen is true and renders the description', async () => {
    const renderer = await renderBox({ defaultOpen: true });

    expect(getTextStyle(renderer.root).maxWidth).toBe(Math.min(SCREEN_WIDTH * 0.7, 280) * 0.75);
    expect(getTextStyle(renderer.root).maxHeight).toBe(SCREEN_HEIGHT * 0.35 * 0.75);
    expect(findTextNode(renderer.root).props.children).toBe(DESCRIPTION);
  });

  it('updates left/top when dragged via the PanResponder', async () => {
    const renderer = await renderBox();

    expect(getTextStyle(renderer.root)).toMatchObject({ left: 50, top: 50 });

    await act(async () => {
      capturedPanResponder.onPanResponderGrant(null, { dx: 0, dy: 0 });
    });

    await act(async () => {
      capturedPanResponder.onPanResponderMove(null, { dx: 100, dy: 20 });
    });

    expect(getTextStyle(renderer.root)).toMatchObject({ left: 150, top: 70 });
  });

  it('clamps the drag position within the screen bounds', async () => {
    const renderer = await renderBox();

    await act(async () => {
      capturedPanResponder.onPanResponderGrant(null, { dx: 0, dy: 0 });
    });

    await act(async () => {
      capturedPanResponder.onPanResponderMove(null, { dx: 5000, dy: 5000 });
    });

    expect(getTextStyle(renderer.root)).toMatchObject({
      left: SCREEN_WIDTH,
      top: SCREEN_HEIGHT,
    });
  });

  it('toggles between narrow and wide sizing on tap (release below threshold)', async () => {
    const renderer = await renderBox();

    const narrowMaxWidth = getTextStyle(renderer.root).maxWidth;
    expect(narrowMaxWidth).toBe(30 * 0.75);

    await act(async () => {
      capturedPanResponder.onPanResponderGrant(null, { dx: 0, dy: 0 });
      capturedPanResponder.onPanResponderRelease(null, { dx: 2, dy: 2 });
    });

    const wideMaxWidth = getTextStyle(renderer.root).maxWidth;
    expect(wideMaxWidth).toBe(Math.min(SCREEN_WIDTH * 0.7, 280) * 0.75);
    expect(wideMaxWidth).not.toBe(narrowMaxWidth);
  });

  it('does not toggle wide/narrow state when dragged past the tap threshold', async () => {
    const renderer = await renderBox({ defaultOpen: true });

    const before = getTextStyle(renderer.root).maxWidth;
    expect(before).toBe(Math.min(SCREEN_WIDTH * 0.7, 280) * 0.75);

    await act(async () => {
      capturedPanResponder.onPanResponderGrant(null, { dx: 0, dy: 0 });
      capturedPanResponder.onPanResponderMove(null, { dx: 50, dy: 0 });
      capturedPanResponder.onPanResponderRelease(null, { dx: 50, dy: 0 });
    });

    expect(getTextStyle(renderer.root).maxWidth).toBe(before);
    expect(getTextStyle(renderer.root)).toMatchObject({ left: 100, top: 50 });
  });
});
