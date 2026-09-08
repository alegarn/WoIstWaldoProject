import type { ContextType } from 'react';
import React from 'react';
import { Alert, Dimensions } from 'react-native';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';

type MockCardProps = {
  category: { id?: string; key?: string; name?: string };
  thumbnailUrl?: string | null;
  count?: number;
  onPress: () => void | Promise<void>;
  testIDPrefix?: string;
};

type MockIconButtonProps = {
  icon?: string;
  color?: string;
  size?: number;
  onPress: () => void | Promise<void>;
  testID?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
};

type MockTutorialOverlayProps = {
  screen?: string;
  instructionsPosition?: { top: number; left: number };
};

type PrivateCategory = {
  id: string;
  key: string;
  name: string;
  thumbnail_image_id?: string;
  thumbnail_url?: string;
};

type OnCategories = (list: PrivateCategory[]) => void;

type FocusEffectCallback = () => void | (() => void);

const mockGuessCategoryCard = jest.fn((_props: MockCardProps) => null);
const mockTutorialOverlay = jest.fn((_props: MockTutorialOverlayProps) => null);
const mockIconButton = jest.fn((_props: MockIconButtonProps) => null);
const mockUseGroupsHub = jest.fn();
const mockFocusEffects = new Set<FocusEffectCallback>();

