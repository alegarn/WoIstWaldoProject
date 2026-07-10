jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('expo-file-system', () => {
  const File = jest.fn().mockImplementation(function MockFile(firstArg, secondArg) {
    const base = typeof firstArg === 'string' ? firstArg : firstArg?.uri;
    this.uri = secondArg ? `${base}${secondArg}` : base;
    this.exists = true;
    this.write = jest.fn();
    this.delete = jest.fn();
  });

  const cacheStore = {
    uri: 'file:///cache/',
    list: () => [],
    create: jest.fn(),
  };

  return {
    File,
    Paths: class MockPaths {
      static get cache() {
        return cacheStore;
      }
    },
  };
});

jest.mock('../../models/image', function MockImageFactory() {
  return function MockImage(uri) {
    this.imageFile = uri;
  };
});

jest.mock('../../utils/storageDatum', () => ({
  saveLastImageUuid: jest.fn(),
}));

jest.mock('../../utils/auth', () => ({
  getBackendHeaders: jest.fn(),
  setHeaders: jest.fn(),
  mapRequestError: jest.fn((error) => ({
    status: error?.response?.status ?? error?.request?.status,
    data: error?.response?.data ?? error,
  })),
}));

import axios from 'axios';
import { getBackendHeaders, setHeaders } from '../../utils/auth';
import {
  fetchPrivateFeedPage,
  fetchPrivateFeedPageForGame,
  downloadPrivateImage,
} from '../../services/groups/groupFeedApi';

const TOKEN = 'Bearer token-1';
const AUTH_HEADERS = { Authorization: TOKEN, HTTP_AUTHORIZATION: TOKEN };
const CONTEXT = { token: TOKEN, userId: 'user-1', scoreId: 'score-1' };

describe('services/groups/groupFeedApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getBackendHeaders.mockResolvedValue({ token: TOKEN, userId: 'user-1', scoreId: 'score-1' });
    setHeaders.mockReturnValue(AUTH_HEADERS);
  });

  it('fetchPrivateFeedPage GETs the private images index with cursor + category params and bearer token', async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        images: [{ id: 'img-1' }],
        next_cursor: 'cursor-2',
      },
    });

    const response = await fetchPrivateFeedPage(CONTEXT, {
      groupId: 'g-3',
      cursor: 'cursor-1',
      categoryId: 'cat-5',
      language: 'fr',
    });

    expect(axios.get).toHaveBeenCalledWith(
      'https://backend.example/api/v1/private_groups/g-3/images/',
      {
        headers: AUTH_HEADERS,
        params: { after: 'cursor-1', category_id: 'cat-5', language: 'fr' },
      }
    );
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ images: [{ id: 'img-1' }], nextCursor: 'cursor-2' });
  });

  it('fetchPrivateFeedPage maps a network error to a status+data envelope without throwing', async () => {
    axios.get.mockRejectedValue({
      response: { status: 403, data: { error: 'forbidden' } },
    });

    const response = await fetchPrivateFeedPage(CONTEXT, { groupId: 'g-3' });

    expect(response.status).toBe(403);
    expect(response.data).toEqual({ error: 'forbidden' });
  });

  it('downloadPrivateImage GETs the presign URL then downloads and decodes the base64 payload', async () => {
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: { data: { url: 'https://backend.example/storage/img-1' } },
      })
      .mockResolvedValueOnce({ data: 'data:image/png;base64,Z29vZGJ5ZQ==' });

    const fileUri = await downloadPrivateImage(CONTEXT, { groupId: 'g-3', imageId: 'img-1' });

    expect(axios.get).toHaveBeenNthCalledWith(
      1,
      'https://backend.example/api/v1/private_groups/g-3/images/img-1',
      { headers: AUTH_HEADERS }
    );
    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      'https://backend.example/storage/img-1',
      { headers: AUTH_HEADERS }
    );
    expect(fileUri).toEqual(expect.stringContaining('img-1'));
  });

  it('fetchPrivateFeedPageForGame returns an empty page without calling the API when the pictureId is the end cursor', async () => {
    const response = await fetchPrivateFeedPageForGame(
      '__private_feed_end__',
      CONTEXT,
      { groupId: 'g-3' }
    );

    expect(response).toEqual({ isError: false, images: [] });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('fetchPrivateFeedPageForGame downloads each row and returns normalized images keyed by file uri', async () => {
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: { images: [{ id: 'img-1', name: 'Waldo' }], next_cursor: null },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { data: { url: 'https://backend.example/storage/img-1' } },
      })
      .mockResolvedValueOnce({ data: 'data:image/png;base64,Z29vZGJ5ZQ==' });

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, {
      groupId: 'g-3',
      categoryKey: 'all',
      language: 'any',
    });

    expect(response.isError).toBe(false);
    expect(response.images).toHaveLength(1);
    expect(response.images[0].imageFile).toEqual(expect.stringContaining('img-1'));
  });

  it('downloadPrivateImage requests an S3 presigned URL as arraybuffer and returns a base64 data URL', async () => {
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: { data: { url: 'https://s3.amazonaws.com/bucket/private/img-1.jpg' } },
      })
      .mockResolvedValueOnce({
        data: new ArrayBuffer(8),
        headers: { 'content-type': 'image/jpeg' },
      });

    const fileUri = await downloadPrivateImage(CONTEXT, { groupId: 'g-3', imageId: 'img-1' });

    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      'https://s3.amazonaws.com/bucket/private/img-1.jpg',
      expect.objectContaining({ responseType: 'arraybuffer' })
    );

    expect(typeof fileUri).toBe('string');
    expect(fileUri).toEqual(expect.stringContaining('img-1'));
  });

  it('downloadPrivateImage returns null instead of throwing when the presign download rejects', async () => {
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: { data: { url: 'https://s3.amazonaws.com/bucket/private/img-1.jpg' } },
      })
      .mockRejectedValueOnce(new Error('network down'));

    const result = await downloadPrivateImage(CONTEXT, { groupId: 'g-3', imageId: 'img-1' });

    expect(result).toBeNull();
  });
});
