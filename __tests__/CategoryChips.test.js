jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  StyleSheet: {
    create: (styles) => styles,
  },
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import CategoryChips from '../components/UI/CategoryChips';
import { GlobalStyle } from '../constants/theme';

describe('CategoryChips', () => {
  const categories = [
    { key: 'recent', name: 'Recent' },
    { key: 'nature', name: 'Nature' },
    { key: 'city', name: 'City' },
  ];

  async function renderChips(overrides = {}) {
    let renderer;

    await act(async () => {
      renderer = create(
        <CategoryChips
          selected="nature"
          onSelect={jest.fn()}
          categories={categories}
          testIDPrefix="categories"
          {...overrides}
        />
      );
    });

    return renderer;
  }

  it('uses the documented primary background color on the selected chip', async () => {
    const renderer = await renderChips({ selected: 'nature' });

    expect(renderer.root.findByProps({ testID: 'categories.chip.nature' }).props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: GlobalStyle.color.primaryColor500 }),
      ])
    );
  });

  it('calls onSelect with the chip key when pressed', async () => {
    const onSelect = jest.fn();
    const renderer = await renderChips({ onSelect });

    await act(async () => {
      renderer.root.findByProps({ testID: 'categories.chip.city' }).props.onPress();
    });

    expect(onSelect).toHaveBeenCalledWith('city');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});