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
    this.moveSync = jest.fn((destination) => {
      this.uri = typeof destination === 'string' ? destination : destination?.uri ?? this.uri;
    });
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

jest.mock('expo-file-system/legacy', () => ({
  downloadAsync: jest.fn(),
}));

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

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { downloadAsync } from 'expo-file-system/legacy';
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
const downloadResult = ({ status = 200, contentType } = {}) => ({
  uri: 'file:///cache/tmp.download',
  status,
  headers: contentType ? { 'content-type': contentType } : {},
});

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

  it('downloadPrivateImage GETs the presign URL then downloads raw bytes to private-<id>.<ext>', async () => {
    axios.get.mockResolvedValueOnce({
      status: 200,
      data: { data: { url: 'https://backend.example/storage/img-1' } },
    });
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }));

    const fileUri = await downloadPrivateImage(CONTEXT, { groupId: 'g-3', imageId: 'img-1' });

    expect(axios.get).toHaveBeenNthCalledWith(
      1,
      'https://backend.example/api/v1/private_groups/g-3/images/img-1',
      { headers: AUTH_HEADERS }
    );
    expect(downloadAsync).toHaveBeenCalledWith(
      'https://backend.example/storage/img-1',
      'file:///cache/private-img-1.download',
      { headers: AUTH_HEADERS }
    );
    expect(fileUri).toBe('file:///cache/private-img-1.png');
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
      });

    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }));

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, {
      groupId: 'g-3',
      categoryKey: 'all',
      language: 'any',
    });

    expect(response.isError).toBe(false);
    expect(response.images).toHaveLength(1);
    expect(response.images[0].imageFile).toBe('file:///cache/private-img-1.png');
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
      });

    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }));

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
      });

    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }));

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

  it('downloadPrivateImage requests an S3 presigned URL and writes the image file with no auth headers', async () => {
    axios.get.mockResolvedValueOnce({
      status: 200,
      data: { data: { url: 'https://s3.amazonaws.com/bucket/private/img-1.jpg' } },
    });
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/jpeg' }));

    const fileUri = await downloadPrivateImage(CONTEXT, { groupId: 'g-3', imageId: 'img-1' });

    expect(downloadAsync).toHaveBeenCalledWith(
      'https://s3.amazonaws.com/bucket/private/img-1.jpg',
      'file:///cache/private-img-1.download',
      undefined
    );

    expect(typeof fileUri).toBe('string');
    expect(fileUri).toBe('file:///cache/private-img-1.jpeg');
  });

  it('downloadPrivateImage returns null instead of throwing when the presign download rejects', async () => {
    axios.get.mockResolvedValueOnce({
      status: 200,
      data: { data: { url: 'https://s3.amazonaws.com/bucket/private/img-1.jpg' } },
    });
    downloadAsync.mockRejectedValueOnce(new Error('network down'));

    const result = await downloadPrivateImage(CONTEXT, { groupId: 'g-3', imageId: 'img-1' });

    expect(result).toBeNull();
  });

  it('downloadPrivateImage returns null when the presign download resolves non-2xx', async () => {
    axios.get.mockResolvedValueOnce({
      status: 200,
      data: { data: { url: 'https://s3.amazonaws.com/bucket/private/img-1.jpg' } },
    });
    downloadAsync.mockResolvedValueOnce(downloadResult({ status: 403 }));

    const result = await downloadPrivateImage(CONTEXT, { groupId: 'g-3', imageId: 'img-1' });

    expect(result).toBeNull();
  });

  it('E5: fetchPrivateFeedPageForGame downloads row.storage_url directly without the presign endpoint', async () => {
    axios.get.mockResolvedValueOnce({
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
    });

    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/jpeg' }));

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, {
      groupId: 'g-3',
      categoryKey: 'all',
      language: 'any',
    });

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(downloadAsync).toHaveBeenCalledWith(
      'https://s3.amazonaws.com/bucket/private/img-1.jpg',
      'file:///cache/private-img-1.download',
      undefined
    );
    expect(response.isError).toBe(false);
    expect(response.images).toHaveLength(1);
    expect(response.images[0].imageFile).toBe('file:///cache/private-img-1.jpeg');
  });

  it('C7: a failed storage_url download (expired presign, non-2xx) falls back to the per-image presign endpoint', async () => {
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
      .mockResolvedValueOnce({
        status: 200,
        data: { data: { url: 'https://s3.amazonaws.com/bucket/private/img-1-fresh.jpg' } },
      });

    downloadAsync
      .mockResolvedValueOnce(downloadResult({ status: 403 }))
      .mockResolvedValueOnce(downloadResult({ contentType: 'image/jpeg' }));

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, {
      groupId: 'g-3',
      categoryKey: 'all',
      language: 'any',
    });

    expect(downloadAsync).toHaveBeenNthCalledWith(
      1,
      'https://s3.amazonaws.com/bucket/private/img-1.jpg?expired-signature',
      'file:///cache/private-img-1.download',
      undefined
    );
    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      'https://backend.example/api/v1/private_groups/g-3/images/img-1',
      { headers: AUTH_HEADERS }
    );
    expect(downloadAsync).toHaveBeenNthCalledWith(
      2,
      'https://s3.amazonaws.com/bucket/private/img-1-fresh.jpg',
      'file:///cache/private-img-1.download',
      undefined
    );
    expect(response.isError).toBe(false);
    expect(response.images).toHaveLength(1);
  });

  it('C7: an expired storage_url whose download rejects at transport level also falls back to presign', async () => {
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: {
          images: [{ id: 'img-1', name: 'Waldo', storage_url: 'https://s3.amazonaws.com/bucket/private/img-1.jpg' }],
          next_cursor: null,
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { data: { url: 'https://backend.example/storage/img-1' } },
      });

    downloadAsync
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }));

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
      });

    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }));

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

