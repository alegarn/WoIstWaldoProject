const mockDelete = jest.fn();

jest.mock('expo-file-system', () => {
  const File = jest.fn().mockImplementation(function MockFile(uri) {
    this.uri = uri;
    this.delete = mockDelete;
  });

  return { File };
});

jest.mock('../utils/imageInfos', () => ({
  handleContentLength: jest.fn(),
}));

jest.mock('../utils/imagesRequests', () => ({
  prepareImageUpload: jest.fn(),
  saveImageInfos: jest.fn(),
  performImageUpload: jest.fn(),
}));

jest.mock('../utils/auth', () => ({
  checkSecureStoreItem: jest.fn(),
}));

import { imageUploader } from '../utils/fileUploader';
import { File } from 'expo-file-system';
import { checkSecureStoreItem } from '../utils/auth';
import { handleContentLength } from '../utils/imageInfos';
import { performImageUpload, prepareImageUpload, saveImageInfos } from '../utils/imagesRequests';

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
    mockDelete.mockClear();
    handleContentLength.mockResolvedValue(4096);
    checkSecureStoreItem.mockResolvedValue('user-42');
  });

  it('returns the presign failure without attempting the upload pipeline', async () => {
    prepareImageUpload.mockResolvedValue({
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
    expect(performImageUpload).not.toHaveBeenCalled();
    expect(saveImageInfos).not.toHaveBeenCalled();
    expect(File).not.toHaveBeenCalled();
  });

  it('returns the upload failure and skips metadata persistence', async () => {
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
    performImageUpload.mockResolvedValue({
      status: 422,
      title: 'Something went wrong, please try again later',
      message: 'Upload failed',
    });

    const result = await imageUploader({ imageInfos, context });

    expect(performImageUpload).toHaveBeenCalledWith({
      plan: {
        provider: 'local_disk',
        method: 'PUT',
        url: 'https://example.com/upload',
        headers: {},
        image_key: 'waldo-image',
      },
      fileUrl: 'file:///waldo.png',
      fileExtension: 'png',
      contentLength: 4096,
      context,
    });
    expect(result).toEqual({
      status: 422,
      title: 'Something went wrong, please try again later',
      message: 'Upload failed',
    });
    expect(saveImageInfos).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('persists the uploaded metadata and deletes the local file after a successful upload', async () => {
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

    const result = await imageUploader({ imageInfos, context });

    expect(saveImageInfos).toHaveBeenCalledWith({
      userId: 'user-42',
      imagesInfos: {
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
      },
      context,
    });
    expect(File).toHaveBeenCalledWith('file:///waldo.png');
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 200 });
  });

  it('returns the metadata persistence failure and keeps the local file intact', async () => {
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
    expect(mockDelete).not.toHaveBeenCalled();
  });
});