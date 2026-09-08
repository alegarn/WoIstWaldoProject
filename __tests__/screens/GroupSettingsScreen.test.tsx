import type { ImageResult } from 'expo-image-manipulator';

const mockBigButton = jest.fn((_props: Record<string, unknown>) => null);
const mockButton = jest.fn((_props: Record<string, unknown>) => null);
const mockLoadingOverlay = jest.fn((_props: Record<string, unknown>) => null);
const mockUseActiveGroup = jest.fn();
const mockUseGroupsHub = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

const mockManipulate = jest.fn();
const mockResize = jest.fn();
const mockRenderAsync = jest.fn();
const mockSaveAsync = jest.fn();
const mockFileSizeFor = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    manipulate: (...args: unknown[]) => mockManipulate(...args),
  },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

jest.mock('expo-file-system', () => ({
  File: function File(this: { uri: string; size: number | undefined }, uri: string) {
    this.uri = uri;
    this.size = mockFileSizeFor(uri);
  },
}));

const RESIZED_URI = 'file:///tmp/category-thumb.jpeg';
const RESIZED_SIZE = 4_321;

type ManipulatorContextMock = {
  resize: typeof mockResize;
  renderAsync: typeof mockRenderAsync;
  release: jest.Mock;
};

function resetManipulatorChain() {
  mockManipulate.mockReset();
  mockResize.mockReset();
  mockRenderAsync.mockReset();
  mockSaveAsync.mockReset();

  mockManipulate.mockImplementation(() => {
    const context: ManipulatorContextMock = {
      resize: mockResize,
      renderAsync: mockRenderAsync,
      release: jest.fn(),
    };
    mockResize.mockReturnValue(context);
    mockRenderAsync.mockResolvedValue({
      saveAsync: mockSaveAsync.mockResolvedValue({
        uri: RESIZED_URI,
        width: 120,
        height: 90,
      } satisfies ImageResult),
      release: jest.fn(),
    });
    return context;
  });
}

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
}));

jest.mock('../../components/UI/BigButton', () => {
  return function MockBigButton(props: Record<string, unknown>) {
    mockBigButton(props);
    return null;
  };
});

jest.mock('../../components/UI/Button', () => {
  return function MockButton(props: Record<string, unknown>) {
    mockButton(props);
    return null;
  };
});