describe('Task 6: fetchPrivateFeedPageForGame pre-download played filter', () => {
  const GROUP_ARGS = { groupId: 'g-3', categoryKey: 'all', language: 'fr' };
  const SCOPE = { kind: 'private', groupId: 'g-3' };

  const row = (id) => ({
    id,
    name: id,
    storage_url: `https://s3.amazonaws.com/bucket/private/${id}.jpg`,
  });

  const page = (rows, nextCursor) => ({
    status: 200,
    data: { images: rows, next_cursor: nextCursor },
  });

  const setGroupPlayed = (ids) => {
    AsyncStorage.getItem.mockImplementation(async (key) =>
      key === 'playedPictureIds:group:g-3:fr' ? JSON.stringify(ids) : null);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getBackendHeaders.mockResolvedValue({ token: TOKEN, userId: 'user-1', scoreId: 'score-1' });
    setHeaders.mockReturnValue(AUTH_HEADERS);
    AsyncStorage.getItem.mockReset();
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  it('6a: downloads only unplayed rows (2 unplayed / 3 played) and persists the FULL server-batch tail cursor', async () => {
    setGroupPlayed(['img-3', 'img-4', 'img-5']);
    axios.get.mockResolvedValueOnce(
      page([row('img-1'), row('img-2'), row('img-3'), row('img-4'), row('img-5')], 'cursor-2'),
    );
    downloadAsync.mockResolvedValue(downloadResult({ contentType: 'image/jpeg' }));

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, GROUP_ARGS);

    expect(response.isError).toBe(false);
    expect(response.images.map((image) => image.imageFile)).toEqual([
      'file:///cache/private-img-1.jpeg',
      'file:///cache/private-img-2.jpeg',
    ]);
    expect(downloadAsync).toHaveBeenCalledTimes(2);
    expect(downloadAsync).toHaveBeenNthCalledWith(
      1,
      'https://s3.amazonaws.com/bucket/private/img-1.jpg',
      'file:///cache/private-img-1.download',
      undefined,
    );
    expect(downloadAsync).toHaveBeenNthCalledWith(
      2,
      'https://s3.amazonaws.com/bucket/private/img-2.jpg',
      'file:///cache/private-img-2.download',
      undefined,
    );
    expect(saveLastImageUuid).toHaveBeenCalledTimes(1);
    expect(saveLastImageUuid).toHaveBeenCalledWith('cursor-2', 'all', 'fr', SCOPE);
  });

  it('6a: a row without name matches the played set by its id (normalizePrivateImage identity fallback)', async () => {
    setGroupPlayed(['img-1']);
    axios.get.mockResolvedValueOnce(page([{ ...row('img-1'), name: null }, row('img-2')], null));
    downloadAsync.mockResolvedValue(downloadResult({ contentType: 'image/jpeg' }));

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, GROUP_ARGS);

    expect(downloadAsync).toHaveBeenCalledTimes(1);
    expect(downloadAsync).toHaveBeenCalledWith(
      'https://s3.amazonaws.com/bucket/private/img-2.jpg',
      'file:///cache/private-img-2.download',
      undefined,
    );
    expect(response.images).toHaveLength(1);
  });

  it('6b: all-played batch with nextCursor loops to the next page (full-tail cursor per iteration, no sentinel write until terminal)', async () => {
    setGroupPlayed(['img-1', 'img-2']);
    axios.get
      .mockResolvedValueOnce(page([row('img-1'), row('img-2')], 'cursor-2'))
      .mockResolvedValueOnce(page([row('img-3')], 'cursor-3'));
    downloadAsync.mockResolvedValue(downloadResult({ contentType: 'image/jpeg' }));

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, GROUP_ARGS);

    expect(response.isError).toBe(false);
    expect(response.images.map((image) => image.imageFile)).toEqual(['file:///cache/private-img-3.jpeg']);
    expect(downloadAsync).toHaveBeenCalledTimes(1);
    expect(saveLastImageUuid).toHaveBeenCalledTimes(2);
    expect(saveLastImageUuid).toHaveBeenNthCalledWith(1, 'cursor-2', 'all', 'fr', SCOPE);
    expect(saveLastImageUuid).toHaveBeenNthCalledWith(2, 'cursor-3', 'all', 'fr', SCOPE);
    expect(saveLastImageUuid).not.toHaveBeenCalledWith('__private_feed_end__', 'all', 'fr', SCOPE);
  });

  it('6b: all-played at the end of the feed (no nextCursor) persists the end sentinel and returns reason played-out with zero downloads', async () => {
    setGroupPlayed(['img-1', 'img-2']);
    axios.get.mockResolvedValueOnce(page([row('img-1'), row('img-2')], null));

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, GROUP_ARGS);

    expect(response).toEqual({ isError: false, reason: 'played-out', images: [] });
    expect(downloadAsync).not.toHaveBeenCalled();
    expect(saveLastImageUuid).toHaveBeenCalledTimes(1);
    expect(saveLastImageUuid).toHaveBeenCalledWith('__private_feed_end__', 'all', 'fr', SCOPE);
  });

  it('6b: an empty page after played skips is played-out, not genuine-empty (a first empty page keeps NO reason)', async () => {
    setGroupPlayed(['img-1']);
    axios.get
      .mockResolvedValueOnce(page([row('img-1')], 'cursor-2'))
      .mockResolvedValueOnce(page([], null));

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, GROUP_ARGS);

    expect(response).toEqual({ isError: false, reason: 'played-out', images: [] });
    expect(downloadAsync).not.toHaveBeenCalled();
    expect(saveLastImageUuid).toHaveBeenNthCalledWith(1, 'cursor-2', 'all', 'fr', SCOPE);
    expect(saveLastImageUuid).toHaveBeenLastCalledWith('__private_feed_end__', 'all', 'fr', SCOPE);
  });

  it('6b: bound hit after MAX_PLAYED_SKIPS consecutive all-played pages returns played-out with full-tail cursor writes and no sentinel', async () => {
    setGroupPlayed(['img-1', 'img-2', 'img-3', 'img-4', 'img-5', 'img-6']);
    axios.get
      .mockResolvedValueOnce(page([row('img-1')], 'cursor-2'))
      .mockResolvedValueOnce(page([row('img-2')], 'cursor-3'))
      .mockResolvedValueOnce(page([row('img-3')], 'cursor-4'))
      .mockResolvedValueOnce(page([row('img-4')], 'cursor-5'))
      .mockResolvedValueOnce(page([row('img-5')], 'cursor-6'))
      .mockResolvedValueOnce(page([row('img-6')], 'cursor-7'));

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, GROUP_ARGS);

    expect(response).toEqual({ isError: false, reason: 'played-out', images: [] });
    expect(downloadAsync).not.toHaveBeenCalled();
    expect(axios.get).toHaveBeenCalledTimes(6);
    expect(saveLastImageUuid).toHaveBeenCalledTimes(6);
    expect(saveLastImageUuid).toHaveBeenLastCalledWith('cursor-7', 'all', 'fr', SCOPE);
    expect(saveLastImageUuid).not.toHaveBeenCalledWith('__private_feed_end__', 'all', 'fr', SCOPE);
  });

  it('6d: persistCursor:false suppresses every cursor write on the played-out loop, including the terminal sentinel', async () => {
    setGroupPlayed(['img-1']);
    axios.get
      .mockResolvedValueOnce(page([row('img-1')], 'cursor-2'))
      .mockResolvedValueOnce(page([row('img-1')], null));

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, { ...GROUP_ARGS, persistCursor: false });

    expect(response).toEqual({ isError: false, reason: 'played-out', images: [] });
    expect(downloadAsync).not.toHaveBeenCalled();
    expect(saveLastImageUuid).not.toHaveBeenCalled();
  });

  it('6a: an unreadable played set fails open (batch downloads unfiltered)', async () => {
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('storage boom'));
    axios.get.mockResolvedValueOnce(page([row('img-1')], null));
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/jpeg' }));

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, GROUP_ARGS);

    expect(response.isError).toBe(false);
    expect(response.images).toHaveLength(1);
  });
});

