// GroupSettingsScreen behavior suite (private group settings).
//
// Renders the REAL screen subtree (GroupMembersSection, GroupIdentitySection,
// GroupCategoriesSection, useActiveGroup, useGroupsHub, useGroupCategories and
// every groups service) and drives it through user-visible interactions:
// the ownership gate, the Members row, editing and saving the identity fields,
// the Creator paywall CTAs, and the category thumbnail swap
// (picker → resize → presign → binary upload → category PATCH).
//
// Only system boundaries are mocked:
// - @react-navigation/native (useFocusEffect runs its callback on mount)
// - expo-image-picker / expo-image-manipulator (native pick/resize)
// - expo-file-system (native; File records deletes + binary uploads and
//   reports the resized image size)
// - AsyncStorage via __tests__/helpers/statefulAsyncStorageMock.ts (in-memory
//   stateful fake; the private-group category cache stays real against it)
// - @react-native-vector-icons/ionicons (native font component)
// - axios (the transport seam; every backend request is asserted here)
//
// Everything else (ownership gate, groups hub + cache, categories store,
// CRUD services, billing policy, upsell alert, palette tokens, i18n) runs
// REAL. Assertions target rendered output (testIDs, English copy from
// i18n/locales/en.json), Alert.alert, navigation calls, file-system effects,
// and axios requests.

const mockLaunchImageLibraryAsync = jest.fn();
const mockFileDelete = jest.fn();
const mockFileUpload = jest.fn();
const mockFileSizeFor = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock('@react-native-vector-icons/ionicons', () => ({
  __esModule: true,
  default: () => null,
  Ionicons: () => null,
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

// Resized thumbnail the native manipulator "saves". Its size is reported by
// the file-system mock below, so presign payloads carry a real length.
const RESIZED_URI = 'file:///tmp/category-thumb.webp';
const RESIZED_SIZE = 4_321;

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    manipulate: () => {
      const context = {
        resize: () => context,
        renderAsync: async () => ({
          saveAsync: async () => ({ uri: RESIZED_URI, width: 120, height: 90 }),
          release: () => {},
        }),
        release: () => {},
      };
      return context;
    },
  },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(...args: unknown[]) {
      this.uri = args.length === 2 ? `${args[0]}${args[1]}` : String(args[0]);
    }
    get exists() {
      return true;
    }
    get size() {
      return mockFileSizeFor(this.uri);
    }
    delete() {
      mockFileDelete(this.uri);
    }
    upload(...args: unknown[]) {
      return mockFileUpload(...args);
    }
  },
  Paths: { cache: 'file:///cache/', document: 'file:///documents/' },
  UploadType: { BINARY_CONTENT: 'binary' },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('../helpers/statefulAsyncStorageMock')({ autoReset: true }),
);

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
}));

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert, StyleSheet, Text } from 'react-native';
import axios from 'axios';

import GroupSettingsScreen from '../../screens/Groups/GroupSettingsScreen';
import { AuthContext } from '../../store/auth-context';
import { resetGroupHubStore } from '../../services/groups/groupHubStore';
import { getPrivateGroupSettingsTokens } from '../../utils/privateGroupTheme';

const BACKEND_URL = 'https://backend.example/';
const HUB_URL = `${BACKEND_URL}api/v1/private_groups/`;
const CATEGORIES_URL = `${BACKEND_URL}api/v1/private_groups/g-3/categories/`;
const PRESIGN_URL = `${BACKEND_URL}api/v1/private_groups/g-3/images/presign`;

// The hub derives the role from owner_id vs the authed userId, mirroring the
// private-group backend contract.
const OWNER_GROUP = {
  id: 'g-3',
  name: 'Mine',
  owner_id: 'u-1',
  member_count: 3,
  primary_color: '#198868',
  secondary_color: '#FFCC00',
};

const AUTH = {
  token: 'test-token',
  userId: 'u-1',
  scoreId: 'score-1',
  paidTier: 2,
  activeGroupId: 'g-3',
  isPrivateMode: true,
};

