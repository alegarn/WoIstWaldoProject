jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) => (Array.isArray(style)
      ? Object.assign({}, ...style.filter(Boolean))
      : style),
  },
}));

jest.mock('../components/UI/IconButton', () => {
  const React = require('react');
  return function MockIconButton({ onPress }) {
    return React.createElement('Pressable', { onPress, testID: 'guess-description.chevron' });
  };
});

jest.mock('../constants/theme', () => ({
  GlobalStyle: {
    color: {
      secondaryColor: '#fff',
      secondaryColor500: '#fff',
    },
  },
}));

import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import GuessDescription from '../components/Picture/Descriptions/GuessDescription';

describe('GuessDescription', () => {
  const item = { description: 'Find Waldo near the old bridge.' };

  async function renderDescription(overrides = {}) {
    let renderer;

    await act(async () => {
      renderer = create(
        <GuessDescription
          item={item}
          showFullDescription={false}
          toggleDescription={jest.fn()}
          {...overrides}
        />
      );
    });

    return renderer;
  }

  it('renders the enigma text with numberOfLines 2 when collapsed', async () => {
    const renderer = await renderDescription({ showFullDescription: false });

    const text = renderer.root.findByProps({ testID: 'guess-description.text' });
    expect(text.props.numberOfLines).toBe(2);
    expect(text.props.children).toBe(item.description);
  });

  it('renders the enigma text with numberOfLines undefined when expanded', async () => {
    const renderer = await renderDescription({ showFullDescription: true });

    const text = renderer.root.findByProps({ testID: 'guess-description.text' });
    expect(text.props.numberOfLines).toBeUndefined();
  });

  it('renders the No description fallback when description is undefined or empty', async () => {
    const undefinedRenderer = await renderDescription({ item: { description: undefined } });
    expect(
      undefinedRenderer.root.findByProps({ testID: 'guess-description.text' }).props.children
    ).toBe('No description');

    const emptyRenderer = await renderDescription({ item: { description: '' } });
    expect(
      emptyRenderer.root.findByProps({ testID: 'guess-description.text' }).props.children
    ).toBe('No description');
  });

  it('falls back to fullDescription when description is missing', async () => {
    const fullDescription = 'A longer enigma stored in full_description.';
    const renderer = await renderDescription({
      item: { description: undefined, fullDescription },
    });

    expect(
      renderer.root.findByProps({ testID: 'guess-description.text' }).props.children
    ).toBe(fullDescription);
  });

  it('positions the description area absolutely at 5% from the bottom', async () => {
    const renderer = await renderDescription();

    const area = renderer.root.findByType('View');
    const style = StyleSheet.flatten(area.props.style);

    expect(style.position).toBe('absolute');
    expect(style.bottom).toBe('5%');
  });

  it('falls back to full_description snake_case when other fields are missing', async () => {
    const full_description = 'Snake-cased enigma from the API.';
    const renderer = await renderDescription({
      item: { description: '', full_description },
    });

    expect(
      renderer.root.findByProps({ testID: 'guess-description.text' }).props.children
    ).toBe(full_description);
  });
});
