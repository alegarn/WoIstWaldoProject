const mockIconButton = jest.fn(() => null);

jest.mock('../components/UI/IconButton', () => {
  return function MockIconButton(props) {
    mockIconButton(props);
    return null;
  };
});

jest.mock('../hooks/useActiveGroup', () => ({
  useActiveGroup: jest.fn(() => ({
    scope: { kind: 'public' },
    activeGroupId: null,
    setActive: jest.fn(),
    clear: jest.fn(),
  })),
}));

jest.mock('../hooks/useGroupsHub', () => ({
  useGroupsHub: jest.fn(() => ({
    data: { owned: [], joined: [] },
    isLoading: false,
    error: null,
    refresh: jest.fn(),
  })),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import { HomeHeaderRight } from '../screens/Groups/HomeHeaderRight';

describe('HomeHeaderRight', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function getIconButtonProps(testID) {
    const matchingCalls = mockIconButton.mock.calls.filter(([{ testID: id }]) => id === testID);
    return matchingCalls[matchingCalls.length - 1]?.[0];
  }

  it('renders the store entry point and navigates to the paywall with intent=store on tap', async () => {
    const navigation = { navigate: jest.fn() };

    let renderer;
    await act(async () => {
      renderer = create(<HomeHeaderRight navigation={navigation} tintColor="#fff" />);
    });

    const overflowProps = getIconButtonProps('home.header.other-options');
    expect(overflowProps).toBeTruthy();
    expect(overflowProps.testID).toBe('home.header.other-options');

    await act(async () => {
      overflowProps.onPress();
    });

    const storeRow = renderer.root.findByProps({ testID: 'home.menu.store' });
    expect(storeRow).toBeTruthy();

    await act(async () => {
      storeRow.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('PaywallScreen', { intent: 'store' });
  });
});
