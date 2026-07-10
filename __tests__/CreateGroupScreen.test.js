const mockBigButton = jest.fn(() => null);
const mockButton = jest.fn(() => null);
const mockCenteredModal = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);

jest.mock('../components/UI/BigButton', () => {
  return function MockBigButton(props) {
    mockBigButton(props);
    return null;
  };
});

jest.mock('../components/UI/Button', () => {
  return function MockButton(props) {
    mockButton(props);
    return null;
  };
});

jest.mock('../components/UI/CenteredModal', () => {
  return function MockCenteredModal(props) {
    mockCenteredModal(props);
    return null;
  };
});

jest.mock('../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../services/groups/groupApi', () => ({
  createGroup: jest.fn(),
  fetchGroups: jest.fn(),
  setActiveGroup: jest.fn(),
}));

jest.mock('../hooks/useGroupsHub', () => ({
  useGroupsHub: jest.fn(() => ({
    data: { owned: [], joined: [] },
    isLoading: false,
    error: null,
    refresh: jest.fn(),
  })),
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

import CreateGroupScreen from '../screens/Groups/CreateGroupScreen';
import { AuthContext } from '../store/auth-context';
import { useGroupsHub } from '../hooks/useGroupsHub';

describe('CreateGroupScreen store entry point (TIER-0)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function getBigButtonProps(testID) {
    const matchingCalls = mockBigButton.mock.calls.filter(([props]) => props.testID === testID);
    return matchingCalls[matchingCalls.length - 1]?.[0];
  }

  async function renderScreen(contextValue) {
    const navigation = { navigate: jest.fn(), replace: jest.fn() };
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue}>
          <CreateGroupScreen navigation={navigation} />
        </AuthContext.Provider>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    return { renderer, navigation };
  }

  it('renders the unlock CTA (not a loading overlay) and routes to the paywall with intent=create-group', async () => {
    const { renderer, navigation } = await renderScreen({ premiumTier: 0 });

    expect(mockLoadingOverlay).not.toHaveBeenCalled();

    const unlockProps = getBigButtonProps('create-group.button.unlock');
    expect(unlockProps).toBeTruthy();
    expect(unlockProps.testID).toBe('create-group.button.unlock');

    await act(async () => {
      unlockProps.onPress();
    });

    expect(navigation.replace).toHaveBeenCalledWith('PaywallScreen', { intent: 'create-group' });
  });

  it('shows the already-owns message and not the unlock CTA when a Premium+ user owns a group', async () => {
    const setActive = jest.fn().mockResolvedValue(undefined);
    useGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-owned' }], joined: [] },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    jest.requireMock('../hooks/useActiveGroup').useActiveGroup.mockReturnValue({
      setActive,
      clear: jest.fn(),
      scope: { kind: 'public' },
      activeGroupId: null,
    });

    const { renderer, navigation } = await renderScreen({ premiumTier: 2 });

    expect(renderer.root.findByProps({ testID: 'create-group.message.already-owns' })).toBeTruthy();

    expect(getBigButtonProps('create-group.button.unlock')).toBeFalsy();

    const goToGroupProps = renderer.root.findByProps({ testID: 'create-group.button.go-to-group' }).props;
    await act(async () => {
      await goToGroupProps.onPress();
      await Promise.resolve();
    });

    expect(setActive).toHaveBeenCalledWith('g-owned');
    expect(navigation.replace).toHaveBeenCalledWith('PrivateHomeScreen', {
      scope: { kind: 'private', groupId: 'g-owned' },
    });
  });

  it('shows the already-owns message without the unlock CTA even when the user is not Premium+', async () => {
    const setActive = jest.fn().mockResolvedValue(undefined);
    useGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-owned' }], joined: [] },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    jest.requireMock('../hooks/useActiveGroup').useActiveGroup.mockReturnValue({
      setActive,
      clear: jest.fn(),
      scope: { kind: 'public' },
      activeGroupId: null,
    });

    const { renderer } = await renderScreen({ premiumTier: 0 });

    expect(renderer.root.findByProps({ testID: 'create-group.message.already-owns' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'create-group.message.already-owns' }).props.children).toBe('You can only create 1 group.');

    expect(getBigButtonProps('create-group.button.unlock')).toBeFalsy();
  });
});
