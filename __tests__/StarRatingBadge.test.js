jest.mock('react-native', () => {
  class MockAnimatedValue {
    constructor(value) {
      this._value = value;
    }

    setValue = (nextValue) => {
      this._value = nextValue;
    };

    interpolate = () => 'interpolated-color';
  }

  return {
    Pressable: 'Pressable',
    Text: 'Text',
    StyleSheet: {
      create: (styles) => styles,
    },
    Animated: {
      Value: MockAnimatedValue,
      Text: 'AnimatedText',
    },
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import StarRatingBadge from '../components/UI/StarRatingBadge';

describe('StarRatingBadge', () => {
  async function renderBadge(overrides = {}) {
    let renderer;

    await act(async () => {
      renderer = create(
        <StarRatingBadge
          value={0}
          ratingsCount={0}
          onPress={jest.fn()}
          testIDPrefix="rating"
          {...overrides}
        />
      );
    });

    return renderer;
  }

  it('renders an unrated question mark test id when there are no ratings', async () => {
    const renderer = await renderBadge({ value: 0, ratingsCount: 0 });

    expect(renderer.root.findByProps({ testID: 'rating.badge.unknown' }).props.children).toBe('?');
  });

  it('renders an unrated question mark when ratings count is undefined', async () => {
    const renderer = await renderBadge({ value: 0, ratingsCount: undefined });

    expect(renderer.root.findByProps({ testID: 'rating.badge.unknown' }).props.children).toBe('?');
  });

  it('renders the hidden numeric value test id when the badge is rated', async () => {
    const renderer = await renderBadge({ value: 4.5, ratingsCount: 12 });

    expect(renderer.root.findByProps({ testID: 'rating.badge.value' }).props.children).toBe(4.5);
  });

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const renderer = await renderBadge({ onPress });

    await act(async () => {
      renderer.root.findByProps({ testID: 'rating.badge' }).props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});