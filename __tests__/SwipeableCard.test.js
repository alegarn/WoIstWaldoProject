const mockGuessDescription = jest.fn(() => null);

let capturedPanResponder;

jest.mock('../utils/e2eMode', () => ({
  isE2EMode: jest.fn(),
}));

jest.mock('../components/Picture/Descriptions/GuessDescription', () => {
  return function MockGuessDescription(props) {
    mockGuessDescription(props);
    return null;
  };
});

jest.mock('react-native', () => {
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
    View: 'View',
    Pressable: 'Pressable',
    Text: 'Text',
    ImageBackground: 'ImageBackground',
    StyleSheet: {
      absoluteFill: {},
      create: (styles) => styles,
    },
    PanResponder: {
      create: jest.fn((config) => {
        capturedPanResponder = config;
        return { panHandlers: {} };
      }),
    },
    Animated: {
      Value: MockAnimatedValue,
      spring: jest.fn((value, config) => buildAnimation(value, config)),
      timing: jest.fn((value, config) => buildAnimation(value, config)),
      parallel: jest.fn((animations) => ({
        start: (callback) => {
          animations.forEach((animation) => animation.start?.());
          callback?.();
        },
      })),
      View: 'AnimatedView',
      Image: 'AnimatedImage',
    },
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import SwipeableCard from '../components/UI/SwipeableCard';
import { isE2EMode } from '../utils/e2eMode';

describe('SwipeableCard', () => {
  const item = {
    listId: 7,
    imageFile: 'file:///waldo.jpg',
    description: 'Find Waldo behind the tree.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedPanResponder = undefined;
    isE2EMode.mockReturnValue(false);
  });

  async function renderCard(overrides = {}) {
    let renderer;

    await act(async () => {
      renderer = create(
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
    });

    return renderer;
  }

  it('does not trigger a card action for a swipe below the release thresholds', async () => {
    const removeCard = jest.fn();
    const onSwipe = jest.fn();

    await renderCard({ removeCard, onSwipe });

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

    await renderCard({ onSwipe });

    await act(async () => {
      capturedPanResponder.onPanResponderMove(null, { dx: 180, dy: 0, moveX: 240, x0: 0 });
      capturedPanResponder.onPanResponderRelease(null, { dx: 180, dy: 0 });
    });

    expect(onSwipe).toHaveBeenCalledWith({ item });
  });

  it('uses a lower right swipe threshold in e2e mode', async () => {
    const onSwipe = jest.fn();
    isE2EMode.mockReturnValue(true);

    await renderCard({ onSwipe });

    await act(async () => {
      capturedPanResponder.onPanResponderMove(null, { dx: 100, dy: 0, moveX: 160, x0: 0 });
      capturedPanResponder.onPanResponderRelease(null, { dx: 100, dy: 0 });
    });

    expect(onSwipe).toHaveBeenCalledWith({ item });
  });

  it('calls removeCard when the card is released past the left swipe threshold', async () => {
    const removeCard = jest.fn();

    await renderCard({ removeCard });

    await act(async () => {
      capturedPanResponder.onPanResponderMove(null, { dx: -181, dy: 0, moveX: 0, x0: 240 });
      capturedPanResponder.onPanResponderRelease(null, { dx: -181, dy: 0 });
    });

    expect(removeCard).toHaveBeenCalledWith(item.listId);
  });

  it('toggles the full description when the card is swiped vertically far enough', async () => {
    await renderCard();

    await act(async () => {
      capturedPanResponder.onPanResponderRelease(null, { dx: 0, dy: -150 });
    });

    expect(mockGuessDescription.mock.calls[mockGuessDescription.mock.calls.length - 1][0]).toEqual(
      expect.objectContaining({ showFullDescription: true })
    );
  });

  it('renders a saved-bridge marker for the e2e hidden card', async () => {
    const renderer = await renderCard({
      item: {
        ...item,
        pictureId: 'e2e-hidden-guess-card',
      },
    });

    expect(renderer.root.findByProps({ testID: 'guess-path.card.saved' })).toBeTruthy();
  });

  it('renders a fallback marker for the seeded e2e card', async () => {
    const renderer = await renderCard({
      item: {
        ...item,
        pictureId: 'e2e-guess-card',
      },
    });

    expect(renderer.root.findByProps({ testID: 'guess-path.card.fallback' })).toBeTruthy();
  });

  it('exposes a deterministic e2e open button that starts guessing without a swipe gesture', async () => {
    const onSwipe = jest.fn();
    isE2EMode.mockReturnValue(true);

    const renderer = await renderCard({
      onSwipe,
      item: {
        ...item,
        pictureId: 'e2e-hidden-guess-card',
      },
    });

    const openButton = renderer.root.findByProps({ testID: 'guess-path.card.open.7' });

    await act(async () => {
      openButton.props.onPress();
    });

    expect(onSwipe).toHaveBeenCalledWith({
      item: expect.objectContaining({
        listId: 7,
        pictureId: 'e2e-hidden-guess-card',
      }),
    });
  });
});