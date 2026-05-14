import React from 'react';
import { Text, View } from 'react-native';

jest.mock('../components/UI/Button', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockButton({ children }) {
    return <Text>{children}</Text>;
  };
});

import CenteredModal from '../components/UI/CenteredModal';

function getBodyElement(children) {
  const modalElement = CenteredModal({
    children,
    isModalVisible: true,
    onCancel: jest.fn(),
    onPress: jest.fn(),
  });
  const backdropElement = modalElement.props.children;
  const contentElement = backdropElement.props.children;

  return contentElement.props.children[0];
}

describe('CenteredModal', () => {
  it('renders string children as modal text', () => {
    const bodyElement = getBodyElement('Do you want to validate this ?');

    expect(bodyElement.type).toBe(Text);
    expect(bodyElement.props.children).toBe('Do you want to validate this ?');
  });

  it('renders layout children without wrapping them in a Text node', () => {
    const bodyElement = getBodyElement(<View testID="modal.custom-content" />);

    expect(bodyElement.type).toBe(View);
    expect(bodyElement.props.children.props.testID).toBe('modal.custom-content');
  });
});