jest.mock('../../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props: Record<string, unknown>) {
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
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import GroupSettingsScreen from '../../screens/Groups/GroupSettingsScreen';
import { AuthContext } from '../../store/auth-context';
import {
  listGroupCategories,
  updateGroupCategory,
} from '../../services/groups/groupCategoriesApi';
import { updateGroupSettings } from '../../services/groups/groupApi';
import { preparePrivateUpload } from '../../services/groups/groupUploadApi';
import { deleteCategoryThumbnailFile } from '../../services/groups/groupCategoryThumbnails';
import { performImageUpload } from '../../utils/imagesRequests';
import { getPrivateGroupSettingsTokens } from '../../utils/privateGroupTheme';

const mockedLaunchImageLibraryAsync = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockedListGroupCategories = jest.mocked(listGroupCategories);
const mockedUpdateGroupCategory = jest.mocked(updateGroupCategory);
const mockedUpdateGroupSettings = jest.mocked(updateGroupSettings);
const mockedPreparePrivateUpload = jest.mocked(preparePrivateUpload);
const mockedDeleteCategoryThumbnailFile = jest.mocked(deleteCategoryThumbnailFile);
const mockedPerformImageUpload = performImageUpload as jest.Mock;

async function flushEffects() {
  await Promise.resolve();
  await Promise.resolve();
}

type ScopeMock = { kind: string; groupId: string };

type GroupsHubDataMock = {
  owned: Array<Record<string, unknown>>;
  joined: Array<Record<string, unknown>>;
};

type NavigationMock = { replace: jest.Mock; navigate?: jest.Mock };

describe('GroupSettingsScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    resetManipulatorChain();
    mockFileSizeFor.mockImplementation((uri: string) => (uri === RESIZED_URI ? RESIZED_SIZE : undefined));
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockedListGroupCategories.mockResolvedValue({ status: 200, data: [] });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  async function renderScreen({
    scope = { kind: 'private', groupId: 'g-3' },
    groupsData,
    navigation = { replace: jest.fn(), navigate: jest.fn() },
    authContext = { paidTier: 2 },
  }: {
    scope?: ScopeMock;
    groupsData?: GroupsHubDataMock | null;
    navigation?: NavigationMock;
    authContext?: Record<string, unknown>;
  } = {}) {
    mockUseActiveGroup.mockReturnValue({ scope });
    mockUseGroupsHub.mockReturnValue({ data: groupsData, isLoading: false, refresh: jest.fn() });

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={authContext as any}>
          <GroupSettingsScreen navigation={navigation} />
        </AuthContext.Provider>
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
    } as Parameters<typeof getPrivateGroupSettingsTokens>[0]);

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
    expect(StyleSheet.flatten(identitySection!.props.style).backgroundColor).toBe(tokens.panel);

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

    let renderer!: ReactTestRenderer;
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
    mockedUpdateGroupSettings.mockRejectedValue({ response: { status: 422, data: { error: 'boom' } } });

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

  it('shows the store-linked upsell alert on a 403 identity save, routing the CTA to the paywall', async () => {
    const navigation: NavigationMock = { replace: jest.fn(), navigate: jest.fn() };
    mockedUpdateGroupSettings.mockResolvedValue({ status: 403, data: {} });

    const { renderer } = await renderScreen({
      navigation,
      authContext: { paidTier: 0 },
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

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [title, , buttons] = alertSpy.mock.calls[0];
    expect(title).toBe('Personalization is a Creator feature');

    const storeCta = buttons.find((button: { text?: string }) => button.text === 'View plans');
    expect(storeCta).toBeTruthy();
    expect(navigation.navigate).not.toHaveBeenCalled();

    await act(async () => {
      storeCta.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith('PaywallScreen', { intent: 'personalize-group' });
  });

  it('launches picker and prepares category thumbnail upload without categoryId payload', async () => {
    const category = { id: 'cat-1', name: 'Cats' };
    mockedListGroupCategories.mockResolvedValue({ status: 200, data: [category] });
    mockedLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///thumb.png', fileSize: 42 }],
    });
    mockedPreparePrivateUpload.mockResolvedValue({ status: 400, data: {} });

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

    expect(mockedLaunchImageLibraryAsync).toHaveBeenCalledWith({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 0.5,
    });

    const uploadArgs = mockedPreparePrivateUpload.mock.calls[0][0];
    expect(uploadArgs).toMatchObject({
      context: { paidTier: 2 },
      groupId: 'g-3',
      kind: 'category-thumbnail',
      fileExtension: 'webp',
      contentType: 'image/webp',
      contentLength: RESIZED_SIZE,
      isCategoryThumbnail: true,
    });
    expect(uploadArgs).not.toHaveProperty('categoryId');
  });

  it('updates category thumbnail with thumbnailImageId and reloads categories after successful upload', async () => {
    const category = { id: 'cat-1', name: 'Cats' };
    mockedListGroupCategories.mockResolvedValue({ status: 200, data: [category] });
    mockedLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///thumb.webp', fileSize: 42 }],
    });
    mockedPreparePrivateUpload.mockResolvedValue({ status: 201, data: { imageId: 'img-9' } });
    mockedPerformImageUpload.mockResolvedValue({ status: 200 });
    mockedUpdateGroupCategory.mockResolvedValue({ status: 200, data: {} });

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

    expect(mockedUpdateGroupCategory).toHaveBeenCalledWith({ paidTier: 2 }, 'g-3', 'cat-1', {
      thumbnailImageId: 'img-9',
    });
    expect(mockedListGroupCategories).toHaveBeenCalledTimes(2);
  });

  it('deletes previous local thumbnail before updating category on re-upload', async () => {
    const category = { id: 'cat-1', name: 'Cats', thumbnail_image_id: 'old-thumb' };
    mockedListGroupCategories.mockResolvedValue({ status: 200, data: [category] });
    mockedLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///thumb.jpg', fileSize: 42 }],
    });
    mockedPreparePrivateUpload.mockResolvedValue({ status: 201, data: { imageId: 'img-new' } });
    mockedPerformImageUpload.mockResolvedValue({ status: 200 });
    mockedUpdateGroupCategory.mockResolvedValue({ status: 200, data: {} });

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

    expect(mockedDeleteCategoryThumbnailFile).toHaveBeenCalledWith('g-3', 'old-thumb');
    expect(mockedDeleteCategoryThumbnailFile.mock.invocationCallOrder[0]).toBeLessThan(
      mockedUpdateGroupCategory.mock.invocationCallOrder[0],
    );
    expect(mockedUpdateGroupCategory).toHaveBeenCalledWith({ paidTier: 2 }, 'g-3', 'cat-1', {
      thumbnailImageId: 'img-new',
    });
  });

  it('shows the locked categories row and no composer for a free owner, routing the tap to the paywall', async () => {
    const navigation: NavigationMock = { replace: jest.fn(), navigate: jest.fn() };

    const { renderer } = await renderScreen({
      navigation,
      authContext: { paidTier: 0 },
      groupsData: {
        owned: [{ id: 'g-3', role: 'owner', name: 'Mine', member_count: 3 }],
        joined: [],
      },
    });

    expect(renderer.root.findByProps({ testID: 'group-settings.category.locked' })).toBeTruthy();
    expect(() =>
      renderer.root.findByProps({ testID: 'group-settings.category.add-composer' })
    ).toThrow();
    expect(() =>
      renderer.root.findByProps({ testID: 'group-settings.uploader.category-thumbnail' })
    ).toThrow();

    await act(async () => {
      renderer.root.findByProps({ testID: 'group-settings.category.locked' }).props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('PaywallScreen', { intent: 'personalize-group' });
  });

  it('shows the member cap banner with the free cap for a free owner', async () => {
    const { renderer } = await renderScreen({
      authContext: { paidTier: 0 },
      groupsData: {
        owned: [{ id: 'g-3', role: 'owner', name: 'Mine', member_count: 3 }],
        joined: [],
      },
    });

    const banner = renderer.root.findByProps({ testID: 'group-settings.members.cap-banner' });
    const bannerText = banner
      .findAllByProps({ testID: 'group-settings.members.cap-count' })
      .map((node: ReactTestInstance) => node.props.children)
      .join(' ');
    expect(bannerText).toContain('3/10 members');
  });
});
