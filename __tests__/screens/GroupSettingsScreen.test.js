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

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
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

jest.mock('../../services/groups/groupCategoryThumbnails', () => ({
  deleteCategoryThumbnailFile: jest.fn(),
  resolveCategoryThumbnail: jest.fn().mockResolvedValue(null),
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
import { Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import GroupSettingsScreen from '../../screens/Groups/GroupSettingsScreen';
import {
  listGroupCategories,
  updateGroupCategory,
} from '../../services/groups/groupCategoriesApi';
import { updateGroupSettings } from '../../services/groups/groupApi';
import { preparePrivateUpload } from '../../services/groups/groupUploadApi';
import { deleteCategoryThumbnailFile } from '../../services/groups/groupCategoryThumbnails';
import { performImageUpload } from '../../utils/imagesRequests';
import { getPrivateGroupSettingsTokens } from '../../utils/privateGroupTheme';

async function flushEffects() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('GroupSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    listGroupCategories.mockResolvedValue({ status: 200, data: [] });
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  async function renderScreen({ scope = { kind: 'private', groupId: 'g-3' }, groupsData, navigation = { replace: jest.fn() } } = {}) {
    mockUseActiveGroup.mockReturnValue({ scope });
    mockUseGroupsHub.mockReturnValue({ data: groupsData, isLoading: false, refresh: jest.fn() });

    let renderer;
    await act(async () => {
      renderer = create(
        <GroupSettingsScreen navigation={navigation} />
      );
      await flushEffects();
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
    expect(renderer.root.findByProps({ testID: 'group-settings.category.editor' })).toBeTruthy();
  });

  it('renders the Members entry that navigates to MemberManagementScreen when pressed', async () => {
    const navigation = { replace: jest.fn(), navigate: jest.fn() };

    const { renderer } = await renderScreen({
      navigation,
      groupsData: {
        owned: [{ id: 'g-3', role: 'owner', name: 'Mine' }],
        joined: [],
      },
    });

    const membersButton = renderer.root.findByProps({ testID: 'group-settings.button.members' });
    expect(membersButton).toBeTruthy();
    expect(membersButton.props.accessibilityLabel).toBe('Manage members');

    await act(async () => {
      membersButton.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('MemberManagementScreen');
  });

  it('uses the active group palette across the settings sections', async () => {
    const group = {
      id: 'g-3',
      role: 'owner',
      name: 'Mine',
      primary_color: '#198868',
      secondary_color: '#FFCC00',
    };
    const tokens = getPrivateGroupSettingsTokens({
      primaryColor: group.primary_color,
      secondaryColor: group.secondary_color,
    });

    const { renderer } = await renderScreen({
      groupsData: {
        owned: [group],
        joined: [],
      },
    });

    const identitySection = renderer.root
      .findAllByProps({ testID: 'group-settings.section.identity' })
      .find((node) => node.props.style);
    expect(identitySection).toBeTruthy();
    expect(StyleSheet.flatten(identitySection.props.style).backgroundColor).toBe(tokens.panel);

    const membersButton = renderer.root.findByProps({ testID: 'group-settings.button.members' });
    const membersStyle = StyleSheet.flatten(membersButton.props.style({ pressed: false }));
    expect(membersStyle.backgroundColor).toBe(tokens.inset);
    expect(membersStyle.borderColor).toBe(tokens.hairline);

    const saveButton = renderer.root.findByProps({ testID: 'group-settings.button.save-colors' });
    const saveStyle = StyleSheet.flatten(saveButton.props.style({ pressed: false }));
    expect(saveStyle.backgroundColor).toBe(group.primary_color);
  });

  it('does not redirect and shows LoadingOverlay while hub is still loading, even when user is the owner', async () => {
    const navigation = { replace: jest.fn() };

    mockUseActiveGroup.mockReturnValue({ scope: { kind: 'private', groupId: 'g-3' } });
    mockUseGroupsHub.mockReturnValue({
      data: null,
      isLoading: true,
      refresh: jest.fn(),
    });

    let renderer;
    await act(async () => {
      renderer = create(<GroupSettingsScreen navigation={navigation} />);
      await flushEffects();
    });

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(mockLoadingOverlay).toHaveBeenCalled();
    expect(() => renderer.root.findByProps({ testID: 'group-settings.button.members' })).toThrow();
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

  it('surfaces an Alert and resets isSavingSettings when updateGroupSettings rejects', async () => {
    updateGroupSettings.mockRejectedValue({ response: { status: 422, data: { error: 'boom' } } });

    const { renderer } = await renderScreen({
      groupsData: {
        owned: [{ id: 'g-3', role: 'owner', name: 'Mine' }],
        joined: [],
      },
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'group-settings.button.save-colors' }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(Alert.alert).toHaveBeenCalled();

    const saveButtonProps = renderer.root.findByProps({ testID: 'group-settings.button.save-colors' }).props;
    expect(saveButtonProps.accessibilityLabel).toBe('Save changes');
  });

  it('launches picker and prepares category thumbnail upload without categoryId payload', async () => {
    const category = { id: 'cat-1', name: 'Cats' };
    listGroupCategories.mockResolvedValue({ status: 200, data: [category] });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///thumb.png', fileSize: 42 }],
    });
    preparePrivateUpload.mockResolvedValue({ status: 400, data: {} });

    const { renderer } = await renderScreen({
      groupsData: {
        owned: [{ id: 'g-3', role: 'owner', name: 'Mine' }],
        joined: [],
      },
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'group-settings.uploader.category-thumbnail' }).props.onPress();
      await flushEffects();
    });

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 0.5,
    });

    const uploadArgs = preparePrivateUpload.mock.calls[0][0];
    expect(uploadArgs).toMatchObject({
      context: {},
      groupId: 'g-3',
      kind: 'category-thumbnail',
      fileExtension: 'png',
      contentType: 'image/png',
      contentLength: 42,
      isCategoryThumbnail: true,
    });
    expect(uploadArgs).not.toHaveProperty('categoryId');
  });

  it('updates category thumbnail with thumbnailImageId and reloads categories after successful upload', async () => {
    const category = { id: 'cat-1', name: 'Cats' };
    listGroupCategories.mockResolvedValue({ status: 200, data: [category] });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///thumb.webp', fileSize: 42 }],
    });
    preparePrivateUpload.mockResolvedValue({ status: 201, data: { imageId: 'img-9' } });
    performImageUpload.mockResolvedValue({ status: 200 });
    updateGroupCategory.mockResolvedValue({ status: 200, data: {} });

    const { renderer } = await renderScreen({
      groupsData: {
        owned: [{ id: 'g-3', role: 'owner', name: 'Mine' }],
        joined: [],
      },
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'group-settings.uploader.category-thumbnail' }).props.onPress();
      await flushEffects();
    });

    expect(updateGroupCategory).toHaveBeenCalledWith({}, 'g-3', 'cat-1', {
      thumbnailImageId: 'img-9',
    });
    expect(listGroupCategories).toHaveBeenCalledTimes(2);
  });

  it('deletes previous local thumbnail before updating category on re-upload', async () => {
    const category = { id: 'cat-1', name: 'Cats', thumbnail_image_id: 'old-thumb' };
    listGroupCategories.mockResolvedValue({ status: 200, data: [category] });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///thumb.jpg', fileSize: 42 }],
    });
    preparePrivateUpload.mockResolvedValue({ status: 201, data: { imageId: 'img-new' } });
    performImageUpload.mockResolvedValue({ status: 200 });
    updateGroupCategory.mockResolvedValue({ status: 200, data: {} });

    const { renderer } = await renderScreen({
      groupsData: {
        owned: [{ id: 'g-3', role: 'owner', name: 'Mine' }],
        joined: [],
      },
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'group-settings.uploader.category-thumbnail' }).props.onPress();
      await flushEffects();
    });

    expect(deleteCategoryThumbnailFile).toHaveBeenCalledWith('g-3', 'old-thumb');
    expect(deleteCategoryThumbnailFile.mock.invocationCallOrder[0]).toBeLessThan(
      updateGroupCategory.mock.invocationCallOrder[0],
    );
    expect(updateGroupCategory).toHaveBeenCalledWith({}, 'g-3', 'cat-1', {
      thumbnailImageId: 'img-new',
    });
  });
});
