const mockGuessCategoryCard = jest.fn(() => null);
const mockTutorialOverlay = jest.fn(() => null);
const mockIconButton = jest.fn(() => null);
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

jest.mock('../components/UI/GuessCategoryCard', () => {
  return function MockGuessCategoryCard(props) {
    mockGuessCategoryCard(props);
    return null;
  };
});

jest.mock('../components/UI/TutorialOverlay', () => {
  return function MockTutorialOverlay(props) {
    mockTutorialOverlay(props);
    return null;
  };
});

jest.mock('../components/UI/IconButton', () => {
  return function MockIconButton(props) {
    mockIconButton(props);
    return null;
  };
});

jest.mock('../hooks/useGroupsHub', () => ({
  useGroupsHub: (...args) => mockUseGroupsHub(...args),
}));

jest.mock('../utils/categoryRequests', () => ({
  getCategories: jest.fn(),
}));

jest.mock('../utils/storageDatum', () => ({
  getPreferredLanguage: jest.fn(),
  getSessionLanguageFilter: jest.fn(),
  saveSessionLanguageFilter: jest.fn(),
}));

jest.mock('../utils/e2eMode', () => ({
  isE2EMode: jest.fn(),
}));

jest.mock('../services/groups/groupCategoriesApi', () => ({
  listGroupCategories: jest.fn(),
  createGroupCategory: jest.fn(),
  updateGroupCategory: jest.fn(),
  deleteGroupCategory: jest.fn(),
}));

jest.mock('../services/groups/groupCategoryThumbnails', () => ({
  resolveCategoryThumbnail: jest.fn(),
  deleteCategoryThumbnailFile: jest.fn(),
}));

jest.mock('../services/groups/categoryThumbnailUpload', () => ({
  uploadCategoryThumbnail: jest.fn(),
}));

