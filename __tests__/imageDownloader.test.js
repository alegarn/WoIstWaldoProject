jest.mock('expo-file-system', () => {
  const state = {
    moved: [],
    deletedUris: [],
    moveError: null,
    cachedEntries: [],
  };

  const File = jest.fn().mockImplementation(function MockFile(firstArg, secondArg) {
    const base = typeof firstArg === 'string' ? firstArg : firstArg?.uri;
    this.uri = secondArg ? `${base}${secondArg}` : base;
    this.exists = true;
    this.moveSync = jest.fn((destination) => {
      if (state.moveError) {
        throw state.moveError;
      }
      state.moved.push({ from: this.uri, to: destination?.uri ?? destination });
    });
    this.delete = jest.fn(() => {
      state.deletedUris.push(this.uri);
    });
  });

  File.__state = state;
  File.__reset = () => {
    state.moved.length = 0;
    state.deletedUris.length = 0;
    state.moveError = null;
    state.cachedEntries.length = 0;
    File.mockClear();
  };

  const cacheStore = {
    uri: 'file:///cache/',
    create: jest.fn(),
    list: jest.fn(() => state.cachedEntries),
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

import { File, Paths } from 'expo-file-system';
import { downloadAsync } from 'expo-file-system/legacy';
import {
  downloadImageFile,
  ImageDownloadError,
  normalizeFileExtension,
  extensionFromUrlPath,
} from '../utils/imageDownloader';

const CACHE_DIR = { uri: 'file:///cache/', create: jest.fn() };
const downloadResult = ({ status = 200, contentType } = {}) => ({
  uri: 'file:///cache/name.download',
  status,
  headers: contentType ? { 'content-type': contentType } : {},
});

describe('utils/imageDownloader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    File.__reset();
  });

  describe('normalizeFileExtension', () => {
    it.each([
      ['png', 'png'],
      ['.WEBP', 'webp'],
      ['jpg', 'jpg'],
      ['x', null],
      ['toolongext', null],
      ['', null],
      [null, null],
      [undefined, null],
    ])('normalizes %s to %s', (input, expected) => {
      expect(normalizeFileExtension(input)).toBe(expected);
    });
  });

  describe('extensionFromUrlPath', () => {
    it.each([
      ['https://s3.example.com/bucket/img-1.jpg', 'jpg'],
      ['https://s3.example.com/bucket/img-1.jpg?X-Amz-Signature=abc', 'jpg'],
      ['https://s3.example.com/bucket/img-1.jpg#fragment', 'jpg'],
      ['https://backend.example/api/v1/local_image_storage/img-1', null],
      ['https://presigned.example.com/thumbs/t-2?sig=abc', null],
      ['', null],
      [null, null],
    ])('derives %s from %s', (url, expected) => {
      expect(extensionFromUrlPath(url)).toBe(expected);
    });
  });

  it('downloads via the legacy native transport into a temp file and renames by content-type', async () => {
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/webp' }));

    const result = await downloadImageFile({
      url: 'https://backend.example/api/v1/local_image_storage/img-1',
      directory: CACHE_DIR,
      name: 'img-1',
      headers: { Authorization: 'Bearer t' },
    });

    expect(CACHE_DIR.create).toHaveBeenCalledWith({ idempotent: true, intermediates: true });
    expect(downloadAsync).toHaveBeenCalledWith(
      'https://backend.example/api/v1/local_image_storage/img-1',
      'file:///cache/img-1.download',
      { headers: { Authorization: 'Bearer t' } }
    );
    expect(File).toHaveBeenLastCalledWith(CACHE_DIR, 'img-1.webp');
    expect(File.__state.moved).toEqual([
      { from: 'file:///cache/img-1.download', to: 'file:///cache/img-1.webp' },
    ]);
    expect(result).toEqual({ fileUri: 'file:///cache/img-1.webp', extension: 'webp' });
    expect(File.__state.deletedUris).toEqual([]);
  });

  it('omits the options argument entirely when no headers are given', async () => {
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/jpeg' }));

    await downloadImageFile({
      url: 'https://s3.amazonaws.com/bucket/img-1.jpg',
      directory: CACHE_DIR,
      name: 'private-img-1',
    });

    expect(downloadAsync).toHaveBeenCalledWith(
      'https://s3.amazonaws.com/bucket/img-1.jpg',
      'file:///cache/private-img-1.download',
      undefined
    );
  });

  it('prefers the caller-provided extension over the response content-type', async () => {
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/webp' }));

    const result = await downloadImageFile({
      url: 'https://s3.amazonaws.com/bucket/img-1.jpg',
      directory: CACHE_DIR,
      name: 'private-img-1',
      preferredExtension: 'jpg',
    });

    expect(result.fileUri).toBe('file:///cache/private-img-1.jpg');
  });

  it('falls back to the URL path extension when the content-type is not an image type', async () => {
    downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'binary/octet-stream' }));

    const result = await downloadImageFile({
      url: 'https://s3.amazonaws.com/bucket/img-1.jpg',
      directory: CACHE_DIR,
      name: 'private-img-1',
    });

    expect(result).toEqual({ fileUri: 'file:///cache/private-img-1.jpg', extension: 'jpg' });
  });

  it('falls back to a sane default extension when nothing names the type', async () => {
    downloadAsync.mockResolvedValueOnce(downloadResult({}));

    const result = await downloadImageFile({
      url: 'https://backend.example/api/v1/local_image_storage/img-1',
      directory: CACHE_DIR,
      name: 'img-1',
    });

    expect(result).toEqual({ fileUri: 'file:///cache/img-1.jpg', extension: 'jpg' });
  });

  it('reads the content-type header case-insensitively', async () => {
    downloadAsync.mockResolvedValueOnce({ uri: 'file:///cache/x.download', status: 200, headers: { 'Content-Type': 'image/png' } });

    const result = await downloadImageFile({
      url: 'https://backend.example/storage/img-1',
      directory: CACHE_DIR,
      name: 'img-1',
    });

    expect(result.extension).toBe('png');
  });

  it('surfaces a non-2xx status as a typed server-class error and deletes the temp file', async () => {
    downloadAsync.mockResolvedValueOnce(downloadResult({ status: 403 }));

    await expect(downloadImageFile({
      url: 'https://s3.amazonaws.com/bucket/img-1.jpg?expired',
      directory: CACHE_DIR,
      name: 'private-img-1',
    })).rejects.toMatchObject({
      name: 'ImageDownloadError',
      status: 403,
      networkFailure: false,
      message: 'Image download failed with status 403',
    });
    expect(File.__state.deletedUris).toEqual(['file:///cache/private-img-1.download']);
    expect(File.__state.moved).toEqual([]);
  });

  it('surfaces a transport rejection as a typed network-class error without a status', async () => {
    downloadAsync.mockRejectedValueOnce(new Error('Network request failed'));

    await expect(downloadImageFile({
      url: 'https://s3.amazonaws.com/bucket/img-1.jpg',
      directory: CACHE_DIR,
      name: 'private-img-1',
    })).rejects.toMatchObject({
      name: 'ImageDownloadError',
      status: undefined,
      networkFailure: true,
      message: 'Network request failed',
    });
    expect(File.__state.deletedUris).toEqual(['file:///cache/private-img-1.download']);
  });

  it('exposes ImageDownloadError as an Error subclass', () => {
    const error = new ImageDownloadError(500, 'boom');

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(500);
    expect(error.networkFailure).toBe(false);
  });

  describe('byte-cache guard (Task 2a)', () => {
    it('returns the existing final file and skips the network entirely on a cache hit', async () => {
      File.__state.cachedEntries.push('file:///cache/img-1.png');

      const result = await downloadImageFile({
        url: 'https://backend.example/api/v1/local_image_storage/img-1',
        directory: Paths.cache,
        name: 'img-1',
      });

      expect(result).toEqual({ fileUri: 'file:///cache/img-1.png', extension: 'png' });
      expect(downloadAsync).not.toHaveBeenCalled();
      expect(Paths.cache.create).not.toHaveBeenCalled();
      expect(File.__state.moved).toEqual([]);
    });

    it('matches on the name prefix across extensions regardless of the preferred extension', async () => {
      File.__state.cachedEntries.push('file:///cache/img-1.webp');

      const result = await downloadImageFile({
        url: 'https://s3.amazonaws.com/bucket/img-1.jpg',
        directory: Paths.cache,
        name: 'img-1',
        preferredExtension: 'jpg',
      });

      expect(result).toEqual({ fileUri: 'file:///cache/img-1.webp', extension: 'webp' });
      expect(downloadAsync).not.toHaveBeenCalled();
    });

    it('never treats a stale <name>.download temp as a hit (download proceeds) and cleans it up on a hit', async () => {
      File.__state.cachedEntries.push('file:///cache/img-1.download');
      downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }));

      const result = await downloadImageFile({
        url: 'https://backend.example/api/v1/local_image_storage/img-1',
        directory: Paths.cache,
        name: 'img-1',
      });

      expect(result).toEqual({ fileUri: 'file:///cache/img-1.png', extension: 'png' });
      expect(downloadAsync).toHaveBeenCalledTimes(1);

      File.__reset();
      File.__state.cachedEntries.push('file:///cache/img-1.png', 'file:///cache/img-1.download');

      const hit = await downloadImageFile({
        url: 'https://backend.example/api/v1/local_image_storage/img-1',
        directory: Paths.cache,
        name: 'img-1',
      });

      expect(hit).toEqual({ fileUri: 'file:///cache/img-1.png', extension: 'png' });
      expect(downloadAsync).toHaveBeenCalledTimes(1);
      expect(File.__state.deletedUris).toEqual(['file:///cache/img-1.download']);
    });

    it('honors a caller-provided cachedFiles index without listing the directory (hit and authoritative miss)', async () => {
      const cachedFiles = new Map([['img-1', 'file:///cache/img-1.jpeg']]);
      File.__state.cachedEntries.push('file:///cache/other.png');

      const hit = await downloadImageFile({
        url: 'https://backend.example/api/v1/local_image_storage/img-1',
        directory: Paths.cache,
        name: 'img-1',
        cachedFiles,
      });

      expect(hit).toEqual({ fileUri: 'file:///cache/img-1.jpeg', extension: 'jpeg' });
      expect(Paths.cache.list).not.toHaveBeenCalled();
      expect(downloadAsync).not.toHaveBeenCalled();

      downloadAsync.mockResolvedValueOnce(downloadResult({ contentType: 'image/png' }));
      File.__state.cachedEntries.push('file:///cache/img-2.png');

      const miss = await downloadImageFile({
        url: 'https://backend.example/api/v1/local_image_storage/img-2',
        directory: Paths.cache,
        name: 'img-2',
        cachedFiles,
      });

      expect(miss).toEqual({ fileUri: 'file:///cache/img-2.png', extension: 'png' });
      expect(Paths.cache.list).not.toHaveBeenCalled();
      expect(downloadAsync).toHaveBeenCalledTimes(1);
    });
  });
});
