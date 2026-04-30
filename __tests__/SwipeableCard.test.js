const mockGuessDescription = jest.fn(() => null);

let capturedPanResponder;

jest.mock('../components/Picture/Descriptions/GuessDescription', () => {
  return function MockGuessDescription(props) {
    mockGuessDescription(props);
    return null;
  };
});

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');

  class MockAnimatedValue {
    constructor(value) {
      this._value = value;
    }

    setValue = (nextValue) => {
      this._value = nextValue;
    };

    interpolate = () => 'interpolated';
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
    ...actual,
    PanResponder: {
      create: jest.fn((config) => {
        capturedPanResponder = config;
        return { panHandlers: {} };
      }),
    },
    Animated: {
      ...actual.Animated,
      Value: MockAnimatedValue,
      spring: jest.fn((value, config) => buildAnimation(value, config)),
      timing: jest.fn((value, config) => buildAnimation(value, config)),
      parallel: jest.fn((animations) => ({
        start: (callback) => {
          animations.forEach((animation) => animation.start?.());
          callback?.();
        },
      })),
      View: actual.View,
      Image: actual.Image,
    },
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import SwipeableCard from '../components/UI/SwipeableCard';

describe('SwipeableCard', () => {
  const item = {
    listId: 7,
    imageFile: 'file:///waldo.jpg',
    description: 'Find Waldo behind the tree.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedPanResponder = undefined;
  });

  function renderCard(overrides = {}) {
    return create(
      <SwipeableCard
        item={item}
        removeCard={jest.fn()}
        swipedDirection={jest.fn()}
        screenWidth={320}
        screenHeight={300}
        onSwipe={jest.fn()}
        {...overrides}
      />
    );
  }

  it('does not trigger a card action for a swipe below the release thresholds', async () => {
    const removeCard = jest.fn();
    const onSwipe = jest.fn();

    renderCard({ removeCard, onSwipe });

    await act(async () => {
      capturedPanResponder.onPanResponderRelease(null, { dx: 40, dy: 20 });
    });

    expect(removeCard).not.toHaveBeenCalled();
    expect(onSwipe).not.toHaveBeenCalled();
    expect(mockGuessDescription.mock.calls[mockGuessDescription.mock.calls.length - 1][0]).toEqual(
      expect.objectContaining({ showFullDescription: false })
    );
  });

  it('calls onSwipe when the card is released past the right swipe threshold', async () => {
    const onSwipe = jest.fn();

    renderCard({ onSwipe });

    await act(async () => {
      capturedPanResponder.onPanResponderMove(null, { dx: 180, dy: 0, moveX: 240, x0: 0 });
      capturedPanResponder.onPanResponderRelease(null, { dx: 180, dy: 0 });
    });

    expect(onSwipe).toHaveBeenCalledWith({ item });
  });

  it('calls removeCard when the card is released past the left swipe threshold', async () => {
    const removeCard = jest.fn();

    renderCard({ removeCard });

    await act(async () => {
      capturedPanResponder.onPanResponderMove(null, { dx: -181, dy: 0, moveX: 0, x0: 240 });
      capturedPanResponder.onPanResponderRelease(null, { dx: -181, dy: 0 });
    });

    expect(removeCard).toHaveBeenCalledWith(item.listId);
  });

  it('toggles the full description when the card is swiped vertically far enough', async () => {
    renderCard();

    await act(async () => {
      capturedPanResponder.onPanResponderRelease(null, { dx: 0, dy: -150 });
    });

    expect(mockGuessDescription.mock.calls[mockGuessDescription.mock.calls.length - 1][0]).toEqual(
      expect.objectContaining({ showFullDescription: true })
    );
  });
});