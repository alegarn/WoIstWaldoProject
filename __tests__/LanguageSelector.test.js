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
import { Modal, Text } from 'react-native';
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

  it('renders the Indonesian option with its native name and fires onChange', async () => {
    const onChange = jest.fn();
    const renderer = await renderSelector({ onChange });

    await act(async () => {
      renderer.root.findByProps({ testID: 'language.button' }).props.onPress();
    });

    const indonesianOption = renderer.root.findByProps({ testID: 'language.option.id' });
    expect(indonesianOption).toBeTruthy();
    expect(indonesianOption.findByType(Text).props.children).toBe('Bahasa Indonesia');

    await act(async () => {
      indonesianOption.props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith('id');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('displays the selected language native name on the trigger button', async () => {
    const renderer = await renderSelector({ value: 'fr' });

    expect(renderer.root.findByProps({ testID: 'language.button' }).props.children).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'language.button' }).findByType(Text).props.children).toBe(
      'Français'
    );
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

  describe('controlled mode', () => {
    async function renderControlled(overrides = {}) {
      let renderer;

      await act(async () => {
        renderer = create(
          <LanguageSelector
            value="fr"
            onChange={jest.fn()}
            testIDPrefix="language"
            visible={false}
            onClose={jest.fn()}
            {...overrides}
          />
        );
      });

      return renderer;
    }

    it('renders no trigger button', async () => {
      const renderer = await renderControlled();

      expect(() => {
        renderer.root.findByProps({ testID: 'language.button' });
      }).toThrow();
    });

    it('renders the modal container and options only when visible', async () => {
      const renderer = await renderControlled();

      expect(() => {
        renderer.root.findByProps({ testID: 'language' });
      }).toThrow();
      expect(() => {
        renderer.root.findByProps({ testID: 'language.option.fr' });
      }).toThrow();

      let visibleRenderer;
      await act(async () => {
        visibleRenderer = create(
          <LanguageSelector
            value="fr"
            onChange={jest.fn()}
            testIDPrefix="language"
            visible={true}
            onClose={jest.fn()}
          />
        );
      });

      expect(visibleRenderer.root.findByProps({ testID: 'language' })).toBeTruthy();
      expect(visibleRenderer.root.findByProps({ testID: 'language.option.fr' })).toBeTruthy();
      expect(visibleRenderer.root.findByProps({ testID: 'language.close' })).toBeTruthy();
    });

    it('calls onChange then onClose when an option is selected', async () => {
      const onChange = jest.fn();
      const onClose = jest.fn();
      let renderer;

      await act(async () => {
        renderer = create(
          <LanguageSelector
            value="fr"
            onChange={onChange}
            testIDPrefix="language"
            visible={true}
            onClose={onClose}
          />
        );
      });

      await act(async () => {
        renderer.root.findByProps({ testID: 'language.option.de' }).props.onPress();
      });

      expect(onChange).toHaveBeenCalledWith('de');
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onChange.mock.invocationCallOrder[0]).toBeLessThan(
        onClose.mock.invocationCallOrder[0]
      );
    });

    it('calls onClose from the close button and hardware back request', async () => {
      const onClose = jest.fn();
      let renderer;

      await act(async () => {
        renderer = create(
          <LanguageSelector
            value="fr"
            onChange={jest.fn()}
            testIDPrefix="language"
            visible={true}
            onClose={onClose}
          />
        );
      });

      await act(async () => {
        renderer.root.findByProps({ testID: 'language.close' }).props.onPress();
      });

      expect(onClose).toHaveBeenCalledTimes(1);

      await act(async () => {
        renderer.root.findByType(Modal).props.onRequestClose();
      });

      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });
});