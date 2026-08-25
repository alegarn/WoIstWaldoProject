jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('base64-js', () => ({
  fromByteArray: jest.fn((bytes) => `b64:${bytes.length}`),
}));

jest.mock('expo-file-system', () => {
  const state = {
    existsOverride: null,
    deletedUris: [],
    writtenUris: [],
    writeError: null,
  };

  const File = jest.fn().mockImplementation(function MockFile(firstArg, secondArg) {
    const base = typeof firstArg === 'string' ? firstArg : firstArg?.uri;
    this.uri = secondArg ? `${base}${secondArg}` : base;
    const override = state.existsOverride;
    this.exists = typeof override === 'function'
      ? override(this.uri)
      : (override === null ? true : override);
    this.write = jest.fn((data, options) => {
      if (state.writeError) {
        throw state.writeError;
      }
      state.writtenUris.push({ uri: this.uri, data, options });
    });
    this.delete = jest.fn(() => {
      state.deletedUris.push(this.uri);
    });
  });

  const cacheStore = {
    uri: 'file:///cache/',
    list: () => [],
    create: jest.fn(),
  };

  function resetMockState() {
    state.existsOverride = null;
    state.deletedUris.length = 0;
    state.writtenUris.length = 0;
    state.writeError = null;
    cacheStore.list = () => [];
    cacheStore.create = jest.fn();
    File.mockClear();
  }

  File.__state = state;
  File.__cacheStore = cacheStore;
  File.__reset = resetMockState;

  const Paths = class MockPaths {
    static get cache() {
      return cacheStore;
    }
  };

  return { File, Paths };
});

import axios from 'axios';
import { fromByteArray } from 'base64-js';
import { File } from 'expo-file-system';
import {
  resolveCategoryThumbnail,
  deleteCategoryThumbnailFile,
  clearGroupThumbnails,
} from '../../services/groups/groupCategoryThumbnails';

const CONTEXT = { token: 'Bearer t', userId: 'u-1' };

