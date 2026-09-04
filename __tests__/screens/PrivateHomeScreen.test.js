const mockHomeCard = jest.fn(() => null);
const mockIconButton = jest.fn(() => null);
const mockCenteredModal = jest.fn();
const mockColorPalettePicker = jest.fn();
const mockLockedGroupOwnerModal = jest.fn(() => null);
const mockLockedGroupMemberBanner = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);
const mockBigButton = jest.fn(() => null);
const mockUseActiveGroup = jest.fn();
const mockUseGroupsHub = jest.fn();
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

jest.mock('../../utils/orientation', () => ({
  handleOrientation: jest.fn(),
}));

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
}));

jest.mock('../../components/UI/HomeCard', () => {
  return function MockHomeCard(props) {
    mockHomeCard(props);
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

jest.mock('../../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../../components/UI/BigButton', () => {
  return function MockBigButton(props) {
    mockBigButton(props);
    return null;
  };
});

jest.mock('../../services/groups/groupApi', () => ({
  updateGroupSettings: jest.fn(),
  deletePrivateImage: jest.fn(),
}));

jest.mock('../../services/groups/groupHomeBackgrounds', () => ({
  resolveHomeBackground: jest.fn(),
  deleteHomeBackgroundFile: jest.fn(),
  SLOTS: ['hide', 'find', 'ranking'],
}));

jest.mock('../../services/groups/homeBackgroundUpload', () => ({
  uploadHomeBackground: jest.fn(),
}));

jest.mock('../../hooks/useActiveGroup', () => ({
  useActiveGroup: () => mockUseActiveGroup(),
}));

jest.mock('../../hooks/useGroupsHub', () => ({
  useGroupsHub: () => mockUseGroupsHub(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { Share, Alert, StyleSheet, View } from 'react-native';

import PrivateHomeScreen from '../../screens/Groups/PrivateHomeScreen';
import { AuthContext } from '../../store/auth-context';
import { handleOrientation } from '../../utils/orientation';
import { updateGroupSettings, deletePrivateImage } from '../../services/groups/groupApi';
import { resolveHomeBackground, deleteHomeBackgroundFile } from '../../services/groups/groupHomeBackgrounds';
import { uploadHomeBackground } from '../../services/groups/homeBackgroundUpload';
import { getPrivateGroupTheme } from '../../utils/privateGroupTheme';

describe('PrivateHomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusEffects.clear();
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    resolveHomeBackground.mockResolvedValue(null);
    uploadHomeBackground.mockResolvedValue(null);
    deletePrivateImage.mockResolvedValue({ status: 200 });
  });

  async function renderScreen({
    scope = { kind: 'private', groupId: 'g-7' },
    groupsData = { owned: [], joined: [] },
    authContext = { paidTier: 2 },
    isLoading = false,
    error = null,
  } = {}) {
    mockUseActiveGroup.mockReturnValue({ scope, clear: jest.fn() });
    const refresh = jest.fn();
    mockUseGroupsHub.mockReturnValue({ data: groupsData, isLoading, error, refresh });

    const navigation = { navigate: jest.fn(), setOptions: jest.fn() };

    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ setPrivateMode: jest.fn(), ...authContext }}>
          <PrivateHomeScreen
            navigation={navigation}
            route={{ params: { scope } }}
          />
        </AuthContext.Provider>
      );
      await Promise.resolve();
    });

    return { renderer, navigation, refresh };
  }

  function lastSetOptions(navigation) {
    const calls = navigation.setOptions.mock.calls;
    return calls[calls.length - 1][0];
  }

  async function triggerFocusEffects() {
    await act(async () => {
      [...mockFocusEffects].forEach((callback) => callback());
      await Promise.resolve();
    });
  }

  async function renderHeader(navigation) {
    const options = lastSetOptions(navigation);
    let headerRoot;
    await act(async () => {
      headerRoot = create(options.headerRight());
    });
    return headerRoot;
  }


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
      owned: [{ id: 'g-7', name: 'Waldos', role: 'owner', joining_code: 'WALDO42', primary_color: '#6528F7' }],
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

    it('wires the header background to the group primary_color', async () => {
      const { navigation } = await renderScreen({ groupsData: ownerData });
      const expectedTheme = getPrivateGroupTheme({ primaryColor: '#6528F7' });

      const options = lastSetOptions(navigation);
      expect(options.headerStyle.backgroundColor).toBe('#6528F7');
      expect(options.headerTintColor).toBe(expectedTheme.headerTintColor);
    });

    it('paints the outer container with the resolved group screen color', async () => {
      const { renderer } = await renderScreen({ groupsData: ownerData });
      const expectedTheme = getPrivateGroupTheme({ primaryColor: '#6528F7' });

      const container = renderer.root.findByType(View);

      expect(container).toBeTruthy();
      expect(StyleSheet.flatten(container.props.style).backgroundColor).toBe(expectedTheme.screen);
    });

    it('lets the owner customize colors via the header button', async () => {
      updateGroupSettings.mockResolvedValue({ status: 200 });
      const { renderer, navigation } = await renderScreen({ groupsData: ownerData });
      const expectedTheme = getPrivateGroupTheme({ primaryColor: '#6528F7' });

      const headerRoot = await renderHeader(navigation);

      // Editor not visible initially.
      expect(() => headerRoot.root.findByProps({ testID: 'private-home.color-editor.confirm.ok' })).toThrow();

      // Open editor via header customize button.
      await act(async () => {
        headerRoot.root.findByProps({ testID: 'private-home.button.customize-colors' }).props.onPress();
      });

      const identitySection = renderer.root
        .findAllByProps({ testID: 'private-home.section.identity' })
        .find((node) => node.props.style);

      expect(identitySection).toBeTruthy();
      expect(StyleSheet.flatten(identitySection.props.style).backgroundColor).toBe(expectedTheme.lightPanel);

      const nameInput = renderer.root.findByProps({ testID: 'private-home.input.name' });
      expect(StyleSheet.flatten(nameInput.props.style).backgroundColor).toBe('#FFFFFF');

      // Editor opened -> two color pickers rendered.
      expect(mockColorPalettePicker.mock.calls.length).toBeGreaterThanOrEqual(2);

      const colorCalls = mockColorPalettePicker.mock.calls;
      expect(colorCalls[colorCalls.length - 2][0].appearance).toBe('light');
      expect(colorCalls[colorCalls.length - 1][0].appearance).toBe('light');
      expect(colorCalls[colorCalls.length - 2][0].themeColors.label).toBe(expectedTheme.lightText);
      expect(colorCalls[colorCalls.length - 1][0].themeColors.shadeGrid).toBe(expectedTheme.lightAccentWash);

      await act(async () => {
        colorCalls[colorCalls.length - 2][0].onValueChange('#111111'); // primary
        colorCalls[colorCalls.length - 1][0].onValueChange('#EEEEEE'); // secondary
      });

      const modalProps = mockCenteredModal.mock.calls[mockCenteredModal.mock.calls.length - 1][0];
      expect(modalProps.confirmTestID).toBe('private-home.color-editor.confirm.ok');

      await act(async () => {
        renderer.root.findByProps({ testID: 'private-home.button.save-colors' }).props.onPress();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(updateGroupSettings).toHaveBeenCalledWith(
        expect.anything(),
        'g-7',
        { name: 'Waldos', primaryColor: '#111111', secondaryColor: '#EEEEEE' },
      );

      const lastModalProps = mockCenteredModal.mock.calls[mockCenteredModal.mock.calls.length - 1][0];
      expect(lastModalProps.isModalVisible).toBe(false);
    });

    it('locks the background upload chips but keeps colors editable for a free owner', async () => {
      const { renderer, navigation } = await renderScreen({
        groupsData: ownerData,
        authContext: { paidTier: 0 },
      });

      const headerRoot = await renderHeader(navigation);

      await act(async () => {
        headerRoot.root.findByProps({ testID: 'private-home.button.customize-colors' }).props.onPress();
      });

      expect(renderer.root.findByProps({ testID: 'private-home.button-bg.hide.locked' })).toBeTruthy();
      expect(renderer.root.findByProps({ testID: 'private-home.button-bg.find.locked' })).toBeTruthy();
      expect(renderer.root.findByProps({ testID: 'private-home.button-bg.ranking.locked' })).toBeTruthy();

      expect(() => renderer.root.findByProps({ testID: 'private-home.button-bg.hide.choose' })).toThrow();

      expect(renderer.root.findByProps({ testID: 'private-home.input.name' })).toBeTruthy();
      const colorCalls = mockColorPalettePicker.mock.calls;
      expect(colorCalls.length).toBeGreaterThanOrEqual(2);

      await act(async () => {
        renderer.root.findByProps({ testID: 'private-home.button-bg.hide.locked' }).props.onPress();
      });

      expect(navigation.navigate).toHaveBeenCalledWith('PaywallScreen', { intent: 'personalize-group' });
      expect(uploadHomeBackground).not.toHaveBeenCalled();
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

    it('does not expose the customize colors button for non-owners', async () => {
      const { navigation } = await renderScreen({ groupsData: memberData });

      const headerRoot = await renderHeader(navigation);

      expect(() => headerRoot.root.findByProps({ testID: 'private-home.button.customize-colors' })).toThrow();
    });
  });

  describe('locked group signaling', () => {
    it('shows the owner modal (visible) and no member banner when owner views a locked group', async () => {
      const { navigation } = await renderScreen({
        groupsData: {
          owned: [{ id: 'g-7', name: 'Waldos', role: 'owner', locked: true, primary_color: '#198868', secondary_color: '#FFCC00' }],
          joined: [],
        },
      });

      const ownerModalCalls = mockLockedGroupOwnerModal.mock.calls.map(([props]) => props);
      const lastOwnerModal = ownerModalCalls[ownerModalCalls.length - 1];
      expect(lastOwnerModal.visible).toBe(true);
      expect(lastOwnerModal.groupName).toBe('Waldos');
      expect(lastOwnerModal.primaryColor).toBe('#198868');
      expect(lastOwnerModal.secondaryColor).toBe('#FFCC00');

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

    it('re-arms the owner modal on the next focus after dismissal', async () => {
      await renderScreen({
        groupsData: {
          owned: [{ id: 'g-7', name: 'Waldos', role: 'owner', locked: true }],
          joined: [],
        },
      });

      const lastModal = () => mockLockedGroupOwnerModal.mock.calls.map(([props]) => props).pop();

      await act(async () => {
        lastModal().onDismiss();
      });
      expect(lastModal().visible).toBe(false);

      await triggerFocusEffects();

      expect(lastModal().visible).toBe(true);
    });

    it('shows the member banner (and no owner modal) when a non-owner views a locked group', async () => {
      await renderScreen({
        groupsData: {
          owned: [],
          joined: [{ id: 'g-7', name: 'Waldos', role: 'member', locked: true, primary_color: '#198868', secondary_color: '#FFCC00' }],
        },
      });

      const bannerCalls = mockLockedGroupMemberBanner.mock.calls.map(([props]) => props);
      expect(bannerCalls.length).toBeGreaterThanOrEqual(1);
      expect(bannerCalls[bannerCalls.length - 1].groupName).toBe('Waldos');
      expect(bannerCalls[bannerCalls.length - 1].primaryColor).toBe('#198868');
      expect(bannerCalls[bannerCalls.length - 1].secondaryColor).toBe('#FFCC00');

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

  describe('locked play gating', () => {
    function lastHomeCardProps(testID) {
      const calls = mockHomeCard.mock.calls.filter(
        ([props]) => props && props.testID === testID
      );
      return calls[calls.length - 1][0];
    }

    it('disables the Hide card when the group is locked (owner)', async () => {
      const { navigation } = await renderScreen({
        groupsData: {
          owned: [{ id: 'g-7', name: 'Waldos', role: 'owner', locked: true }],
          joined: [],
        },
      });

      const hideCard = lastHomeCardProps('private-home.button.hide');
      expect(hideCard.onPress).toBeUndefined();
      expect(hideCard.accessibilityState).toEqual({ disabled: true });
      expect(hideCard.pointerEvents).toBe('none');

      const findCard = lastHomeCardProps('private-home.button.find');
      expect(findCard.onPress).toBeUndefined();
      expect(findCard.accessibilityState).toEqual({ disabled: true });
      expect(findCard.pointerEvents).toBe('none');

      const rankingCard = lastHomeCardProps('private-home.button.ranking');
      expect(rankingCard.onPress).toBeInstanceOf(Function);
      expect(rankingCard.pointerEvents).toBeUndefined();

      expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('disables the Hide card when the group is locked (member)', async () => {
      await renderScreen({
        groupsData: {
          owned: [],
          joined: [{ id: 'g-7', name: 'Waldos', role: 'member', locked: true }],
        },
      });

      const hideCard = lastHomeCardProps('private-home.button.hide');
      expect(hideCard.onPress).toBeUndefined();
      expect(hideCard.accessibilityState).toEqual({ disabled: true });
      expect(hideCard.pointerEvents).toBe('none');

      const findCard = lastHomeCardProps('private-home.button.find');
      expect(findCard.onPress).toBeUndefined();
      expect(findCard.accessibilityState).toEqual({ disabled: true });
      expect(findCard.pointerEvents).toBe('none');
    });

    it('keeps the Hide card enabled and navigating when the group is unlocked', async () => {
      const { navigation } = await renderScreen({
        groupsData: {
          owned: [{ id: 'g-7', name: 'Waldos', role: 'owner', locked: false }],
          joined: [],
        },
      });

      const hideCard = lastHomeCardProps('private-home.button.hide');
      expect(hideCard.onPress).toBeInstanceOf(Function);
      expect(hideCard.accessibilityState).toBeUndefined();
      expect(hideCard.pointerEvents).toBe('auto');

      const findCard = lastHomeCardProps('private-home.button.find');
      expect(findCard.onPress).toBeInstanceOf(Function);
      expect(findCard.accessibilityState).toBeUndefined();
      expect(findCard.pointerEvents).toBe('auto');

      await act(async () => {
        hideCard.onPress();
      });

      expect(navigation.navigate).toHaveBeenCalledWith('HidingPathScreen', {
        scope: { kind: 'private', groupId: 'g-7' },
      });

      await act(async () => {
        findCard.onPress();
      });

      expect(navigation.navigate).toHaveBeenCalledWith('GuessPathScreen', {
        scope: { kind: 'private', groupId: 'g-7' },
      });
    });
  });

  describe('home button backgrounds', () => {
    const hideSlot = {
      image_id: 'img-hide',
      file_extension: 'png',
      url: 'https://example.com/hide.png',
    };

    function lastHomeCardProps(testID) {
      const calls = mockHomeCard.mock.calls.filter(
        ([props]) => props && props.testID === testID
      );
      return calls[calls.length - 1][0];
    }

    it('passes the resolved uri to the Hide HomeCard when a hide background is present', async () => {
      resolveHomeBackground.mockResolvedValue('file:///private-home-bg/g-7/hide-img-hide.png');

      await renderScreen({
        groupsData: {
          owned: [{
            id: 'g-7',
            name: 'Waldos',
            role: 'owner',
            home_button_backgrounds: { hide: hideSlot },
          }],
          joined: [],
        },
      });

      expect(resolveHomeBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: 'g-7',
          slot: 'hide',
          imageId: 'img-hide',
          fileExtension: 'png',
          url: 'https://example.com/hide.png',
        })
      );

      expect(lastHomeCardProps('private-home.button.hide').backgroundImage).toEqual({
        uri: 'file:///private-home-bg/g-7/hide-img-hide.png',
      });
    });

    it('falls back to the bundled asset when no background is set for the slot', async () => {
      const bundledHide = require('../../assets/home/WoIstWaldo-character-hide.webp');

      await renderScreen({
        groupsData: {
          owned: [{ id: 'g-7', name: 'Waldos', role: 'owner' }],
          joined: [],
        },
      });

      expect(resolveHomeBackground).not.toHaveBeenCalled();

      expect(lastHomeCardProps('private-home.button.hide').backgroundImage).toBe(bundledHide);
    });

    it('runs updateGroupSettings then deletePrivateImage in order when the owner chooses a new hide background', async () => {
      updateGroupSettings.mockResolvedValue({ status: 200 });
      uploadHomeBackground.mockResolvedValue({ imageId: 'img-new' });

      const { renderer, navigation } = await renderScreen({
        groupsData: {
          owned: [{
            id: 'g-7',
            name: 'Waldos',
            role: 'owner',
            home_button_backgrounds: { hide: hideSlot },
          }],
          joined: [],
        },
      });

      const headerRoot = await renderHeader(navigation);

      await act(async () => {
        headerRoot.root.findByProps({ testID: 'private-home.button.customize-colors' }).props.onPress();
      });

      const chooseButton = renderer.root.findByProps({ testID: 'private-home.button-bg.hide.choose' });

      await act(async () => {
        await chooseButton.props.onPress();
        await Promise.resolve();
      });

      expect(uploadHomeBackground).toHaveBeenCalledWith(
        expect.objectContaining({ groupId: 'g-7' })
      );
      expect(updateGroupSettings).toHaveBeenCalledWith(
        expect.anything(),
        'g-7',
        { hideBgImageId: 'img-new' }
      );
      expect(deletePrivateImage).toHaveBeenCalledWith(expect.anything(), 'g-7', 'img-hide');
      expect(deleteHomeBackgroundFile).toHaveBeenCalledWith('g-7', 'hide', 'img-hide');

      const updateOrder = updateGroupSettings.mock.invocationCallOrder[0];
      const deleteOrder = deletePrivateImage.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(deleteOrder);
    });

    it('guards against double-tap re-entry on the Choose button (uploads once)', async () => {
      let resolveUpload;
      uploadHomeBackground.mockImplementation(
        () => new Promise((resolve) => { resolveUpload = resolve; })
      );

      const { renderer, navigation } = await renderScreen({
        groupsData: {
          owned: [{
            id: 'g-7',
            name: 'Waldos',
            role: 'owner',
            home_button_backgrounds: { hide: hideSlot },
          }],
          joined: [],
        },
      });

      const headerRoot = await renderHeader(navigation);

      await act(async () => {
        headerRoot.root.findByProps({ testID: 'private-home.button.customize-colors' }).props.onPress();
      });

      const chooseButton = renderer.root.findByProps({ testID: 'private-home.button-bg.hide.choose' });

      let firstCall;
      await act(async () => {
        firstCall = chooseButton.props.onPress();
        await Promise.resolve();
      });

      await act(async () => {
        chooseButton.props.onPress();
        await Promise.resolve();
      });

      await act(async () => {
        resolveUpload({ imageId: 'img-new' });
        await firstCall;
        await Promise.resolve();
      });

      expect(uploadHomeBackground).toHaveBeenCalledTimes(1);
    });

    it('does NOT call deletePrivateImage or deleteHomeBackgroundFile when the Choose PATCH fails (non-2xx)', async () => {
      updateGroupSettings.mockResolvedValue({ status: 422 });
      uploadHomeBackground.mockResolvedValue({ imageId: 'img-new' });

      const { renderer, navigation } = await renderScreen({
        groupsData: {
          owned: [{
            id: 'g-7',
            name: 'Waldos',
            role: 'owner',
            home_button_backgrounds: { hide: hideSlot },
          }],
          joined: [],
        },
      });

      const headerRoot = await renderHeader(navigation);

      await act(async () => {
        headerRoot.root.findByProps({ testID: 'private-home.button.customize-colors' }).props.onPress();
      });

      const chooseButton = renderer.root.findByProps({ testID: 'private-home.button-bg.hide.choose' });

      await act(async () => {
        await chooseButton.props.onPress();
        await Promise.resolve();
      });

      expect(updateGroupSettings).toHaveBeenCalledWith(
        expect.anything(),
        'g-7',
        { hideBgImageId: 'img-new' }
      );
      expect(deletePrivateImage).not.toHaveBeenCalled();
      expect(deleteHomeBackgroundFile).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith('Error', expect.any(String));
    });

    it('runs updateGroupSettings(null) then deletePrivateImage then deleteHomeBackgroundFile then refresh on Remove', async () => {
      updateGroupSettings.mockResolvedValue({ status: 200 });
      const refresh = jest.fn();

      mockUseActiveGroup.mockReturnValue({ scope: { kind: 'private', groupId: 'g-7' }, clear: jest.fn() });
      mockUseGroupsHub.mockReturnValue({
        data: {
          owned: [{
            id: 'g-7',
            name: 'Waldos',
            role: 'owner',
            home_button_backgrounds: { hide: hideSlot },
          }],
        },
        isLoading: false,
        error: null,
        refresh,
      });

      const navigation = { navigate: jest.fn(), setOptions: jest.fn() };
      let renderer;
      await act(async () => {
        renderer = create(
          <AuthContext.Provider value={{ setPrivateMode: jest.fn(), paidTier: 2 }}>
            <PrivateHomeScreen
              navigation={navigation}
              route={{ params: { scope: { kind: 'private', groupId: 'g-7' } } }}
            />
          </AuthContext.Provider>
        );
        await Promise.resolve();
      });

      const headerRoot = await renderHeader(navigation);

      await act(async () => {
        headerRoot.root.findByProps({ testID: 'private-home.button.customize-colors' }).props.onPress();
      });

      const removeButton = renderer.root.findByProps({ testID: 'private-home.button-bg.hide.remove' });

      await act(async () => {
        await removeButton.props.onPress();
        await Promise.resolve();
      });

      expect(updateGroupSettings).toHaveBeenCalledWith(
        expect.anything(),
        'g-7',
        { hideBgImageId: null }
      );
      expect(deletePrivateImage).toHaveBeenCalledWith(expect.anything(), 'g-7', 'img-hide');
      expect(deleteHomeBackgroundFile).toHaveBeenCalledWith('g-7', 'hide', 'img-hide');
      expect(refresh).toHaveBeenCalled();

      const updateOrder = updateGroupSettings.mock.invocationCallOrder[0];
      const deleteOrder = deletePrivateImage.mock.invocationCallOrder[0];
      const fileDeleteOrder = deleteHomeBackgroundFile.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(deleteOrder);
      expect(deleteOrder).toBeLessThan(fileDeleteOrder);
    });
  });

  describe('hub loading and error states', () => {
    it('shows LoadingOverlay while the first hub fetch is loading', async () => {
      await renderScreen({ groupsData: null, isLoading: true });

      const calls = mockLoadingOverlay.mock.calls.map(([props]) => props);
      expect(calls.length).toBeGreaterThanOrEqual(1);
      expect(calls[calls.length - 1].message).toBe('Loading groups...');
    });

    it('shows the error UI with retry (and no owner header buttons) when the hub fetch fails', async () => {
      const { renderer, navigation, refresh } = await renderScreen({
        groupsData: null,
        error: { status: 500 },
      });

      expect(renderer.root.findByProps({ testID: 'private-home.error' })).toBeTruthy();
      expect(renderer.root.findByProps({ testID: 'private-home.button.retry' })).toBeTruthy();

      const headerRoot = await renderHeader(navigation);
      expect(() => headerRoot.root.findByProps({ testID: 'private-home.button.settings' })).toThrow();

      const callsBefore = refresh.mock.calls.length;

      await act(async () => {
        renderer.root.findByProps({ testID: 'private-home.button.retry' }).props.onPress();
      });

      expect(refresh.mock.calls.length).toBe(callsBefore + 1);
    });

    it('renders the normal screen once hub data is present', async () => {
      const { renderer } = await renderScreen({
        groupsData: { owned: [{ id: 'g-7', name: 'Waldos', role: 'owner' }], joined: [] },
      });

      expect(mockLoadingOverlay).not.toHaveBeenCalled();
      expect(() => renderer.root.findByProps({ testID: 'private-home.error' })).toThrow();
      expect(mockHomeCard.mock.calls.some(([props]) => props?.testID === 'private-home.button.hide')).toBe(true);
    });

    it('survives a loading-to-data transition on the same renderer without a hook-order crash', async () => {
      mockUseActiveGroup.mockReturnValue({ scope: { kind: 'private', groupId: 'g-7' }, clear: jest.fn() });
      const refresh = jest.fn();
      mockUseGroupsHub.mockReturnValue({ data: null, isLoading: true, error: null, refresh });

      const navigation = { navigate: jest.fn(), setOptions: jest.fn() };
      const route = { params: { scope: { kind: 'private', groupId: 'g-7' } } };
      const providerValue = { setPrivateMode: jest.fn(), paidTier: 2 };

      let renderer;
      await act(async () => {
        renderer = create(
          <AuthContext.Provider value={providerValue}>
            <PrivateHomeScreen navigation={navigation} route={route} />
          </AuthContext.Provider>
        );
        await Promise.resolve();
      });

      expect(mockLoadingOverlay.mock.calls.length).toBeGreaterThanOrEqual(1);

      mockUseGroupsHub.mockReturnValue({
        data: { owned: [{ id: 'g-7', name: 'Waldos', role: 'owner' }], joined: [] },
        isLoading: false,
        error: null,
        refresh,
      });

      await act(async () => {
        renderer.update(
          <AuthContext.Provider value={providerValue}>
            <PrivateHomeScreen navigation={navigation} route={route} />
          </AuthContext.Provider>
        );
        await Promise.resolve();
      });

      expect(() => renderer.root.findByProps({ testID: 'private-home.error' })).toThrow();
      expect(mockHomeCard.mock.calls.some(([props]) => props?.testID === 'private-home.button.hide')).toBe(true);
    });
  });
});
