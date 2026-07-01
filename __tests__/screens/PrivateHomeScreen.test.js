const mockHomeCard = jest.fn(() => null);
const mockBigButton = jest.fn(() => null);
const mockIconButton = jest.fn(() => null);
const mockCenteredModal = jest.fn();
const mockColorPalettePicker = jest.fn();
const mockLockedGroupOwnerModal = jest.fn(() => null);
const mockLockedGroupMemberBanner = jest.fn(() => null);
const mockUseActiveGroup = jest.fn();
const mockUseGroupsHub = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    const React = require('react');
    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock('../../utils/orientation', () => ({
  handleOrientation: jest.fn(),
}));

jest.mock('../../components/UI/HomeCard', () => {
  return function MockHomeCard(props) {
    mockHomeCard(props);
    return null;
  };
});

jest.mock('../../components/UI/BigButton', () => {
  return function MockBigButton(props) {
    mockBigButton(props);
    return null;
  };
});

jest.mock('../../components/UI/IconButton', () => {
  return function MockIconButton(props) {
    mockIconButton(props);
    return null;
  };
});

jest.mock('../../components/UI/CenteredModal', () => {
  return function MockCenteredModal(props) {
    mockCenteredModal(props);
    return props.isModalVisible ? props.children : null;
  };
});

jest.mock('../../components/UI/ColorPalettePicker', () => {
  return function MockColorPalettePicker(props) {
    mockColorPalettePicker(props);
    return null;
  };
});

jest.mock('../../components/Groups/LockedGroupOwnerModal', () => {
  return function MockLockedGroupOwnerModal(props) {
    mockLockedGroupOwnerModal(props);
    return null;
  };
});

jest.mock('../../components/Groups/LockedGroupMemberBanner', () => {
  return function MockLockedGroupMemberBanner(props) {
    mockLockedGroupMemberBanner(props);
    return null;
  };
});

jest.mock('../../services/groups/groupApi', () => ({
  updateGroupSettings: jest.fn(),
}));

jest.mock('../../hooks/useActiveGroup', () => ({
  useActiveGroup: () => mockUseActiveGroup(),
}));

