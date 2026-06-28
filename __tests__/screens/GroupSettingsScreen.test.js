const mockBigButton = jest.fn(() => null);
const mockButton = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);
const mockUseActiveGroup = jest.fn();
const mockUseGroupsHub = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    const React = require('react');
    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('../../components/UI/BigButton', () => {
  return function MockBigButton(props) {
    mockBigButton(props);
    return null;
  };
});

jest.mock('../../components/UI/Button', () => {
  return function MockButton(props) {
    mockButton(props);
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

jest.mock('../../services/groups/groupApi', () => ({
  updateGroupSettings: jest.fn(),
}));

jest.mock('../../services/groups/groupCategoriesApi', () => ({
  listGroupCategories: jest.fn(),
  createGroupCategory: jest.fn(),
  updateGroupCategory: jest.fn(),
  deleteGroupCategory: jest.fn(),
}));

jest.mock('../../services/groups/groupUploadApi', () => ({
  preparePrivateUpload: jest.fn(),
}));

jest.mock('../../utils/imagesRequests', () => ({
  performImageUpload: jest.fn(),
}));

jest.mock('../../store/auth-context', () => {
  const React = require('react');
  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import GroupSettingsScreen from '../../screens/Groups/GroupSettingsScreen';
import { listGroupCategories } from '../../services/groups/groupCategoriesApi';

describe('GroupSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listGroupCategories.mockResolvedValue({ status: 200, data: [] });
  });

  async function renderScreen({ scope = { kind: 'private', groupId: 'g-3' }, groupsData, navigation = { replace: jest.fn() } } = {}) {
    mockUseActiveGroup.mockReturnValue({ scope });
    mockUseGroupsHub.mockReturnValue({ data: groupsData, refresh: jest.fn() });

    let renderer;
    await act(async () => {
      renderer = create(
        <GroupSettingsScreen navigation={navigation} />
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    return { renderer, navigation };
  }

  it('renders the owner-only editor controls when the user is the group owner', async () => {
    const { renderer } = await renderScreen({
      groupsData: {
        owned: [{ id: 'g-3', role: 'owner', name: 'Mine' }],
        joined: [],
      },
    });

    expect(renderer.root.findByProps({ testID: 'group-settings.input.name' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'group-settings.button.save-colors' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'group-settings.uploader.home-background' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'group-settings.uploader.button-image' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'group-settings.category.editor' })).toBeTruthy();
  });

  it('redirects to GroupsListScreen when the current user is not the owner', async () => {
    const navigation = { replace: jest.fn() };

    mockUseActiveGroup.mockReturnValue({ scope: { kind: 'private', groupId: 'g-3' } });
    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [],
        joined: [{ id: 'g-3', role: 'member', name: 'Theirs' }],
      },
      refresh: jest.fn(),
    });

    await act(async () => {
      create(<GroupSettingsScreen navigation={navigation} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(navigation.replace).toHaveBeenCalledWith('GroupsListScreen');
  });
});
