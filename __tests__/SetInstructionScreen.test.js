const mockHideDescription = jest.fn(() => null);
const mockCenteredModal = jest.fn(() => null);
const mockModalContent = jest.fn(() => null);
const mockTutorialOverlay = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);
const mockDeleteLocalImage = jest.fn();

const mockRequestPermission = jest.fn();
const mockUsePermissions = jest.fn();
const mockOpenSettings = jest.fn();
const mockUseGroupsHub = jest.fn();

jest.mock('expo-file-system', () => {
  const File = jest.fn().mockImplementation(function MockFile(uri) {
    this.uri = uri;
    this.delete = mockDeleteLocalImage;
  });

  return { File };
});

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: 'Ionicons',
  default: 'Ionicons',
}), { virtual: true });

jest.mock('expo-media-library', () => ({
  usePermissions: () => mockUsePermissions(),
}), { virtual: true });

jest.mock('expo-linking', () => ({
  openSettings: () => mockOpenSettings(),
}), { virtual: true });

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

jest.mock('../components/Picture/Descriptions/HideDescription', () => {
  return function MockHideDescription(props) {
    mockHideDescription(props);
    return null;
  };
});

jest.mock('../components/UI/CenteredModal', () => {
  return function MockCenteredModal(props) {
    mockCenteredModal(props);
    return null;
  };
});

jest.mock('../components/UI/ModalContent', () => {
  return function MockModalContent(props) {
    mockModalContent(props);
    return null;
  };
});

jest.mock('../components/UI/TutorialOverlay', () => {
  return function MockTutorialOverlay(props) {
    mockTutorialOverlay(props);
    return null;
  };
});

jest.mock('../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../components/UI/LanguageSelector', () => {
  return function MockLanguageSelector(props) {
    return null;
  };
});

jest.mock('../components/UI/CategoryChips', () => {
  return function MockCategoryChips(props) {
    return null;
  };
});

jest.mock('../utils/fileUploader', () => {
  const actual = jest.requireActual('../utils/fileUploader');

  return {
    ...actual,
    imageUploader: jest.fn(actual.imageUploader),
  };
});

jest.mock('../utils/e2eMode', () => ({
  buildE2EHiddenGuessPayload: jest.fn((payload) => payload),
  isE2EMode: jest.fn(),
}));

jest.mock('../utils/orientation', () => ({
  handleOrientation: jest.fn(),
}));

jest.mock('../utils/imageInfos', () => ({
  handleContentLength: jest.fn(),
  handleImageType: jest.fn(),
  isTypeValid: jest.fn(),
}));

jest.mock('../utils/imagesRequests', () => ({
  prepareImageUpload: jest.fn(),
  performImageUpload: jest.fn(),
  saveImageInfos: jest.fn(),
}));

jest.mock('../utils/auth', () => ({
  checkSecureStoreItem: jest.fn(),
}));

jest.mock('../utils/storageDatum', () => ({
  getPreferredLanguage: jest.fn(),
  saveE2EHiddenGuessCard: jest.fn(),
}));

jest.mock('../utils/categoryRequests', () => ({
  getCategories: jest.fn(),
}));

jest.mock('../services/groups/groupCategoriesStore', () => ({
  loadGroupCategoriesOptimistic: jest.fn(),
}));

jest.mock('../hooks/useGroupsHub', () => ({
  useGroupsHub: (...args) => mockUseGroupsHub(...args),
}));

jest.mock('../utils/languageDefaults', () => ({
  resolveDefaultLanguage: jest.fn(),
}));

import React from 'react';
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';

import SetInstructionsScreen from '../screens/SetInstructionScreen';
import { AuthContext } from '../store/auth-context';
import { checkSecureStoreItem } from '../utils/auth';
import { getCategories } from '../utils/categoryRequests';
import { getDefaultCategories } from '../constants/defaultCategories';
import { buildE2EHiddenGuessPayload, isE2EMode } from '../utils/e2eMode';
import { imageUploader } from '../utils/fileUploader';
import { handleContentLength, handleImageType, isTypeValid } from '../utils/imageInfos';
import { performImageUpload, prepareImageUpload, saveImageInfos } from '../utils/imagesRequests';
import { resolveDefaultLanguage } from '../utils/languageDefaults';
import { handleOrientation } from '../utils/orientation';
import { getPreferredLanguage, saveE2EHiddenGuessCard } from '../utils/storageDatum';
import { loadGroupCategoriesOptimistic } from '../services/groups/groupCategoriesStore';

