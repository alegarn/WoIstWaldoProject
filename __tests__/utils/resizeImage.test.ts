import type { ImageResult } from 'expo-image-manipulator';

const mockFileSizeFor = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

jest.mock('expo-file-system', () => ({
  File: function File(this: { uri: string; size: number | undefined }, uri: string) {
    this.uri = uri;
    this.size = mockFileSizeFor(uri);
  },
}));

jest.mock('../../utils/imageMetadataScrub', () => ({
  scrubImageMetadata: jest.fn(),
}));

import { SaveFormat } from 'expo-image-manipulator';
import { scrubImageMetadata } from '../../utils/imageMetadataScrub';
import { resizeImage } from '../../utils/resizeImage';

const SAVED_URI = 'file:///tmp/resized.jpeg';
const SCRUBBED: ImageResult = { uri: SAVED_URI, width: 120, height: 90 };

const mockScrubImageMetadata = jest.mocked(scrubImageMetadata);

describe('utils/resizeImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScrubImageMetadata.mockResolvedValue(SCRUBBED);
    mockFileSizeFor.mockImplementation((uri: string) => (uri === SAVED_URI ? 12_345 : undefined));
  });

  it('routes through the metadata scrub and resizes by width when the landscape side exceeds maxLongestSide', async () => {
    const result = await resizeImage({
      uri: 'file:///photos/landscape.jpg',
      width: 800,
      height: 400,
      maxLongestSide: 120,
    });

    expect(mockScrubImageMetadata).toHaveBeenCalledWith({
      uri: 'file:///photos/landscape.jpg',
      format: 'jpeg',
      compress: 0.7,
      resize: { width: 120 },
    });
    expect(result).toEqual({ uri: SAVED_URI, contentLength: 12_345, fileExtension: 'jpeg' });
  });

  it('routes through the metadata scrub and resizes by height when the portrait side exceeds maxLongestSide', async () => {
    await resizeImage({ uri: 'file:///photos/portrait.jpg', width: 400, height: 800, maxLongestSide: 120 });

    expect(mockScrubImageMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ resize: { height: 120 } }),
    );
  });

  it('never upscales and still re-encodes when the longest side is already within maxLongestSide', async () => {
    const result = await resizeImage({
      uri: 'file:///photos/small.jpg',
      width: 100,
      height: 80,
      maxLongestSide: 120,
    });

    expect(mockScrubImageMetadata).toHaveBeenCalledWith({
      uri: 'file:///photos/small.jpg',
      format: 'jpeg',
      compress: 0.7,
      resize: undefined,
    });
    expect(result).toEqual({ uri: SAVED_URI, contentLength: 12_345, fileExtension: 'jpeg' });
  });

  it('does not resize when the longest side equals maxLongestSide exactly', async () => {
    await resizeImage({ uri: 'file:///photos/exact.jpg', width: 120, height: 90, maxLongestSide: 120 });

    expect(mockScrubImageMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ resize: undefined }),
    );
  });

  it('re-encodes to JPEG with the default compress quality by default', async () => {
    const result = await resizeImage({
      uri: 'file:///photos/any.webp',
      width: 800,
      height: 600,
      maxLongestSide: 120,
    });

    expect(mockScrubImageMetadata).toHaveBeenCalledWith({
      uri: 'file:///photos/any.webp',
      format: 'jpeg',
      compress: 0.7,
      resize: { width: 120 },
    });
    expect(result.fileExtension).toBe('jpeg');
  });

  it('saves as WEBP with the caller-provided compress quality and reports the webp extension', async () => {
    const result = await resizeImage({
      uri: 'file:///photos/any.jpg',
      width: 2400,
      height: 1800,
      maxLongestSide: 600,
      format: SaveFormat.WEBP,
      compress: 0.85,
    });

    expect(mockScrubImageMetadata).toHaveBeenCalledWith({
      uri: 'file:///photos/any.jpg',
      format: 'webp',
      compress: 0.85,
      resize: { width: 600 },
    });
    expect(result.fileExtension).toBe('webp');
  });

  it('reports the png extension when saving as PNG', async () => {
    const result = await resizeImage({
      uri: 'file:///photos/any.jpg',
      width: 800,
      height: 600,
      maxLongestSide: 120,
      format: SaveFormat.PNG,
    });

    expect(mockScrubImageMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'png', compress: 0.7 }),
    );
    expect(result.fileExtension).toBe('png');
  });

  it('rejects when the saved file size cannot be determined', async () => {
    mockFileSizeFor.mockReturnValue(undefined);

    await expect(
      resizeImage({ uri: 'file:///photos/broken.jpg', width: 800, height: 400, maxLongestSide: 120 }),
    ).rejects.toThrow('Could not determine resized image size.');
  });

  it('rejects when reading the saved file size throws', async () => {
    mockFileSizeFor.mockImplementation(() => {
      throw new Error('file system unavailable');
    });

    await expect(
      resizeImage({ uri: 'file:///photos/broken.jpg', width: 800, height: 400, maxLongestSide: 120 }),
    ).rejects.toThrow('file system unavailable');
  });
});