type Nav = Record<string, jest.Mock>;

function makeNav(): Nav {
  return { replace: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
}

// Serves the groups hub and the private categories list off the axios seam.
// `categoryQueue` feeds successive GETs (the store reloads after mutations);
// the last entry repeats. `pending` holds the hub request in flight.
function serveHub({
  owned = [],
  joined = [],
  pending = false,
  categoryQueue = [[]] as unknown[][],
}: {
  owned?: unknown[];
  joined?: unknown[];
  pending?: boolean;
  categoryQueue?: unknown[][];
} = {}) {
  const queue = [...categoryQueue];
  (axios.get as jest.Mock).mockImplementation((url: string) => {
    if (url === HUB_URL) {
      if (pending) {
        return new Promise(() => {});
      }
      return Promise.resolve({ status: 200, data: { data: [...owned, ...joined] } });
    }
    const next = queue.length > 1 ? queue.shift() : queue[0] ?? [];
    return Promise.resolve({ status: 200, data: { data: next } });
  });
}

async function flushEffects(times = 8) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderSettingsScreen({
  navigation = makeNav(),
  authOverrides = {},
}: {
  navigation?: Nav;
  authOverrides?: Record<string, unknown>;
} = {}) {
  const view = render(
    <AuthContext.Provider value={{ ...AUTH, ...authOverrides } as any}>
      <GroupSettingsScreen navigation={navigation as any} />
    </AuthContext.Provider>
  );
  await flushEffects();
  return { view, navigation };
}

describe('GroupSettingsScreen (private group)', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    resetGroupHubStore();
    mockFileSizeFor.mockReturnValue(RESIZED_SIZE);
    mockFileUpload.mockResolvedValue({ status: 200 });
    (axios.patch as jest.Mock).mockResolvedValue({ status: 200, data: {} });
    (axios.post as jest.Mock).mockResolvedValue({ status: 200, data: {} });
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('shows the owner the identity editor, the members row, and the categories panel', async () => {
    serveHub({ owned: [OWNER_GROUP], categoryQueue: [[{ id: 'cat-1', name: 'Cats' }]] });
    const { view } = await renderSettingsScreen();

    expect(view.getByTestId('group-settings.input.name').props.value).toBe('Mine');
    expect(view.getByTestId('group-settings.button.save-colors')).toBeTruthy();
    expect(view.getByTestId('group-settings.button.members')).toBeTruthy();
    expect(view.getByTestId('group-settings.category.editor')).toBeTruthy();
    expect(view.getByTestId('group-settings.category.row.cat-1')).toBeTruthy();
  });

  it('opens member management when the Members row is pressed', async () => {
    serveHub({ owned: [OWNER_GROUP], categoryQueue: [[]] });
    const { view, navigation } = await renderSettingsScreen();

    expect(view.getByText('Manage members')).toBeTruthy();

    fireEvent.press(view.getByTestId('group-settings.button.members'));

    expect(navigation.navigate).toHaveBeenCalledWith('MemberManagementScreen');
  });

  it('paints the settings surfaces with the active group palette', async () => {
    serveHub({ owned: [OWNER_GROUP], categoryQueue: [[]] });
    const tokens = getPrivateGroupSettingsTokens({
      primaryColor: OWNER_GROUP.primary_color,
      secondaryColor: OWNER_GROUP.secondary_color,
    });
    const { view } = await renderSettingsScreen();

    const identitySection = view.getByTestId('group-settings.section.identity');
    expect(StyleSheet.flatten(identitySection.props.style).backgroundColor).toBe(tokens.panel);

    const membersRow = view.getByTestId('group-settings.button.members');
    const membersStyle = StyleSheet.flatten(membersRow.props.style);
    expect(membersStyle.backgroundColor).toBe(tokens.inset);
    expect(membersStyle.borderColor).toBe(tokens.hairline);

    const saveButton = view.getByTestId('group-settings.button.save-colors');
    const saveStyle = StyleSheet.flatten(saveButton.props.style);
    expect(saveStyle.backgroundColor).toBe(OWNER_GROUP.primary_color);
  });

  it('keeps checking ownership without redirecting while the hub request is in flight', async () => {
    serveHub({ owned: [OWNER_GROUP], pending: true, categoryQueue: [[]] });
    const { view, navigation } = await renderSettingsScreen();

    expect(view.getByText('Checking ownership...')).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(view.queryByTestId('group-settings.button.members')).toBeNull();
  });

  it('sends a non-owner back to the groups list', async () => {
    serveHub({
      joined: [{ id: 'g-3', name: 'Theirs', owner_id: 'someone-else' }],
      categoryQueue: [[]],
    });
    const { navigation } = await renderSettingsScreen();

    expect(navigation.replace).toHaveBeenCalledWith('GroupsListScreen');
  });

  it('reports a failed settings save and re-enables the save button', async () => {
    (axios.patch as jest.Mock).mockRejectedValue({ response: { status: 422, data: { error: 'boom' } } });
    serveHub({ owned: [OWNER_GROUP], categoryQueue: [[]] });
    const { view } = await renderSettingsScreen();

    fireEvent.changeText(view.getByTestId('group-settings.input.name'), 'Renamed');
    fireEvent.press(view.getByTestId('group-settings.button.save-colors'));
    await flushEffects();

    expect(axios.patch).toHaveBeenCalledWith(
      `${HUB_URL}g-3/`,
      {
        private_group: {
          name: 'Renamed',
          primary_color: OWNER_GROUP.primary_color,
          secondary_color: OWNER_GROUP.secondary_color,
        },
      },
      expect.anything()
    );
    expect(alertSpy).toHaveBeenCalledWith('Error 422', 'Could not save settings.');

    const saveButton = view.getByTestId('group-settings.button.save-colors');
    expect(saveButton.props.accessibilityLabel).toBe('Save changes');
  });

  it('offers the Creator upgrade on a refused 403 save and routes its CTA to the paywall', async () => {
    (axios.patch as jest.Mock).mockResolvedValue({ status: 403, data: {} });
    serveHub({ owned: [OWNER_GROUP], categoryQueue: [[]] });
    const { view, navigation } = await renderSettingsScreen({ authOverrides: { paidTier: 0 } });

    fireEvent.press(view.getByTestId('group-settings.button.save-colors'));
    await flushEffects();

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, , buttons] = alertSpy.mock.calls[0];
    expect(title).toBe('Personalization is a Creator feature');
    const viewPlans = buttons.find((button: { text?: string }) => button.text === 'View plans');
    expect(viewPlans).toBeTruthy();
    expect(navigation.navigate).not.toHaveBeenCalled();

    await act(async () => {
      viewPlans.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith('PaywallScreen', { intent: 'personalize-group' });
  });

  it('opens the picker and presigns a private thumbnail upload without a category id', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///thumb.png', fileSize: 42 }],
    });
    (axios.post as jest.Mock).mockResolvedValue({ status: 400, data: {} });
    serveHub({ owned: [OWNER_GROUP], categoryQueue: [[{ id: 'cat-1', name: 'Cats' }]] });
    const { view } = await renderSettingsScreen();

    fireEvent.press(view.getByTestId('group-settings.uploader.category-thumbnail'));
    await flushEffects();

    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledWith({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 0.5,
    });
    expect(axios.post).toHaveBeenCalledWith(
      PRESIGN_URL,
      {
        private_image: {
          kind: 'groupUi',
          file_extension: 'webp',
          content_type: 'image/webp',
          content_length: RESIZED_SIZE,
          is_category_thumbnail: true,
        },
      },
      expect.anything()
    );
    const presignBody = (axios.post as jest.Mock).mock.calls[0][1];
    expect(presignBody.private_image).not.toHaveProperty('category_id');
    expect(alertSpy).toHaveBeenCalledWith('Error', 'Could not prepare upload.');
  });

  it('attaches a finished thumbnail upload to the category, reloads it, and confirms', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///thumb.webp', fileSize: 42 }],
    });
    (axios.post as jest.Mock).mockResolvedValue({
      status: 201,
      data: { data: { image_id: 'img-9', method: 'PUT', url: 'https://storage.example/upload', headers: {} } },
    });
    serveHub({
      owned: [OWNER_GROUP],
      categoryQueue: [
        [{ id: 'cat-1', name: 'Cats' }],
        [{ id: 'cat-1', name: 'Cats', thumbnail_image_id: 'img-9' }],
      ],
    });
    const { view } = await renderSettingsScreen();

    fireEvent.press(view.getByTestId('group-settings.uploader.category-thumbnail'));
    await flushEffects();

    expect(mockFileUpload).toHaveBeenCalled();
    expect(axios.patch).toHaveBeenCalledWith(
      `${CATEGORIES_URL}cat-1/`,
      { private_category: { thumbnail_image_id: 'img-9' } },
      expect.anything()
    );

    const categoryLoads = (axios.get as jest.Mock).mock.calls.filter(([url]) => url === CATEGORIES_URL);
    expect(categoryLoads).toHaveLength(2);

    expect(view.getByTestId('group-settings.category.row.cat-1')).toBeTruthy();
    expect(alertSpy).toHaveBeenCalledWith('Uploaded', 'Category thumbnail updated.');
  });

  it('purges the previous local thumbnail before patching the new one', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///thumb.jpg', fileSize: 42 }],
    });
    (axios.post as jest.Mock).mockResolvedValue({
      status: 201,
      data: { data: { image_id: 'img-new', method: 'PUT', url: 'https://storage.example/upload', headers: {} } },
    });
    serveHub({
      owned: [OWNER_GROUP],
      categoryQueue: [[{ id: 'cat-1', name: 'Cats', thumbnail_image_id: 'old-thumb' }]],
    });
    const { view } = await renderSettingsScreen();

    fireEvent.press(view.getByTestId('group-settings.uploader.category-thumbnail'));
    await flushEffects();

    const deletedUris = mockFileDelete.mock.calls.map(([uri]) => uri as string);
    expect(deletedUris.some((uri) => uri.includes('private-thumb-g-3-old-thumb.'))).toBe(true);
    expect(mockFileDelete.mock.invocationCallOrder[0]).toBeLessThan(
      (axios.patch as jest.Mock).mock.invocationCallOrder[0]
    );
    expect(axios.patch).toHaveBeenCalledWith(
      `${CATEGORIES_URL}cat-1/`,
      { private_category: { thumbnail_image_id: 'img-new' } },
      expect.anything()
    );
  });

  it('locks the categories panel for a free owner and routes the tap to the paywall', async () => {
    serveHub({ owned: [OWNER_GROUP], categoryQueue: [[{ id: 'cat-1', name: 'Cats' }]] });
    const { view, navigation } = await renderSettingsScreen({ authOverrides: { paidTier: 0 } });

    expect(view.getByTestId('group-settings.category.locked')).toBeTruthy();
    expect(view.getByText('Cats')).toBeTruthy();
    expect(view.queryByTestId('group-settings.category.add-composer')).toBeNull();
    expect(view.queryByTestId('group-settings.uploader.category-thumbnail')).toBeNull();

    fireEvent.press(view.getByTestId('group-settings.category.locked'));

    expect(navigation.navigate).toHaveBeenCalledWith('PaywallScreen', { intent: 'personalize-group' });
  });

  it('shows the free member cap to a free owner', async () => {
    serveHub({ owned: [OWNER_GROUP], categoryQueue: [[]] });
    const { view } = await renderSettingsScreen({ authOverrides: { paidTier: 0 } });

    const banner = view.getByTestId('group-settings.members.cap-banner');
    const bannerText = banner
      .findAllByType(Text)
      .map((node) => String(node.props.children))
      .join(' ');
    expect(bannerText).toContain('3/10 members');
    expect(view.queryByTestId('group-settings.members.upgrade')).toBeNull();
  });
});
