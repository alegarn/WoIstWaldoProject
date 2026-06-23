const mockHideDescription = jest.fn(() => null);
const mockCenteredModal = jest.fn(() => null);
const mockModalContent = jest.fn(() => null);
const mockTutorialOverlay = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);
const mockLanguageSelector = jest.fn(() => null);
const mockCategoryChips = jest.fn(() => null);
const mockDeleteLocalImage = jest.fn();

const mockRequestPermission = jest.fn();
const mockUsePermissions = jest.fn();
const mockOpenSettings = jest.fn();

jest.mock('expo-file-system', () => {
  const File = jest.fn().mockImplementation(function MockFile(uri) {
    this.uri = uri;
    this.delete = mockDeleteLocalImage;
  });

  return { File };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
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
    mockLanguageSelector(props);
    return null;
  };
});

jest.mock('../components/UI/CategoryChips', () => {
  return function MockCategoryChips(props) {
    mockCategoryChips(props);
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
import { buildE2EHiddenGuessPayload, isE2EMode } from '../utils/e2eMode';
import { imageUploader } from '../utils/fileUploader';
import { handleContentLength, handleImageType, isTypeValid } from '../utils/imageInfos';
import { performImageUpload, prepareImageUpload, saveImageInfos } from '../utils/imagesRequests';
import { resolveDefaultLanguage } from '../utils/languageDefaults';
import { handleOrientation } from '../utils/orientation';
import { getPreferredLanguage, saveE2EHiddenGuessCard } from '../utils/storageDatum';

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
      'Access to  Photos and Videos / audio is denied'
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
        categoryId: null,
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

    const lastCall = mockLanguageSelector.mock.calls[mockLanguageSelector.mock.calls.length - 1][0];
    expect(getPreferredLanguage).toHaveBeenCalled();
    expect(mockLanguageSelector).toHaveBeenCalled();
    expect(lastCall.value).toBe('fr');
    expect(resolveDefaultLanguage).not.toHaveBeenCalled();
  });

  it('falls back to resolveDefaultLanguage when no preferred language is stored', async () => {
    getPreferredLanguage.mockResolvedValue(null);
    resolveDefaultLanguage.mockReturnValue('de');

    await renderScreen();

    const lastCall = mockLanguageSelector.mock.calls[mockLanguageSelector.mock.calls.length - 1][0];
    expect(getPreferredLanguage).toHaveBeenCalled();
    expect(resolveDefaultLanguage).toHaveBeenCalled();
    expect(lastCall.value).toBe('de');
  });

  it('renders every category returned by getCategories through CategoryChips', async () => {
    await renderScreen();

    const lastCall = mockCategoryChips.mock.calls[mockCategoryChips.mock.calls.length - 1][0];
    expect(getCategories).toHaveBeenCalledWith({ context: expect.any(Object) });
    expect(mockCategoryChips).toHaveBeenCalled();
    expect(lastCall.categories).toEqual([
      { id: 'cat-2', key: 'nature', name: 'Nature' },
      { id: 'cat-3', key: 'city', name: 'City' },
    ]);
  });

  it('updates the selected category when a chip is pressed', async () => {
    await renderScreen();

    await act(async () => {
      mockCategoryChips.mock.calls[0][0].onSelect('nature');
    });

    expect(mockCategoryChips.mock.calls[mockCategoryChips.mock.calls.length - 1][0].selected).toBe('nature');

    await act(async () => {
      mockCategoryChips.mock.calls[mockCategoryChips.mock.calls.length - 1][0].onSelect('nature');
    });

    expect(mockCategoryChips.mock.calls[mockCategoryChips.mock.calls.length - 1][0].selected).toBeNull();
  });

  it('falls back to en when no preferred language or locale heuristic is available', async () => {
    getPreferredLanguage.mockResolvedValue(null);
    resolveDefaultLanguage.mockReturnValue('');

    await renderScreen();

    const lastCall = mockLanguageSelector.mock.calls[mockLanguageSelector.mock.calls.length - 1][0];
    expect(lastCall.value).toBe('en');
  });

  it('blocks submission with an inline error and skips the uploader when language hydration has not finished yet', async () => {
    const preferredLanguageDeferred = createDeferred();

    getPreferredLanguage.mockReturnValue(preferredLanguageDeferred.promise);

    const renderer = await renderScreen();

    await act(async () => {
      mockHideDescription.mock.calls[0][0].onSubmit('Look near the river');
    });

    await act(async () => {
      await getModalProps().onPress();
      await flushEffects();
    });

    expect(renderer.root.findByProps({ testID: 'set-instructions.language.error' })).toBeTruthy();
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
      mockLanguageSelector.mock.calls[mockLanguageSelector.mock.calls.length - 1][0].onChange('fr');
    });

    await act(async () => {
      preferredLanguageDeferred.resolve('de');
      await flushEffects();
    });

    const lastCall = mockLanguageSelector.mock.calls[mockLanguageSelector.mock.calls.length - 1][0];
    expect(lastCall.value).toBe('fr');
  });

  it('includes the resolved category_id in the upload payload when a chip is selected', async () => {
    await renderScreen();

    await act(async () => {
      mockCategoryChips.mock.calls[0][0].onSelect('nature');
    });

    await act(async () => {
      mockLanguageSelector.mock.calls[0][0].onChange('fr');
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
        categoryId: 'cat-2',
      }),
      context: expect.any(Object),
    });
  });

  it('treats forced pseudo-category selections as unset and omits category_id from uploads', async () => {
    await renderScreen();

    await act(async () => {
      mockCategoryChips.mock.calls[0][0].onSelect('all');
    });

    expect(mockCategoryChips.mock.calls[mockCategoryChips.mock.calls.length - 1][0].selected).toBeNull();

    await act(async () => {
      mockLanguageSelector.mock.calls[0][0].onChange('fr');
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
        categoryId: null,
      }),
      context: expect.any(Object),
    });
  });

  it('persists snake_case upload keys through saveImageInfos', async () => {
    const actualImageUploader = jest.requireActual('../utils/fileUploader').imageUploader;
    imageUploader.mockImplementation(actualImageUploader);

    await renderScreen();

    await act(async () => {
      mockCategoryChips.mock.calls[0][0].onSelect('nature');
    });

    await act(async () => {
      mockLanguageSelector.mock.calls[0][0].onChange('fr');
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
      category_id: 'cat-2',
    }));
    expect(imagesInfos).not.toHaveProperty('categoryId');
  });

  it('lets e2e mode bypass the language requirement while still rendering the selectors', async () => {
    isE2EMode.mockReturnValue(true);
    getPreferredLanguage.mockResolvedValue(null);
    resolveDefaultLanguage.mockReturnValue('');

    await renderScreen();

    expect(mockLanguageSelector).toHaveBeenCalled();
    expect(mockCategoryChips).toHaveBeenCalled();

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