describe('services/groups/groupCategoryThumbnails', () => {
  beforeEach(() => {
    axios.get.mockReset();
    fromByteArray.mockClear();
    File.__reset();
  });

  it('downloads the presigned thumbnail as arraybuffer and writes a private-thumb file when the local file is absent', async () => {
    File.__state.existsOverride = false;
    const bytes = new Uint8Array([1, 2, 3, 4]);
    axios.get.mockResolvedValue({
      data: bytes,
      headers: { 'content-type': 'image/png' },
    });

    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: {
        thumbnail_image_id: 't-1',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-1.png',
      },
    });

    expect(axios.get).toHaveBeenCalledWith(
      'https://presigned.example.com/thumbs/t-1.png',
      { responseType: 'arraybuffer', timeout: 15000 }
    );
    expect(uri).toEqual(expect.stringContaining('private-thumb-g-1-t-1.png'));
    expect(fromByteArray).toHaveBeenCalledWith(bytes);
    expect(File.__state.writtenUris).toHaveLength(1);
    expect(File.__state.writtenUris[0]).toEqual({
      uri: expect.stringContaining('private-thumb-g-1-t-1.png'),
      data: 'b64:4',
      options: { encoding: 'base64' },
    });
  });

  it('returns the cached URI without calling axios when the local file already exists', async () => {
    File.__state.existsOverride = true;

    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: {
        thumbnail_image_id: 't-1',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-1.png',
      },
    });

    expect(axios.get).not.toHaveBeenCalled();
    expect(uri).toEqual(expect.stringContaining('private-thumb-g-1-t-1.png'));
  });

  it('falls back to content-type for the file extension when the presigned URL path has none', async () => {
    File.__state.existsOverride = false;
    const bytes = new Uint8Array([5, 6, 7]);
    axios.get.mockResolvedValue({
      data: bytes,
      headers: { 'content-type': 'image/webp' },
    });

    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: {
        thumbnail_image_id: 't-2',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-2?sig=abc',
      },
    });

    expect(uri).toEqual(expect.stringContaining('private-thumb-g-1-t-2.webp'));
    expect(File.__state.writtenUris[0].uri).toEqual(
      expect.stringContaining('private-thumb-g-1-t-2.webp')
    );
  });

  it('returns null and skips the network when thumbnail_image_id is null', async () => {
    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: { thumbnail_image_id: null, thumbnail_url: 'https://x/y.png' },
    });

    expect(uri).toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('returns null when the category has no thumbnail_image_id key at all', async () => {
    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: {},
    });

    expect(uri).toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('returns the original presigned URL when the download fails', async () => {
    File.__state.existsOverride = false;
    axios.get.mockRejectedValue(new Error('network down'));

    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: {
        thumbnail_image_id: 't-3',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-3.png',
      },
    });

    expect(uri).toBe('https://presigned.example.com/thumbs/t-3.png');
    expect(File.__state.writtenUris).toHaveLength(0);
  });

  it('returns the original presigned URL when file write fails', async () => {
    File.__state.existsOverride = false;
    File.__state.writeError = new Error('disk full');
    axios.get.mockResolvedValue({
      data: new Uint8Array([8, 9]),
      headers: { 'content-type': 'image/jpeg' },
    });

    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: {
        thumbnail_image_id: 't-4',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-4.jpeg',
      },
    });

    expect(uri).toBe('https://presigned.example.com/thumbs/t-4.jpeg');
  });

  it('deleteCategoryThumbnailFile best-effort deletes the local thumbnail file', () => {
    deleteCategoryThumbnailFile('g-1', 't-1');

    const deleted = File.__state.deletedUris.filter((u) =>
      u.includes('private-thumb-g-1-t-1')
    );
    expect(deleted.length).toBeGreaterThan(0);
  });

  it('clearGroupThumbnails deletes only entries matching the group prefix', () => {
    File.__cacheStore.list = () => [
      'file:///cache/private-thumb-g-1-t-1.webp',
      'file:///cache/private-thumb-g-2-t-1.png',
      'file:///cache/other-private-foo.png',
    ];

    clearGroupThumbnails('g-1');

    expect(File.__state.deletedUris).toEqual(
      expect.arrayContaining(['file:///cache/private-thumb-g-1-t-1.webp'])
    );
    expect(File.__state.deletedUris).not.toContain(
      'file:///cache/private-thumb-g-2-t-1.png'
    );
    expect(File.__state.deletedUris).not.toContain(
      'file:///cache/other-private-foo.png'
    );
  });

  it('clearGroupThumbnails does not throw when Paths.cache.list is undefined', () => {
    File.__cacheStore.list = undefined;

    expect(() => clearGroupThumbnails('g-1')).not.toThrow();
  });

  it('sends Authorization and HTTP_AUTHORIZATION headers when the thumbnail URL points at backend storage', async () => {
    const originalBackendUrl = process.env.EXPO_PUBLIC_APP_BACKEND_URL;
    process.env.EXPO_PUBLIC_APP_BACKEND_URL = 'https://backend.example.com/';
    File.__state.existsOverride = false;
    axios.get.mockResolvedValue({
      data: 'data:image/png;base64,AAEC',
      headers: { 'content-type': 'text/plain' },
    });

    try {
      const uri = await resolveCategoryThumbnail(
        { ...CONTEXT, scoreId: 's-1' },
        {
          groupId: 'g-backend',
          category: {
            thumbnail_image_id: 't-backend',
            thumbnail_url:
              'https://backend.example.com/api/v1/local_image_storage/thumbs/t-backend.png',
          },
        }
      );

      expect(axios.get).toHaveBeenCalledWith(
        'https://backend.example.com/api/v1/local_image_storage/thumbs/t-backend.png',
        {
          headers: { Authorization: 'Bearer t', HTTP_AUTHORIZATION: 'Bearer t' },
          timeout: 15000,
        }
      );
      expect(uri).toEqual(expect.stringContaining('private-thumb-g-backend-t-backend.png'));
      expect(File.__state.writtenUris).toHaveLength(1);
      expect(File.__state.writtenUris[0]).toEqual({
        uri: expect.stringContaining('private-thumb-g-backend-t-backend.png'),
        data: 'AAEC',
        options: { encoding: 'base64' },
      });
    } finally {
      process.env.EXPO_PUBLIC_APP_BACKEND_URL = originalBackendUrl;
    }
  });

  it('returns the presigned URL without writing when backend response is not a valid data URL', async () => {
    const originalBackendUrl = process.env.EXPO_PUBLIC_APP_BACKEND_URL;
    process.env.EXPO_PUBLIC_APP_BACKEND_URL = 'https://backend.example.com/';
    File.__state.existsOverride = false;
    axios.get.mockResolvedValue({
      data: new Uint8Array([0, 1, 2]),
      headers: { 'content-type': 'text/plain' },
    });

    try {
      const uri = await resolveCategoryThumbnail(CONTEXT, {
        groupId: 'g-backend',
        category: {
          thumbnail_image_id: 't-bad',
          thumbnail_url:
            'https://backend.example.com/api/v1/local_image_storage/thumbs/t-bad.png',
        },
      });

      expect(uri).toBe(
        'https://backend.example.com/api/v1/local_image_storage/thumbs/t-bad.png'
      );
      expect(File.__state.writtenUris).toHaveLength(0);
    } finally {
      process.env.EXPO_PUBLIC_APP_BACKEND_URL = originalBackendUrl;
    }
  });

  it('shares a single network fetch between concurrent calls for the same group and image', async () => {
    File.__state.existsOverride = false;
    const bytes = new Uint8Array([10, 11, 12]);
    let deferredResolve;
    axios.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          deferredResolve = resolve;
        })
    );

    const args = {
      groupId: 'g-dedup',
      category: {
        thumbnail_image_id: 't-dedup',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-dedup.png',
      },
    };

    const first = resolveCategoryThumbnail(CONTEXT, args);
    const second = resolveCategoryThumbnail(CONTEXT, args);

    expect(axios.get).toHaveBeenCalledTimes(1);

    deferredResolve({
      data: bytes,
      headers: { 'content-type': 'image/png' },
    });

    const [uriA, uriB] = await Promise.all([first, second]);

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(uriA).toEqual(expect.stringContaining('private-thumb-g-dedup-t-dedup.png'));
    expect(uriB).toEqual(uriA);
    expect(File.__state.writtenUris).toHaveLength(1);
  });

  it('serves the local file on the next sequential call after a successful download', async () => {
    File.__state.existsOverride = false;
    axios.get.mockResolvedValue({
      data: new Uint8Array([13]),
      headers: { 'content-type': 'image/png' },
    });

    const args = {
      groupId: 'g-seq',
      category: {
        thumbnail_image_id: 't-seq',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-seq.png',
      },
    };

    const firstUri = await resolveCategoryThumbnail(CONTEXT, args);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(firstUri).toEqual(expect.stringContaining('private-thumb-g-seq-t-seq.png'));

    File.__state.existsOverride = true;
    axios.get.mockClear();

    const secondUri = await resolveCategoryThumbnail(CONTEXT, args);

    expect(axios.get).not.toHaveBeenCalled();
    expect(secondUri).toEqual(firstUri);
  });

  it('resolves both concurrent callers to the presigned fallback when the fetch rejects, then retries on the next call', async () => {
    File.__state.existsOverride = false;
    axios.get.mockRejectedValue(new Error('network down'));

    const args = {
      groupId: 'g-retry',
      category: {
        thumbnail_image_id: 't-retry',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-retry.png',
      },
    };

    const first = resolveCategoryThumbnail(CONTEXT, args);
    const second = resolveCategoryThumbnail(CONTEXT, args);

    await expect(first).resolves.toBe('https://presigned.example.com/thumbs/t-retry.png');
    await expect(second).resolves.toBe('https://presigned.example.com/thumbs/t-retry.png');
    expect(axios.get).toHaveBeenCalledTimes(1);

    await resolveCategoryThumbnail(CONTEXT, args);

    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('fetches separately for the same image id under different group ids', async () => {
    File.__state.existsOverride = false;
    axios.get.mockResolvedValue({
      data: new Uint8Array([14, 15]),
      headers: { 'content-type': 'image/png' },
    });

    const category = {
      thumbnail_image_id: 't-shared',
      thumbnail_url: 'https://presigned.example.com/thumbs/t-shared.png',
    };

    const [uriA, uriB] = await Promise.all([
      resolveCategoryThumbnail(CONTEXT, { groupId: 'g-a', category }),
      resolveCategoryThumbnail(CONTEXT, { groupId: 'g-b', category }),
    ]);

    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(uriA).toEqual(expect.stringContaining('private-thumb-g-a-t-shared.png'));
    expect(uriB).toEqual(expect.stringContaining('private-thumb-g-b-t-shared.png'));
  });
});
