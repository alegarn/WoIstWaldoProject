jest.mock('react-native', () => {
  const React = require('react');

  function MockModal({ children, visible }) {
    if (!visible) {
      return null;
    }

    return React.createElement(React.Fragment, null, children);
  }

  return {
    Modal: MockModal,
    View: 'View',
    Text: 'Text',
    StyleSheet: {
      create: (styles) => styles,
    },
    Platform: { OS: 'android' },
  };
});

jest.mock('../components/UI/Button', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockButton({ children, testID, disabled }) {
    return <Text testID={testID} disabled={disabled}>{children}</Text>;
  };
});

import React from 'react';
import { Text, View } from 'react-native';
import { act, create } from 'react-test-renderer';

import CenteredModal from '../components/UI/CenteredModal';

async function renderModal(children, props = {}) {
  let renderer;

  await act(async () => {
    renderer = create(
      <CenteredModal
        children={children}
        isModalVisible={true}
        onCancel={jest.fn()}
        onPress={jest.fn()}
        {...props}
      />
    );
  });

  return renderer;
}

function getBodyElement(renderer) {
  const contentElement = renderer.root.findByProps({ testID: 'modal.content' });

  return contentElement.props.children[0];
}

describe('CenteredModal', () => {
  it('renders string children as modal text', async () => {
    const renderer = await renderModal('Do you want to validate this ?');
    const bodyElement = getBodyElement(renderer);

    expect(bodyElement.type).toBe(Text);
    expect(bodyElement.props.children).toBe('Do you want to validate this ?');
  });

  it('renders layout children without wrapping them in a Text node', async () => {
    const renderer = await renderModal(<View testID="modal.custom-content" />);
    const bodyElement = getBodyElement(renderer);

    expect(bodyElement.type).toBe(View);
    expect(bodyElement.props.children.props.testID).toBe('modal.custom-content');
  });

  it('renders translated default confirm and close button labels', async () => {
    const renderer = await renderModal('Do you want to validate this ?');

    expect(renderer.root.findByProps({ testID: 'modal.confirm' }).props.children).toBe('Confirm');
    expect(renderer.root.findByProps({ testID: 'modal.close' }).props.children).toBe('Close');
  });

  it('forwards confirmDisabled to the confirm button only', async () => {
    const renderer = await renderModal('Do you want to validate this ?', { confirmDisabled: true });

    expect(renderer.root.findByProps({ testID: 'modal.confirm' }).props.disabled).toBe(true);
    expect(renderer.root.findByProps({ testID: 'modal.close' }).props.disabled).toBeUndefined();
  });
});
