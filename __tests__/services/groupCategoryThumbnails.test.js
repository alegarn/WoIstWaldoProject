jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('expo-file-system', () => {
  const state = {
    existsOverride: null,
    deletedUris: [],
    movedUris: [],
    moveError: null,
  };

  const File = jest.fn().mockImplementation(function MockFile(firstArg, secondArg) {
    const base = typeof firstArg === 'string' ? firstArg : firstArg?.uri;
    this.uri = secondArg ? `${base}${secondArg}` : base;
    const override = state.existsOverride;
    this.exists = typeof override === 'function'
      ? override(this.uri)
      : (override === null ? true : override);
    this.write = jest.fn();
    this.moveSync = jest.fn((destination) => {
      if (state.moveError) {
        throw state.moveError;
      }
      state.movedUris.push({
        from: this.uri,
        to: typeof destination === 'string' ? destination : destination?.uri,
      });
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
    state.movedUris.length = 0;
    state.moveError = null;
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

jest.mock('expo-file-system/legacy', () => ({
  downloadAsync: jest.fn(),
}));

jest.mock('../../utils/imagesRequests', () => ({
  usesBackendStorage: jest.fn((url) =>
    typeof url === 'string' && url.startsWith('https://backend.example.com/')
  ),
  setStorageDownloadHeaders: jest.fn((token) => ({
    Authorization: token,
    HTTP_AUTHORIZATION: token,
  })),
  getBackendHeaders: jest.fn(async () => ({ token: 'Bearer t' })),
}));

import { downloadAsync } from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import {
  resolveCategoryThumbnail,
  deleteCategoryThumbnailFile,
  clearGroupThumbnails,
} from '../../services/groups/groupCategoryThumbnails';

const CONTEXT = { token: 'Bearer t', userId: 'u-1' };
const downloadResult = ({ status = 200, contentType } = {}) => ({
  uri: 'file:///cache/tmp.download',
  status,
  headers: contentType ? { 'content-type': contentType } : {},
});

describe('services/groups/groupCategoryThumbnails', () => {
  beforeEach(() => {
    downloadAsync.mockReset();
    File.__reset();
  });

  it('downloads the presigned thumbnail through the raw native transport and moves it to a private-thumb file', async () => {
    File.__state.existsOverride = false;
    downloadAsync.mockResolvedValue(downloadResult({ contentType: 'image/png' }));

    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: {
        thumbnail_image_id: 't-1',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-1.png',
      },
    });

    expect(downloadAsync).toHaveBeenCalledWith(
      'https://presigned.example.com/thumbs/t-1.png',
      'file:///cache/private-thumb-g-1-t-1.download',
      undefined
    );
    expect(uri).toEqual(expect.stringContaining('private-thumb-g-1-t-1.png'));
    expect(File.__state.movedUris).toEqual([
      { from: expect.stringContaining('private-thumb-g-1-t-1.download'), to: expect.stringContaining('private-thumb-g-1-t-1.png') },
    ]);
  });

  it('returns the cached URI without downloading when the local file already exists', async () => {
    File.__state.existsOverride = true;

    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: {
        thumbnail_image_id: 't-1',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-1.png',
      },
    });

    expect(downloadAsync).not.toHaveBeenCalled();
    expect(uri).toEqual(expect.stringContaining('private-thumb-g-1-t-1.png'));
  });

  it('keeps the URL-path extension over the response content-type (cache-key convention)', async () => {
    File.__state.existsOverride = false;
    downloadAsync.mockResolvedValue(downloadResult({ contentType: 'image/webp' }));

    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: {
        thumbnail_image_id: 't-url-ext',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-url-ext.png',
      },
    });

    expect(uri).toEqual(expect.stringContaining('private-thumb-g-1-t-url-ext.png'));
  });

  it('falls back to content-type for the file extension when the presigned URL path has none', async () => {
    File.__state.existsOverride = false;
    downloadAsync.mockResolvedValue(downloadResult({ contentType: 'image/webp' }));

    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: {
        thumbnail_image_id: 't-2',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-2?sig=abc',
      },
    });

    expect(uri).toEqual(expect.stringContaining('private-thumb-g-1-t-2.webp'));
    expect(File.__state.movedUris[0]).toEqual({
      from: expect.stringContaining('private-thumb-g-1-t-2.download'),
      to: expect.stringContaining('private-thumb-g-1-t-2.webp'),
    });
  });

  it('serves a gif content-type as a local gif file', async () => {
    File.__state.existsOverride = false;
    downloadAsync.mockResolvedValue(downloadResult({ contentType: 'image/gif' }));

    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: {
        thumbnail_image_id: 't-gif',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-gif?sig=abc',
      },
    });

    expect(uri).toEqual(expect.stringContaining('private-thumb-g-1-t-gif.gif'));
    expect(File.__state.movedUris).toHaveLength(1);
    expect(File.__state.movedUris[0]).toEqual({
      from: expect.stringContaining('private-thumb-g-1-t-gif.download'),
      to: expect.stringContaining('private-thumb-g-1-t-gif.gif'),
    });
  });

  it('returns null and skips the network when thumbnail_image_id is null', async () => {
    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: { thumbnail_image_id: null, thumbnail_url: 'https://x/y.png' },
    });

    expect(uri).toBeNull();
    expect(downloadAsync).not.toHaveBeenCalled();
  });

  it('returns null when the category has no thumbnail_image_id key at all', async () => {
    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: {},
    });

    expect(uri).toBeNull();
    expect(downloadAsync).not.toHaveBeenCalled();
  });

  it('returns the original presigned URL when the download fails at transport level', async () => {
    File.__state.existsOverride = false;
    downloadAsync.mockRejectedValue(new Error('network down'));

    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: {
        thumbnail_image_id: 't-3',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-3.png',
      },
    });

    expect(uri).toBe('https://presigned.example.com/thumbs/t-3.png');
    expect(File.__state.movedUris).toHaveLength(0);
  });

  it('returns the original presigned URL when the download resolves non-2xx', async () => {
    File.__state.existsOverride = false;
    downloadAsync.mockResolvedValue(downloadResult({ status: 403 }));

    const uri = await resolveCategoryThumbnail(CONTEXT, {
      groupId: 'g-1',
      category: {
        thumbnail_image_id: 't-http',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-http.png',
      },
    });

    expect(uri).toBe('https://presigned.example.com/thumbs/t-http.png');
    expect(File.__state.movedUris).toHaveLength(0);
  });

  it('returns the original presigned URL when moving the downloaded file fails', async () => {
    File.__state.existsOverride = false;
    File.__state.moveError = new Error('disk full');
    downloadAsync.mockResolvedValue(downloadResult({ contentType: 'image/jpeg' }));

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
    downloadAsync.mockResolvedValue(downloadResult({ contentType: 'image/png' }));

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

      expect(downloadAsync).toHaveBeenCalledWith(
        'https://backend.example.com/api/v1/local_image_storage/thumbs/t-backend.png',
        'file:///cache/private-thumb-g-backend-t-backend.download',
        {
          headers: { Authorization: 'Bearer t', HTTP_AUTHORIZATION: 'Bearer t' },
        }
      );
      expect(uri).toEqual(expect.stringContaining('private-thumb-g-backend-t-backend.png'));
      expect(File.__state.movedUris).toHaveLength(1);
    } finally {
      process.env.EXPO_PUBLIC_APP_BACKEND_URL = originalBackendUrl;
    }
  });

  it('shares a single network fetch between concurrent calls for the same group and image', async () => {
    File.__state.existsOverride = false;
    let deferredResolve;
    downloadAsync.mockImplementation(
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

    expect(downloadAsync).toHaveBeenCalledTimes(1);

    deferredResolve(downloadResult({ contentType: 'image/png' }));

    const [uriA, uriB] = await Promise.all([first, second]);

    expect(downloadAsync).toHaveBeenCalledTimes(1);
    expect(uriA).toEqual(expect.stringContaining('private-thumb-g-dedup-t-dedup.png'));
    expect(uriB).toEqual(uriA);
    expect(File.__state.movedUris).toHaveLength(1);
  });

  it('serves the local file on the next sequential call after a successful download', async () => {
    File.__state.existsOverride = false;
    downloadAsync.mockResolvedValue(downloadResult({ contentType: 'image/png' }));

    const args = {
      groupId: 'g-seq',
      category: {
        thumbnail_image_id: 't-seq',
        thumbnail_url: 'https://presigned.example.com/thumbs/t-seq.png',
      },
    };

    const firstUri = await resolveCategoryThumbnail(CONTEXT, args);
    expect(downloadAsync).toHaveBeenCalledTimes(1);
    expect(firstUri).toEqual(expect.stringContaining('private-thumb-g-seq-t-seq.png'));

    File.__state.existsOverride = true;
    downloadAsync.mockClear();

    const secondUri = await resolveCategoryThumbnail(CONTEXT, args);

    expect(downloadAsync).not.toHaveBeenCalled();
    expect(secondUri).toEqual(firstUri);
  });

  it('resolves both concurrent callers to the presigned fallback when the fetch rejects, then retries on the next call', async () => {
    File.__state.existsOverride = false;
    downloadAsync.mockRejectedValue(new Error('network down'));

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
    expect(downloadAsync).toHaveBeenCalledTimes(1);

    await resolveCategoryThumbnail(CONTEXT, args);

    expect(downloadAsync).toHaveBeenCalledTimes(2);
  });

  it('fetches separately for the same image id under different group ids', async () => {
    File.__state.existsOverride = false;
    downloadAsync.mockResolvedValue(downloadResult({ contentType: 'image/png' }));

    const category = {
      thumbnail_image_id: 't-shared',
      thumbnail_url: 'https://presigned.example.com/thumbs/t-shared.png',
    };

    const [uriA, uriB] = await Promise.all([
      resolveCategoryThumbnail(CONTEXT, { groupId: 'g-a', category }),
      resolveCategoryThumbnail(CONTEXT, { groupId: 'g-b', category }),
    ]);

    expect(downloadAsync).toHaveBeenCalledTimes(2);
    expect(uriA).toEqual(expect.stringContaining('private-thumb-g-a-t-shared.png'));
    expect(uriB).toEqual(expect.stringContaining('private-thumb-g-b-t-shared.png'));
  });
});
