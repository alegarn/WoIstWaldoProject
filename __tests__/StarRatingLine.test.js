let capturedPanResponder;

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
    View: 'View',
    Pressable: 'Pressable',
    Text: 'Text',
    StyleSheet: {
      create: (styles) => styles,
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 300 })),
    },
    PanResponder: {
      create: jest.fn((config) => {
        capturedPanResponder = config;
        return { panHandlers: {} };
      }),
    },
    Animated: {
      Value: MockAnimatedValue,
      View: 'AnimatedView',
      Text: 'AnimatedText',
    },
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';
import { PanResponder } from 'react-native';

import StarRatingLine from '../components/UI/StarRatingLine';
import { RATING_LABELS } from '../constants/rating';

describe('StarRatingLine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedPanResponder = undefined;
  });

  async function renderLine(overrides = {}) {
    let renderer;

    await act(async () => {
      renderer = create(
        <StarRatingLine
          value={0}
          onChange={jest.fn()}
          testIDPrefix="rating"
          {...overrides}
        />
      );
    });

    return renderer;
  }

  it('renders five stars', async () => {
    const renderer = await renderLine();

    const stars = renderer.root.findAll(
      (node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('rating.star.')
    );

    expect(stars).toHaveLength(5);
  });

  it('renders a question mark label before interaction when value is zero', async () => {
    const renderer = await renderLine({ value: 0 });

    expect(renderer.root.findByProps({ testID: 'rating.label' }).props.children).toBe('?');
  });

  it('triggers onChange when the PanResponder move changes the rating', async () => {
    const onChange = jest.fn();

    await renderLine({ onChange, value: 0 });

    await act(async () => {
      capturedPanResponder.onPanResponderMove(null, { moveX: 180 });
    });

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('does not trigger onChange when disabled is true', async () => {
    const onChange = jest.fn();
    const renderer = await renderLine({ onChange, disabled: true });

    const fourthStar = renderer.root.findByProps({ testID: 'rating.star.4' });

    await act(async () => {
      fourthStar.props.onPress?.();
    });

    expect(PanResponder.create).not.toHaveBeenCalled();
    expect(fourthStar.props.disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders the correct label for each rating value', async () => {
    expect(RATING_LABELS).toHaveLength(6);

    for (const [value, label] of RATING_LABELS.entries()) {
      let renderer;

      await act(async () => {
        renderer = create(
          <StarRatingLine
            value={value}
            onChange={jest.fn()}
            testIDPrefix={`rating-${value}`}
          />
        );
      });

      expect(renderer.root.findByProps({ testID: `rating-${value}.label` }).props.children).toBe(
        label
      );
    }
  });
});