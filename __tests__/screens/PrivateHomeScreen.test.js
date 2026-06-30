const mockHomeCard = jest.fn(() => null);
const mockBigButton = jest.fn(() => null);
const mockIconButton = jest.fn(() => null);
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
  });
});
