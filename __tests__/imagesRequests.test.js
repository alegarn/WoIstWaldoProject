jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

jest.mock('../utils/auth', () => ({
  getBackendHeaders: jest.fn(),
  setHeaders: jest.fn(),
}));

jest.mock('../utils/storageDatum', () => ({
  saveLastImageUuid: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: {
    Base64: 'base64',
  },
  readAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));

import axios from 'axios';
import * as FileSystem from 'expo-file-system';

import { getBackendHeaders, setHeaders } from '../utils/auth';
import { getImages, performImageUpload, prepareImageUpload, saveImageInfos } from '../utils/imagesRequests';

describe('imagesRequests utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_APP_BACKEND_URL = 'https://backend.example/';
    getBackendHeaders.mockResolvedValue({
      token: 'Bearer token',
      uid: 'waldo@example.com',
      expiry: '123',
      access_token: 'access',
      client: 'client',
      userId: '42',
    });
    setHeaders.mockReturnValue({ Authorization: 'Bearer token' });
  });

  it('returns the upload plan payload for the current auth state', async () => {
    axios.get.mockResolvedValue({
      status: 200,
      message: 'ok',
      data: { provider: 'local_disk', method: 'PUT', url: 'https://backend.example/api/v1/local_image_storage/image-key', headers: {}, image_key: 'image-key' },
    });

    const response = await prepareImageUpload({ token: 'Bearer token' }, { contentType: 'image/png', contentLength: 4096 });

    expect(axios.get).toHaveBeenCalledWith(
      'https://backend.example/api/v1/aws_requests/get_secure_upload_url',
      {
        headers: { Authorization: 'Bearer token' },
        params: {
          content_type: 'image/png',
          content_length: 4096,
        },
      }
    );
    expect(response).toEqual({
      status: 200,
      title: '',
      message: 'ok',
      data: { provider: 'local_disk', method: 'PUT', url: 'https://backend.example/api/v1/local_image_storage/image-key', headers: {}, image_key: 'image-key' },
    });
  });

  it('uploads through the local provider with auth headers from the current session', async () => {
    FileSystem.readAsStringAsync.mockResolvedValueOnce('abc123');
    axios.put.mockResolvedValueOnce({ status: 200, message: 'ok' });

    const response = await performImageUpload({
      plan: {
        provider: 'local_disk',
        method: 'PUT',
        url: 'https://backend.example/api/v1/local_image_storage/image-key',
        headers: {},
        image_key: 'image-key',
      },
      fileUrl: 'file:///waldo.png',
      fileExtension: 'png',
      contentLength: 4096,
      context: { token: 'Bearer token' },
    });

    expect(axios.put).toHaveBeenCalledWith(
      'https://backend.example/api/v1/local_image_storage/image-key',
      'data:image/png;base64,abc123',
      {
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': 4096,
          Authorization: 'Bearer token',
          HTTP_AUTHORIZATION: 'Bearer token',
        },
      }
    );
    expect(response).toEqual({
      status: 200,
      title: '',
      message: 'ok',
    });
  });

  it('returns an auth error when image batch loading is rejected with 401', async () => {
    axios.get.mockRejectedValueOnce({ request: { status: 401 } });

    const response = await getImages(null, { token: 'Bearer token' });

    expect(response).toEqual({
      isError: true,
      title: 'There is an authentication error.',
      message: 'Please reconnect',
    });
  });

  it('returns an empty list without trying to download files when the backend batch is empty', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        data: [],
      },
    });

    const response = await getImages(null, { token: 'Bearer token' });

    expect(response).toEqual({ isError: false, images: [] });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('downloads backend-hosted images with auth headers', async () => {
    FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
    FileSystem.writeAsStringAsync.mockResolvedValueOnce(undefined);
    axios.get
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              name: 'img-1',
              description: 'Find Waldo',
              image_height: 100,
              image_width: 200,
              is_portrait: true,
              x_location: 0.3,
              y_location: 0.7,
              screen_height: 400,
              screen_width: 300,
              storage_url: 'https://backend.example/api/v1/local_image_storage/img-1',
            },
          ],
        },
      })
      .mockResolvedValueOnce({ data: 'data:image/png;base64,abc123' });

    const response = await getImages(null, { token: 'Bearer token' });

    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      'https://backend.example/api/v1/local_image_storage/img-1',
      {
        headers: {
          Authorization: 'Bearer token',
          HTTP_AUTHORIZATION: 'Bearer token',
        },
      }
    );
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///cache/img-1.png',
      'abc123',
      { encoding: 'base64' }
    );
    expect(response.isError).toBe(false);
  });

  it('posts image metadata with backend headers and maps request failures', async () => {
    axios.post.mockRejectedValueOnce({
      request: { status: 500 },
      message: 'Metadata failed',
    });

    const response = await saveImageInfos({
      userId: '42',
      imagesInfos: { name: 'img-1' },
      context: { token: 'Bearer token' },
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://backend.example/api/v1/users/42/images',
      { image: { name: 'img-1' } },
      { headers: { Authorization: 'Bearer token' } }
    );
    expect(response).toEqual({
      status: 500,
      title: 'Internal server error, please wait and try again',
      message: 'Metadata failed',
    });
  });
});