jest.mock('../services/groups/groupApi', () => ({
  fetchGroups: jest.fn(),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { Alert, Dimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import GuessPathScreen from '../screens/GuessScreens/GuessPathScreen';
import { AuthContext } from '../store/auth-context';
import { getCategories } from '../utils/categoryRequests';
import {
  getPreferredLanguage,
  getSessionLanguageFilter,
  saveSessionLanguageFilter,
} from '../utils/storageDatum';
import { isE2EMode } from '../utils/e2eMode';
import {
  createGroupCategory,
  deleteGroupCategory,
  listGroupCategories,
  updateGroupCategory,
} from '../services/groups/groupCategoriesApi';
import {
  resolveCategoryThumbnail,
  deleteCategoryThumbnailFile,
} from '../services/groups/groupCategoryThumbnails';
import { uploadCategoryThumbnail } from '../services/groups/categoryThumbnailUpload';
import { fetchGroups } from '../services/groups/groupApi';

const CATEGORIES = [
  { id: '1', key: 'nature', name: 'Nature', thumbnailUrl: 'x', count: 5 },
  { id: '2', key: 'city', name: 'City', thumbnailUrl: 'y', count: 3 },
];

const PRIVATE_THUMBNAIL_CATEGORIES = [
  {
    id: 'c-1',
    key: 'c-1',
    name: 'Cats',
    thumbnail_image_id: 'thumb-1',
    thumbnail_url: 'https://example.com/thumb-1.webp',
  },
  {
    id: 'c-2',
    key: 'c-2',
    name: 'Dogs',
    thumbnail_image_id: 'thumb-2',
    thumbnail_url: 'https://example.com/thumb-2.webp',
  },
];

const PRIVATE_CREATED_CATEGORIES = [
  { id: 'c-new', key: 'c-new', name: 'NewCat' },
];

describe('GuessPathScreen', () => {
  const contextValue = { token: 'Bearer token' };
  const mountedRenderers = [];
  let navigation;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusEffects.clear();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 320,
      height: 640,
      scale: 1,
      fontScale: 1,
    });
    isE2EMode.mockReturnValue(false);
    getCategories.mockResolvedValue({ data: CATEGORIES });
    listGroupCategories.mockResolvedValue({ status: 200, data: [] });
    createGroupCategory.mockResolvedValue({ status: 201, data: {} });
    updateGroupCategory.mockResolvedValue({ status: 200, data: {} });
    deleteGroupCategory.mockResolvedValue({ status: 204, data: {} });
    resolveCategoryThumbnail.mockResolvedValue(null);
    deleteCategoryThumbnailFile.mockReturnValue(undefined);
    uploadCategoryThumbnail.mockResolvedValue(null);
    fetchGroups.mockResolvedValue({ status: 200, data: { owned: [], joined: [] } });
    getPreferredLanguage.mockResolvedValue(null);
    getSessionLanguageFilter.mockResolvedValue(null);
    saveSessionLanguageFilter.mockResolvedValue(undefined);
    mockUseGroupsHub.mockReturnValue({ data: null, refresh: jest.fn() });
    navigation = { navigate: jest.fn(), popToTop: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() };
  });

  afterEach(async () => {
    await act(async () => {
      mountedRenderers.splice(0).forEach((renderer) => renderer.unmount());
    });

    Alert.alert.mockRestore();
    Dimensions.get.mockRestore();
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  async function triggerFocusEffects() {
    await act(async () => {
      [...mockFocusEffects].forEach((callback) => callback());
      await flushEffects();
    });
  }

  async function renderScreen(route = { params: {} }) {
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue}>
          <GuessPathScreen navigation={navigation} route={route} />
        </AuthContext.Provider>
      );

      await flushEffects();
    });

    mountedRenderers.push(renderer);

    return renderer;
  }

  it('does not opt into private group loading while rendering the public guess path flow', async () => {
    await renderScreen();

    expect(mockUseGroupsHub).toHaveBeenCalled();
    expect(mockUseGroupsHub.mock.calls.every(([options]) => options?.enabled === false)).toBe(true);
  });

  function getCardPropsByKey(key) {
    const call = mockGuessCategoryCard.mock.calls.find(
      ([props]) => props.category.id === key
    );
    return call?.[0];
  }

  function getDetailsButtonProps() {
    const call = mockIconButton.mock.calls.find(
      ([props]) => props.testID === 'guess-path.button.details'
    );
    return call?.[0];
  }

  function getAddCategoryButtonProps() {
    const call = mockIconButton.mock.calls.find(
      ([props]) => props.testID === 'guess-path.button.add-category'
    );
    return call?.[0];
  }

  function getPencilEditButtonProps(categoryId) {
    const call = mockIconButton.mock.calls.find(
      ([props]) => props.testID === `guess-path.category.edit.${categoryId}`
    );
    return call?.[0];
  }

  function getManageButtonProps() {
    const call = mockIconButton.mock.calls.find(
      ([props]) => props.testID === 'guess-path.button.manage'
    );
    return call?.[0];
  }

  function getDeleteButtonProps(categoryId) {
    const call = mockIconButton.mock.calls.find(
      ([props]) => props.testID === `guess-path.category.delete.${categoryId}`
    );
    return call?.[0];
  }

  function invokeAlertDelete() {
    expect(Alert.alert).toHaveBeenCalled();
    const buttons = Alert.alert.mock.calls[Alert.alert.mock.calls.length - 1][2];
    const deleteButton = buttons.find((b) => b.text === 'Delete');
    return deleteButton.onPress;
  }

  it('fetches categories on mount with the auth context', async () => {
    await renderScreen();

    expect(getCategories).toHaveBeenCalledWith({ context: contextValue });
    expect(getCategories).toHaveBeenCalledTimes(1);
  });

  it('reads the persisted session language filter on mount', async () => {
    await renderScreen();

    expect(getSessionLanguageFilter).toHaveBeenCalledTimes(1);
  });

  it('renders the synthetic Recent/All card as the first grid item', async () => {
    await renderScreen();

    const renderedKeys = mockGuessCategoryCard.mock.calls.map(
      ([props]) => props.category.id
    );

    expect(renderedKeys[0]).toBe('all');
    expect(mockGuessCategoryCard.mock.calls[0][0].category).toEqual(
      expect.objectContaining({ id: 'all', key: 'all', name: 'Recent/All' })
    );
  });

  it('renders one GuessCategoryCard per category returned by the api', async () => {
    await renderScreen();

    const renderedKeys = [...new Set(mockGuessCategoryCard.mock.calls.map(
      ([props]) => props.category.id
    ))];

    expect(renderedKeys).toEqual(['all', 'nature', 'city']);
  });

  it('passes the grid testID and slug-based card testIDs to the flat list', async () => {
    const renderer = await renderScreen();

    expect(renderer.root.findByProps({ testID: 'guess-path.category.grid' })).toBeTruthy();
    expect(getCardPropsByKey('nature')).toEqual(
      expect.objectContaining({
        testIDPrefix: 'guess-path.category',
        category: expect.objectContaining({ id: 'nature', name: 'Nature' }),
      })
    );
  });

  it('navigates to GuessFeedScreen with the selected category and resolved language', async () => {
    await renderScreen();

    const natureCard = getCardPropsByKey('nature');

    await act(async () => {
      natureCard.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('GuessFeedScreen', {
      category: expect.objectContaining({ key: 'nature', name: 'Nature' }),
      language: 'any',
    });
  });

  it('falls back to the preferred language when the session filter is unset', async () => {
    getPreferredLanguage.mockResolvedValue('fr');

    const renderer = await renderScreen();

    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.current' }).props
        .children
    ).toBe('fr');

    const natureCard = getCardPropsByKey('nature');

    await act(async () => {
      natureCard.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('GuessFeedScreen', {
      category: expect.objectContaining({ key: 'nature', name: 'Nature' }),
      language: 'fr',
    });
  });

  it('threads the active private-group ad snapshot into GuessFeedScreen navigation', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [{ id: 'g-1', role: 'owner', member_count: 6 }],
        joined: [],
      },
      refresh: jest.fn(),
    });
    listGroupCategories.mockResolvedValue({
      status: 200,
      data: [{ id: 'c-1', key: 'c-1', name: 'Cats' }],
    });

    await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    const privateCard = getCardPropsByKey('c-1');

    await act(async () => {
      privateCard.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('GuessFeedScreen', {
      category: expect.objectContaining({ key: 'c-1', name: 'Cats' }),
      language: 'any',
      scope: { kind: 'private', groupId: 'g-1' },
      activeGroup: { isOwnedByViewer: true, memberCount: 6 },
    });
  });

  it('fetches groups on press when private hub data is still missing and then threads the active-group snapshot', async () => {
    mockUseGroupsHub.mockReturnValue({ data: null, refresh: jest.fn() });
    listGroupCategories.mockResolvedValue({
      status: 200,
      data: [{ id: 'c-1', key: 'c-1', name: 'Cats' }],
    });
    fetchGroups.mockResolvedValue({
      status: 200,
      data: {
        owned: [{ id: 'g-1', role: 'owner', member_count: 7 }],
        joined: [],
      },
    });

    await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    const privateCard = getCardPropsByKey('c-1');

    await act(async () => {
      await privateCard.onPress();
    });

    expect(fetchGroups).toHaveBeenCalledWith(contextValue);
    expect(navigation.navigate).toHaveBeenCalledWith('GuessFeedScreen', {
      category: expect.objectContaining({ key: 'c-1', name: 'Cats' }),
      language: 'any',
      scope: { kind: 'private', groupId: 'g-1' },
      activeGroup: { isOwnedByViewer: true, memberCount: 7 },
    });
  });

  it('shows the resolved language sentinel (en) while AsyncStorage has not resolved', async () => {
    const renderer = await renderScreen();

    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.current' }).props
        .children
    ).toBe('en');
  });

  it('opens the language filter modal when the details button is tapped', async () => {
    const renderer = await renderScreen();

    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.filter.language' })
    ).toThrow();

    await act(async () => {
      getDetailsButtonProps().onPress();
    });

    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language' })
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.option.fr' })
    ).toBeTruthy();
  });

  it('persists the selected language and updates the resolved language label', async () => {
    const renderer = await renderScreen();

    await act(async () => {
      getDetailsButtonProps().onPress();
    });

    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.current' }).props
        .children
    ).toBe('en');

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.filter.language.option.fr' }).props.onPress();
      await flushEffects();
    });

    expect(saveSessionLanguageFilter).toHaveBeenCalledWith('fr');
    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.current' }).props
        .children
    ).toBe('fr');
  });

  it('keeps the e2e home button available on the category screen', async () => {
    isE2EMode.mockReturnValue(true);

    const renderer = await renderScreen();

    expect(renderer.root.findByProps({ testID: 'guess-path.button.home' })).toBeTruthy();
  });

  it('renders the TutorialOverlay only when the isTutorial route param is set', async () => {
    await renderScreen({ params: { isTutorial: true } });

    expect(mockTutorialOverlay).toHaveBeenCalled();
    expect(mockTutorialOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'GuessPathScreen' })
    );
  });

  it('does not render the TutorialOverlay when isTutorial is absent', async () => {
    await renderScreen();

    expect(mockTutorialOverlay).not.toHaveBeenCalled();
  });

  it('does not render the add-category affordance in public scope even when the user owns groups', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });

    await renderScreen();

    expect(getAddCategoryButtonProps()).toBeUndefined();
  });

  it('does not render the add-category affordance for a non-owner member in private scope', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [],
        joined: [{ id: 'g-1', role: 'member' }],
      },
      refresh: jest.fn(),
    });

    await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    expect(getAddCategoryButtonProps()).toBeUndefined();
  });

  it('renders the add-category affordance for the owner in private scope and creates a category on submit', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    listGroupCategories
      .mockResolvedValueOnce({ status: 200, data: [] })
      .mockResolvedValue({ status: 200, data: PRIVATE_CREATED_CATEGORIES });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    const addButtonProps = getAddCategoryButtonProps();
    expect(addButtonProps).toBeDefined();

    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.add-category.input.name' })
    ).toThrow();

    await act(async () => {
      addButtonProps.onPress();
      await flushEffects();
    });

    const nameInput = renderer.root.findByProps({
      testID: 'guess-path.add-category.input.name',
    });
    expect(nameInput).toBeTruthy();

    await act(async () => {
      nameInput.props.onChangeText('NewCat');
    });

    await act(async () => {
      renderer.root.findByProps({
        testID: 'guess-path.add-category.button.create',
      }).props.onPress();
      await flushEffects();
    });

    expect(createGroupCategory).toHaveBeenCalledWith(
      contextValue,
      'g-1',
      { name: 'NewCat' }
    );
    expect(listGroupCategories).toHaveBeenCalledTimes(2);
    expect(listGroupCategories).toHaveBeenLastCalledWith(contextValue, 'g-1');

    const renderedKeys = mockGuessCategoryCard.mock.calls.map(
      ([props]) => props.category.id
    );
    expect(renderedKeys).toContain('c-new');
  });

  it('prefers resolved local private thumbnail uris and falls back to presigned urls', async () => {
    listGroupCategories.mockResolvedValue({
      status: 200,
      data: PRIVATE_THUMBNAIL_CATEGORIES,
    });
    resolveCategoryThumbnail
      .mockResolvedValueOnce('file:///cache/private-thumb-g-1-thumb-1.webp')
      .mockResolvedValueOnce(null);

    await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    expect(resolveCategoryThumbnail).toHaveBeenCalledTimes(2);
    expect(resolveCategoryThumbnail).toHaveBeenNthCalledWith(1, contextValue, {
      groupId: 'g-1',
      category: PRIVATE_THUMBNAIL_CATEGORIES[0],
    });
    expect(resolveCategoryThumbnail).toHaveBeenNthCalledWith(2, contextValue, {
      groupId: 'g-1',
      category: PRIVATE_THUMBNAIL_CATEGORIES[1],
    });
    expect(getCardPropsByKey('c-1')).toEqual(
      expect.objectContaining({
        thumbnailUrl: 'file:///cache/private-thumb-g-1-thumb-1.webp',
      })
    );
    expect(getCardPropsByKey('c-2')).toEqual(
      expect.objectContaining({
        thumbnailUrl: 'https://example.com/thumb-2.webp',
      })
    );
  });

  it('refetches private categories on focus and resolves thumbnails for categories added on the server', async () => {
    const initialCategory = {
      id: 'c-1',
      key: 'c-1',
      name: 'Cats',
      thumbnail_image_id: 'thumb-1',
      thumbnail_url: 'https://example.com/thumb-1.webp',
    };
    const newServerCategory = {
      id: 'c-2',
      key: 'c-2',
      name: 'Dogs',
      thumbnail_image_id: 'thumb-2',
      thumbnail_url: 'https://example.com/thumb-2.webp',
    };
    let serverCategories = [initialCategory];

    listGroupCategories.mockImplementation(async () => ({
      status: 200,
      data: serverCategories,
    }));

    await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    expect(listGroupCategories).toHaveBeenCalledTimes(1);
    expect(getCardPropsByKey('c-2')).toBeUndefined();

    serverCategories = [initialCategory, newServerCategory];

    await triggerFocusEffects();

    expect(listGroupCategories).toHaveBeenCalledTimes(2);
    expect(listGroupCategories).toHaveBeenLastCalledWith(contextValue, 'g-1');
    expect(getCardPropsByKey('c-2')).toEqual(
      expect.objectContaining({
        category: expect.objectContaining({ id: 'c-2', name: 'Dogs' }),
      })
    );
    expect(resolveCategoryThumbnail).toHaveBeenCalledWith(contextValue, {
      groupId: 'g-1',
      category: newServerCategory,
    });
  });

  it('closes the create-category modal without creating when cancel is tapped', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    await act(async () => {
      getAddCategoryButtonProps().onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({
        testID: 'guess-path.add-category.button.cancel',
      }).props.onPress();
      await flushEffects();
    });

    expect(createGroupCategory).not.toHaveBeenCalled();
    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.add-category.input.name' })
    ).toThrow();
  });

  it('creates a category with thumbnailImageId when a thumbnail is picked in the modal', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    uploadCategoryThumbnail.mockResolvedValue({ imageId: 'img-7' });
    listGroupCategories
      .mockResolvedValueOnce({ status: 200, data: [] })
      .mockResolvedValue({ status: 200, data: PRIVATE_CREATED_CATEGORIES });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    await act(async () => {
      getAddCategoryButtonProps().onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({
        testID: 'guess-path.add-category.button.pick-thumbnail',
      }).props.onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({
        testID: 'guess-path.add-category.input.name',
      }).props.onChangeText('NewCat');
    });

    await act(async () => {
      renderer.root.findByProps({
        testID: 'guess-path.add-category.button.create',
      }).props.onPress();
      await flushEffects();
    });

    expect(uploadCategoryThumbnail).toHaveBeenCalledWith({ context: contextValue, groupId: 'g-1' });
    expect(createGroupCategory).toHaveBeenCalledWith(contextValue, 'g-1', {
      name: 'NewCat',
      thumbnailImageId: 'img-7',
    });
  });

  it('renders a pencil edit affordance on owned category cards and swaps the thumbnail on press', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    const category = {
      id: 'c-1',
      key: 'c-1',
      name: 'Cats',
      thumbnail_image_id: 'old-thumb',
      thumbnail_url: 'https://example.com/old.webp',
    };
    listGroupCategories.mockResolvedValue({ status: 200, data: [category] });
    resolveCategoryThumbnail.mockResolvedValue('file:///cache/old.webp');
    uploadCategoryThumbnail.mockResolvedValue({ imageId: 'img-new' });
    updateGroupCategory.mockResolvedValue({ status: 200, data: {} });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    await act(async () => {
      getManageButtonProps().onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.manage.option.update' }).props.onPress();
      await flushEffects();
    });

    const pencilProps = renderer.root.findByProps({
      testID: 'guess-path.category.edit.c-1',
    }).props;
    expect(pencilProps).toBeTruthy();
    expect(pencilProps.accessibilityLabel).toBe('Edit Cats thumbnail');

    await act(async () => {
      pencilProps.onPress();
      await flushEffects();
    });

    expect(uploadCategoryThumbnail).toHaveBeenCalledWith({ context: contextValue, groupId: 'g-1' });
    expect(deleteCategoryThumbnailFile).toHaveBeenCalledWith('g-1', 'old-thumb');
    expect(deleteCategoryThumbnailFile.mock.invocationCallOrder[0]).toBeLessThan(
      updateGroupCategory.mock.invocationCallOrder[0],
    );
    expect(updateGroupCategory).toHaveBeenCalledWith(contextValue, 'g-1', 'c-1', {
      thumbnailImageId: 'img-new',
    });
    // reloadCategories fired after successful swap.
    expect(listGroupCategories).toHaveBeenCalledTimes(2);
  });

  it('does not render the pencil edit affordance for non-owner members', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [],
        joined: [{ id: 'g-1', role: 'member' }],
      },
      refresh: jest.fn(),
    });
    const category = { id: 'c-1', key: 'c-1', name: 'Cats' };
    listGroupCategories.mockResolvedValue({ status: 200, data: [category] });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    expect(getPencilEditButtonProps('c-1')).toBeUndefined();
    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.category.edit.c-1' })
    ).toThrow();
  });

  it('owner default mode: manage button present, no per-card edit or delete icons', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    const category = { id: 'c-1', key: 'c-1', name: 'Cats' };
    listGroupCategories.mockResolvedValue({ status: 200, data: [category] });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    expect(getManageButtonProps()).toBeDefined();
    expect(getPencilEditButtonProps('c-1')).toBeUndefined();
    expect(getDeleteButtonProps('c-1')).toBeUndefined();
    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.category.edit.c-1' })
    ).toThrow();
    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.category.delete.c-1' })
    ).toThrow();
  });

  it('owner taps manage then Update images: modal opens then closes, pencil appears on non-all card only', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    const category = { id: 'c-1', key: 'c-1', name: 'Cats' };
    listGroupCategories.mockResolvedValue({ status: 200, data: [category] });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.manage' })
    ).toThrow();

    await act(async () => {
      getManageButtonProps().onPress();
      await flushEffects();
    });

    expect(
      renderer.root.findByProps({ testID: 'guess-path.manage.option.update' })
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'guess-path.manage.option.delete' })
    ).toBeTruthy();

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.manage.option.update' }).props.onPress();
      await flushEffects();
    });

    expect(getPencilEditButtonProps('c-1')).toBeDefined();
    expect(getPencilEditButtonProps('all')).toBeUndefined();
    expect(
      renderer.root.findByProps({ testID: 'guess-path.category.edit.c-1' })
    ).toBeTruthy();
  });

  it('owner taps Delete categories: trash appears on non-all card only', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    const category = { id: 'c-1', key: 'c-1', name: 'Cats' };
    listGroupCategories.mockResolvedValue({ status: 200, data: [category] });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    await act(async () => {
      getManageButtonProps().onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.manage.option.delete' }).props.onPress();
      await flushEffects();
    });

    expect(getDeleteButtonProps('c-1')).toBeDefined();
    expect(getDeleteButtonProps('all')).toBeUndefined();
  });

  it('trash press confirms via Alert, deletes category, purges thumbnail file and reloads', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    const category = {
      id: 'c-1',
      key: 'c-1',
      name: 'Cats',
      thumbnail_image_id: 'thumb-1',
    };
    listGroupCategories
      .mockResolvedValueOnce({ status: 200, data: [category] })
      .mockResolvedValue({ status: 200, data: [] });
    deleteGroupCategory.mockResolvedValue({ status: 204, data: {} });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    await act(async () => {
      getManageButtonProps().onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.manage.option.delete' }).props.onPress();
      await flushEffects();
    });

    const trashProps = getDeleteButtonProps('c-1');

    await act(async () => {
      trashProps.onPress();
      await flushEffects();
    });

    const deleteOnPress = invokeAlertDelete();

    await act(async () => {
      await deleteOnPress();
      await flushEffects();
    });

    expect(deleteGroupCategory).toHaveBeenCalledWith(contextValue, 'g-1', 'c-1');
    expect(deleteCategoryThumbnailFile).toHaveBeenCalledWith('g-1', 'thumb-1');
    expect(listGroupCategories).toHaveBeenCalledTimes(2);
  });

  it('delete error branch: reload NOT called and Alert error path triggered', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    const category = { id: 'c-1', key: 'c-1', name: 'Cats' };
    listGroupCategories.mockResolvedValue({ status: 200, data: [category] });
    deleteGroupCategory.mockResolvedValue({ status: 500, data: {} });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    const initialCalls = listGroupCategories.mock.calls.length;

    await act(async () => {
      getManageButtonProps().onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.manage.option.delete' }).props.onPress();
      await flushEffects();
    });

    const trashProps = getDeleteButtonProps('c-1');

    await act(async () => {
      trashProps.onPress();
      await flushEffects();
    });

    const deleteOnPress = invokeAlertDelete();

    await act(async () => {
      await deleteOnPress();
      await flushEffects();
    });

    expect(deleteGroupCategory).toHaveBeenCalledWith(contextValue, 'g-1', 'c-1');
    expect(listGroupCategories).toHaveBeenCalledTimes(initialCalls);
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Error 500',
      'Could not delete category.'
    );
  });

  it('non-owner: manage button absent and no per-card icons', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [],
        joined: [{ id: 'g-1', role: 'member' }],
      },
      refresh: jest.fn(),
    });
    const category = { id: 'c-1', key: 'c-1', name: 'Cats' };
    listGroupCategories.mockResolvedValue({ status: 200, data: [category] });

    await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    expect(getManageButtonProps()).toBeUndefined();
    expect(getPencilEditButtonProps('c-1')).toBeUndefined();
    expect(getDeleteButtonProps('c-1')).toBeUndefined();
  });

  it('manage banner hidden by default, visible after picking a mode, hidden again after Done', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    const category = { id: 'c-1', key: 'c-1', name: 'Cats' };
    listGroupCategories.mockResolvedValue({ status: 200, data: [category] });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.button.manage-done' })
    ).toThrow();

    await act(async () => {
      getManageButtonProps().onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.manage.option.delete' }).props.onPress();
      await flushEffects();
    });

    expect(
      renderer.root.findByProps({ testID: 'guess-path.button.manage-done' })
    ).toBeTruthy();
    expect(getDeleteButtonProps('c-1')).toBeDefined();

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.button.manage-done' }).props.onPress();
      await flushEffects();
    });

    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.button.manage-done' })
    ).toThrow();
    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.category.delete.c-1' })
    ).toThrow();
  });

  it('useFocusEffect re-focus resets manageMode so the trash icon disappears', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    const category = { id: 'c-1', key: 'c-1', name: 'Cats' };
    listGroupCategories.mockResolvedValue({ status: 200, data: [category] });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    await act(async () => {
      getManageButtonProps().onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.manage.option.delete' }).props.onPress();
      await flushEffects();
    });

    expect(getDeleteButtonProps('c-1')).toBeDefined();

    await triggerFocusEffects();

    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.category.delete.c-1' })
    ).toThrow();
  });

  it('does not fire a second delete when the trash icon is tapped while a delete is in flight', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    const category = { id: 'c-1', key: 'c-1', name: 'Cats' };
    listGroupCategories.mockResolvedValue({ status: 200, data: [category] });

    let resolveFirstDelete;
    deleteGroupCategory.mockImplementation(
      () => new Promise((resolve) => { resolveFirstDelete = resolve; })
    );

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    await act(async () => {
      getManageButtonProps().onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.manage.option.delete' }).props.onPress();
      await flushEffects();
    });

    await act(async () => {
      getDeleteButtonProps('c-1').onPress();
      await flushEffects();
    });
    const firstDeleteOnPress = invokeAlertDelete();

    await act(async () => {
      firstDeleteOnPress();
      await flushEffects();
    });

    expect(deleteGroupCategory).toHaveBeenCalledTimes(1);

    const trashCalls = mockIconButton.mock.calls.filter(
      ([props]) => props.testID === 'guess-path.category.delete.c-1'
    );
    const latestTrashProps = trashCalls[trashCalls.length - 1][0];

    await act(async () => {
      latestTrashProps.onPress();
      await flushEffects();
    });
    const secondDeleteOnPress = invokeAlertDelete();

    await act(async () => {
      secondDeleteOnPress();
      await flushEffects();
    });

    expect(deleteGroupCategory).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstDelete({ status: 204, data: {} });
      await flushEffects();
    });

    expect(deleteGroupCategory).toHaveBeenCalledTimes(1);
  });
});
