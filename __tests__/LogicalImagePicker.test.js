const mockShowImagePicker = jest.fn(() => null);
const mockLaunchCameraAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
const mockUseCameraPermissions = jest.fn();

jest.mock('../components/Picture/ShowImagePicker', () => {
  return function MockShowImagePicker(props) {
    mockShowImagePicker(props);
    return null;
  };
});

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: (...args) => mockLaunchCameraAsync(...args),
  launchImageLibraryAsync: (...args) => mockLaunchImageLibraryAsync(...args),
  useCameraPermissions: () => mockUseCameraPermissions(),
  PermissionStatus: {
    UNDETERMINED: 'undetermined',
    DENIED: 'denied',
  },
}));

jest.mock('../utils/e2eMode', () => ({
  buildE2EHideRouteParams: jest.fn(),
  isE2EMode: jest.fn(() => false),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import LogicalImagePicker from '../components/Picture/LogicalImagePicker';

describe('LogicalImagePicker', () => {
  const navigation = {
    navigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCameraPermissions.mockReturnValue([
      {
        status: 'granted',
        granted: true,
      },
      jest.fn(),
    ]);
  });

  function renderComponent() {
    act(() => {
      create(<LogicalImagePicker navigation={navigation} isTutorial={false} />);
    });
  }

  it('launches the library picker without cropping and navigates to HideScreen', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///picked-image.jpg',
          width: 1200,
          height: 800,
        },
      ],
    });

    renderComponent();

    await act(async () => {
      await mockShowImagePicker.mock.calls[0][0].pickImage();
    });

    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledWith({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 0.5,
    });
    expect(navigation.navigate).toHaveBeenCalledWith(
      'HideScreen',
      expect.objectContaining({
        uri: 'file:///picked-image.jpg',
        imageWidth: 1200,
        imageHeight: 800,
        isPortrait: false,
      })
    );
  });

  it('launches the camera without cropping and navigates to HideScreen', async () => {
    mockLaunchCameraAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///camera-image.jpg',
          width: 900,
          height: 1600,
        },
      ],
    });

    renderComponent();

    await act(async () => {
      await mockShowImagePicker.mock.calls[0][0].takePictureHandler();
    });

    expect(mockLaunchCameraAsync).toHaveBeenCalledWith({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 0.5,
    });
    expect(navigation.navigate).toHaveBeenCalledWith(
      'HideScreen',
      expect.objectContaining({
        uri: 'file:///camera-image.jpg',
        imageWidth: 900,
        imageHeight: 1600,
        isPortrait: true,
      })
    );
  });
});