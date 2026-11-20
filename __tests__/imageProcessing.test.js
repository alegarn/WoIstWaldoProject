import { SaveFormat } from 'expo-image-manipulator';
import {
  MAX_LONGEST_SIDE,
  MIN_LONGEST_SIDE,
  processPickedImage,
} from '../utils/imageProcessing';
import { scrubImageMetadata } from '../utils/imageMetadataScrub';

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('../utils/imageMetadataScrub', () => ({
  scrubImageMetadata: jest.fn(),
}));

const SCRUB_RESULT = { uri: 'file://result.jpg', width: 1580, height: 1185 };

describe('imageProcessing utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scrubImageMetadata.mockResolvedValue(SCRUB_RESULT);
  });

  it('exports the size floor and ceiling constants', () => {
    expect(MIN_LONGEST_SIDE).toBe(1200);
    expect(MAX_LONGEST_SIDE).toBe(2560);
  });

  it('rejects images whose longest side is below the floor without re-encoding', async () => {
    const result = await processPickedImage({
      uri: 'file://small.jpg',
      width: 800,
      height: 600,
    });

    expect(result).toEqual({ tooSmall: true });
    expect(scrubImageMetadata).not.toHaveBeenCalled();
  });

  it('routes in-range images through the metadata scrub re-encode without resizing', async () => {
    const result = await processPickedImage({
      uri: 'file://in-range.jpg',
      width: 1600,
      height: 1200,
    });

    expect(scrubImageMetadata).toHaveBeenCalledTimes(1);
    expect(scrubImageMetadata).toHaveBeenCalledWith({
      uri: 'file://in-range.jpg',
      format: SaveFormat.JPEG,
      compress: 0.8,
      resize: undefined,
    });
    expect(result).toEqual({ tooSmall: false, ...SCRUB_RESULT });
  });

  it('resizes portrait images by height when the longest side exceeds the ceiling', async () => {
    const portraitResult = { uri: 'file://portrait.jpg', width: 1920, height: 2560 };
    scrubImageMetadata.mockResolvedValue(portraitResult);

    const result = await processPickedImage({
      uri: 'file://portrait-original.jpg',
      width: 3000,
      height: 4000,
    });

    expect(scrubImageMetadata).toHaveBeenCalledWith({
      uri: 'file://portrait-original.jpg',
      format: SaveFormat.JPEG,
      compress: 0.8,
      resize: { height: MAX_LONGEST_SIDE },
    });
    expect(result).toEqual({ tooSmall: false, ...portraitResult });
  });

  it('resizes landscape images by width when the longest side exceeds the ceiling', async () => {
    const landscapeResult = { uri: 'file://landscape.jpg', width: 2560, height: 1920 };
    scrubImageMetadata.mockResolvedValue(landscapeResult);

    const result = await processPickedImage({
      uri: 'file://landscape-original.jpg',
      width: 4000,
      height: 3000,
    });

    expect(scrubImageMetadata).toHaveBeenCalledWith({
      uri: 'file://landscape-original.jpg',
      format: SaveFormat.JPEG,
      compress: 0.8,
      resize: { width: MAX_LONGEST_SIDE },
    });
    expect(result).toEqual({ tooSmall: false, ...landscapeResult });
  });

  it('skips the floor check and resize when dimensions are missing or zero', async () => {
    const noDimsResult = { uri: 'file://no-dims.jpg', width: 640, height: 480 };
    scrubImageMetadata.mockResolvedValueOnce(noDimsResult);

    await expect(
      processPickedImage({ uri: 'file://no-dims.jpg' })
    ).resolves.toEqual({ tooSmall: false, ...noDimsResult });
    expect(scrubImageMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'file://no-dims.jpg', resize: undefined })
    );

    const zeroDimsResult = { uri: 'file://zero-dims.jpg', width: 640, height: 480 };
    scrubImageMetadata.mockResolvedValueOnce(zeroDimsResult);

    await expect(
      processPickedImage({ uri: 'file://zero-dims.jpg', width: 0, height: 0 })
    ).resolves.toEqual({ tooSmall: false, ...zeroDimsResult });
    expect(scrubImageMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'file://zero-dims.jpg', resize: undefined })
    );
  });

  it('propagates scrub re-encode failures', async () => {
    scrubImageMetadata.mockRejectedValue(new Error('save failed'));

    await expect(
      processPickedImage({ uri: 'file://broken.jpg', width: 1600, height: 1200 })
    ).rejects.toThrow('save failed');
  });
});
