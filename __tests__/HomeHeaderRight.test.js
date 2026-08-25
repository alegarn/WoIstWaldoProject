const mockIconButton = jest.fn(() => null);
const mockFocusEffects = new Set();

jest.mock('@react-navigation/native', () => {
  const React = require('react');

  return {
    useFocusEffect: (callback) => {
      React.useEffect(() => {
        mockFocusEffects.add(callback);
        const cleanup = callback();

        return () => {
          mockFocusEffects.delete(callback);
          cleanup?.();
        };
      }, [callback]);
    },
  };
});

jest.mock('../components/UI/IconButton', () => {
  return function MockIconButton(props) {
    mockIconButton(props);
    return null;
  };
});

jest.mock('../hooks/useActiveGroup', () => ({
  useActiveGroup: jest.fn(),
}));

jest.mock('../hooks/useGroupsHub', () => ({
  useGroupsHub: jest.fn(),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');
  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import { HomeHeaderRight } from '../screens/Groups/HomeHeaderRight';
import { useActiveGroup } from '../hooks/useActiveGroup';
import { useGroupsHub } from '../hooks/useGroupsHub';
import { AuthContext } from '../store/auth-context';

const defaultActiveGroup = {
  scope: { kind: 'public' },
  activeGroupId: null,
  setActive: jest.fn(),
  clear: jest.fn(),
};

describe('HomeHeaderRight', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusEffects.clear();
    useActiveGroup.mockReturnValue(defaultActiveGroup);
    useGroupsHub.mockReturnValue({
      data: { owned: [], joined: [] },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
  });

  function getIconButtonProps(testID) {
    const matchingCalls = mockIconButton.mock.calls.filter(([{ testID: id }]) => id === testID);
    return matchingCalls[matchingCalls.length - 1]?.[0];
  }

  async function openMenu(renderer) {
    const overflowProps = getIconButtonProps('home.header.other-options');
    await act(async () => {
      overflowProps.onPress();
    });
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

  it('keeps scope-toggle enabled for a group owner when the hub fetch failed, and switches to private', async () => {
    const navigation = { navigate: jest.fn() };
    const setActive = jest.fn().mockResolvedValue({ status: 200 });
    useActiveGroup.mockReturnValue({
      scope: { kind: 'public' },
      activeGroupId: 'group-1',
      setActive,
      clear: jest.fn(),
    });
    useGroupsHub.mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: 'Not Found' },
      refresh: jest.fn(),
    });

    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ isGroupOwner: true }}>
          <HomeHeaderRight navigation={navigation} tintColor="#fff" />
        </AuthContext.Provider>
      );
    });

    await openMenu(renderer);

    const scopeToggle = renderer.root.findByProps({ testID: 'home.menu.scope-toggle' });
    expect(scopeToggle.props.disabled).toBe(false);

    await act(async () => {
      scopeToggle.props.onPress();
    });

    expect(setActive).toHaveBeenCalledWith('group-1');
    expect(navigation.navigate).toHaveBeenCalledWith('PrivateHomeScreen', {
      scope: { kind: 'private', groupId: 'group-1' },
    });
  });

  it('refreshes the groups hub when the screen comes into focus', async () => {
    const refresh = jest.fn();
    useGroupsHub.mockReturnValue({
      data: { owned: [], joined: [] },
      isLoading: false,
      error: null,
      refresh,
    });

    await act(async () => {
      create(<HomeHeaderRight navigation={{ navigate: jest.fn() }} tintColor="#fff" />);
    });

    expect(mockFocusEffects.size).toBeGreaterThan(0);

    refresh.mockClear();
    await act(async () => {
      mockFocusEffects.forEach((callback) => callback());
    });

    expect(refresh).toHaveBeenCalled();
  });
});
