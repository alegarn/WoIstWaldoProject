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

jest.mock('../utils/imageProcessing', () => ({
  processPickedImage: jest.fn(),
}));

import React from 'react';
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';

import LogicalImagePicker from '../components/Picture/LogicalImagePicker';
import { processPickedImage } from '../utils/imageProcessing';

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

  it('launches the library picker without cropping and navigates to HideScreen with processed image', async () => {
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
    processPickedImage.mockResolvedValueOnce({
      tooSmall: false,
      uri: 'file:///processed.jpg',
      width: 1000,
      height: 2000,
    });

    renderComponent();

    await act(async () => {
      await mockShowImagePicker.mock.calls[0][0].pickImage();
    });

    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledWith({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 1,
    });
    expect(processPickedImage).toHaveBeenCalledWith({
      uri: 'file:///picked-image.jpg',
      width: 1200,
      height: 800,
    });
    expect(navigation.navigate).toHaveBeenCalledWith(
      'HideScreen',
      expect.objectContaining({
        uri: 'file:///processed.jpg',
        imageWidth: 1000,
        imageHeight: 2000,
        isPortrait: true,
      })
    );
  });

  it('launches the camera without cropping and navigates to HideScreen with processed image', async () => {
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
    processPickedImage.mockResolvedValueOnce({
      tooSmall: false,
      uri: 'file:///processed.jpg',
      width: 1000,
      height: 2000,
    });

    renderComponent();

    await act(async () => {
      await mockShowImagePicker.mock.calls[0][0].takePictureHandler();
    });

    expect(mockLaunchCameraAsync).toHaveBeenCalledWith({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 1,
    });
    expect(processPickedImage).toHaveBeenCalledWith({
      uri: 'file:///camera-image.jpg',
      width: 900,
      height: 1600,
    });
    expect(navigation.navigate).toHaveBeenCalledWith(
      'HideScreen',
      expect.objectContaining({
        uri: 'file:///processed.jpg',
        imageWidth: 1000,
        imageHeight: 2000,
        isPortrait: true,
      })
    );
  });

  it('alerts and does not navigate when the processed image is too small', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///picked-image.jpg',
          width: 400,
          height: 300,
        },
      ],
    });
    processPickedImage.mockResolvedValueOnce({
      tooSmall: true,
    });

    renderComponent();

    await act(async () => {
      await mockShowImagePicker.mock.calls[0][0].pickImage();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Image too small',
      'Please pick an image with at least 1200px on the longest side.'
    );
    expect(navigation.navigate).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