describe('Task 7c: private feed exclude param from group played set', () => {
  const GROUP_ARGS = { groupId: 'g-3', categoryKey: 'all', language: 'fr' };
  const IMAGES_URL = 'https://backend.example/api/v1/private_groups/g-3/images/';

  const row = (id) => ({
    id,
    name: id,
    storage_url: `https://s3.amazonaws.com/bucket/private/${id}.jpg`,
  });

  const page = (rows, nextCursor) => ({
    status: 200,
    data: { images: rows, next_cursor: nextCursor },
  });

  const setGroupPlayed = (ids) => {
    AsyncStorage.getItem.mockImplementation(async (key) =>
      key === 'playedPictureIds:group:g-3:fr' ? JSON.stringify(ids) : null);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getBackendHeaders.mockResolvedValue({ token: TOKEN, userId: 'user-1', scoreId: 'score-1' });
    setHeaders.mockReturnValue(AUTH_HEADERS);
    AsyncStorage.getItem.mockReset();
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  it('7c: fetchPrivateFeedPage attaches excludeNames as a csv query param', async () => {
    axios.get.mockResolvedValueOnce({
      status: 200,
      data: { images: [row('img-1')], next_cursor: 'cursor-2' },
    });

    await fetchPrivateFeedPage(CONTEXT, {
      groupId: 'g-3',
      cursor: 'cursor-1',
      categoryId: 'cat-5',
      language: 'fr',
      excludeNames: ['img-8', 'img-9'],
    });

    expect(axios.get).toHaveBeenCalledWith(IMAGES_URL, {
      headers: AUTH_HEADERS,
      params: { after: 'cursor-1', category_id: 'cat-5', language: 'fr', exclude: 'img-8,img-9' },
    });
  });

  it('7c: fetchPrivateFeedPageForGame sends exclude=<csv> from the group played set on the page fetch', async () => {
    setGroupPlayed(['img-8', 'img-9']);
    axios.get.mockResolvedValueOnce(page([row('img-1')], null));
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/jpeg' }));

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, GROUP_ARGS);

    expect(response.isError).toBe(false);
    expect(axios.get).toHaveBeenCalledWith(IMAGES_URL, {
      headers: AUTH_HEADERS,
      params: { language: 'fr', exclude: 'img-8,img-9' },
    });
  });

  it('7c: exclude csv keeps only the most recent 200 played ids (PLAYED_PICTURE_IDS_CAP)', async () => {
    const all = Array.from({ length: 205 }, (_, i) => `id-${String(i + 1).padStart(3, '0')}`);
    setGroupPlayed(all);
    axios.get.mockResolvedValueOnce(page([row('img-1')], null));
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/jpeg' }));

    await fetchPrivateFeedPageForGame(null, CONTEXT, GROUP_ARGS);

    const params = axios.get.mock.calls[0][1].params;
    expect(params.exclude.split(',')).toHaveLength(200);
    expect(params.exclude).toBe(all.slice(-200).join(','));
    expect(params.exclude).not.toContain('id-005');
    expect(params.exclude).toContain('id-006');
  });

  it('7c: empty played set omits the exclude param entirely', async () => {
    setGroupPlayed([]);
    axios.get.mockResolvedValueOnce(page([row('img-1')], null));
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/jpeg' }));

    await fetchPrivateFeedPageForGame(null, CONTEXT, GROUP_ARGS);

    expect(axios.get).toHaveBeenCalledWith(IMAGES_URL, {
      headers: AUTH_HEADERS,
      params: { language: 'fr' },
    });
  });

  it('7c: exclude rides every page iteration of the played-skip loop', async () => {
    setGroupPlayed(['img-1']);
    axios.get
      .mockResolvedValueOnce(page([row('img-1')], 'cursor-2'))
      .mockResolvedValueOnce(page([row('img-2')], null));
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/jpeg' }));

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, GROUP_ARGS);

    expect(response.isError).toBe(false);
    expect(axios.get).toHaveBeenNthCalledWith(1, IMAGES_URL, {
      headers: AUTH_HEADERS,
      params: { language: 'fr', exclude: 'img-1' },
    });
    expect(axios.get).toHaveBeenNthCalledWith(2, IMAGES_URL, {
      headers: AUTH_HEADERS,
      params: { after: 'cursor-2', language: 'fr', exclude: 'img-1' },
    });
  });

  it('7c: unreadable played set fails open with no exclude param', async () => {
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('storage boom'));
    axios.get.mockResolvedValueOnce(page([row('img-1')], null));
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/jpeg' }));

    const response = await fetchPrivateFeedPageForGame(null, CONTEXT, GROUP_ARGS);

    expect(response.isError).toBe(false);
    expect(response.images).toHaveLength(1);
    expect(axios.get).toHaveBeenCalledWith(IMAGES_URL, {
      headers: AUTH_HEADERS,
      params: { language: 'fr' },
    });
  });
});
