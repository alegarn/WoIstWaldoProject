const mockBase64 = jest.fn();
const mockWrite = jest.fn();
const mockCreateCacheDirectory = jest.fn();
const mockUpload = jest.fn();
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
    this.size = 4096;
    this.base64 = mockBase64;
    this.write = mockWrite;
    this.upload = mockUpload;
    this.moveSync = jest.fn((destination) => {
      this.uri = typeof destination === 'string' ? destination : destination?.uri ?? this.uri;
    });
    this.delete = jest.fn();
  }),
  Paths: class MockPaths {
    static get cache() {
      return {
        uri: 'file:///cache/',
        create: mockCreateCacheDirectory,
      };
    }
  },
  UploadType: {
    BINARY_CONTENT: 0,
    MULTIPART: 1,
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  downloadAsync: jest.fn(),
}));

import axios from 'axios';
import { File, Paths, UploadType } from 'expo-file-system';
import { downloadAsync } from 'expo-file-system/legacy';

import { getBackendHeaders, setHeaders } from '../utils/auth';
import { getImages, performImageUpload, prepareImageUpload, saveImageInfos, buildImageObject } from '../utils/imagesRequests';
import { saveLastImageUuid } from '../utils/storageDatum';

const batchRow = (name, storageUrl) => ({
  name,
  storage_url: storageUrl ?? `https://backend.example/api/v1/local_image_storage/${name}`,
});
const batchResponse = (names) => ({ data: { data: names.map((name) => batchRow(name)) } });
const downloadResult = ({ status = 200, contentType } = {}) => ({
  uri: 'file:///cache/tmp.download',
  status,
  headers: contentType ? { 'content-type': contentType } : {},
});
const NETWORK_ERROR_RESULT = {
  isError: true,
  reason: 'network',
  title: "There is an error downloading user's images.",
  message: 'Please retry later...',
};
const SERVER_ERROR_RESULT = {
  isError: true,
  reason: 'server',
  title: "There is an error downloading user's images.",
  message: 'Please retry later...',
};

