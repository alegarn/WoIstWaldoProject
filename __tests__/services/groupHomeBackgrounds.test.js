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
    createdUris: [],
    writtenUris: [],
    writeError: null,
    listings: {},
  };

  function joinArgs(args) {
    let base = '';
    for (const arg of args) {
      if (arg == null) continue;
      const text = typeof arg === 'string' ? arg : arg?.uri;
      if (typeof text !== 'string' || text.length === 0) continue;
      if (base.length === 0) {
        base = text;
      } else if (base.endsWith('/')) {
        base = `${base}${text}`;
      } else {
        base = `${base}/${text}`;
      }
    }
    return base;
  }

  const File = jest.fn().mockImplementation(function MockFile(...args) {
    this.uri = joinArgs(args);
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
    this.create = jest.fn(() => {
      state.createdUris.push(this.uri);
    });
    this.list = jest.fn(() => state.listings[this.uri] || []);
  });

  const cacheStore = {
    uri: 'file:///cache/',
    list: () => [],
    create: jest.fn(),
  };

  function resetMockState() {
    state.existsOverride = null;
    state.deletedUris.length = 0;
    state.createdUris.length = 0;
    state.writtenUris.length = 0;
    state.writeError = null;
    state.listings = {};
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

  const Directory = File;
  return { File, Directory, Paths };
});

jest.mock('../../utils/imagesRequests', () => ({
  usesBackendStorage: jest.fn(() => false),
  setStorageDownloadHeaders: jest.fn((token) => ({
    Authorization: token,
    HTTP_AUTHORIZATION: token,
  })),
  getBackendHeaders: jest.fn(async () => ({ token: 'Bearer t' })),
}));

import axios from 'axios';
import { fromByteArray } from 'base64-js';
import { File } from 'expo-file-system';
import {
  SLOTS,
  resolveHomeBackground,
  deleteHomeBackgroundFile,
  clearGroupHomeBackgrounds,
} from '../../services/groups/groupHomeBackgrounds';
import { usesBackendStorage } from '../../utils/imagesRequests';

const CONTEXT = { token: 'Bearer t', userId: 'u-1' };

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

const legacyDataUrlBytes = (text) => {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
};

