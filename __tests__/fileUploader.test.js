jest.mock('expo-file-system', () => ({
  deleteAsync: jest.fn(),
}));

jest.mock('../utils/imageInfos', () => ({
  handleContentLength: jest.fn(),
}));

jest.mock('../utils/imagesRequests', () => ({
  getUploadUrl: jest.fn(),
  saveImageInfos: jest.fn(),
  saveImageToAws: jest.fn(),
}));

jest.mock('../utils/auth', () => ({
  checkSecureStoreItem: jest.fn(),
}));

import * as FileSystem from 'expo-file-system';

import { imageUploader } from '../utils/fileUploader';
import { checkSecureStoreItem } from '../utils/auth';
import { handleContentLength } from '../utils/imageInfos';
import { getUploadUrl, saveImageInfos, saveImageToAws } from '../utils/imagesRequests';

describe('imageUploader', () => {
  const context = {
    token: 'token',
    uid: 'waldo@example.com',
    expiry: '123',
    access_token: 'access-token',
    client: 'client-id',
  };
  const imageInfos = {
    uri: 'file:///waldo.png',
    fileExtension: 'png',
    imageHeight: 768,
    imageWidth: 1024,
    screenHeight: 640,
    screenWidth: 320,
    description: 'Near the bridge',
    isPortrait: true,
    xLocation: 0.4,
    yLocation: 0.6,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    handleContentLength.mockResolvedValue(4096);
    checkSecureStoreItem.mockResolvedValue('user-42');
  });

  it('returns the presign failure without attempting the upload pipeline', async () => {
    getUploadUrl.mockResolvedValue({
      status: 500,
      title: 'Internal server error',
      message: 'Presign failed',
    });

    const result = await imageUploader({ imageInfos, context });

    expect(result).toEqual({
      status: 500,
      title: 'Internal server error',
      message: 'Presign failed',
    });
    expect(saveImageToAws).not.toHaveBeenCalled();
    expect(saveImageInfos).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('returns the AWS upload failure and skips metadata persistence', async () => {
    getUploadUrl.mockResolvedValue({
      status: 200,
      data: {
        url: 'https://example.com/upload',
        filename: 'waldo-image',
      },
    });
    saveImageToAws.mockResolvedValue({
      status: 422,
      title: 'Something went wrong, please try again later',
      message: 'Upload failed',
    });

    const result = await imageUploader({ imageInfos, context });

    expect(saveImageToAws).toHaveBeenCalledWith({
      url: 'https://example.com/upload',
      filename: 'waldo-image',
      fileUrl: 'file:///waldo.png',
      fileExtension: 'png',
      contentLength: 4096,
      userId: 'user-42',
    });
    expect(result).toEqual({
      status: 422,
      title: 'Something went wrong, please try again later',
      message: 'Upload failed',
    });
    expect(saveImageInfos).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('persists the uploaded metadata and deletes the local file after a successful upload', async () => {
    getUploadUrl.mockResolvedValue({
      status: 200,
      data: {
        url: 'https://example.com/upload',
        filename: 'waldo-image',
      },
    });
    saveImageToAws.mockResolvedValue({ status: 200 });
    saveImageInfos.mockResolvedValue({ status: 200 });

    const result = await imageUploader({ imageInfos, context });

    expect(saveImageInfos).toHaveBeenCalledWith({
      userId: 'user-42',
      imagesInfos: {
        user_id: 'user-42',
        name: 'waldo-image',
        file_extension: 'png',
        image_height: 768,
        image_width: 1024,
        screen_height: 640,
        screen_width: 320,
        description: 'Near the bridge',
        is_portrait: true,
        x_location: 0.4,
        y_location: 0.6,
        storage_url: '',
      },
      token: 'token',
      uid: 'waldo@example.com',
      expiry: '123',
      access_token: 'access-token',
      client: 'client-id',
    });
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///waldo.png');
    expect(result).toEqual({ status: 200 });
  });

  it('returns the metadata persistence failure and keeps the local file intact', async () => {
    getUploadUrl.mockResolvedValue({
      status: 200,
      data: {
        url: 'https://example.com/upload',
        filename: 'waldo-image',
      },
    });
    saveImageToAws.mockResolvedValue({ status: 200 });
    saveImageInfos.mockResolvedValue({
      status: 409,
      title: 'Something went wrong, please try again later',
      message: 'Metadata save failed',
    });

    const result = await imageUploader({ imageInfos, context });

    expect(result).toEqual({
      status: 409,
      title: 'Something went wrong, please try again later',
      message: 'Metadata save failed',
    });
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });
});