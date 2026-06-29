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

    const storeProps = getIconButtonProps('home.header.store');
    expect(storeProps).toBeTruthy();
    expect(storeProps.testID).toBe('home.header.store');

    await act(async () => {
      storeProps.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('PaywallScreen', { intent: 'store' });
  });
});