jest.mock('@react-navigation/native', () => {
  const React = require('react');

  return {
    useFocusEffect: (callback: FocusEffectCallback) => {
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
  return function MockGuessCategoryCard(props: MockCardProps) {
    mockGuessCategoryCard(props);
    return null;
  };
});

jest.mock('../components/UI/TutorialOverlay', () => {
  return function MockTutorialOverlay(props: MockTutorialOverlayProps) {
    mockTutorialOverlay(props);
    return null;
  };
});

jest.mock('../components/UI/IconButton', () => {
  return function MockIconButton(props: MockIconButtonProps) {
    mockIconButton(props);
    return null;
  };
});

jest.mock('../hooks/useGroupsHub', () => ({
  useGroupsHub: (...args: unknown[]) => mockUseGroupsHub(...args),
}));

jest.mock('../utils/categoryRequests', () => ({
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
}));

jest.mock('../utils/storageDatum', () => ({
  getPreferredLanguage: (...args: unknown[]) => mockGetPreferredLanguage(...args),
  getSessionLanguageFilter: (...args: unknown[]) => mockGetSessionLanguageFilter(...args),
  saveSessionLanguageFilter: (...args: unknown[]) => mockSaveSessionLanguageFilter(...args),
}));

jest.mock('../utils/e2eMode', () => ({
  isE2EMode: (...args: unknown[]) => mockIsE2EMode(...args),
}));

jest.mock('../services/groups/groupCategoriesApi', () => ({
  createGroupCategory: (...args: unknown[]) => mockCreateGroupCategory(...args),
  updateGroupCategory: (...args: unknown[]) => mockUpdateGroupCategory(...args),
  deleteGroupCategory: (...args: unknown[]) => mockDeleteGroupCategory(...args),
}));

jest.mock('../services/groups/groupCategoriesStore', () => ({
  loadGroupCategoriesOptimistic: (...args: unknown[]) => mockLoadGroupCategoriesOptimistic(...args),
}));

jest.mock('../services/groups/groupCategoryThumbnails', () => ({
  resolveCategoryThumbnail: (...args: unknown[]) => mockResolveCategoryThumbnail(...args),
  deleteCategoryThumbnailFile: (...args: unknown[]) => mockDeleteCategoryThumbnailFile(...args),
}));

jest.mock('../services/groups/categoryThumbnailUpload', () => ({
  uploadCategoryThumbnail: (...args: unknown[]) => mockUploadCategoryThumbnail(...args),
}));

jest.mock('../services/groups/groupApi', () => ({
  fetchGroups: (...args: unknown[]) => mockFetchGroups(...args),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

const mockGetCategories = jest.fn();
const mockGetPreferredLanguage = jest.fn();
const mockGetSessionLanguageFilter = jest.fn();
const mockSaveSessionLanguageFilter = jest.fn();
const mockIsE2EMode = jest.fn();
const mockCreateGroupCategory = jest.fn();
const mockUpdateGroupCategory = jest.fn();
const mockDeleteGroupCategory = jest.fn();
const mockLoadGroupCategoriesOptimistic = jest.fn();
const mockResolveCategoryThumbnail = jest.fn();
const mockDeleteCategoryThumbnailFile = jest.fn();
const mockUploadCategoryThumbnail = jest.fn();
const mockFetchGroups = jest.fn();

import GuessPathScreen from '../screens/GuessScreens/GuessPathScreen';
import { AuthContext } from '../store/auth-context';

const BUNDLED_CATEGORY_KEYS = [
  'other',
  'nature',
  'city',
  'abstract',
  'animals',
  'food',
  'vehicles',
  'interiors',
  'landmarks',
];

const PRIVATE_THUMBNAIL_CATEGORIES: PrivateCategory[] = [
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

const PRIVATE_CREATED_CATEGORIES: PrivateCategory[] = [
  { id: 'c-new', key: 'c-new', name: 'NewCat' },
];

function emitCategoriesViaStore(list: PrivateCategory[]) {
  mockLoadGroupCategoriesOptimistic.mockImplementation(async ({ onCategories }: { onCategories?: OnCategories }) => {
    if (typeof onCategories === 'function') {
      onCategories(list);
    }
  });
}

describe('GuessPathScreen', () => {
  const contextValue = { token: 'Bearer token' };
  const mountedRenderers: ReactTestRenderer[] = [];
  let navigation: {
    navigate: jest.Mock;
    popToTop: jest.Mock;
    goBack: jest.Mock;
    setOptions: jest.Mock;
  };
  let alertSpy: jest.SpyInstance;
  let dimensionsGetSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusEffects.clear();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    dimensionsGetSpy = jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 320,
      height: 640,
      scale: 1,
      fontScale: 1,
    });
    mockIsE2EMode.mockReturnValue(false);
    mockGetCategories.mockResolvedValue({ data: [] });
    mockCreateGroupCategory.mockResolvedValue({ status: 201, data: {} });
    mockUpdateGroupCategory.mockResolvedValue({ status: 200, data: {} });
    mockDeleteGroupCategory.mockResolvedValue({ status: 204, data: {} });
    mockResolveCategoryThumbnail.mockResolvedValue(null);
    mockDeleteCategoryThumbnailFile.mockReturnValue(undefined);
    mockUploadCategoryThumbnail.mockResolvedValue(null);
    mockFetchGroups.mockResolvedValue({ status: 200, data: { owned: [], joined: [] } });
    mockGetPreferredLanguage.mockResolvedValue(null);
    mockGetSessionLanguageFilter.mockResolvedValue(null);
    mockSaveSessionLanguageFilter.mockResolvedValue(undefined);
    mockUseGroupsHub.mockReturnValue({ data: null, refresh: jest.fn() });
    emitCategoriesViaStore([]);
    navigation = { navigate: jest.fn(), popToTop: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() };
  });

  afterEach(async () => {
    await act(async () => {
      mountedRenderers.splice(0).forEach((renderer) => renderer.unmount());
    });

    alertSpy.mockRestore();
    dimensionsGetSpy.mockRestore();
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

  async function renderScreen(
    route: { params?: { isTutorial?: boolean; scope?: { kind: 'private'; groupId: string } } } = { params: {} }
  ) {
    let renderer!: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue as ContextType<typeof AuthContext>}>
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

  function getCardPropsByKey(key: string): MockCardProps | undefined {
    for (let i = mockGuessCategoryCard.mock.calls.length - 1; i >= 0; i -= 1) {
      const [props] = mockGuessCategoryCard.mock.calls[i];
      if (props.category.id === key) {
        return props;
      }
    }
    return undefined;
  }

  function getDetailsButtonProps(): MockIconButtonProps | undefined {
    const call = mockIconButton.mock.calls.find(
      ([props]) => props.testID === 'guess-path.button.details'
    );
    return call?.[0];
  }

  function getAddCategoryButtonProps(): MockIconButtonProps | undefined {
    const call = mockIconButton.mock.calls.find(
      ([props]) => props.testID === 'guess-path.button.add-category'
    );
    return call?.[0];
  }

  function getPencilEditButtonProps(categoryId: string): MockIconButtonProps | undefined {
    const call = mockIconButton.mock.calls.find(
      ([props]) => props.testID === `guess-path.category.edit.${categoryId}`
    );
    return call?.[0];
  }

  function getManageButtonProps(): MockIconButtonProps | undefined {
    const call = mockIconButton.mock.calls.find(
      ([props]) => props.testID === 'guess-path.button.manage'
    );
    return call?.[0];
  }

  function getDeleteButtonProps(categoryId: string): MockIconButtonProps | undefined {
    const call = mockIconButton.mock.calls.find(
      ([props]) => props.testID === `guess-path.category.delete.${categoryId}`
    );
    return call?.[0];
  }

  function invokeAlertDelete() {
    expect(alertSpy).toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[alertSpy.mock.calls.length - 1][2];
    const deleteButton = buttons.find((b: { text: string }) => b.text === 'Delete');
    return deleteButton.onPress;
  }

  it('renders the bundled default categories on mount without any network call', async () => {
    await renderScreen();

    expect(mockGetCategories).not.toHaveBeenCalled();
    expect(mockLoadGroupCategoriesOptimistic).not.toHaveBeenCalled();

    const renderedKeys = [...new Set(mockGuessCategoryCard.mock.calls.map(
      ([props]) => props.category.id
    ))];

    expect(renderedKeys).toEqual(['all', ...BUNDLED_CATEGORY_KEYS]);
  });

  it('reads the persisted session language filter on mount', async () => {
    await renderScreen();

    expect(mockGetSessionLanguageFilter).toHaveBeenCalledTimes(1);
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

    const natureCard = getCardPropsByKey('nature')!;

    await act(async () => {
      natureCard.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('GuessFeedScreen', {
      category: expect.objectContaining({ key: 'nature', name: 'Nature' }),
      language: 'any',
    });
  });

  it('falls back to the preferred language when the session filter is unset', async () => {
    mockGetPreferredLanguage.mockResolvedValue('fr');

    const renderer = await renderScreen();

    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.current' }).props
        .children
    ).toBe('fr');

    const natureCard = getCardPropsByKey('nature')!;

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
    emitCategoriesViaStore([{ id: 'c-1', key: 'c-1', name: 'Cats' }]);

    await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    const privateCard = getCardPropsByKey('c-1')!;

    await act(async () => {
      privateCard.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('GuessFeedScreen', {
      category: expect.objectContaining({ key: 'c-1', name: 'Cats' }),
      language: 'any',
      scope: { kind: 'private', groupId: 'g-1' },
      activeGroup: { isOwnedByViewer: true, memberCount: 6, locked: false },
    });
  });

  it('does not navigate to GuessFeedScreen and shows the lock alert when the private group is locked', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [{ id: 'g-1', role: 'owner', locked: true }],
        joined: [],
      },
      refresh: jest.fn(),
    });
    emitCategoriesViaStore([{ id: 'c-1', key: 'c-1', name: 'Cats' }]);

    await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    const privateCard = getCardPropsByKey('c-1')!;

    await act(async () => {
      await privateCard.onPress();
    });

    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Group is locked',
      'New private games are paused until the owner renews the subscription or transfers ownership.'
    );
  });

  it('fetches groups on press when private hub data is still missing and then threads the active-group snapshot', async () => {
    mockUseGroupsHub.mockReturnValue({ data: null, refresh: jest.fn() });
    emitCategoriesViaStore([{ id: 'c-1', key: 'c-1', name: 'Cats' }]);
    mockFetchGroups.mockResolvedValue({
      status: 200,
      data: {
        owned: [{ id: 'g-1', role: 'owner', member_count: 7 }],
        joined: [],
      },
    });

    await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    const privateCard = getCardPropsByKey('c-1')!;

    await act(async () => {
      await privateCard.onPress();
    });

    expect(mockFetchGroups).toHaveBeenCalledWith(contextValue);
    expect(navigation.navigate).toHaveBeenCalledWith('GuessFeedScreen', {
      category: expect.objectContaining({ key: 'c-1', name: 'Cats' }),
      language: 'any',
      scope: { kind: 'private', groupId: 'g-1' },
      activeGroup: { isOwnedByViewer: true, memberCount: 7, locked: false },
    });
  });

  it('blocks navigation and shows the lock alert when the on-demand fetch resolves a locked group', async () => {
    mockUseGroupsHub.mockReturnValue({ data: null, refresh: jest.fn() });
    emitCategoriesViaStore([{ id: 'c-1', key: 'c-1', name: 'Cats' }]);
    mockFetchGroups.mockResolvedValue({
      status: 200,
      data: {
        owned: [{ id: 'g-1', role: 'owner', member_count: 7, locked: true }],
        joined: [],
      },
    });

    await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    const privateCard = getCardPropsByKey('c-1')!;

    await act(async () => {
      await privateCard.onPress();
    });

    expect(mockFetchGroups).toHaveBeenCalledWith(contextValue);
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Group is locked',
      'New private games are paused until the owner renews the subscription or transfers ownership.'
    );
  });

  it('renders private categories optimistically via the store onCategories callback', async () => {
    const cachedCategories: PrivateCategory[] = [
      { id: 'c-cached', key: 'c-cached', name: 'Cached' },
    ];
    emitCategoriesViaStore(cachedCategories);

    await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    expect(mockLoadGroupCategoriesOptimistic).toHaveBeenCalledWith(expect.objectContaining({
      context: contextValue,
      groupId: 'g-1',
      onCategories: expect.any(Function),
    }));

    const renderedIds = mockGuessCategoryCard.mock.calls.map(
      ([props]) => props.category.id
    );
    expect(renderedIds).toContain('c-cached');
  });

  it('replaces the optimistic list with the revalidated fresh list from the store', async () => {
    const freshCategories: PrivateCategory[] = [
      { id: 'c-fresh', key: 'c-fresh', name: 'Fresh' },
    ];
    let onCategoriesRef: OnCategories | null = null;
    mockLoadGroupCategoriesOptimistic.mockImplementation(async ({ onCategories }: { onCategories?: OnCategories }) => {
      onCategoriesRef = onCategories ?? null;
      if (typeof onCategories === 'function') {
        onCategories([{ id: 'c-cached', key: 'c-cached', name: 'Cached' }]);
      }
    });

    await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    expect(mockGuessCategoryCard.mock.calls.some(
      ([props]) => props.category.id === 'c-cached'
    )).toBe(true);

    const callsBeforeFresh = mockGuessCategoryCard.mock.calls.length;

    await act(async () => {
      onCategoriesRef!(freshCategories);
      await flushEffects();
    });

    const callsAfterFresh = mockGuessCategoryCard.mock.calls.slice(callsBeforeFresh);
    const renderedIdsAfterFresh = callsAfterFresh.map(([props]) => props.category.id);

    expect(renderedIdsAfterFresh).toContain('c-fresh');
    expect(renderedIdsAfterFresh).not.toContain('c-cached');
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
      getDetailsButtonProps()!.onPress();
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
      getDetailsButtonProps()!.onPress();
    });

    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.current' }).props
        .children
    ).toBe('en');

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.filter.language.option.fr' }).props.onPress();
      await flushEffects();
    });

    expect(mockSaveSessionLanguageFilter).toHaveBeenCalledWith('fr');
    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.current' }).props
        .children
    ).toBe('fr');
  });

  it('keeps the e2e home button available on the category screen', async () => {
    mockIsE2EMode.mockReturnValue(true);
    mockGetCategories.mockResolvedValue({ data: [] });

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

  it('shows the owner affordances once the hub resolves after a cold-start null and refreshes the hub on focus', async () => {
    const hubRefresh = jest.fn();
    mockUseGroupsHub.mockReturnValue({ data: null, refresh: hubRefresh });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    expect(getAddCategoryButtonProps()).toBeUndefined();
    expect(getManageButtonProps()).toBeUndefined();

    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: hubRefresh,
    });

    await act(async () => {
      renderer.update(
        <AuthContext.Provider value={contextValue as ContextType<typeof AuthContext>}>
          <GuessPathScreen
            navigation={navigation}
            route={{ params: { scope: { kind: 'private', groupId: 'g-1' } } }}
          />
        </AuthContext.Provider>
      );
      await flushEffects();
    });

    expect(getAddCategoryButtonProps()).toBeDefined();
    expect(getManageButtonProps()).toBeDefined();

    await triggerFocusEffects();

    expect(hubRefresh).toHaveBeenCalled();
  });

  it('renders the add-category affordance for the owner in private scope and creates a category on submit', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    mockLoadGroupCategoriesOptimistic
      .mockImplementationOnce(async ({ onCategories }: { onCategories?: OnCategories }) => {
        if (typeof onCategories === 'function') onCategories([]);
      })
      .mockImplementation(async ({ onCategories }: { onCategories?: OnCategories }) => {
        if (typeof onCategories === 'function') onCategories(PRIVATE_CREATED_CATEGORIES);
      });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    const addButtonProps = getAddCategoryButtonProps();
    expect(addButtonProps).toBeDefined();

    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.add-category.input.name' })
    ).toThrow();

    await act(async () => {
      addButtonProps!.onPress();
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

    expect(mockCreateGroupCategory).toHaveBeenCalledWith(
      contextValue,
      'g-1',
      { name: 'NewCat' }
    );
    expect(mockLoadGroupCategoriesOptimistic).toHaveBeenCalledTimes(2);
    expect(mockLoadGroupCategoriesOptimistic).toHaveBeenLastCalledWith(expect.objectContaining({
      context: contextValue,
      groupId: 'g-1',
      onCategories: expect.any(Function),
    }));

    const renderedKeys = mockGuessCategoryCard.mock.calls.map(
      ([props]) => props.category.id
    );
    expect(renderedKeys).toContain('c-new');
  });

  it('prefers resolved local private thumbnail uris and falls back to presigned urls', async () => {
    emitCategoriesViaStore(PRIVATE_THUMBNAIL_CATEGORIES);
    mockResolveCategoryThumbnail
      .mockResolvedValueOnce('file:///cache/private-thumb-g-1-thumb-1.webp')
      .mockResolvedValueOnce(null);

    await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    expect(mockResolveCategoryThumbnail).toHaveBeenCalledTimes(2);
    expect(mockResolveCategoryThumbnail).toHaveBeenNthCalledWith(1, contextValue, {
      groupId: 'g-1',
      category: PRIVATE_THUMBNAIL_CATEGORIES[0],
    });
    expect(mockResolveCategoryThumbnail).toHaveBeenNthCalledWith(2, contextValue, {
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
    const initialCategory: PrivateCategory = {
      id: 'c-1',
      key: 'c-1',
      name: 'Cats',
      thumbnail_image_id: 'thumb-1',
      thumbnail_url: 'https://example.com/thumb-1.webp',
    };
    const newServerCategory: PrivateCategory = {
      id: 'c-2',
      key: 'c-2',
      name: 'Dogs',
      thumbnail_image_id: 'thumb-2',
      thumbnail_url: 'https://example.com/thumb-2.webp',
    };
    let serverCategories: PrivateCategory[] = [initialCategory];

    mockLoadGroupCategoriesOptimistic.mockImplementation(async ({ onCategories }: { onCategories?: OnCategories }) => {
      if (typeof onCategories === 'function') {
        onCategories(serverCategories);
      }
    });

    await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    expect(mockLoadGroupCategoriesOptimistic).toHaveBeenCalledTimes(1);
    expect(getCardPropsByKey('c-2')).toBeUndefined();

    serverCategories = [initialCategory, newServerCategory];

    await triggerFocusEffects();

    expect(mockLoadGroupCategoriesOptimistic).toHaveBeenCalledTimes(2);
    expect(mockLoadGroupCategoriesOptimistic).toHaveBeenLastCalledWith(expect.objectContaining({
      context: contextValue,
      groupId: 'g-1',
      onCategories: expect.any(Function),
    }));
    expect(getCardPropsByKey('c-2')).toEqual(
      expect.objectContaining({
        category: expect.objectContaining({ id: 'c-2', name: 'Dogs' }),
      })
    );
    expect(mockResolveCategoryThumbnail).toHaveBeenCalledWith(contextValue, {
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
      getAddCategoryButtonProps()!.onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({
        testID: 'guess-path.add-category.button.cancel',
      }).props.onPress();
      await flushEffects();
    });

    expect(mockCreateGroupCategory).not.toHaveBeenCalled();
    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.add-category.input.name' })
    ).toThrow();
  });

  it('creates a category with thumbnailImageId when a thumbnail is picked in the modal', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    mockUploadCategoryThumbnail.mockResolvedValue({ imageId: 'img-7' });
    mockLoadGroupCategoriesOptimistic
      .mockImplementationOnce(async ({ onCategories }: { onCategories?: OnCategories }) => {
        if (typeof onCategories === 'function') onCategories([]);
      })
      .mockImplementation(async ({ onCategories }: { onCategories?: OnCategories }) => {
        if (typeof onCategories === 'function') onCategories(PRIVATE_CREATED_CATEGORIES);
      });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    await act(async () => {
      getAddCategoryButtonProps()!.onPress();
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

    expect(mockUploadCategoryThumbnail).toHaveBeenCalledWith({ context: contextValue, groupId: 'g-1' });
    expect(mockCreateGroupCategory).toHaveBeenCalledWith(contextValue, 'g-1', {
      name: 'NewCat',
      thumbnailImageId: 'img-7',
    });
    expect(mockUpdateGroupCategory).not.toHaveBeenCalled();
  });

  it('disables the create confirm button while a thumbnail pick is in flight and drops create presses', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    let resolveUpload!: (value: { imageId: string } | null) => void;
    mockUploadCategoryThumbnail.mockImplementation(
      () => new Promise<{ imageId: string } | null>((resolve) => { resolveUpload = resolve; })
    );

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    await act(async () => {
      getAddCategoryButtonProps()!.onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({
        testID: 'guess-path.add-category.button.pick-thumbnail',
      }).props.onPress();
      await flushEffects();
    });

    const confirmButton = renderer.root.findByProps({
      testID: 'guess-path.add-category.button.create',
    });
    expect(confirmButton.props.disabled).toBe(true);
    expect(
      renderer.root.findByProps({ testID: 'guess-path.add-category.button.cancel' }).props.disabled
    ).toBeUndefined();

    await act(async () => {
      confirmButton.props.onPress();
      await flushEffects();
    });

    expect(mockCreateGroupCategory).not.toHaveBeenCalled();

    await act(async () => {
      resolveUpload(null);
      await flushEffects();
    });
  });

  it('PATCHes the thumbnail onto the created category when the pending pick completes after create', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    let resolveUpload!: (value: { imageId: string } | null) => void;
    mockUploadCategoryThumbnail.mockImplementation(
      () => new Promise<{ imageId: string } | null>((resolve) => { resolveUpload = resolve; })
    );
    mockCreateGroupCategory.mockResolvedValue({ status: 201, data: { id: 'c-new' } });
    mockLoadGroupCategoriesOptimistic
      .mockImplementationOnce(async ({ onCategories }: { onCategories?: OnCategories }) => {
        if (typeof onCategories === 'function') onCategories([]);
      })
      .mockImplementation(async ({ onCategories }: { onCategories?: OnCategories }) => {
        if (typeof onCategories === 'function') onCategories(PRIVATE_CREATED_CATEGORIES);
      });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    await act(async () => {
      getAddCategoryButtonProps()!.onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({
        testID: 'guess-path.add-category.input.name',
      }).props.onChangeText('NewCat');
    });

    const staleCreateOnPress = renderer.root.findByProps({
      testID: 'guess-path.add-category.button.create',
    }).props.onPress;

    await act(async () => {
      renderer.root.findByProps({
        testID: 'guess-path.add-category.button.pick-thumbnail',
      }).props.onPress();
      await flushEffects();
    });

    await act(async () => {
      staleCreateOnPress();
      await flushEffects();
    });

    expect(mockCreateGroupCategory).toHaveBeenCalledWith(contextValue, 'g-1', { name: 'NewCat' });

    await act(async () => {
      resolveUpload({ imageId: 'img-late' });
      await flushEffects();
    });

    expect(mockUpdateGroupCategory).toHaveBeenCalledTimes(1);
    expect(mockUpdateGroupCategory).toHaveBeenCalledWith(contextValue, 'g-1', 'c-new', {
      thumbnailImageId: 'img-late',
    });
    expect(mockLoadGroupCategoriesOptimistic).toHaveBeenCalledTimes(3);
  });

  it('renders a pencil edit affordance on owned category cards and swaps the thumbnail on press', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    const category: PrivateCategory = {
      id: 'c-1',
      key: 'c-1',
      name: 'Cats',
      thumbnail_image_id: 'old-thumb',
      thumbnail_url: 'https://example.com/old.webp',
    };
    emitCategoriesViaStore([category]);
    mockResolveCategoryThumbnail.mockResolvedValue('file:///cache/old.webp');
    mockUploadCategoryThumbnail.mockResolvedValue({ imageId: 'img-new' });
    mockUpdateGroupCategory.mockResolvedValue({ status: 200, data: {} });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    await act(async () => {
      getManageButtonProps()!.onPress();
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

    expect(mockUploadCategoryThumbnail).toHaveBeenCalledWith({ context: contextValue, groupId: 'g-1' });
    expect(mockDeleteCategoryThumbnailFile).toHaveBeenCalledWith('g-1', 'old-thumb');
    expect(mockDeleteCategoryThumbnailFile.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpdateGroupCategory.mock.invocationCallOrder[0],
    );
    expect(mockUpdateGroupCategory).toHaveBeenCalledWith(contextValue, 'g-1', 'c-1', {
      thumbnailImageId: 'img-new',
    });
    // reloadCategories fired after successful swap.
    expect(mockLoadGroupCategoriesOptimistic).toHaveBeenCalledTimes(2);
  });

  it('does not render the pencil edit affordance for non-owner members', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [],
        joined: [{ id: 'g-1', role: 'member' }],
      },
      refresh: jest.fn(),
    });
    const category: PrivateCategory = { id: 'c-1', key: 'c-1', name: 'Cats' };
    emitCategoriesViaStore([category]);

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
    const category: PrivateCategory = { id: 'c-1', key: 'c-1', name: 'Cats' };
    emitCategoriesViaStore([category]);

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
    const category: PrivateCategory = { id: 'c-1', key: 'c-1', name: 'Cats' };
    emitCategoriesViaStore([category]);

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.manage' })
    ).toThrow();

    await act(async () => {
      getManageButtonProps()!.onPress();
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
    const category: PrivateCategory = { id: 'c-1', key: 'c-1', name: 'Cats' };
    emitCategoriesViaStore([category]);

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    await act(async () => {
      getManageButtonProps()!.onPress();
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
    const category: PrivateCategory = {
      id: 'c-1',
      key: 'c-1',
      name: 'Cats',
      thumbnail_image_id: 'thumb-1',
    };
    mockLoadGroupCategoriesOptimistic
      .mockImplementationOnce(async ({ onCategories }: { onCategories?: OnCategories }) => {
        if (typeof onCategories === 'function') onCategories([category]);
      })
      .mockImplementation(async ({ onCategories }: { onCategories?: OnCategories }) => {
        if (typeof onCategories === 'function') onCategories([]);
      });
    mockDeleteGroupCategory.mockResolvedValue({ status: 204, data: {} });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    await act(async () => {
      getManageButtonProps()!.onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.manage.option.delete' }).props.onPress();
      await flushEffects();
    });

    const trashProps = getDeleteButtonProps('c-1');

    await act(async () => {
      trashProps!.onPress();
      await flushEffects();
    });

    const deleteOnPress = invokeAlertDelete();

    await act(async () => {
      await deleteOnPress();
      await flushEffects();
    });

    expect(mockDeleteGroupCategory).toHaveBeenCalledWith(contextValue, 'g-1', 'c-1');
    expect(mockDeleteCategoryThumbnailFile).toHaveBeenCalledWith('g-1', 'thumb-1');
    expect(mockLoadGroupCategoriesOptimistic).toHaveBeenCalledTimes(2);
  });

  it('delete error branch: reload NOT called and Alert error path triggered', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-1', role: 'owner' }] },
      refresh: jest.fn(),
    });
    const category: PrivateCategory = { id: 'c-1', key: 'c-1', name: 'Cats' };
    emitCategoriesViaStore([category]);
    mockDeleteGroupCategory.mockResolvedValue({ status: 500, data: {} });

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    const initialCalls = mockLoadGroupCategoriesOptimistic.mock.calls.length;

    await act(async () => {
      getManageButtonProps()!.onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.manage.option.delete' }).props.onPress();
      await flushEffects();
    });

    const trashProps = getDeleteButtonProps('c-1');

    await act(async () => {
      trashProps!.onPress();
      await flushEffects();
    });

    const deleteOnPress = invokeAlertDelete();

    await act(async () => {
      await deleteOnPress();
      await flushEffects();
    });

    expect(mockDeleteGroupCategory).toHaveBeenCalledWith(contextValue, 'g-1', 'c-1');
    expect(mockLoadGroupCategoriesOptimistic).toHaveBeenCalledTimes(initialCalls);
    expect(alertSpy).toHaveBeenLastCalledWith(
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
    const category: PrivateCategory = { id: 'c-1', key: 'c-1', name: 'Cats' };
    emitCategoriesViaStore([category]);

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
    const category: PrivateCategory = { id: 'c-1', key: 'c-1', name: 'Cats' };
    emitCategoriesViaStore([category]);

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.button.manage-done' })
    ).toThrow();

    await act(async () => {
      getManageButtonProps()!.onPress();
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
    const category: PrivateCategory = { id: 'c-1', key: 'c-1', name: 'Cats' };
    emitCategoriesViaStore([category]);

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    await act(async () => {
      getManageButtonProps()!.onPress();
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
    const category: PrivateCategory = { id: 'c-1', key: 'c-1', name: 'Cats' };
    emitCategoriesViaStore([category]);

    let resolveFirstDelete!: (value: { status: number; data: object }) => void;
    mockDeleteGroupCategory.mockImplementation(
      () => new Promise<{ status: number; data: object }>((resolve) => { resolveFirstDelete = resolve; })
    );

    const renderer = await renderScreen({ params: { scope: { kind: 'private', groupId: 'g-1' } } });

    await act(async () => {
      getManageButtonProps()!.onPress();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.manage.option.delete' }).props.onPress();
      await flushEffects();
    });

    await act(async () => {
      getDeleteButtonProps('c-1')!.onPress();
      await flushEffects();
    });
    const firstDeleteOnPress = invokeAlertDelete();

    await act(async () => {
      firstDeleteOnPress();
      await flushEffects();
    });

    expect(mockDeleteGroupCategory).toHaveBeenCalledTimes(1);

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

    expect(mockDeleteGroupCategory).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstDelete({ status: 204, data: {} });
      await flushEffects();
    });

    expect(mockDeleteGroupCategory).toHaveBeenCalledTimes(1);
  });
});