describe('SetInstructionScreen', () => {
  const navigation = {
    replace: jest.fn(),
    reset: jest.fn(),
  };
  const route = {
    params: {
      uri: 'file:///waldo.png',
      imageWidth: 1024,
      imageHeight: 768,
      screenHeight: 640,
      screenWidth: 320,
      isPortrait: true,
      touchLocation: { x: 0.3, y: 0.7 },
      target: { targetSize: 18, targetStyle: { top: 10, left: 10 } },
      imageDimensionStyle: { width: 200, height: 300 },
      isTutorial: false,
    },
  };
  const contextValue = {
    isTutorialFinished: {
      guessPathDone: false,
      hidePathDone: false,
    },
    updateTutorialStatus: jest.fn().mockResolvedValue(undefined),
  };
  const categoriesFixture = [
    { id: 'cat-1', key: 'all', name: 'Recent/All' },
    { id: 'cat-2', key: 'nature', name: 'Nature' },
    { id: 'cat-3', key: 'city', name: 'City' },
  ];
  const privateScope = { kind: 'private', groupId: 'group-7' };
  const privateCategoriesFixture = [
    { id: 'grp-cat-1', key: 'nature', name: 'Nature', thumbnailUrl: 'https://example.com/nature.webp' },
    { id: 'grp-cat-2', key: 'city', name: 'City', thumbnailUrl: 'https://example.com/city.webp' },
  ];

  function emitCategoriesViaStore(list) {
    loadGroupCategoriesOptimistic.mockImplementation(async ({ onCategories }) => {
      if (typeof onCategories === 'function') {
        onCategories(list);
      }
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockDeleteLocalImage.mockClear();
    isE2EMode.mockReturnValue(false);
    mockUsePermissions.mockReturnValue([
      {
        status: 'granted',
        canAskAgain: true,
      },
      mockRequestPermission,
    ]);
    mockUseGroupsHub.mockReturnValue({ data: null, refresh: jest.fn() });
    checkSecureStoreItem.mockResolvedValue('user-42');
    handleContentLength.mockResolvedValue(4096);
    handleImageType.mockReturnValue('png');
    isTypeValid.mockReturnValue(true);
    prepareImageUpload.mockResolvedValue({
      status: 200,
      data: {
        provider: 'local_disk',
        method: 'PUT',
        url: 'https://example.com/upload',
        headers: {},
        image_key: 'waldo-image',
      },
    });
    performImageUpload.mockResolvedValue({ status: 200 });
    saveImageInfos.mockResolvedValue({ status: 200 });
    imageUploader.mockResolvedValue({ status: 200 });
    getPreferredLanguage.mockResolvedValue('en');
    getCategories.mockResolvedValue({ data: categoriesFixture });
    resolveDefaultLanguage.mockReturnValue('en');
    loadGroupCategoriesOptimistic.mockResolvedValue(undefined);
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  function createDeferred() {
    let resolve;
    const promise = new Promise((promiseResolve) => {
      resolve = promiseResolve;
    });

    return { promise, resolve };
  }

  async function renderScreen(routeOverrides = {}, contextOverrides = {}) {
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ ...contextValue, ...contextOverrides }}>
          <SetInstructionsScreen
            navigation={navigation}
            route={{
              ...route,
              ...routeOverrides,
              params: {
                ...route.params,
                ...(routeOverrides.params || {}),
              },
            }}
          />
        </AuthContext.Provider>
      );

      await flushEffects();
    });

    return renderer;
  }

  function getModalProps() {
    return mockCenteredModal.mock.calls[mockCenteredModal.mock.calls.length - 1][0];
  }

  function getHideDescriptionProps() {
    return mockHideDescription.mock.calls[mockHideDescription.mock.calls.length - 1][0];
  }

  it('rejects invalid file types before trying the upload pipeline', async () => {
    handleImageType.mockReturnValue('gif');
    isTypeValid.mockReturnValue(false);

    await renderScreen();

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onSubmit('Look near the river');
    });

    await act(async () => {
      await getModalProps().onPress();
      await flushEffects();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Invalid image type',
      'Please select a valid image type (png, jpg or jpeg)'
    );
    expect(imageUploader).not.toHaveBeenCalled();
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('opens the app settings when media-library permission can no longer be requested', async () => {
    mockUsePermissions.mockReturnValue([
      {
        status: 'denied',
        canAskAgain: false,
      },
      mockRequestPermission,
    ]);

    await renderScreen();

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onSubmit('Look near the river');
    });

    await act(async () => {
      await getModalProps().onPress();
      await flushEffects();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Insufficient Permissions',
      'Access to  Photos and Videos is denied'
    );
    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
    expect(imageUploader).not.toHaveBeenCalled();
  });

  it('continues upload after requesting media-library permission from the undetermined state', async () => {
    mockUsePermissions.mockReturnValue([
      {
        status: 'undetermined',
        canAskAgain: true,
      },
      mockRequestPermission.mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
      }),
    ]);

    await renderScreen();

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onSubmit('Look near the river');
    });

    await act(async () => {
      await getModalProps().onPress();
      await flushEffects();
    });

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(imageUploader).toHaveBeenCalledWith({
      imageInfos: expect.objectContaining({
        language: 'en',
      }),
      context: expect.any(Object),
    });
    expect(navigation.reset).toHaveBeenCalled();
  });

  it('uploads the image, updates the tutorial state, and resets back to the home screen', async () => {
    const tutorialContext = {
      isTutorialFinished: {
        guessPathDone: false,
        hidePathDone: false,
      },
      updateTutorialStatus: jest.fn().mockResolvedValue(undefined),
    };

    await renderScreen(
      {
        params: {
          isTutorial: true,
        },
      },
      tutorialContext
    );

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onSubmit('Look near the river');
    });

    await act(async () => {
      await getModalProps().onPress();
      await flushEffects();
    });

    expect(checkSecureStoreItem).toHaveBeenCalledWith({
      secureStoreValue: 'userId',
      context: expect.objectContaining(tutorialContext),
    });
    expect(imageUploader).toHaveBeenCalledWith({
      imageInfos: {
        uri: 'file:///waldo.png',
        userId: 'user-42',
        fileExtension: 'png',
        imageHeight: 768,
        imageWidth: 1024,
        screenHeight: 640,
        screenWidth: 320,
        description: 'Look near the river',
        isPortrait: true,
        xLocation: 0.3,
        yLocation: 0.7,
        language: 'en',
        categoryKey: null,
      },
      context: expect.objectContaining(tutorialContext),
    });
    expect(handleOrientation).toHaveBeenCalledWith('portrait');
    expect(tutorialContext.updateTutorialStatus).toHaveBeenCalledWith({
      isTutorial: true,
      guessPathDone: false,
      hidePathDone: true,
    });
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [
        {
          name: 'HomeScreen',
          params: {
            isTutorial: true,
            hidePathDone: true,
          },
        },
      ],
    });
  });

  it('does not reset navigation after an upload failure', async () => {
    imageUploader.mockResolvedValue({
      status: 500,
      title: 'Internal server error',
      message: 'Upload failed',
    });

    await renderScreen();

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onSubmit('Look near the river');
    });

    await act(async () => {
      await getModalProps().onPress();
      await flushEffects();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Uploading error: Internal server error',
      'Upload failed\nPlease try again later'
    );
    expect(handleOrientation).not.toHaveBeenCalled();
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('stops loading and alerts when the upload helper throws', async () => {
    imageUploader.mockRejectedValue(new Error('Upload exploded'));

    await renderScreen();

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onSubmit('Look near the river');
    });

    await act(async () => {
      await getModalProps().onPress();
      await flushEffects();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Uploading error',
      'Upload exploded\nPlease try again later'
    );
    expect(handleOrientation).not.toHaveBeenCalled();
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('ignores repeated confirms while an upload is already in flight', async () => {
    let resolveUpload;

    imageUploader.mockImplementation(
      () => new Promise((resolve) => {
        resolveUpload = resolve;
      })
    );

    await renderScreen();

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onSubmit('Look near the river');
    });

    const onConfirm = getModalProps().onPress;

    await act(async () => {
      const firstSubmission = onConfirm();
      const secondSubmission = onConfirm();

      await flushEffects();

      resolveUpload({ status: 200 });

      await firstSubmission;
      await secondSubmission;
      await flushEffects();
    });

    expect(imageUploader).toHaveBeenCalledTimes(1);
  });

  it('stores the saved hide payload in e2e mode after a successful upload', async () => {
    isE2EMode.mockReturnValue(true);
    handleImageType.mockReturnValue('gif');
    isTypeValid.mockReturnValue(false);

    await renderScreen();

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onSubmit('Look near the river');
    });

    await act(async () => {
      await getModalProps().onPress();
      await flushEffects();
    });

    expect(buildE2EHiddenGuessPayload).toHaveBeenCalledWith({
      uri: 'file:///waldo.png',
      description: 'Look near the river',
      imageHeight: 768,
      imageWidth: 1024,
      isPortrait: true,
      hiddenLocation: { x: 0.3, y: 0.7 },
      screenHeight: 640,
      screenWidth: 320,
    });
    expect(saveE2EHiddenGuessCard).toHaveBeenCalledWith(expect.objectContaining({
      uri: 'file:///waldo.png',
      hiddenLocation: { x: 0.3, y: 0.7 },
    }));
    expect(handleImageType).not.toHaveBeenCalled();
    expect(isTypeValid).not.toHaveBeenCalled();
    expect(imageUploader).not.toHaveBeenCalled();
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [
        {
          name: 'HomeScreen',
          params: {
            isTutorial: false,
            hidePathDone: true,
          },
        },
      ],
    });
  });

  it('defaults the language selector to the stored preferred language when present', async () => {
    getPreferredLanguage.mockResolvedValue('fr');
    resolveDefaultLanguage.mockReturnValue('en');

    await renderScreen();

    expect(getPreferredLanguage).toHaveBeenCalled();
    expect(getHideDescriptionProps().language).toBe('fr');
    expect(resolveDefaultLanguage).not.toHaveBeenCalled();
  });

  it('falls back to resolveDefaultLanguage when no preferred language is stored', async () => {
    getPreferredLanguage.mockResolvedValue(null);
    resolveDefaultLanguage.mockReturnValue('de');

    await renderScreen();

    expect(getPreferredLanguage).toHaveBeenCalled();
    expect(resolveDefaultLanguage).toHaveBeenCalled();
    expect(getHideDescriptionProps().language).toBe('de');
  });

  it('renders the bundled default categories without any category network fetch', async () => {
    await renderScreen();

    expect(getCategories).not.toHaveBeenCalled();
    expect(loadGroupCategoriesOptimistic).not.toHaveBeenCalled();
    expect(getHideDescriptionProps().categories).toEqual(getDefaultCategories().data);
    expect(getHideDescriptionProps().categories.map((category) => category.key)).toEqual([
      'other',
      'nature',
      'city',
      'abstract',
      'animals',
      'food',
      'vehicles',
      'interiors',
      'landmarks',
    ]);
    expect(getHideDescriptionProps().categoriesError).toBeNull();
  });

  it('loads private group categories optimistically through the store', async () => {
    emitCategoriesViaStore(privateCategoriesFixture);

    await renderScreen({ params: { scope: privateScope } });

    expect(loadGroupCategoriesOptimistic).toHaveBeenCalledWith({
      context: expect.any(Object),
      groupId: 'group-7',
      onCategories: expect.any(Function),
    });
    expect(getCategories).not.toHaveBeenCalled();
    expect(getHideDescriptionProps().categories).toEqual(privateCategoriesFixture);
    expect(getHideDescriptionProps().categoriesError).toBeNull();
  });

  it('refreshes private group categories through the retry handler', async () => {
    emitCategoriesViaStore(privateCategoriesFixture);

    await renderScreen({ params: { scope: privateScope } });

    emitCategoriesViaStore([privateCategoriesFixture[0]]);

    await act(async () => {
      await getHideDescriptionProps().onRetryCategories();
      await flushEffects();
    });

    expect(loadGroupCategoriesOptimistic).toHaveBeenCalledTimes(2);
    expect(getHideDescriptionProps().categories).toEqual([privateCategoriesFixture[0]]);
    expect(getHideDescriptionProps().categoriesError).toBeNull();
  });

  it('updates the selected category when a chip is pressed', async () => {
    await renderScreen();

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onCategorySelect('nature');
    });

    expect(getHideDescriptionProps().selectedCategory).toBe('nature');

    await act(async () => {
      getHideDescriptionProps().onCategorySelect('nature');
    });

    expect(getHideDescriptionProps().selectedCategory).toBeNull();
  });

  it('falls back to en when no preferred language or locale heuristic is available', async () => {
    getPreferredLanguage.mockResolvedValue(null);
    resolveDefaultLanguage.mockReturnValue('');

    await renderScreen();

    expect(getHideDescriptionProps().language).toBe('en');
  });

  it('blocks submission with an inline error and skips the uploader when language hydration has not finished yet', async () => {
    const preferredLanguageDeferred = createDeferred();

    getPreferredLanguage.mockReturnValue(preferredLanguageDeferred.promise);

    await renderScreen();

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onSubmit('Look near the river');
    });

    await act(async () => {
      await getModalProps().onPress();
      await flushEffects();
    });

    expect(getHideDescriptionProps().languageError).toBe(true);
    expect(imageUploader).not.toHaveBeenCalled();
    expect(handleImageType).not.toHaveBeenCalled();
    expect(navigation.reset).not.toHaveBeenCalled();

    await act(async () => {
      preferredLanguageDeferred.resolve(null);
      await flushEffects();
    });
  });

  it('does not overwrite an explicit language selection when async hydration resolves late', async () => {
    const preferredLanguageDeferred = createDeferred();

    getPreferredLanguage.mockReturnValue(preferredLanguageDeferred.promise);

    await renderScreen();

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onLanguageChange('fr');
    });

    await act(async () => {
      preferredLanguageDeferred.resolve('de');
      await flushEffects();
    });

    expect(getHideDescriptionProps().language).toBe('fr');
  });

  it('sends the selected category key in the public upload payload when a chip is selected', async () => {
    await renderScreen();

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onCategorySelect('nature');
    });

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onLanguageChange('fr');
    });

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onSubmit('Look near the river');
    });

    await act(async () => {
      await getModalProps().onPress();
      await flushEffects();
    });

    expect(imageUploader).toHaveBeenCalledWith({
      imageInfos: expect.objectContaining({
        language: 'fr',
        categoryKey: 'nature',
      }),
      context: expect.any(Object),
    });

    const [{ imageInfos }] = imageUploader.mock.calls[0];
    expect(imageInfos).not.toHaveProperty('categoryId');
    expect(imageInfos.scope).toBeUndefined();
  });

  it('sends the resolved category id in the private upload payload when a chip is selected', async () => {
    emitCategoriesViaStore(privateCategoriesFixture);

    await renderScreen({ params: { scope: privateScope } });

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onCategorySelect('nature');
    });

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onLanguageChange('fr');
    });

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onSubmit('Look near the river');
    });

    await act(async () => {
      await getModalProps().onPress();
      await flushEffects();
    });

    expect(imageUploader).toHaveBeenCalledWith({
      imageInfos: expect.objectContaining({
        language: 'fr',
        categoryId: 'grp-cat-1',
      }),
      context: expect.any(Object),
      scope: privateScope,
    });

    const [{ imageInfos }] = imageUploader.mock.calls[0];
    expect(imageInfos).not.toHaveProperty('categoryKey');
  });

  it('treats forced pseudo-category selections as unset and omits the category from uploads', async () => {
    await renderScreen();

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onCategorySelect('all');
    });

    expect(getHideDescriptionProps().selectedCategory).toBeNull();

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onLanguageChange('fr');
    });

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onSubmit('Look near the river');
    });

    await act(async () => {
      await getModalProps().onPress();
      await flushEffects();
    });

    expect(imageUploader).toHaveBeenCalledWith({
      imageInfos: expect.objectContaining({
        language: 'fr',
        categoryKey: null,
      }),
      context: expect.any(Object),
    });
  });

  it('persists snake_case upload keys through saveImageInfos', async () => {
    const actualImageUploader = jest.requireActual('../utils/fileUploader').imageUploader;
    imageUploader.mockImplementation(actualImageUploader);

    await renderScreen();

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onCategorySelect('nature');
    });

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onLanguageChange('fr');
    });

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onSubmit('Look near the river');
    });

    await act(async () => {
      await getModalProps().onPress();
      await flushEffects();
    });

    expect(saveImageInfos).toHaveBeenCalledTimes(1);

    const [{ imagesInfos }] = saveImageInfos.mock.calls[0];

    expect(imagesInfos).toEqual(expect.objectContaining({
      language: 'fr',
      category_key: 'nature',
    }));
    expect(imagesInfos).not.toHaveProperty('categoryId');
    expect(imagesInfos).not.toHaveProperty('categoryKey');
  });

  it('lets e2e mode bypass the language requirement while still rendering the selectors', async () => {
    isE2EMode.mockReturnValue(true);
    getPreferredLanguage.mockResolvedValue(null);
    resolveDefaultLanguage.mockReturnValue('');

    await renderScreen();

    const hideDescriptionProps = getHideDescriptionProps();
    expect(hideDescriptionProps.language).toBe('en');
    expect(hideDescriptionProps.categories).toEqual([
      { id: 'cat-2', key: 'nature', name: 'Nature' },
      { id: 'cat-3', key: 'city', name: 'City' },
    ]);
    expect(typeof hideDescriptionProps.onLanguageChange).toBe('function');
    expect(typeof hideDescriptionProps.onCategorySelect).toBe('function');

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onSubmit('Look near the river');
    });

    await act(async () => {
      await getModalProps().onPress();
      await flushEffects();
    });

    expect(buildE2EHiddenGuessPayload).toHaveBeenCalled();
    expect(saveE2EHiddenGuessCard).toHaveBeenCalled();
    expect(imageUploader).not.toHaveBeenCalled();
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [
        {
          name: 'HomeScreen',
          params: {
            isTutorial: false,
            hidePathDone: true,
          },
        },
      ],
    });
  });
});