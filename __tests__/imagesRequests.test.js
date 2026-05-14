const mockBase64 = jest.fn();
const mockWrite = jest.fn();
const mockCreateCacheDirectory = jest.fn();
let mockFileExists = true;

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
  File: jest.fn().mockImplementation(function MockFile(firstArg, secondArg) {
    const baseUri = typeof firstArg === 'string' ? firstArg : firstArg?.uri;

    this.uri = secondArg ? `${baseUri}${secondArg}` : baseUri;
    this.exists = mockFileExists;
    this.base64 = mockBase64;
    this.write = mockWrite;
  }),
  Paths: class MockPaths {
    static get cache() {
      return {
        uri: 'file:///cache/',
        create: mockCreateCacheDirectory,
      };
    }
  },
}));

import axios from 'axios';
import { File, Paths } from 'expo-file-system';

import { getBackendHeaders, setHeaders } from '../utils/auth';
import { getImages, performImageUpload, prepareImageUpload, saveImageInfos } from '../utils/imagesRequests';
import { saveLastImageUuid } from '../utils/storageDatum';

describe('imagesRequests utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBase64.mockReset();
    mockWrite.mockReset();
    mockCreateCacheDirectory.mockReset();
    mockFileExists = true;
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
    mockBase64.mockResolvedValueOnce('abc123');
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
    expect(File).toHaveBeenCalledWith('file:///waldo.png');
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
    expect(File).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: 'file:///cache/',
        create: expect.any(Function),
      }),
      'img-1.png'
    );
    expect(mockCreateCacheDirectory).toHaveBeenCalledWith({ idempotent: true, intermediates: true });
    expect(mockWrite).toHaveBeenCalledWith(
      'abc123',
      { encoding: 'base64' }
    );
    expect(response.isError).toBe(false);
    expect(saveLastImageUuid).toHaveBeenCalledWith('img-1');
  });

  it('skips a fully broken batch and continues to the next batch of playable images', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              name: 'broken-img',
              description: 'Broken image',
              image_height: 100,
              image_width: 200,
              is_portrait: true,
              x_location: 0.3,
              y_location: 0.7,
              screen_height: 400,
              screen_width: 300,
              storage_url: 'https://backend.example/api/v1/local_image_storage/broken-img',
            },
          ],
        },
      })
      .mockRejectedValueOnce({ request: { status: 404 } })
      .mockResolvedValueOnce({ data: 'data:image/png;base64,next123' });

    axios.post.mockResolvedValueOnce({
      data: {
        data: [
          {
            name: 'playable-img',
            description: 'Playable image',
            image_height: 300,
            image_width: 400,
            is_portrait: false,
            x_location: 0.5,
            y_location: 0.4,
            screen_height: 640,
            screen_width: 320,
            storage_url: 'https://backend.example/api/v1/local_image_storage/playable-img',
          },
        ],
      },
    });

    const response = await getImages(null, { token: 'Bearer token' });

    expect(axios.post).toHaveBeenCalledWith(
      'https://backend.example/api/v1/users/42/next_image_batch',
      { image: { name: 'broken-img' } },
      { headers: { Authorization: 'Bearer token' } }
    );
    expect(response).toEqual({
      isError: false,
      images: [
        expect.objectContaining({
          pictureId: 'playable-img',
          imageFile: 'file:///cache/playable-img.png',
        }),
      ],
    });
    expect(saveLastImageUuid).toHaveBeenCalledWith('playable-img');
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