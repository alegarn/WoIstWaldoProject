import type { ImageResult } from 'expo-image-manipulator';

const mockManipulate = jest.fn();
const mockResize = jest.fn();
const mockRenderAsync = jest.fn();
const mockSaveAsync = jest.fn();
const mockContextRelease = jest.fn();
const mockRefRelease = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    manipulate: (...args: unknown[]) => mockManipulate(...args),
  },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

import { SaveFormat } from 'expo-image-manipulator';
import { scrubImageMetadata } from '../../utils/imageMetadataScrub';

const SOURCE_URI = 'file:///photos/original-with-exif.jpeg';
const SCRUBBED_URI = 'file:///cache/scrubbed.jpeg';

type ManipulatorContextMock = {
  resize: typeof mockResize;
  renderAsync: typeof mockRenderAsync;
  release: typeof mockContextRelease;
};

function resetManipulatorChain() {
  mockManipulate.mockReset();
  mockResize.mockReset();
  mockRenderAsync.mockReset();
  mockSaveAsync.mockReset();

  mockManipulate.mockImplementation(() => {
    const context: ManipulatorContextMock = {
      resize: mockResize,
      renderAsync: mockRenderAsync,
      release: mockContextRelease,
    };
    mockResize.mockReturnValue(context);
    mockRenderAsync.mockResolvedValue({
      saveAsync: mockSaveAsync.mockResolvedValue({
        uri: SCRUBBED_URI,
        width: 1080,
        height: 810,
      } satisfies ImageResult),
      release: mockRefRelease,
    });
    return context;
  });
}

describe('utils/imageMetadataScrub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetManipulatorChain();
  });

  it('always decodes and re-encodes into a brand-new file, never returning the source uri', async () => {
    const result = await scrubImageMetadata({
      uri: SOURCE_URI,
      format: SaveFormat.JPEG,
      compress: 0.8,
    });

    expect(mockManipulate).toHaveBeenCalledTimes(1);
    expect(mockManipulate).toHaveBeenCalledWith(SOURCE_URI);
    expect(mockRenderAsync).toHaveBeenCalledTimes(1);
    expect(mockSaveAsync).toHaveBeenCalledTimes(1);
    expect(mockSaveAsync).toHaveBeenCalledWith({ compress: 0.8, format: 'jpeg' });
    expect(result.uri).not.toBe(SOURCE_URI);
    expect(result.uri).toBe(SCRUBBED_URI);
  });

  it('still runs the full re-encode when no resize is requested', async () => {
    const result = await scrubImageMetadata({
      uri: SOURCE_URI,
      format: SaveFormat.JPEG,
      compress: 0.8,
    });

    expect(mockResize).not.toHaveBeenCalled();
    expect(mockRenderAsync).toHaveBeenCalledTimes(1);
    expect(mockSaveAsync).toHaveBeenCalledTimes(1);
    expect(result.uri).toBe(SCRUBBED_URI);
  });

  it('propagates the requested resize to the manipulator', async () => {
    await scrubImageMetadata({
      uri: SOURCE_URI,
      format: SaveFormat.JPEG,
      compress: 0.8,
      resize: { width: 1080 },
    });

    expect(mockResize).toHaveBeenCalledTimes(1);
    expect(mockResize).toHaveBeenCalledWith({ width: 1080 });
    expect(mockSaveAsync).toHaveBeenCalledWith({ compress: 0.8, format: 'jpeg' });
  });

  it('propagates caller-provided format and compress quality', async () => {
    await scrubImageMetadata({
      uri: SOURCE_URI,
      format: SaveFormat.WEBP,
      compress: 0.85,
    });

    expect(mockSaveAsync).toHaveBeenCalledWith({ compress: 0.85, format: 'webp' });
  });

  it('returns the re-encoded uri and dimensions from the save result', async () => {
    const result = await scrubImageMetadata({
      uri: SOURCE_URI,
      format: SaveFormat.JPEG,
      compress: 0.8,
    });

    expect(result).toEqual({ uri: SCRUBBED_URI, width: 1080, height: 810 });
  });

  it('releases both manipulator handles on success', async () => {
    await scrubImageMetadata({ uri: SOURCE_URI, format: SaveFormat.JPEG, compress: 0.8 });

    expect(mockContextRelease).toHaveBeenCalledTimes(1);
    expect(mockRefRelease).toHaveBeenCalledTimes(1);
  });

  it('releases both manipulator handles when the save fails', async () => {
    mockSaveAsync.mockRejectedValueOnce(new Error('save failed'));

    await expect(
      scrubImageMetadata({ uri: SOURCE_URI, format: SaveFormat.JPEG, compress: 0.8 }),
    ).rejects.toThrow('save failed');

    expect(mockContextRelease).toHaveBeenCalledTimes(1);
    expect(mockRefRelease).toHaveBeenCalledTimes(1);
  });
});
