jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  Image: 'Image',
  StyleSheet: {
    create: (styles) => styles,
  },
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import CategoryChips from '../components/UI/CategoryChips';
import { GlobalStyle } from '../constants/theme';
import { CATEGORY_ASSETS } from '../utils/categoryAssets';

describe('CategoryChips', () => {
  const categories = [
    { key: 'other', name: 'Backend Other' },
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

  it('renders a single reset chip first and maps it to null', async () => {
    const onSelect = jest.fn();
    const renderer = await renderChips({ onSelect, selected: null });

    const pressables = renderer.root.findAllByType('Pressable');

    expect(pressables[0].props.testID).toBe('categories.chip.other');
    expect(renderer.root.findAllByProps({ testID: 'categories.chip.other' })).toHaveLength(1);

    await act(async () => {
      renderer.root.findByProps({ testID: 'categories.chip.other' }).props.onPress();
    });

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('renders the null-thumbnail fallback for categories without thumbnails', async () => {
    const renderer = await renderChips({ selected: null });

    expect(renderer.root.findByProps({ testID: 'categories.chip.recent.fallback' })).toBeTruthy();
  });

  it('uses the local asset when a private default category has no remote thumbnail', async () => {
    const renderer = await renderChips({
      categories: [
        {
          id: '966b8efe-887d-44da-b6a6-5eac0791b4ff',
          key: '966b8efe-887d-44da-b6a6-5eac0791b4ff',
          name: 'Nature',
          thumbnailUrl: null,
        },
      ],
      selected: null,
    });

    const images = renderer.root.findAllByType('Image');
    const privateDefaultImage = images.find(
      (image) => image.props.source === CATEGORY_ASSETS.nature
    );

    expect(privateDefaultImage).toBeTruthy();
    expect(() => renderer.root.findByProps({ testID: 'categories.chip.966b8efe-887d-44da-b6a6-5eac0791b4ff.fallback' })).toThrow();
  });
});