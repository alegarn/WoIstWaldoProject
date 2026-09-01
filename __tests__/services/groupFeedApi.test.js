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
import { saveLastImageUuid } from '../../utils/storageDatum';
import {
  PRIVATE_FEED_END_CURSOR,
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
      {
        headers: AUTH_HEADERS,
        responseType: 'arraybuffer',
        timeout: 15000,
      }
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

  it('Fix 2a (j): private success with persistCursor:false → no cursor save (head replay must not rewind)', async () => {
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: { images: [{ id: 'img-1', name: 'Waldo' }], next_cursor: 'cursor-2' },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { data: { url: 'https://backend.example/storage/img-1' } },
      })
      .mockResolvedValueOnce({ data: 'data:image/png;base64,Z29vG5ZQ==' });

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, {
      groupId: 'g-3',
      categoryKey: 'all',
      language: 'fr',
      persistCursor: false,
    });

    expect(response.isError).toBe(false);
    expect(saveLastImageUuid).not.toHaveBeenCalled();
  });

  it('Fix 2a (k): default (persistCursor true) saves the nextCursor on private success', async () => {
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: { images: [{ id: 'img-1', name: 'Waldo' }], next_cursor: 'cursor-2' },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { data: { url: 'https://backend.example/storage/img-1' } },
      })
      .mockResolvedValueOnce({ data: 'data:image/png;base64,Z29vG5ZQ==' });

    await fetchPrivateFeedPageForGame(null, CONTEXT, {
      groupId: 'g-3',
      categoryKey: 'all',
      language: 'fr',
    });

    expect(saveLastImageUuid).toHaveBeenCalledTimes(1);
    expect(saveLastImageUuid).toHaveBeenCalledWith('cursor-2', 'all', 'fr', { kind: 'private', groupId: 'g-3' });
  });

  it('empty private page persists the PRIVATE_FEED_END_CURSOR under the group scope (public cursor never poisoned)', async () => {
    axios.get.mockResolvedValueOnce({
      status: 200,
      data: { images: [], next_cursor: null },
    });

    await fetchPrivateFeedPageForGame(null, CONTEXT, {
      groupId: 'g-3',
      categoryKey: 'all',
      language: 'fr',
    });

    expect(saveLastImageUuid).toHaveBeenCalledTimes(1);
    expect(saveLastImageUuid).toHaveBeenCalledWith('__private_feed_end__', 'all', 'fr', { kind: 'private', groupId: 'g-3' });
  });

  it('Fix 2a: exported PRIVATE_FEED_END_CURSOR sentinel value is stable', () => {
    expect(PRIVATE_FEED_END_CURSOR).toBe('__private_feed_end__');
  });

  it('downloadPrivateImage requests an S3 presigned URL as arraybuffer and writes the decoded image file', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: { data: { url: 'https://s3.amazonaws.com/bucket/private/img-1.jpg' } },
      })
      .mockResolvedValueOnce({
        data: jpegBytes,
        headers: { 'content-type': 'image/jpeg' },
      });

    const fileUri = await downloadPrivateImage(CONTEXT, { groupId: 'g-3', imageId: 'img-1' });

    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      'https://s3.amazonaws.com/bucket/private/img-1.jpg',
      { responseType: 'arraybuffer', timeout: 15000 }
    );

    expect(typeof fileUri).toBe('string');
    expect(fileUri).toEqual(expect.stringContaining('private-img-1.jpeg'));
  });

  it('C8: downloadPrivateImage decodes a legacy ASCII data-URL ArrayBuffer served by S3', async () => {
    const legacyText = 'data:image/png;base64,AAEC';
    const legacyBytes = new Uint8Array(legacyText.length);
    for (let i = 0; i < legacyText.length; i++) {
      legacyBytes[i] = legacyText.charCodeAt(i) & 0xff;
    }
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: { data: { url: 'https://s3.amazonaws.com/bucket/private/img-legacy' } },
      })
      .mockResolvedValueOnce({
        data: legacyBytes.buffer,
        headers: { 'content-type': 'binary/octet-stream' },
      });

    const fileUri = await downloadPrivateImage(CONTEXT, { groupId: 'g-3', imageId: 'img-legacy' });

    expect(fileUri).toEqual(expect.stringContaining('private-img-legacy.png'));
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

  it('E5: fetchPrivateFeedPageForGame downloads row.storage_url directly without the presign endpoint', async () => {
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: {
          images: [
            {
              id: 'img-1',
              name: 'Waldo',
              storage_url: 'https://s3.amazonaws.com/bucket/private/img-1.jpg',
            },
          ],
          next_cursor: null,
        },
      })
      .mockResolvedValueOnce({
        data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
        headers: { 'content-type': 'image/jpeg' },
      });

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, {
      groupId: 'g-3',
      categoryKey: 'all',
      language: 'any',
    });

    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      'https://s3.amazonaws.com/bucket/private/img-1.jpg',
      { responseType: 'arraybuffer', timeout: 15000 }
    );
    expect(response.isError).toBe(false);
    expect(response.images).toHaveLength(1);
    expect(response.images[0].imageFile).toEqual(expect.stringContaining('private-img-1.jpeg'));
  });

  it('C7: a failed storage_url download (expired presign) falls back to the per-image presign endpoint', async () => {
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: {
          images: [
            {
              id: 'img-1',
              name: 'Waldo',
              storage_url: 'https://s3.amazonaws.com/bucket/private/img-1.jpg?expired-signature',
            },
          ],
          next_cursor: null,
        },
      })
      .mockRejectedValueOnce({ response: { status: 403 } })
      .mockResolvedValueOnce({
        status: 200,
        data: { data: { url: 'https://s3.amazonaws.com/bucket/private/img-1-fresh.jpg' } },
      })
      .mockResolvedValueOnce({
        data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
        headers: { 'content-type': 'image/jpeg' },
      });

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, {
      groupId: 'g-3',
      categoryKey: 'all',
      language: 'any',
    });

    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      'https://s3.amazonaws.com/bucket/private/img-1.jpg?expired-signature',
      { responseType: 'arraybuffer', timeout: 15000 }
    );
    expect(axios.get).toHaveBeenNthCalledWith(
      3,
      'https://backend.example/api/v1/private_groups/g-3/images/img-1',
      { headers: AUTH_HEADERS }
    );
    expect(axios.get).toHaveBeenNthCalledWith(
      4,
      'https://s3.amazonaws.com/bucket/private/img-1-fresh.jpg',
      { responseType: 'arraybuffer', timeout: 15000 }
    );
    expect(response.isError).toBe(false);
    expect(response.images).toHaveLength(1);
  });

  it('C7: an expired storage_url that decodes to nothing also falls back to presign', async () => {
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: {
          images: [{ id: 'img-1', name: 'Waldo', storage_url: 'https://s3.amazonaws.com/bucket/private/img-1.jpg' }],
          next_cursor: null,
        },
      })
      .mockResolvedValueOnce({
        data: new Uint8Array([0x00, 0x01, 0x02]),
        headers: { 'content-type': 'application/xml' },
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

    expect(axios.get).toHaveBeenNthCalledWith(
      3,
      'https://backend.example/api/v1/private_groups/g-3/images/img-1',
      { headers: AUTH_HEADERS }
    );
    expect(response.isError).toBe(false);
    expect(response.images).toHaveLength(1);
  });

  it('E5: rows without storage_url keep using the per-image presign endpoint', async () => {
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: {
          images: [{ id: 'img-1', name: 'Waldo', storage_url: null }],
          next_cursor: null,
        },
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

    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      'https://backend.example/api/v1/private_groups/g-3/images/img-1',
      { headers: AUTH_HEADERS }
    );
    expect(response.isError).toBe(false);
    expect(response.images).toHaveLength(1);
  });
});
