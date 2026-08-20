import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  MAX_LONGEST_SIDE,
  MIN_LONGEST_SIDE,
  processPickedImage,
} from '../utils/imageProcessing';

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

const buildRef = (
  saveResult = { uri: 'file://result.jpg', width: 1200, height: 900 }
) => ({
  saveAsync: jest.fn(() => Promise.resolve(saveResult)),
  release: jest.fn(),
});

const buildContext = (ref) => ({
  resize: jest.fn(),
  renderAsync: jest.fn(() => Promise.resolve(ref)),
  release: jest.fn(),
});

const wireContext = (ref) => {
  const context = buildContext(ref);
  ImageManipulator.manipulate.mockReturnValue(context);
  return context;
};

describe('imageProcessing utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports the size floor and ceiling constants', () => {
    expect(MIN_LONGEST_SIDE).toBe(1200);
    expect(MAX_LONGEST_SIDE).toBe(2560);
  });

  it('rejects images whose longest side is below the floor without touching the manipulator', async () => {
    const result = await processPickedImage({
      uri: 'file://small.jpg',
      width: 800,
      height: 600,
    });

    expect(result).toEqual({ tooSmall: true });
    expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
  });

  it('re-saves in-range images without resizing and returns the manipulator-reported dimensions', async () => {
    const ref = buildRef({ uri: 'file://result.jpg', width: 1580, height: 1185 });
    const context = wireContext(ref);

    const result = await processPickedImage({
      uri: 'file://in-range.jpg',
      width: 1600,
      height: 1200,
    });

    expect(context.resize).not.toHaveBeenCalled();
    expect(ref.saveAsync).toHaveBeenCalledTimes(1);
    expect(ref.saveAsync).toHaveBeenCalledWith({
      compress: 0.8,
      format: SaveFormat.JPEG,
    });
    expect(result).toEqual({
      tooSmall: false,
      uri: 'file://result.jpg',
      width: 1580,
      height: 1185,
    });
  });

  it('resizes portrait images by height when the longest side exceeds the ceiling', async () => {
    const ref = buildRef({ uri: 'file://portrait.jpg', width: 1920, height: 2560 });
    const context = wireContext(ref);

    const result = await processPickedImage({
      uri: 'file://portrait-original.jpg',
      width: 3000,
      height: 4000,
    });

    expect(context.resize).toHaveBeenCalledWith({ height: 2560 });
    expect(ref.saveAsync).toHaveBeenCalledWith({
      compress: 0.8,
      format: SaveFormat.JPEG,
    });
    expect(result).toEqual({
      tooSmall: false,
      uri: 'file://portrait.jpg',
      width: 1920,
      height: 2560,
    });
  });

  it('resizes landscape images by width when the longest side exceeds the ceiling', async () => {
    const ref = buildRef({ uri: 'file://landscape.jpg', width: 2560, height: 1920 });
    const context = wireContext(ref);

    const result = await processPickedImage({
      uri: 'file://landscape-original.jpg',
      width: 4000,
      height: 3000,
    });

    expect(context.resize).toHaveBeenCalledWith({ width: 2560 });
    expect(result).toEqual({
      tooSmall: false,
      uri: 'file://landscape.jpg',
      width: 2560,
      height: 1920,
    });
  });

  it('releases both the context and the rendered ref after a successful save', async () => {
    const ref = buildRef();
    const context = wireContext(ref);

    await processPickedImage({
      uri: 'file://ok.jpg',
      width: 1600,
      height: 1200,
    });

    expect(ref.release).toHaveBeenCalledTimes(1);
    expect(context.release).toHaveBeenCalledTimes(1);
  });

  it('skips the floor check and resize when dimensions are missing or zero', async () => {
    const missingDimsRef = buildRef({ uri: 'file://no-dims.jpg', width: 640, height: 480 });
    const missingDimsContext = wireContext(missingDimsRef);

    await expect(
      processPickedImage({ uri: 'file://no-dims.jpg' })
    ).resolves.toEqual({
      tooSmall: false,
      uri: 'file://no-dims.jpg',
      width: 640,
      height: 480,
    });
    expect(missingDimsContext.resize).not.toHaveBeenCalled();
    expect(missingDimsRef.saveAsync).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();

    const zeroDimsRef = buildRef({ uri: 'file://zero-dims.jpg', width: 640, height: 480 });
    const zeroDimsContext = wireContext(zeroDimsRef);

    await expect(
      processPickedImage({ uri: 'file://zero-dims.jpg', width: 0, height: 0 })
    ).resolves.toEqual({
      tooSmall: false,
      uri: 'file://zero-dims.jpg',
      width: 640,
      height: 480,
    });
    expect(zeroDimsContext.resize).not.toHaveBeenCalled();
    expect(zeroDimsRef.saveAsync).toHaveBeenCalledTimes(1);
  });

  it('releases both handles even when the save fails', async () => {
    const ref = {
      saveAsync: jest.fn(() => Promise.reject(new Error('save failed'))),
      release: jest.fn(),
    };
    const context = wireContext(ref);

    await expect(
      processPickedImage({ uri: 'file://broken.jpg', width: 1600, height: 1200 })
    ).rejects.toThrow('save failed');

    expect(ref.release).toHaveBeenCalledTimes(1);
    expect(context.release).toHaveBeenCalledTimes(1);
  });
});