describe('services/groups/groupHomeBackgrounds', () => {
  beforeEach(() => {
    axios.get.mockReset();
    fromByteArray.mockClear();
    File.__reset();
    usesBackendStorage.mockReset();
    usesBackendStorage.mockReturnValue(false);
  });

  it('exports the three slot keys', () => {
    expect(SLOTS).toEqual(['hide', 'find', 'ranking']);
  });

  it('returns the cached URI without downloading when the local file already exists', async () => {
    File.__state.existsOverride = true;

    const uri = await resolveHomeBackground({
      context: CONTEXT,
      groupId: 'g-1',
      slot: 'hide',
      imageId: 'img-1',
      fileExtension: 'png',
      url: 'https://presigned.example.com/home/img-1.png',
    });

    expect(axios.get).not.toHaveBeenCalled();
    expect(uri).toEqual(expect.stringContaining('private-home-bg/g-1/hide-img-1.png'));
    expect(File.__state.writtenUris).toHaveLength(0);
  });

  it('ensures the nested dir, downloads as arraybuffer, and writes the file when missing', async () => {
    File.__state.existsOverride = false;
    axios.get.mockResolvedValue({
      data: PNG_MAGIC,
      headers: { 'content-type': 'image/png' },
    });

    const uri = await resolveHomeBackground({
      context: CONTEXT,
      groupId: 'g-1',
      slot: 'find',
      imageId: 'img-2',
      fileExtension: 'png',
      url: 'https://presigned.example.com/home/img-2.png',
    });

    expect(axios.get).toHaveBeenCalledWith(
      'https://presigned.example.com/home/img-2.png',
      { responseType: 'arraybuffer', timeout: 15000 }
    );
    expect(fromByteArray).toHaveBeenCalledWith(PNG_MAGIC);
    expect(uri).toEqual(
      expect.stringContaining('private-home-bg/g-1/find-img-2.png')
    );
    expect(File.__state.createdUris).toEqual([
      expect.stringContaining('private-home-bg/g-1'),
    ]);
    expect(File.__state.writtenUris).toHaveLength(1);
    expect(File.__state.writtenUris[0]).toEqual({
      uri: expect.stringContaining('private-home-bg/g-1/find-img-2.png'),
      data: 'b64:12',
      options: { encoding: 'base64' },
    });
  });

  it('derives the file extension from the response content-type when no fileExtension is given', async () => {
    File.__state.existsOverride = false;
    axios.get.mockResolvedValue({
      data: PNG_MAGIC,
      headers: { 'content-type': 'image/webp' },
    });

    const uri = await resolveHomeBackground({
      context: CONTEXT,
      groupId: 'g-1',
      slot: 'find',
      imageId: 'img-ct',
      url: 'https://presigned.example.com/home/img-ct',
    });

    expect(uri).toEqual(
      expect.stringContaining('private-home-bg/g-1/find-img-ct.webp')
    );
  });

  it('falls back to the remote url when the download fails', async () => {
    File.__state.existsOverride = false;
    axios.get.mockRejectedValue(new Error('network down'));

    const uri = await resolveHomeBackground({
      context: CONTEXT,
      groupId: 'g-1',
      slot: 'ranking',
      imageId: 'img-3',
      fileExtension: 'png',
      url: 'https://presigned.example.com/home/img-3.png',
    });

    expect(uri).toBe('https://presigned.example.com/home/img-3.png');
    expect(File.__state.writtenUris).toHaveLength(0);
  });

  it('downloads from backend storage as arraybuffer with legacy ASCII-prefix decode and writes the cached file', async () => {
    usesBackendStorage.mockReturnValue(true);
    File.__state.existsOverride = false;
    axios.get.mockResolvedValue({
      data: legacyDataUrlBytes('data:image/jpeg;base64,ChQe'),
      headers: { 'content-type': 'text/plain' },
    });

    const uri = await resolveHomeBackground({
      context: CONTEXT,
      groupId: 'g-2',
      slot: 'hide',
      imageId: 'img-be-1',
      fileExtension: 'jpeg',
      url: 'https://api.example.com/storage/home/img-be-1.jpeg',
    });

    expect(axios.get).toHaveBeenCalledWith(
      'https://api.example.com/storage/home/img-be-1.jpeg',
      {
        headers: { Authorization: 'Bearer t', HTTP_AUTHORIZATION: 'Bearer t' },
        responseType: 'arraybuffer',
        timeout: 15000,
      }
    );
    expect(fromByteArray).not.toHaveBeenCalled();
    expect(uri).toEqual(
      expect.stringContaining('private-home-bg/g-2/hide-img-be-1.jpeg')
    );
    expect(File.__state.writtenUris).toHaveLength(1);
    expect(File.__state.writtenUris[0]).toEqual({
      uri: expect.stringContaining('private-home-bg/g-2/hide-img-be-1.jpeg'),
      data: 'ChQe',
      options: { encoding: 'base64' },
    });
  });

  it('C5: decodes a legacy gif data-url byte payload from backend storage', async () => {
    usesBackendStorage.mockReturnValue(true);
    File.__state.existsOverride = false;
    axios.get.mockResolvedValue({
      data: legacyDataUrlBytes('data:image/gif;base64,R0lGODlh'),
      headers: { 'content-type': 'text/plain' },
    });

    const uri = await resolveHomeBackground({
      context: CONTEXT,
      groupId: 'g-2',
      slot: 'find',
      imageId: 'img-be-gif',
      url: 'https://api.example.com/storage/home/img-be-gif',
    });

    expect(axios.get).toHaveBeenCalledWith(
      'https://api.example.com/storage/home/img-be-gif',
      {
        headers: { Authorization: 'Bearer t', HTTP_AUTHORIZATION: 'Bearer t' },
        responseType: 'arraybuffer',
        timeout: 15000,
      }
    );
    expect(uri).toEqual(
      expect.stringContaining('private-home-bg/g-2/find-img-be-gif.gif')
    );
    expect(File.__state.writtenUris[0]).toEqual({
      uri: expect.stringContaining('private-home-bg/g-2/find-img-be-gif.gif'),
      data: 'R0lGODlh',
      options: { encoding: 'base64' },
    });
  });

  it('returns null instead of the remote url when a backend-storage download fails', async () => {
    usesBackendStorage.mockReturnValue(true);
    File.__state.existsOverride = false;
    axios.get.mockRejectedValue(new Error('401'));

    const uri = await resolveHomeBackground({
      context: CONTEXT,
      groupId: 'g-2',
      slot: 'find',
      imageId: 'img-be-2',
      fileExtension: 'png',
      url: 'https://api.example.com/storage/home/img-be-2.png',
    });

    expect(uri).toBeNull();
    expect(File.__state.writtenUris).toHaveLength(0);
  });

  it('returns null when imageId or slot is missing', async () => {
    const uri = await resolveHomeBackground({
      context: CONTEXT,
      groupId: 'g-1',
      slot: 'hide',
      imageId: null,
      fileExtension: 'png',
      url: 'https://presigned.example.com/home/x.png',
    });

    expect(uri).toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('deleteHomeBackgroundFile best-effort deletes the slot cache file across extensions', () => {
    File.__state.existsOverride = true;

    deleteHomeBackgroundFile('g-1', 'hide', 'img-1');

    const deleted = File.__state.deletedUris.filter((u) =>
      u.includes('private-home-bg/g-1/hide-img-1')
    );
    expect(deleted.length).toBeGreaterThan(0);
  });

  it('clearGroupHomeBackgrounds deletes the nested group directory', () => {
    File.__state.existsOverride = true;

    clearGroupHomeBackgrounds('g-1');

    expect(File.__state.deletedUris).toEqual([
      expect.stringContaining('private-home-bg/g-1'),
    ]);
  });

  it('clearGroupHomeBackgrounds is best-effort when the dir is absent', () => {
    File.__state.existsOverride = false;

    expect(() => clearGroupHomeBackgrounds('g-1')).not.toThrow();
    expect(File.__state.deletedUris).toHaveLength(0);
  });

  it('clearGroupHomeBackgrounds deletes each cached child file before deleting the directory', () => {
    File.__state.existsOverride = true;
    const groupDirUri = 'file:///cache/private-home-bg/g-1';
    File.__state.listings[groupDirUri] = [
      'file:///cache/private-home-bg/g-1/hide-img-1.png',
      'file:///cache/private-home-bg/g-1/find-img-2.jpeg',
      'file:///cache/private-home-bg/g-1/ranking-img-3.webp',
    ];

    clearGroupHomeBackgrounds('g-1');

    const deleted = File.__state.deletedUris;
    expect(deleted).toEqual(
      expect.arrayContaining([
        'file:///cache/private-home-bg/g-1/hide-img-1.png',
        'file:///cache/private-home-bg/g-1/find-img-2.jpeg',
        'file:///cache/private-home-bg/g-1/ranking-img-3.webp',
        groupDirUri,
      ])
    );
    expect(deleted[deleted.length - 1]).toBe(groupDirUri);
  });
});
