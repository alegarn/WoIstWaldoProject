const mockManipulate = jest.fn();
const mockResize = jest.fn();
const mockRenderAsync = jest.fn();
const mockSaveAsync = jest.fn();
const mockContextRelease = jest.fn();
const mockRefRelease = jest.fn();
const mockFileSizeFor = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    manipulate: (...args) => mockManipulate(...args),
  },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

jest.mock('expo-file-system', () => ({
  File: function File(uri) {
    this.uri = uri;
    this.size = mockFileSizeFor(uri);
  },
}));

import { resizeToJpeg } from '../../utils/resizeToJpeg';

const SAVED_URI = 'file:///tmp/resized.jpeg';

function resetManipulatorChain() {
  mockManipulate.mockReset();
  mockResize.mockReset();
  mockRenderAsync.mockReset();
  mockSaveAsync.mockReset();

  mockManipulate.mockImplementation(() => {
    const context = {
      resize: mockResize.mockReturnValue(context),
      renderAsync: mockRenderAsync.mockResolvedValue({
        saveAsync: mockSaveAsync.mockResolvedValue({
          uri: SAVED_URI,
          width: 120,
          height: 90,
        }),
        release: mockRefRelease,
      }),
      release: mockContextRelease,
    };
    return context;
  });
}

describe('utils/resizeToJpeg', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetManipulatorChain();
    mockFileSizeFor.mockImplementation((uri) => (uri === SAVED_URI ? 12_345 : undefined));
  });

  it('resizes by width when the landscape side exceeds maxLongestSide', async () => {
    const result = await resizeToJpeg({
      uri: 'file:///photos/landscape.jpg',
      width: 800,
      height: 400,
      maxLongestSide: 120,
    });

    expect(mockManipulate).toHaveBeenCalledWith('file:///photos/landscape.jpg');
    expect(mockResize).toHaveBeenCalledWith({ width: 120 });
    expect(result).toEqual({ uri: SAVED_URI, contentLength: 12_345 });
  });

  it('resizes by height when the portrait side exceeds maxLongestSide', async () => {
    await resizeToJpeg({ uri: 'file:///photos/portrait.jpg', width: 400, height: 800, maxLongestSide: 120 });

    expect(mockResize).toHaveBeenCalledWith({ height: 120 });
  });

  it('never upscales when the longest side is already within maxLongestSide', async () => {
    await resizeToJpeg({ uri: 'file:///photos/small.jpg', width: 100, height: 80, maxLongestSide: 120 });

    expect(mockResize).not.toHaveBeenCalled();
    expect(mockSaveAsync).toHaveBeenCalledWith({ compress: 0.7, format: 'jpeg' });
  });

  it('does not resize when the longest side equals maxLongestSide exactly', async () => {
    await resizeToJpeg({ uri: 'file:///photos/exact.jpg', width: 120, height: 90, maxLongestSide: 120 });

    expect(mockResize).not.toHaveBeenCalled();
  });

  it('re-encodes to JPEG with the default compress quality', async () => {
    await resizeToJpeg({ uri: 'file:///photos/any.webp', width: 800, height: 600, maxLongestSide: 120 });

    expect(mockSaveAsync).toHaveBeenCalledWith({ compress: 0.7, format: 'jpeg' });
  });

  it('releases both manipulator handles on success', async () => {
    await resizeToJpeg({ uri: 'file:///photos/landscape.jpg', width: 800, height: 400, maxLongestSide: 120 });

    expect(mockContextRelease).toHaveBeenCalledTimes(1);
    expect(mockRefRelease).toHaveBeenCalledTimes(1);
  });

  it('rejects when the saved file size cannot be determined', async () => {
    mockFileSizeFor.mockReturnValue(undefined);

    await expect(
      resizeToJpeg({ uri: 'file:///photos/broken.jpg', width: 800, height: 400, maxLongestSide: 120 }),
    ).rejects.toThrow('Could not determine resized image size.');
    expect(mockContextRelease).toHaveBeenCalledTimes(1);
    expect(mockRefRelease).toHaveBeenCalledTimes(1);
  });

  it('rejects when reading the saved file size throws', async () => {
    mockFileSizeFor.mockImplementation(() => {
      throw new Error('file system unavailable');
    });

    await expect(
      resizeToJpeg({ uri: 'file:///photos/broken.jpg', width: 800, height: 400, maxLongestSide: 120 }),
    ).rejects.toThrow('file system unavailable');
    expect(mockContextRelease).toHaveBeenCalledTimes(1);
    expect(mockRefRelease).toHaveBeenCalledTimes(1);
  });
});
