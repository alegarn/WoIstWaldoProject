jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
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
}));

import axios from 'axios';

import { getBackendHeaders, setHeaders } from '../utils/auth';
import { getImages, getUploadUrl, saveImageInfos } from '../utils/imagesRequests';

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

  it('returns the upload URL payload and derived error title for the current auth state', async () => {
    axios.get.mockResolvedValue({
      status: 200,
      message: 'ok',
      data: { secure_url: 'https://aws.example/upload' },
    });

    const response = await getUploadUrl({ token: 'Bearer token' });

    expect(axios.get).toHaveBeenCalledWith(
      'https://backend.example/api/v1/aws_requests/get_secure_upload_url',
      { headers: { Authorization: 'Bearer token' } }
    );
    expect(response).toEqual({
      status: 200,
      title: 'Something went wrong, please try again later',
      message: 'ok',
      data: { secure_url: 'https://aws.example/upload' },
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

  it('posts image metadata with backend headers and maps request failures', async () => {
    axios.post.mockRejectedValueOnce({
      request: { status: 500 },
      message: 'Metadata failed',
    });

    const response = await saveImageInfos({
      userId: '42',
      imagesInfos: { name: 'img-1' },
      token: 'Bearer token',
      uid: 'waldo@example.com',
      expiry: '123',
      access_token: 'access',
      client: 'client',
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