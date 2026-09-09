const mockBigButton = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);
const mockUseGroupsHub = jest.fn();
const mockUseActiveGroup = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    const React = require('react');
    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock('../../components/UI/BigButton', () => {
  return function MockBigButton(props) {
    mockBigButton(props);
    return null;
  };
});

jest.mock('../../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../../hooks/useGroupsHub', () => ({
  useGroupsHub: () => mockUseGroupsHub(),
}));

jest.mock('../../hooks/useActiveGroup', () => ({
  useActiveGroup: () => mockUseActiveGroup(),
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

import GroupsListScreen from '../../screens/Groups/GroupsListScreen';
import { AuthContext } from '../../store/auth-context';

describe('GroupsListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  async function renderScreen({ authContext = {}, hubData = null, isLoading = false, error = null, setActive = jest.fn().mockResolvedValue({ status: 200 }) } = {}) {
    mockUseGroupsHub.mockReturnValue({
      data: hubData,
      isLoading,
      error,
      refresh: jest.fn(),
    });
    mockUseActiveGroup.mockReturnValue({ setActive });

    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={authContext}>
          <GroupsListScreen navigation={{ navigate: jest.fn() }} />
        </AuthContext.Provider>
      );
      await Promise.resolve();
    });

    return renderer;
  }

  it('renders the empty state with the groups-list.container and groups-list.empty testIDs when no groups', async () => {
    const renderer = await renderScreen({
      authContext: { paidTier: 1 },
      hubData: { owned: [], joined: [], pendingInvites: [] },
    });

    expect(renderer.root.findByProps({ testID: 'groups-list.container' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'groups-list.empty' })).toBeTruthy();
  });

  it('always offers the create-group CTA regardless of tier or ownership (Fix A: gate removed)', async () => {
    const renderer = await renderScreen({
      authContext: { paidTier: 0 },
      hubData: { owned: [], joined: [], pendingInvites: [] },
    });

    expect(renderer.root.findByProps({ testID: 'groups-list.button.create' })).toBeTruthy();

    const ownedRenderer = await renderScreen({
      authContext: { paidTier: 0 },
      hubData: {
        owned: [{ id: 'g-1', role: 'owner', name: 'Mine' }],
        joined: [],
        pendingInvites: [],
      },
    });

    expect(ownedRenderer.root.findAllByProps({ testID: 'groups-list.button.create' })).toHaveLength(1);
  });

  it('renders the Store entry point for a tier-0 user and routes it to the paywall with intent=store', async () => {
    const navigation = { navigate: jest.fn() };
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [], joined: [], pendingInvites: [] },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    mockUseActiveGroup.mockReturnValue({ setActive: jest.fn().mockResolvedValue({ status: 200 }) });

    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ paidTier: 0 }}>
          <GroupsListScreen navigation={navigation} />
        </AuthContext.Provider>
      );
      await Promise.resolve();
    });

    expect(renderer.root.findByProps({ testID: 'groups-list.button.create' })).toBeTruthy();

    const storeButton = renderer.root.findByProps({ testID: 'groups-list.button.store' });
    expect(storeButton).toBeTruthy();

    await act(async () => {
      storeButton.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('PaywallScreen', { intent: 'store' });
  });

  it('calls setActive with the tapped group id and then navigates to PrivateHomeScreen with private scope', async () => {
    const navigation = { navigate: jest.fn() };
    const setActive = jest.fn().mockResolvedValue({ status: 200 });

    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [{ id: 'g-7', role: 'owner', name: 'Mine' }],
        joined: [],
        pendingInvites: [],
      },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    mockUseActiveGroup.mockReturnValue({ setActive });

    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ paidTier: 2 }}>
          <GroupsListScreen navigation={navigation} />
        </AuthContext.Provider>
      );
      await Promise.resolve();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'groups-list.button.open-g-7' }).props.onPress();
      await Promise.resolve();
    });

    expect(setActive).toHaveBeenCalledWith('g-7');
    expect(navigation.navigate).toHaveBeenCalledWith('PrivateHomeScreen', {
      scope: { kind: 'private', groupId: 'g-7' },
    });
  });

  it('surfaces an Alert and skips navigation when setActive rejects on openGroup', async () => {
    const navigation = { navigate: jest.fn() };
    const setActive = jest.fn().mockRejectedValue({
      response: { status: 422, data: { error: 'boom' } },
    });

    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [{ id: 'g-7', role: 'owner', name: 'Mine' }],
        joined: [],
        pendingInvites: [],
      },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    mockUseActiveGroup.mockReturnValue({ setActive });

    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ paidTier: 2 }}>
          <GroupsListScreen navigation={navigation} />
        </AuthContext.Provider>
      );
      await Promise.resolve();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'groups-list.button.open-g-7' }).props.onPress();
      await Promise.resolve();
    });

    expect(setActive).toHaveBeenCalledWith('g-7');
    expect(Alert.alert).toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
