const mockButton = jest.fn(() => null);
const mockCenteredModal = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);
const mockUseActiveGroup = jest.fn();
const mockUseGroupsHub = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    const React = require('react');
    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock('../../components/UI/Button', () => {
  return function MockButton(props) {
    mockButton(props);
    return null;
  };
});

jest.mock('../../components/UI/CenteredModal', () => {
  return function MockCenteredModal(props) {
    mockCenteredModal(props);
    return null;
  };
});

jest.mock('../../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../../hooks/useActiveGroup', () => ({
  useActiveGroup: () => mockUseActiveGroup(),
}));

jest.mock('../../hooks/useGroupsHub', () => ({
  useGroupsHub: () => mockUseGroupsHub(),
}));

jest.mock('../../services/groups/groupMembershipApi', () => ({
  listMembers: jest.fn(),
  removeMember: jest.fn(),
  transferOwnership: jest.fn(),
}));

jest.mock('../../store/auth-context', () => {
  const React = require('react');
  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import MemberManagementScreen from '../../screens/Groups/MemberManagementScreen';
import { listMembers, removeMember } from '../../services/groups/groupMembershipApi';

describe('MemberManagementScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function renderScreen({ scope = { kind: 'private', groupId: 'g-3' }, groupsData, members = [] } = {}) {
    mockUseActiveGroup.mockReturnValue({ scope });
    mockUseGroupsHub.mockReturnValue({ data: groupsData, refresh: jest.fn() });
    listMembers.mockResolvedValue({ status: 200, data: members });

    let renderer;
    await act(async () => {
      renderer = create(<MemberManagementScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });
    return renderer;
  }

  it('renders the remove confirm modal trigger for non-owner members and surfaces the confirm testID', async () => {
    const renderer = await renderScreen({
      groupsData: {
        owned: [{ id: 'g-3', role: 'owner', name: 'Mine' }],
        joined: [],
      },
      members: [{ id: 'm-2', user_id: 'u-2', username: 'waldo', role: 'member' }],
    });

    expect(renderer.root.findByProps({ testID: 'member-mgmt.button.remove' })).toBeTruthy();

    await act(async () => {
      renderer.root.findByProps({ testID: 'member-mgmt.button.remove' }).props.onPress();
      await Promise.resolve();
    });

    const removeModalCall = mockCenteredModal.mock.calls
      .map(([props]) => props)
      .filter((props) => props.confirmTestID === 'members.remove.confirm.ok' && props.isModalVisible)
      .pop();

    expect(removeModalCall).toBeTruthy();
  });

  it('shows no leave-self control for the owner (owner cannot leave; only member-mgmt transfer/remove buttons exist for non-owners)', async () => {
    const renderer = await renderScreen({
      groupsData: {
        owned: [{ id: 'g-3', role: 'owner', name: 'Mine' }],
        joined: [],
      },
      members: [{ id: 'm-1', user_id: 'u-1', username: 'owner', role: 'owner' }],
    });

    expect(renderer.root.findAllByProps({ testID: 'member-leave' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'member-mgmt.button.remove' })).toHaveLength(0);
  });

  it('removes the targeted member when the confirm modal is accepted', async () => {
    removeMember.mockResolvedValue({ status: 204, data: null });

    const renderer = await renderScreen({
      groupsData: {
        owned: [{ id: 'g-3', role: 'owner', name: 'Mine' }],
        joined: [],
      },
      members: [{ id: 'm-2', user_id: 'u-2', username: 'waldo', role: 'member' }],
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'member-mgmt.button.remove' }).props.onPress();
      await Promise.resolve();
    });

    const removeModalCall = mockCenteredModal.mock.calls
      .map(([props]) => props)
      .filter((props) => props.confirmTestID === 'members.remove.confirm.ok' && props.isModalVisible)
      .pop();

    await act(async () => {
      await removeModalCall.onPress();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(removeMember).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'g-3',
      membershipId: 'm-2',
      removedUserId: 'u-2',
    }));
  });

  it('disables the remove trigger during an in-flight removeMember and surfaces only one API call', async () => {
    let resolveRemove;
    removeMember.mockReturnValueOnce(new Promise((resolve) => {
      resolveRemove = resolve;
    }));

    const renderer = await renderScreen({
      groupsData: {
        owned: [{ id: 'g-3', role: 'owner', name: 'Mine' }],
        joined: [],
      },
      members: [{ id: 'm-2', user_id: 'u-2', username: 'waldo', role: 'member' }],
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'member-mgmt.button.remove' }).props.onPress();
      await Promise.resolve();
    });

    const confirmModalCall = mockCenteredModal.mock.calls
      .map(([props]) => props)
      .filter((props) => props.confirmTestID === 'members.remove.confirm.ok' && props.isModalVisible)
      .pop();

    let confirmPromise;
    await act(async () => {
      confirmPromise = confirmModalCall.onPress();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const removeButtonDuringFlight = renderer.root.findAllByProps({ testID: 'member-mgmt.button.remove' })[0];
    expect(removeButtonDuringFlight.props.disabled).toBe(true);

    const removeModalCalls = mockCenteredModal.mock.calls
      .map(([props]) => props)
      .filter((props) => props.confirmTestID === 'members.remove.confirm.ok');
    const latestRemoveModalCall = removeModalCalls[removeModalCalls.length - 1];
    expect(latestRemoveModalCall.isModalVisible).toBe(false);

    await act(async () => {
      resolveRemove({ status: 204, data: null });
      await confirmPromise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(removeMember).toHaveBeenCalledTimes(1);
  });
});
