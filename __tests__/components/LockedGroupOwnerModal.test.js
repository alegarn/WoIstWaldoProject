import React from 'react';
import { act, create } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

jest.mock('../../components/UI/Button', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockButton({ children, onPress, testID, style, textStyle }) {
    return (
      <Text testID={testID} onPress={onPress} style={[style, textStyle]}>
        {children}
      </Text>
    );
  };
});

import LockedGroupOwnerModal from '../../components/Groups/LockedGroupOwnerModal';
import { getPrivateGroupTheme } from '../../utils/privateGroupTheme';

describe('LockedGroupOwnerModal', () => {
  function render(props) {
    let renderer;
    act(() => {
      renderer = create(<LockedGroupOwnerModal {...props} />);
    });
    return renderer;
  }

  it('exposes the Modal as visible when visible=true', () => {
    const renderer = render({ visible: true, groupName: 'Waldos' });

    const modal = renderer.root.findByProps({ testID: 'private-home.locked-owner-modal.backdrop' });
    expect(modal.parent.props.visible).toBe(true);
  });

  it('renders the title and the three action triggers', () => {
    const renderer = render({ visible: true, groupName: 'Waldos' });

    expect(renderer.root.findByProps({ testID: 'private-home.locked-owner-modal.title' }).props.children)
      .toBe('Your Premium+ subscription ended');
    expect(renderer.root.findByProps({ testID: 'private-home.locked-owner-modal.button.renew' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'private-home.locked-owner-modal.button.transfer' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'private-home.locked-owner-modal.button.dismiss' })).toBeTruthy();
  });

  it('fires onRenew / onTransfer / onDismiss when the respective triggers are pressed', () => {
    const onRenew = jest.fn();
    const onTransfer = jest.fn();
    const onDismiss = jest.fn();
    const renderer = render({ visible: true, groupName: 'Waldos', onRenew, onTransfer, onDismiss });

    renderer.root.findByProps({ testID: 'private-home.locked-owner-modal.button.renew' }).props.onPress();
    renderer.root.findByProps({ testID: 'private-home.locked-owner-modal.button.transfer' }).props.onPress();
    renderer.root.findByProps({ testID: 'private-home.locked-owner-modal.button.dismiss' }).props.onPress();

    expect(onRenew).toHaveBeenCalledTimes(1);
    expect(onTransfer).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('falls back to a generic name when no group name is provided', () => {
    const renderer = render({ visible: true });
    const content = renderer.root.findByProps({ testID: 'private-home.locked-owner-modal.content' });
    expect(content.props.children.some((node) =>
      typeof node?.props?.children === 'string' && node.props.children.includes('this group')
    )).toBe(true);
  });

  it('uses the private group palette for the modal surface and primary action', () => {
    const theme = getPrivateGroupTheme({ primaryColor: '#198868', secondaryColor: '#FFCC00' });
    const renderer = render({
      visible: true,
      groupName: 'Waldos',
      primaryColor: '#198868',
      secondaryColor: '#FFCC00',
    });

    const content = renderer.root.findByProps({ testID: 'private-home.locked-owner-modal.content' });
    const contentStyle = StyleSheet.flatten(content.props.style);
    expect(contentStyle.borderColor).toBe(theme.lightHairlineStrong);

    const renewButton = renderer.root.findByProps({ testID: 'private-home.locked-owner-modal.button.renew' });
    expect(StyleSheet.flatten(renewButton.props.style).backgroundColor).toBe(theme.primaryColor);
    expect(StyleSheet.flatten(renewButton.props.textStyle).color).toBe(theme.accentText);
  });
});
