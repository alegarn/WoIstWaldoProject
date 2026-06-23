jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  View: 'View',
  Text: 'Text',
  ImageBackground: 'ImageBackground',
  StyleSheet: {
    absoluteFillObject: {},
    create: (styles) => styles,
  },
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import GuessCategoryCard from '../components/UI/GuessCategoryCard';

describe('GuessCategoryCard', () => {
  const category = {
    id: 'nature',
    name: 'Nature',
  };

  const thumbnailUrl = { uri: 'file:///nature.jpg' };

  async function renderCard(overrides = {}) {
    let renderer;

    await act(async () => {
      renderer = create(
        <GuessCategoryCard
          category={category}
          thumbnailUrl={thumbnailUrl}
          count={12}
          onPress={jest.fn()}
          testIDPrefix="guess-category"
          {...overrides}
        />
      );
    });

    return renderer;
  }

  it('renders the category label', async () => {
    const renderer = await renderCard();

    expect(renderer.root.findByType('Text').props.children).toBe('Nature');
  });

  it('renders the count badge when count is provided', async () => {
    const renderer = await renderCard({ count: 12 });

    expect(
      renderer.root.findByProps({ testID: 'guess-category.card.nature.count' }).props.children
    ).toBe(12);
  });

  it('hides the count badge when count is zero', async () => {
    const renderer = await renderCard({ count: 0 });

    expect(() => {
      renderer.root.findByProps({ testID: 'guess-category.card.nature.count' });
    }).toThrow();
  });

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const renderer = await renderCard({ onPress });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-category.card.nature' }).props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});