jest.mock('../../hooks/useGroupsHub', () => ({
  useGroupsHub: () => mockUseGroupsHub(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { Share, Alert } from 'react-native';

import PrivateHomeScreen from '../../screens/Groups/PrivateHomeScreen';
import { handleOrientation } from '../../utils/orientation';
import { updateGroupSettings } from '../../services/groups/groupApi';

describe('PrivateHomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  async function renderScreen({
    scope = { kind: 'private', groupId: 'g-7' },
    groupsData = { owned: [], joined: [] },
  } = {}) {
    mockUseActiveGroup.mockReturnValue({ scope, clear: jest.fn() });
    mockUseGroupsHub.mockReturnValue({ data: groupsData, refresh: jest.fn() });

    const navigation = { navigate: jest.fn(), setOptions: jest.fn() };

    let renderer;
    await act(async () => {
      renderer = create(
        <PrivateHomeScreen
          navigation={navigation}
          route={{ params: { scope } }}
        />
      );
      await Promise.resolve();
    });

    return { renderer, navigation };
  }

  function lastSetOptions(navigation) {
    const calls = navigation.setOptions.mock.calls;
    return calls[calls.length - 1][0];
  }

  async function renderHeader(navigation) {
    const options = lastSetOptions(navigation);
    let headerRoot;
    await act(async () => {
      headerRoot = create(options.headerRight());
    });
    return headerRoot;
  }

  it('renders the active group name in private-home.title and forces portrait orientation', async () => {
    const { renderer } = await renderScreen({
      scope: { kind: 'private', groupId: 'g-7' },
      groupsData: {
        owned: [{ id: 'g-7', name: 'Waldos Of The World', role: 'owner' }],
        joined: [],
      },
    });

    const titleNode = renderer.root.findByProps({ testID: 'private-home.title' });
    expect(titleNode.props.children).toBe('Waldos Of The World');
    expect(handleOrientation).toHaveBeenCalledWith('portrait');
  });

  it('does not render the legacy back-to-public button', async () => {
    const { renderer } = await renderScreen({
      groupsData: {
        owned: [{ id: 'g-7', name: 'Waldos', role: 'owner' }],
        joined: [],
      },
    });

    expect(() => renderer.root.findByProps({ testID: 'private-home.button.back-to-public' })).toThrow();
  });

  describe('owner', () => {
    const ownerData = {
      owned: [{ id: 'g-7', name: 'Waldos', role: 'owner', joining_code: 'WALDO42' }],
      joined: [],
    };

    it('exposes the settings gear via headerRight', async () => {
      const { navigation } = await renderScreen({ groupsData: ownerData });

      const options = lastSetOptions(navigation);
      expect(options.title).toBe('Waldos');
      expect(options.headerRight).toBeInstanceOf(Function);

      const headerRoot = await renderHeader(navigation);

      const gear = headerRoot.root.findByProps({ testID: 'private-home.button.settings' });
      expect(gear.props.accessibilityLabel).toBe('Group settings');
    });

    it('navigates to GroupSettingsScreen when the gear is pressed', async () => {
      const { navigation } = await renderScreen({ groupsData: ownerData });

      const headerRoot = await renderHeader(navigation);

      await act(async () => {
        headerRoot.root.findByProps({ testID: 'private-home.button.settings' }).props.onPress();
      });

      expect(navigation.navigate).toHaveBeenCalledWith('GroupSettingsScreen');
    });

    it('renders the share-code icon in the header', async () => {
      const { navigation } = await renderScreen({ groupsData: ownerData });

      const headerRoot = await renderHeader(navigation);

      const button = headerRoot.root.findByProps({ testID: 'private-home.button.share-code' });
      expect(button.props.accessibilityLabel).toBe('Share invite code');
    });

    it('shares the joining code via Share.share when the share-code icon is pressed', async () => {
      const { navigation } = await renderScreen({ groupsData: ownerData });

      const headerRoot = await renderHeader(navigation);

      await act(async () => {
        headerRoot.root.findByProps({ testID: 'private-home.button.share-code' }).props.onPress();
        await Promise.resolve();
      });

      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('WALDO42') })
      );
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('renders the switch-to-public icon in the header', async () => {
      const { navigation } = await renderScreen({ groupsData: ownerData });

      const headerRoot = await renderHeader(navigation);

      const button = headerRoot.root.findByProps({ testID: 'private-home.button.switch-to-public' });
      expect(button.props.accessibilityLabel).toBe('Switch to public');
    });

    it('lets the owner change colors via a hidden long-press on the title (no visible button)', async () => {
      updateGroupSettings.mockResolvedValue({ status: 200 });
      const { renderer } = await renderScreen({ groupsData: ownerData });

      // No visible color button anywhere in the UI.
      expect(() => renderer.root.findByProps({ testID: 'private-home.color-editor.confirm.ok' })).toThrow();

      // Hidden trigger: long-press the title (owner only).
      await act(async () => {
        renderer.root.findByProps({ testID: 'private-home.title' }).props.onLongPress();
      });

      // Editor opened -> both pickers rendered.
      const pickerCalls = mockColorPalettePicker.mock.calls;
      expect(pickerCalls.length).toBe(2);

      await act(async () => {
        pickerCalls[0][0].onValueChange('#111111'); // primary
        pickerCalls[1][0].onValueChange('#EEEEEE'); // secondary
      });

      const modalProps = mockCenteredModal.mock.calls[mockCenteredModal.mock.calls.length - 1][0];
      expect(modalProps.confirmTestID).toBe('private-home.color-editor.confirm.ok');

      await act(async () => {
        await modalProps.onPress();
        await Promise.resolve();
      });

      expect(updateGroupSettings).toHaveBeenCalledWith(
        expect.anything(),
        'g-7',
        { primaryColor: '#111111', secondaryColor: '#EEEEEE' },
      );

      const lastModalProps = mockCenteredModal.mock.calls[mockCenteredModal.mock.calls.length - 1][0];
      expect(lastModalProps.isModalVisible).toBe(false);
    });
  });

  describe('non-owner member', () => {
    const memberData = {
      owned: [],
      joined: [{ id: 'g-7', name: 'Waldos', role: 'member', joining_code: 'WALDO42' }],
    };

    it('renders the switch-to-public icon but no owner-only icons', async () => {
      const { navigation } = await renderScreen({ groupsData: memberData });

      const options = lastSetOptions(navigation);
      expect(options.headerRight).toBeInstanceOf(Function);

      const headerRoot = await renderHeader(navigation);

      const switchButton = headerRoot.root.findByProps({
        testID: 'private-home.button.switch-to-public',
      });
      expect(switchButton.props.accessibilityLabel).toBe('Switch to public');

      expect(() => headerRoot.root.findByProps({ testID: 'private-home.button.share-code' })).toThrow();
      expect(() => headerRoot.root.findByProps({ testID: 'private-home.button.settings' })).toThrow();
    });

    it('does not expose the hidden color editor (title has no onLongPress)', async () => {
      const { renderer } = await renderScreen({ groupsData: memberData });

      const title = renderer.root.findByProps({ testID: 'private-home.title' });
      expect(title.props.onLongPress).toBeUndefined();
      expect(title.props.accessibilityLabel).toBeUndefined();
    });
  });

  describe('locked group signaling', () => {
    it('shows the owner modal (visible) and no member banner when owner views a locked group', async () => {
      const { navigation } = await renderScreen({
        groupsData: {
          owned: [{ id: 'g-7', name: 'Waldos', role: 'owner', locked: true }],
          joined: [],
        },
      });

      const ownerModalCalls = mockLockedGroupOwnerModal.mock.calls.map(([props]) => props);
      const lastOwnerModal = ownerModalCalls[ownerModalCalls.length - 1];
      expect(lastOwnerModal.visible).toBe(true);
      expect(lastOwnerModal.groupName).toBe('Waldos');

      const bannerCalls = mockLockedGroupMemberBanner.mock.calls.map(([props]) => props);
      expect(bannerCalls).toHaveLength(0);
      expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('navigates to the paywall (intent=store) when the owner taps Renew', async () => {
      const { navigation } = await renderScreen({
        groupsData: {
          owned: [{ id: 'g-7', name: 'Waldos', role: 'owner', locked: true }],
          joined: [],
        },
      });

      const ownerModalCalls = mockLockedGroupOwnerModal.mock.calls.map(([props]) => props);
      const lastOwnerModal = ownerModalCalls[ownerModalCalls.length - 1];

      await act(async () => {
        lastOwnerModal.onRenew();
      });

      expect(navigation.navigate).toHaveBeenCalledWith('PaywallScreen', { intent: 'store' });
    });

    it('navigates to MemberManagementScreen when the owner taps Transfer', async () => {
      const { navigation } = await renderScreen({
        groupsData: {
          owned: [{ id: 'g-7', name: 'Waldos', role: 'owner', locked: true }],
          joined: [],
        },
      });

      const ownerModalCalls = mockLockedGroupOwnerModal.mock.calls.map(([props]) => props);
      const lastOwnerModal = ownerModalCalls[ownerModalCalls.length - 1];

      await act(async () => {
        lastOwnerModal.onTransfer();
      });

      expect(navigation.navigate).toHaveBeenCalledWith('MemberManagementScreen');
    });

    it('hides the owner modal when dismissed but keeps the lock badge', async () => {
      const { renderer, navigation } = await renderScreen({
        groupsData: {
          owned: [{ id: 'g-7', name: 'Waldos', role: 'owner', locked: true }],
          joined: [],
        },
      });

      const ownerModalCalls = mockLockedGroupOwnerModal.mock.calls.map(([props]) => props);
      const lastOwnerModal = ownerModalCalls[ownerModalCalls.length - 1];

      await act(async () => {
        lastOwnerModal.onDismiss();
      });

      const afterDismiss = mockLockedGroupOwnerModal.mock.calls.map(([props]) => props).pop();
      expect(afterDismiss.visible).toBe(false);
      expect(renderer.root.findByProps({ testID: 'private-home.lock-badge' })).toBeTruthy();
      expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('shows the member banner (and no owner modal) when a non-owner views a locked group', async () => {
      await renderScreen({
        groupsData: {
          owned: [],
          joined: [{ id: 'g-7', name: 'Waldos', role: 'member', locked: true }],
        },
      });

      const bannerCalls = mockLockedGroupMemberBanner.mock.calls.map(([props]) => props);
      expect(bannerCalls.length).toBeGreaterThanOrEqual(1);
      expect(bannerCalls[bannerCalls.length - 1].groupName).toBe('Waldos');

      const ownerModalCalls = mockLockedGroupOwnerModal.mock.calls.map(([props]) => props);
      const visibleOwnerModals = ownerModalCalls.filter((props) => props.visible);
      expect(visibleOwnerModals).toHaveLength(0);
    });

    it('shows neither the owner modal nor the member banner when the group is not locked', async () => {
      await renderScreen({
        groupsData: {
          owned: [{ id: 'g-7', name: 'Waldos', role: 'owner', locked: false }],
          joined: [{ id: 'g-9', name: 'Other', role: 'member', locked: false }],
        },
      });

      const ownerModalCalls = mockLockedGroupOwnerModal.mock.calls.map(([props]) => props);
      const visibleOwnerModals = ownerModalCalls.filter((props) => props.visible);
      expect(visibleOwnerModals).toHaveLength(0);

      expect(mockLockedGroupMemberBanner.mock.calls).toHaveLength(0);
    });
  });
});
