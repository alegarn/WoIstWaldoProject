const mockBigButton = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);

jest.mock('@react-navigation/native', () => {
  const React = require('react');

  return {
    useFocusEffect: (callback) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('../components/UI/BigButton', () => {
  return function MockBigButton(props) {
    mockBigButton(props);
    return null;
  };
});

jest.mock('../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../hooks/useGroupsHub', () => ({
  useGroupsHub: jest.fn(),
}));

jest.mock('../hooks/useActiveGroup', () => ({
  useActiveGroup: jest.fn(() => ({
    setActive: jest.fn(),
    clear: jest.fn(),
    scope: { kind: 'public' },
    activeGroupId: null,
  })),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import GroupsListScreen from '../screens/Groups/GroupsListScreen';
import { AuthContext } from '../store/auth-context';
import { useGroupsHub } from '../hooks/useGroupsHub';

describe('GroupsListScreen store entry points', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGroupsHub.mockReturnValue({
      data: {
        owned: [{ id: 7, name: 'My Crew', owner_id: 99, primary_color: '#111' }],
        joined: [],
      },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
  });

  function bigButtonTestIDs() {
    return mockBigButton.mock.calls.map(([props]) => props.testID);
  }

  async function renderScreen(contextValue) {
    const navigation = { navigate: jest.fn(), replace: jest.fn() };
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue}>
          <GroupsListScreen navigation={navigation} />
        </AuthContext.Provider>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    return { renderer, navigation };
  }

  it('renders the Create group and Store buttons for a TIER-0 user (Fix A: gate removed)', async () => {
    const { renderer } = await renderScreen({ paidTier: 0 });

    expect(renderer.root.findByProps({ testID: 'groups-list.container' })).toBeTruthy();

    const testIDs = bigButtonTestIDs();
    expect(testIDs).toContain('groups-list.button.create');
    expect(testIDs).toContain('groups-list.button.store');
  });

  it('routes the Store button to the paywall with intent=store', async () => {
    const { navigation } = await renderScreen({ paidTier: 0 });

    const storeCall = mockBigButton.mock.calls.find(([{ testID }]) => testID === 'groups-list.button.store');
    expect(storeCall).toBeTruthy();

    await act(async () => {
      storeCall[0].onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('PaywallScreen', { intent: 'store' });
  });
});
