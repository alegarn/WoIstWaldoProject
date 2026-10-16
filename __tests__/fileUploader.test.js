const mockDelete = jest.fn();

jest.mock('expo-file-system', () => {
  const File = jest.fn().mockImplementation(function MockFile(uri) {
    this.uri = uri;
    this.delete = mockDelete;
  });

  return { File };
});

jest.mock('axios', () => ({
  post: jest.fn(),
}));

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
  getBackendHeaders: jest.fn(),
  setHeaders: jest.fn(),
  mapRequestError: jest.fn((error) => {
    throw error;
  }),
}));

jest.mock('../services/groups/groupUploadApi', () => {
  const actual = jest.requireActual('../services/groups/groupUploadApi');

  return {
    ...actual,
    preparePrivateUpload: jest.fn(actual.preparePrivateUpload),
  };
});

import { imageUploader } from '../utils/fileUploader';
import { File } from 'expo-file-system';
import axios from 'axios';
import { checkSecureStoreItem, getBackendHeaders, setHeaders } from '../utils/auth';
import { handleContentLength } from '../utils/imageInfos';
import { performImageUpload, prepareImageUpload, saveImageInfos } from '../utils/imagesRequests';
import { preparePrivateUpload } from '../services/groups/groupUploadApi';

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

  const shapeOutline = [
    { x: 0.5, y: 0.3 },
    { x: 0.7, y: 0.5 },
    { x: 0.5, y: 0.7 },
    { x: 0.3, y: 0.5 },
    { x: 0.5, y: 0.3 },
  ];
  const privateScope = { kind: 'private', groupId: 'group-7' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDelete.mockClear();
    handleContentLength.mockResolvedValue(4096);
    checkSecureStoreItem.mockResolvedValue('user-42');
    getBackendHeaders.mockResolvedValue({ token: 'token-42' });
    setHeaders.mockReturnValue({ Authorization: 'Bearer token-42' });
    axios.post.mockResolvedValue({
      status: 201,
      data: {
        data: {
          provider: 'local_disk',
          method: 'PUT',
          url: 'https://example.com/upload',
          headers: {},
          image_key: 'waldo-image',
        },
      },
    });
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

  it('B2: public upload threads category_key from imageInfos.categoryKey (no category_id)', async () => {
    // B2: public uploads switched from category_id (server UUID) to category_key
    // (bundled string key). The imageInfos payload carries categoryKey now.
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

    await imageUploader({
      imageInfos: { ...imageInfos, categoryKey: 'nature' },
      context,
    });

    const saveCall = saveImageInfos.mock.calls[0][0].imagesInfos;
    expect(saveCall.category_key).toBe('nature');
    expect(saveCall).not.toHaveProperty('category_id');
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

  it('keeps the saveImageInfos body free of mode and shape keys when the mode is absent', async () => {
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

    await imageUploader({ imageInfos, context });

    expect(saveImageInfos).toHaveBeenCalledTimes(1);

    const imagesInfos = saveImageInfos.mock.calls[0][0].imagesInfos;
    expect(imagesInfos).not.toHaveProperty('mode');
    expect(imagesInfos).not.toHaveProperty('shape');
  });

  it('adds mode and shape to the snake_case saveImageInfos body in shape mode', async () => {
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

    await imageUploader({
      imageInfos: { ...imageInfos, mode: 'shape', shape: shapeOutline },
      context,
    });

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
        language: undefined,
        category_key: undefined,
        mode: 'shape',
        shape: shapeOutline,
      },
      context,
    });
  });

  it('forwards mode and shape to preparePrivateUpload for private uploads', async () => {
    preparePrivateUpload.mockImplementationOnce(async () => ({
      status: 201,
      data: {
        provider: 'local_disk',
        method: 'PUT',
        url: 'https://example.com/upload',
        headers: {},
        imageKey: 'waldo-image',
      },
    }));
    performImageUpload.mockResolvedValue({ status: 200 });

    const result = await imageUploader({
      imageInfos: { ...imageInfos, categoryId: 'grp-cat-1', mode: 'shape', shape: shapeOutline },
      context,
      scope: privateScope,
    });

    expect(preparePrivateUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'shape',
        shape: shapeOutline,
      })
    );
    expect(result).toEqual({ status: 200 });
  });

  it('adds mode and shape to the private presign body only when defined', async () => {
    const withShape = {
      ...imageInfos,
      categoryId: 'grp-cat-1',
      mode: 'shape',
      shape: shapeOutline,
    };

    await imageUploader({ imageInfos: withShape, context, scope: privateScope });

    expect(axios.post).toHaveBeenCalledTimes(1);

    const shapeBody = axios.post.mock.calls[0][1];
    expect(shapeBody).toEqual({
      private_image: expect.objectContaining({
        kind: 'guess',
        category_id: 'grp-cat-1',
        mode: 'shape',
        shape: shapeOutline,
      }),
    });

    await imageUploader({ imageInfos, context, scope: privateScope });

    const pointBody = axios.post.mock.calls[1][1];
    expect(pointBody).toEqual({
      private_image: expect.not.objectContaining({
        mode: expect.anything(),
        shape: expect.anything(),
      }),
    });
  });
});