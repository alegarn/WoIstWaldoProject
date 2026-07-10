jest.mock('../../components/UI/IconButton', () => {
  function MockIconButton(props) {
    return null;
  }
  return {
    __esModule: true,
    default: MockIconButton,
  };
});

jest.mock('../../hooks/useActiveGroup', () => ({
  useActiveGroup: jest.fn(),
}));

jest.mock('../../hooks/useGroupsHub', () => ({
  useGroupsHub: jest.fn(),
}));

jest.mock('../../store/auth-context', () => {
  const React = require('react');
  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';
import { Alert } from 'react-native';

import { HomeHeaderRight } from '../../screens/Groups/HomeHeaderRight';
import IconButton from '../../components/UI/IconButton';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { useGroupsHub } from '../../hooks/useGroupsHub';

describe('HomeHeaderRight', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  function renderHeader({ activeGroup, groupsHubData, navigation = { navigate: jest.fn() } } = {}) {
    useActiveGroup.mockReturnValue(activeGroup);
    useGroupsHub.mockReturnValue({ data: groupsHubData });
    let renderer;
    act(() => {
      renderer = create(<HomeHeaderRight navigation={navigation} tintColor="#fff" />);
    });
    return { renderer, navigation };
  }

  function getToggle(renderer) {
    return renderer.root.findByProps({ testID: 'home.menu.scope-toggle' });
  }

  function openMenu(renderer) {
    const overflow = renderer.root.findByProps({ testID: 'home.header.other-options' });
    act(() => {
      overflow.props.onPress();
    });
  }

  it('invokes setActive with the active group id when toggling from public to private scope', async () => {
    const setActive = jest.fn().mockResolvedValue({ status: 200 });
    const { renderer, navigation } = renderHeader({
      activeGroup: {
        scope: { kind: 'public' },
        activeGroupId: 'g-9',
        setActive,
        clear: jest.fn(),
      },
      groupsHubData: {
        owned: [{ id: 'g-9', role: 'owner' }],
        joined: [],
      },
    });

    openMenu(renderer);

    await act(async () => {
      await getToggle(renderer).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(setActive).toHaveBeenCalledWith('g-9');
    expect(navigation.navigate).toHaveBeenCalledWith('PrivateHomeScreen', {
      scope: { kind: 'private', groupId: 'g-9' },
    });
  });

  it('surfaces an Alert when setActive rejects on scope toggle', async () => {
    const setActive = jest.fn().mockRejectedValue(new Error('server boom'));
    const { renderer, navigation } = renderHeader({
      activeGroup: {
        scope: { kind: 'public' },
        activeGroupId: 'g-9',
        setActive,
        clear: jest.fn(),
      },
      groupsHubData: {
        owned: [{ id: 'g-9', role: 'owner' }],
        joined: [],
      },
    });

    openMenu(renderer);

    await act(async () => {
      await getToggle(renderer).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(setActive).toHaveBeenCalledWith('g-9');
    expect(Alert.alert).toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('keeps the toggle enabled when the user has a membership but no active group', () => {
    const { renderer } = renderHeader({
      activeGroup: {
        scope: { kind: 'public' },
        activeGroupId: null,
        setActive: jest.fn(),
        clear: jest.fn(),
      },
      groupsHubData: {
        owned: [],
        joined: [{ id: 'g-2', role: 'member' }],
      },
    });

    openMenu(renderer);

    const toggle = getToggle(renderer);
    expect(toggle.props.disabled).toBe(false);
  });

  it('navigates to GroupsListScreen when toggling from public to private without an active group', async () => {
    const setActive = jest.fn();
    const { renderer, navigation } = renderHeader({
      activeGroup: {
        scope: { kind: 'public' },
        activeGroupId: null,
        setActive,
        clear: jest.fn(),
      },
      groupsHubData: {
        owned: [],
        joined: [{ id: 'g-2', role: 'member' }],
      },
    });

    openMenu(renderer);

    await act(async () => {
      await getToggle(renderer).props.onPress();
      await Promise.resolve();
    });

    expect(setActive).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith('GroupsListScreen');
    expect(navigation.navigate).not.toHaveBeenCalledWith('PrivateHomeScreen', expect.anything());
  });
});
