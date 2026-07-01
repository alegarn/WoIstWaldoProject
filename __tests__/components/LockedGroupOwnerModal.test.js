import React from 'react';
import { act, create } from 'react-test-renderer';

jest.mock('../../components/UI/Button', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockButton({ children, onPress, testID }) {
    return (
      <Text testID={testID} onPress={onPress}>
        {children}
      </Text>
    );
  };
});

import LockedGroupOwnerModal from '../../components/Groups/LockedGroupOwnerModal';

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
});
