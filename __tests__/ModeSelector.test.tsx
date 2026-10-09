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
import { Modal } from 'react-native';
import { act, create } from 'react-test-renderer';

import ModeSelector from '../components/UI/ModeSelector';

describe('ModeSelector', () => {
  async function renderControlled(overrides = {}) {
    let renderer;

    await act(async () => {
      renderer = create(
        <ModeSelector
          value="any"
          onChange={jest.fn()}
          testIDPrefix="mode"
          visible={false}
          onClose={jest.fn()}
          {...overrides}
        />
      );
    });

    return renderer;
  }

  it('renders nothing while not visible', async () => {
    const renderer = await renderControlled();

    expect(() => {
      renderer.root.findByProps({ testID: 'mode' });
    }).toThrow();
    expect(() => {
      renderer.root.findByProps({ testID: 'mode.option.any' });
    }).toThrow();
  });

  it('renders the modal container, close button and the three mode options when visible', async () => {
    const renderer = await renderControlled({ visible: true });

    expect(renderer.root.findByProps({ testID: 'mode' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'mode.close' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'mode.option.any' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'mode.option.point' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'mode.option.shape' })).toBeTruthy();
  });

  it('labels the options through the guess.modeFilter i18n keys', async () => {
    const renderer = await renderControlled({ visible: true });

    expect(
      renderer.root.findByProps({ testID: 'mode.option.any' }).findByType('Text').props.children
    ).toBe('Any mode');
    expect(
      renderer.root.findByProps({ testID: 'mode.option.point' }).findByType('Text').props.children
    ).toBe('Point');
    expect(
      renderer.root.findByProps({ testID: 'mode.option.shape' }).findByType('Text').props.children
    ).toBe('Shape');
  });

  it('highlights the selected mode option', async () => {
    const renderer = await renderControlled({ value: 'point', visible: true });

    const pointOption = renderer.root.findByProps({ testID: 'mode.option.point' });
    const anyOption = renderer.root.findByProps({ testID: 'mode.option.any' });

    expect(pointOption.props.style).toEqual([expect.anything(), expect.anything()]);
    expect(anyOption.props.style).toEqual([expect.anything(), false]);
  });

  it('calls onChange with the picked mode then onClose (select round-trip)', async () => {
    const onChange = jest.fn();
    const onClose = jest.fn();
    const renderer = await renderControlled({ value: 'any', onChange, onClose, visible: true });

    await act(async () => {
      renderer.root.findByProps({ testID: 'mode.option.shape' }).props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith('shape');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChange.mock.invocationCallOrder[0]).toBeLessThan(
      onClose.mock.invocationCallOrder[0]
    );
  });

  it('calls onClose from the close button and the hardware back request', async () => {
    const onClose = jest.fn();
    const renderer = await renderControlled({ visible: true, onClose });

    await act(async () => {
      renderer.root.findByProps({ testID: 'mode.close' }).props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.root.findByType(Modal).props.onRequestClose();
    });

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
