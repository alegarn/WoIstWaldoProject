jest.mock('react-native', () => {
  const React = require('react');

  function MockModal({ children, visible }) {
    if (!visible) {
      return null;
    }

    return React.createElement(React.Fragment, null, children);
  }

  return {
    View: 'View',
    Pressable: 'Pressable',
    Text: 'Text',
    Modal: MockModal,
    ScrollView: 'ScrollView',
    StyleSheet: {
      create: (styles) => styles,
      hairlineWidth: 1,
    },
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import LanguageSelector from '../components/UI/LanguageSelector';

describe('LanguageSelector', () => {
  async function renderSelector(overrides = {}) {
    let renderer;

    await act(async () => {
      renderer = create(
        <LanguageSelector value="en" onChange={jest.fn()} testIDPrefix="language" {...overrides} />
      );
    });

    return renderer;
  }

  it('opens the modal when the trigger is pressed', async () => {
    const renderer = await renderSelector();

    expect(() => {
      renderer.root.findByProps({ testID: 'language.option.fr' });
    }).toThrow();

    await act(async () => {
      renderer.root.findByProps({ testID: 'language.button' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'language.option.fr' })).toBeTruthy();
  });

  it('calls onChange when a language is selected', async () => {
    const onChange = jest.fn();
    const renderer = await renderSelector({ onChange });

    await act(async () => {
      renderer.root.findByProps({ testID: 'language.button' }).props.onPress();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'language.option.fr' }).props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith('fr');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('forwards accessibility metadata to the trigger button', async () => {
    const renderer = await renderSelector({
      accessibilityLabel: 'Choose onboarding language',
      accessibilityHint: 'Opens language choices',
    });

    expect(renderer.root.findByProps({ testID: 'language.button' }).props.accessibilityLabel).toBe(
      'Choose onboarding language'
    );
    expect(renderer.root.findByProps({ testID: 'language.button' }).props.accessibilityHint).toBe(
      'Opens language choices'
    );
  });
});