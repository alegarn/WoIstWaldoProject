const mockHideDescription = jest.fn(() => null);
const mockCenteredModal = jest.fn(() => null);
const mockModalContent = jest.fn(() => null);
const mockTutorialOverlay = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);

const mockRequestPermission = jest.fn();
const mockUsePermissions = jest.fn();
const mockOpenSettings = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-media-library', () => ({
  usePermissions: () => mockUsePermissions(),
}));

jest.mock('expo-linking', () => ({
  openSettings: () => mockOpenSettings(),
}));

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

jest.mock('../utils/fileUploader', () => ({
  imageUploader: jest.fn(),
}));

jest.mock('../utils/orientation', () => ({
  handleOrientation: jest.fn(),
}));

jest.mock('../utils/imageInfos', () => ({
  handleImageType: jest.fn(),
  isTypeValid: jest.fn(),
}));

jest.mock('../utils/auth', () => ({
  checkSecureStoreItem: jest.fn(),
}));

import React from 'react';
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';

import SetInstructionsScreen from '../screens/SetInstructionScreen';
import { AuthContext } from '../store/auth-context';
import { checkSecureStoreItem } from '../utils/auth';
import { imageUploader } from '../utils/fileUploader';
import { handleImageType, isTypeValid } from '../utils/imageInfos';
import { handleOrientation } from '../utils/orientation';

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

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockUsePermissions.mockReturnValue([
      {
        status: 'granted',
        canAskAgain: true,
      },
      mockRequestPermission,
    ]);
    checkSecureStoreItem.mockResolvedValue('user-42');
    handleImageType.mockReturnValue('png');
    isTypeValid.mockReturnValue(true);
    imageUploader.mockResolvedValue({ status: 200 });
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
  }

  async function renderScreen(routeOverrides = {}, contextOverrides = {}) {
    await act(async () => {
      create(
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
});