describe('imagesRequests utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBase64.mockReset();
    mockWrite.mockReset();
    mockCreateCacheDirectory.mockReset();
    mockUpload.mockReset();
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

  it('uploads binary through File.upload with auth headers for the local_disk provider (no base64 read)', async () => {
    mockUpload.mockResolvedValueOnce({ status: 200, body: '', headers: {} });

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

    expect(File).toHaveBeenCalledWith('file:///waldo.png');
    expect(mockBase64).not.toHaveBeenCalled();
    expect(axios.put).not.toHaveBeenCalled();
    expect(mockUpload).toHaveBeenCalledWith(
      'https://backend.example/api/v1/local_image_storage/image-key',
      {
        httpMethod: 'PUT',
        uploadType: UploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': '4096',
          Authorization: 'Bearer token',
        },
      }
    );
    const uploadHeaders = mockUpload.mock.calls[0][1].headers;
    expect(Object.values(uploadHeaders).every((value) => typeof value === 'string')).toBe(true);
    expect(uploadHeaders['Content-Length']).toBe('4096');
    expect(response).toEqual({
      status: 200,
      title: '',
      message: '',
    });
  });

  it('sends only the presigned headers (no Authorization) for the S3 provider', async () => {
    mockUpload.mockResolvedValueOnce({ status: 200, body: '', headers: {} });

    await performImageUpload({
      plan: {
        provider: 's3',
        method: 'PUT',
        url: 'https://s3.amazonaws.com/bucket/image-key',
        headers: { 'x-amz-server-side-encryption': 'AES256' },
        image_key: 'image-key',
      },
      fileUrl: 'file:///waldo.png',
      fileExtension: 'png',
      contentLength: 4096,
      context: { token: 'Bearer token' },
    });

    expect(mockUpload).toHaveBeenCalledWith(
      'https://s3.amazonaws.com/bucket/image-key',
      {
        httpMethod: 'PUT',
        uploadType: UploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': '4096',
          'x-amz-server-side-encryption': 'AES256',
        },
      }
    );
    const uploadHeaders = mockUpload.mock.calls[0][1].headers;
    expect(Object.values(uploadHeaders).every((value) => typeof value === 'string')).toBe(true);
    expect(uploadHeaders).not.toHaveProperty('Authorization');
    expect(uploadHeaders).not.toHaveProperty('HTTP_AUTHORIZATION');
  });

  it('coerces numeric header values (client Content-Length and server plan headers) to strings', async () => {
    mockUpload.mockResolvedValueOnce({ status: 200, body: '', headers: {} });

    await performImageUpload({
      plan: {
        provider: 's3',
        method: 'PUT',
        url: 'https://s3.amazonaws.com/bucket/image-key',
        headers: { 'Content-Length': 392318, 'x-amz-meta-size': 12345 },
        image_key: 'image-key',
      },
      fileUrl: 'file:///waldo.png',
      fileExtension: 'png',
      contentLength: 392318,
      context: { token: 'Bearer token' },
    });

    const uploadHeaders = mockUpload.mock.calls[0][1].headers;
    expect(Object.values(uploadHeaders).every((value) => typeof value === 'string')).toBe(true);
    expect(uploadHeaders['Content-Length']).toBe('392318');
    expect(uploadHeaders['x-amz-meta-size']).toBe('12345');
  });

  it('surfaces a non-2xx File.upload response like the old axios failure path', async () => {
    mockUpload.mockResolvedValueOnce({ status: 422, body: 'InvalidUpload', headers: {} });

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

    expect(response).toEqual({
      status: 422,
      title: 'Something went wrong, please try again later',
      message: 'InvalidUpload',
    });
  });

  it('maps a File.upload transport rejection to the error envelope', async () => {
    mockUpload.mockRejectedValueOnce(new Error('Network request failed'));

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

    expect(response.status).toBeUndefined();
    expect(response.title).toBe('Something went wrong, please try again later');
    expect(response.message).toBe('Network request failed');
  });

  it('returns the missing-file envelope when the local file vanished before upload', async () => {
    mockFileExists = false;

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

    expect(mockUpload).not.toHaveBeenCalled();
    expect(response.status).toBeUndefined();
    expect(response.message).toEqual(
      expect.stringContaining('Your file might not exist anymore but should be uploaded')
    );
  });

  it('rejects upload plans whose method is not a binary upload method', async () => {
    const response = await performImageUpload({
      plan: {
        provider: 'local_disk',
        method: 'GET',
        url: 'https://backend.example/api/v1/local_image_storage/image-key',
        headers: {},
        image_key: 'image-key',
      },
      fileUrl: 'file:///waldo.png',
      fileExtension: 'png',
      contentLength: 4096,
      context: { token: 'Bearer token' },
    });

    expect(response).toEqual({
      status: 500,
      title: 'Internal server error, please wait and try again',
      message: 'Unsupported upload method: GET',
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('returns an auth error when image batch loading is rejected with 401', async () => {
    axios.get.mockRejectedValueOnce({ request: { status: 401 } });

    const response = await getImages(null, { token: 'Bearer token' });

    expect(response).toEqual({
      isError: true,
      title: 'There is an authentication error.',
      message: 'Please reconnect',
    });
    expect(response.reason).toBeUndefined();
  });

  it('classifies a 5xx image batch response as a server error', async () => {
    axios.get.mockRejectedValueOnce({
      response: { status: 503 },
      request: { status: 503 },
      message: 'Boom',
    });

    const response = await getImages(null, { token: 'Bearer token' });

    expect(response).toEqual({
      isError: true,
      reason: 'server',
      title: "There is an error downloading user's images.",
      message: 'Please retry later...',
    });
  });

  it('classifies a network failure as a network error', async () => {
    axios.get.mockRejectedValueOnce({ message: 'Network Error' });

    const response = await getImages(null, { token: 'Bearer token' });

    expect(response).toEqual({
      isError: true,
      reason: 'network',
      title: "There is an error downloading user's images.",
      message: 'Please retry later...',
    });
  });

  it('tags a successful empty batch with the empty reason', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        data: [],
      },
    });

    const response = await getImages(null, { token: 'Bearer token' });

    expect(response.isError).toBe(false);
    expect(response.reason).toBe('empty');
    expect(response.images).toEqual([]);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list without trying to download files when the backend batch is empty', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        data: [],
      },
    });

    const response = await getImages(null, { token: 'Bearer token' });

    expect(response).toEqual({ isError: false, reason: 'empty', images: [] });
    expect(axios.get).toHaveBeenCalledTimes(1);
    // Regression: an empty batch must NOT persist the exhausted sentinel.
    // Saving it bricked the category forever (no new uploads ever surfaced).
    // The caller decides exhaustion via the empty images array; the cursor
    // stays on the last successfully fetched image so a later retry can page.
    expect(saveLastImageUuid).not.toHaveBeenCalled();
  });

  it('downloads backend-hosted images through the raw native transport with auth headers (no base64 anywhere)', async () => {
    axios.get.mockResolvedValueOnce({
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
    });
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }));

    const response = await getImages(null, { token: 'Bearer token' });

    expect(downloadAsync).toHaveBeenCalledWith(
      'https://backend.example/api/v1/local_image_storage/img-1',
      'file:///cache/img-1.download',
      {
        headers: {
          Authorization: 'Bearer token',
          HTTP_AUTHORIZATION: 'Bearer token',
        },
      }
    );
    expect(mockCreateCacheDirectory).toHaveBeenCalledWith({ idempotent: true, intermediates: true });
    expect(File).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: 'file:///cache/',
        create: expect.any(Function),
      }),
      'img-1.png'
    );
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockBase64).not.toHaveBeenCalled();
    expect(response.isError).toBe(false);
    expect(response.images[0].imageFile).toBe('file:///cache/img-1.png');
    expect(saveLastImageUuid).toHaveBeenCalledWith('img-1', undefined, undefined);
  });

  it('derives the file extension from the response Content-Type header', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        data: [batchRow('img-webp')],
      },
    });
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/webp' }));

    const response = await getImages(null, { token: 'Bearer token' });

    expect(downloadAsync).toHaveBeenCalledWith(
      'https://backend.example/api/v1/local_image_storage/img-webp',
      'file:///cache/img-webp.download',
      {
        headers: {
          Authorization: 'Bearer token',
          HTTP_AUTHORIZATION: 'Bearer token',
        },
      }
    );
    expect(File).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'file:///cache/' }),
      'img-webp.webp'
    );
    expect(mockWrite).not.toHaveBeenCalled();
    expect(response.isError).toBe(false);
    expect(response.images[0].imageFile).toBe('file:///cache/img-webp.webp');
  });

  it('sends no Authorization headers for non-backend (S3) storage URLs', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        data: [batchRow('img-s3', 'https://s3.amazonaws.com/bucket/img-s3.jpg')],
      },
    });
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/jpeg' }));

    const response = await getImages(null, { token: 'Bearer token' });

    expect(downloadAsync).toHaveBeenCalledWith(
      'https://s3.amazonaws.com/bucket/img-s3.jpg',
      'file:///cache/img-s3.download',
      undefined
    );
    expect(response.isError).toBe(false);
    expect(response.images[0].imageFile).toBe('file:///cache/img-s3.jpeg');
  });

  it('falls back to the URL path extension when the Content-Type is not an image type', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        data: [batchRow('img-ext', 'https://s3.amazonaws.com/bucket/img-ext.jpg')],
      },
    });
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'binary/octet-stream' }));

    const response = await getImages(null, { token: 'Bearer token' });

    expect(File).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'file:///cache/' }),
      'img-ext.jpg'
    );
    expect(response.images[0].imageFile).toBe('file:///cache/img-ext.jpg');
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
      });

    downloadAsync
      .mockResolvedValueOnce(downloadResult({ status: 404 }))
      .mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }));

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
      { headers: { Authorization: 'Bearer token' }, timeout: 15000 }
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
    expect(saveLastImageUuid).toHaveBeenCalledWith('playable-img', undefined, undefined);
  });

  it('H1: aborts after one metadata request with no cursor write when every download fails network-class (no HTTP response)', async () => {
    axios.get.mockResolvedValueOnce(batchResponse(['img-1', 'img-2', 'img-3', 'img-4', 'img-5']));
    downloadAsync.mockRejectedValue(new Error('Network Error'));

    const response = await getImages(null, { token: 'Bearer token' });

    expect(response).toEqual(NETWORK_ERROR_RESULT);
    // Exactly ONE metadata request total: the head GET. The loop aborted, so
    // no next_image_batch POST was ever fired.
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(downloadAsync).toHaveBeenCalledTimes(5);
    expect(axios.post).not.toHaveBeenCalled();
    expect(saveLastImageUuid).not.toHaveBeenCalled();
  });

  it('H1: retries a fully server-class 5xx batch to budget exhaustion and fails terminal server (cursor saved each iteration)', async () => {
    axios.get.mockResolvedValueOnce(batchResponse(['img-1']));
    downloadAsync.mockResolvedValue(downloadResult({ status: 503 }));
    axios.post
      .mockResolvedValueOnce(batchResponse(['img-2']))
      .mockResolvedValueOnce(batchResponse(['img-3']))
      .mockResolvedValueOnce(batchResponse(['img-4']));

    const response = await getImages(null, { token: 'Bearer token' });

    expect(response).toEqual(SERVER_ERROR_RESULT);
    // 4 metadata requests worst case: head GET + 3 next POSTs.
    expect(downloadAsync).toHaveBeenCalledTimes(4);
    expect(axios.post).toHaveBeenCalledTimes(3);
    expect(saveLastImageUuid).toHaveBeenCalledTimes(4);
    expect(saveLastImageUuid).toHaveBeenNthCalledWith(1, 'img-1', undefined, undefined);
    expect(saveLastImageUuid).toHaveBeenNthCalledWith(2, 'img-2', undefined, undefined);
    expect(saveLastImageUuid).toHaveBeenNthCalledWith(3, 'img-3', undefined, undefined);
    expect(saveLastImageUuid).toHaveBeenNthCalledWith(4, 'img-4', undefined, undefined);
  });

  it('H1: retries a fully server-class 404 batch (HTTP response received) to budget exhaustion and fails terminal server', async () => {
    axios.get.mockResolvedValueOnce(batchResponse(['img-1']));
    downloadAsync.mockResolvedValue(downloadResult({ status: 404 }));
    axios.post
      .mockResolvedValueOnce(batchResponse(['img-2']))
      .mockResolvedValueOnce(batchResponse(['img-3']))
      .mockResolvedValueOnce(batchResponse(['img-4']));

    const response = await getImages(null, { token: 'Bearer token' });

    expect(response).toEqual(SERVER_ERROR_RESULT);
    expect(axios.post).toHaveBeenCalledTimes(3);
    expect(saveLastImageUuid).toHaveBeenCalledTimes(4);
    expect(saveLastImageUuid).toHaveBeenNthCalledWith(1, 'img-1', undefined, undefined);
    expect(saveLastImageUuid).toHaveBeenNthCalledWith(4, 'img-4', undefined, undefined);
  });

  it('H1: returns partial successes without retrying when some downloads succeed and others fail network-class', async () => {
    axios.get.mockResolvedValueOnce(batchResponse(['img-1', 'img-2', 'img-3', 'img-4', 'img-5']));
    downloadAsync
      .mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }))
      .mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }))
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockRejectedValueOnce(new Error('Network Error'));

    const response = await getImages(null, { token: 'Bearer token' });

    expect(response.isError).toBe(false);
    expect(response.images.map((image) => image.pictureId)).toEqual(['img-1', 'img-2']);
    expect(saveLastImageUuid).toHaveBeenCalledTimes(1);
    expect(saveLastImageUuid).toHaveBeenCalledWith('img-5', undefined, undefined);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('H1: aborts with reason network when a zero-success batch mixes network and server failures', async () => {
    axios.get.mockResolvedValueOnce(batchResponse(['img-1', 'img-2', 'img-3', 'img-4', 'img-5']));
    downloadAsync
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce(downloadResult({ status: 503 }))
      .mockResolvedValueOnce(downloadResult({ status: 404 }))
      .mockResolvedValueOnce(downloadResult({ status: 500 }));

    const response = await getImages(null, { token: 'Bearer token' });

    expect(response).toEqual(NETWORK_ERROR_RESULT);
    expect(saveLastImageUuid).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('Fix 2a (g): persistCursor:false skips saveLastImageUuid on a successful batch', async () => {
    axios.get.mockResolvedValueOnce(batchResponse(['img-1']));
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }));

    const response = await getImages(null, { token: 'Bearer token' }, {}, { persistCursor: false });

    expect(response.isError).toBe(false);
    expect(response.images.map((image) => image.pictureId)).toEqual(['img-1']);
    expect(saveLastImageUuid).not.toHaveBeenCalled();
  });

  it('Fix 2a (h): persistCursor:false skips the broken-batch cursor advance (loop semantics unchanged)', async () => {
    axios.get.mockResolvedValueOnce(batchResponse(['not-found-img']));
    downloadAsync
      .mockResolvedValueOnce(downloadResult({ status: 404 }))
      .mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }));
    axios.post.mockResolvedValueOnce(batchResponse(['playable-img']));

    const response = await getImages(null, { token: 'Bearer token' }, {}, { persistCursor: false });

    expect(response.isError).toBe(false);
    expect(response.images.map((image) => image.pictureId)).toEqual(['playable-img']);
    // Broken batch still skipped (POST fired, loop continued) — but no cursor
    // write at EITHER site (broken-batch advance and success).
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(saveLastImageUuid).not.toHaveBeenCalled();
  });

  it('Fix 2a: private scope forwards persistCursor:false so the private path also skips the cursor save', async () => {
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: { images: [{ id: 'img-1', name: 'img-1' }], next_cursor: 'cursor-9' },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { data: { url: 'https://backend.example/storage/img-1' } },
      });

    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }));

    const response = await getImages(null, { token: 'Bearer token' }, {
      category_id: 'cat-private-uuid',
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-3' },
    }, { persistCursor: false });

    expect(response.isError).toBe(false);
    expect(saveLastImageUuid).not.toHaveBeenCalled();
  });

  it('threads category and language filters into the initial image batch query params', async () => {
    axios.get.mockResolvedValueOnce({ data: { data: [] } });

    await getImages(null, { token: 'Bearer token' }, { category_id: 'X', language: 'fr' });

    expect(axios.get).toHaveBeenCalledWith(
      'https://backend.example/api/v1/users/42/get_image_batch',
      {
        headers: { Authorization: 'Bearer token' },
        params: { category_id: 'X', language: 'fr' },
        timeout: 15000,
      }
    );
  });

  it('threads category and language filters into the next image batch body', async () => {
    axios.post.mockResolvedValueOnce({ data: { data: [] } });

    await getImages('first-img', { token: 'Bearer token' }, { category_id: 'X', language: 'fr' });

    expect(axios.post).toHaveBeenCalledWith(
      'https://backend.example/api/v1/users/42/next_image_batch',
      { image: { name: 'first-img', category_id: 'X', language: 'fr' } },
      { headers: { Authorization: 'Bearer token' }, timeout: 15000 }
    );
  });

  it('threads category_key and language into saveLastImageUuid when a batch resolves', async () => {
    axios.get.mockResolvedValueOnce({
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
    });
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }));

    await getImages(
      null,
      { token: 'Bearer token' },
      { category_id: 'uuid-123', category_key: 'nature', language: 'fr' }
    );

    expect(saveLastImageUuid).toHaveBeenCalledWith('img-1', 'nature', 'fr');
  });

  it('B2: threads category_key into the public image batch query params (no category_id)', async () => {
    axios.get.mockResolvedValueOnce({ data: { data: [] } });

    await getImages(null, { token: 'Bearer token' }, { category_key: 'nature', language: 'fr' });

    expect(axios.get).toHaveBeenCalledWith(
      'https://backend.example/api/v1/users/42/get_image_batch',
      {
        headers: { Authorization: 'Bearer token' },
        params: { category_key: 'nature', language: 'fr' },
        timeout: 15000,
      }
    );
    // B2: public path must NOT leak category_id when only category_key is supplied.
    expect(axios.get.mock.calls[0][1].params).not.toHaveProperty('category_id');
  });

  it('B2: threads category_key into the next image batch body (public pagination)', async () => {
    axios.post.mockResolvedValueOnce({ data: { data: [] } });

    await getImages('first-img', { token: 'Bearer token' }, { category_key: 'nature', language: 'fr' });

    expect(axios.post).toHaveBeenCalledWith(
      'https://backend.example/api/v1/users/42/next_image_batch',
      { image: { name: 'first-img', category_key: 'nature', language: 'fr' } },
      { headers: { Authorization: 'Bearer token' }, timeout: 15000 }
    );
    expect(axios.post.mock.calls[0][1].image).not.toHaveProperty('category_id');
  });

  it('B2: sends neither category_key nor category_id when filters omit them (legacy full feed)', async () => {
    axios.get.mockResolvedValueOnce({ data: { data: [] } });

    await getImages(null, { token: 'Bearer token' }, { language: 'fr' });

    expect(axios.get).toHaveBeenCalledWith(
      'https://backend.example/api/v1/users/42/get_image_batch',
      {
        headers: { Authorization: 'Bearer token' },
        params: { language: 'fr' },
        timeout: 15000,
      }
    );
    expect(axios.get.mock.calls[0][1].params).not.toHaveProperty('category_key');
    expect(axios.get.mock.calls[0][1].params).not.toHaveProperty('category_id');
  });

  it('private scope: namespaces the cursor with the private category id so it round-trips with getLastImageUuid', async () => {
    // Regression: private filters carry no category_key (server contract stays
    // category_id), so the private delegation must derive the LOCAL cursor
    // namespace from category_id. Writing under 'all' (the storageDatum
    // fallback for undefined) never matched the read side
    // (getLastImageUuid(<privateId>)) and polluted the public 'all' cursor.
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: { images: [{ id: 'img-1', name: 'img-1' }], next_cursor: 'cursor-9' },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { data: { url: 'https://backend.example/storage/img-1' } },
      });

    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }));

    const response = await getImages(null, { token: 'Bearer token' }, {
      category_id: 'cat-private-uuid',
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-3' },
    });

    expect(axios.get).toHaveBeenNthCalledWith(
      1,
      'https://backend.example/api/v1/private_groups/g-3/images/',
      {
        headers: { Authorization: 'Bearer token' },
        params: { category_id: 'cat-private-uuid', language: 'fr' },
      }
    );
    expect(response.isError).toBe(false);
    expect(saveLastImageUuid).toHaveBeenCalledTimes(1);
    expect(saveLastImageUuid).toHaveBeenCalledWith('cursor-9', 'cat-private-uuid', 'fr', { kind: 'private', groupId: 'g-3' });
  });

  it('leaves the request unchanged when no filters are provided (legacy full feed)', async () => {
    axios.get.mockResolvedValueOnce({ data: { data: [] } });

    await getImages(null, { token: 'Bearer token' });

    expect(axios.get).toHaveBeenCalledWith(
      'https://backend.example/api/v1/users/42/get_image_batch',
      { headers: { Authorization: 'Bearer token' }, timeout: 15000 }
    );
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

describe('buildImageObject', () => {
  it('maps snake_case API payload to camelCase app object including nested category fields', () => {
    const apiImage = {
      name: 'img-1',
      description: 'Short',
      image_height: 100,
      image_width: 200,
      is_portrait: true,
      x_location: 0.3,
      y_location: 0.7,
      screen_height: 400,
      screen_width: 300,
      storage_url: 'https://backend.example/api/v1/local_image_storage/img-1',
      ratings_average: 4.5,
      ratings_count: 12,
      creator_username: 'waldo',
      created_at: '2024-01-02T00:00:00Z',
      full_description: 'Find Waldo in the crowd',
      language: 'fr',
      category: {
        id: 7,
        name: 'Crowd',
        thumbnail_url: 'https://backend.example/thumb.png',
        sort_order: 3,
      },
    };

    const mapped = buildImageObject(apiImage, 'file:///cache/img-1.png');

    expect(mapped.pictureId).toBe('img-1');
    expect(mapped.imageFile).toBe('file:///cache/img-1.png');
    expect(mapped.description).toBe('Short');
    expect(mapped.imageHeight).toBe(100);
    expect(mapped.imageWidth).toBe(200);
    expect(mapped.isPortrait).toBe(true);
    expect(mapped.touchLocation).toEqual({ x: 0.3, y: 0.7 });
    expect(mapped.screenHeight).toBe(400);
    expect(mapped.screenWidth).toBe(300);
    expect(mapped.averageRating).toBe(4.5);
    expect(mapped.ratingsCount).toBe(12);
    expect(mapped.creatorUsername).toBe('waldo');
    expect(mapped.createdAt).toBe('2024-01-02T00:00:00Z');
    expect(mapped.fullDescription).toBe('Find Waldo in the crowd');
    expect(mapped.language).toBe('fr');
    expect(mapped.category).toEqual({
      id: 7,
      name: 'Crowd',
      thumbnailUrl: 'https://backend.example/thumb.png',
      sortOrder: 3,
    });
  });

  it('does not crash on legacy payload without snake_case fields or category', () => {
    const legacyApiImage = {
      name: 'legacy-img',
      description: 'Legacy',
      image_height: 100,
      image_width: 200,
      is_portrait: true,
      x_location: 0.3,
      y_location: 0.7,
      screen_height: 400,
      screen_width: 300,
    };

    const mapped = buildImageObject(legacyApiImage, 'file:///cache/legacy-img.png');

    expect(mapped.pictureId).toBe('legacy-img');
    expect(mapped.imageFile).toBe('file:///cache/legacy-img.png');
    expect(mapped.description).toBe('Legacy');
    expect(mapped.averageRating).toBeUndefined();
    expect(mapped.ratingsCount).toBeUndefined();
    expect(mapped.creatorUsername).toBeUndefined();
    expect(mapped.createdAt).toBeUndefined();
    expect(mapped.fullDescription).toBeUndefined();
    expect(mapped.language).toBeUndefined();
    expect(mapped.category).toBeUndefined();
  });

  it('preserves null category as null on the mapped object', () => {
    const apiImage = {
      name: 'img-2',
      description: 'No category',
      image_height: 100,
      image_width: 200,
      is_portrait: true,
      x_location: 0.3,
      y_location: 0.7,
      screen_height: 400,
      screen_width: 300,
      category: null,
    };

    const mapped = buildImageObject(apiImage, 'file:///cache/img-2.png');

    expect(mapped.category).toBeNull();
  });
});
