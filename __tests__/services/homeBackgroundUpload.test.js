jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

const mockManipulate = jest.fn();
const mockResize = jest.fn();
const mockRenderAsync = jest.fn();
const mockSaveAsync = jest.fn();
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

jest.mock('../../services/groups/groupUploadApi', () => ({
  preparePrivateUpload: jest.fn(),
}));

jest.mock('../../utils/imagesRequests', () => ({
  performImageUpload: jest.fn(),
}));

import * as ImagePicker from 'expo-image-picker';
import { preparePrivateUpload } from '../../services/groups/groupUploadApi';
import { performImageUpload } from '../../utils/imagesRequests';
import { uploadHomeBackground } from '../../services/groups/homeBackgroundUpload';

const CONTEXT = { token: 'Bearer t', userId: 'u-1' };

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
          uri: 'file:///tmp/manipulated.jpg',
          width: 1080,
          height: 810,
        }),
      }),
    };
    return context;
  });
}

describe('services/groups/homeBackgroundUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetManipulatorChain();
    mockFileSizeFor.mockImplementation((uri) =>
      uri === 'file:///tmp/manipulated.jpg' ? 150_000 : undefined
    );
  });

  it('returns null when the picker is cancelled', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });

    const result = await uploadHomeBackground({ context: CONTEXT, groupId: 'g-1' });

    expect(result).toBeNull();
    expect(preparePrivateUpload).not.toHaveBeenCalled();
    expect(performImageUpload).not.toHaveBeenCalled();
  });

  it('picks, downscales, presigns as home-button-background, uploads, and returns imageId', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///photos/big.jpg',
          width: 4032,
          height: 3024,
          fileSize: 2_000_000,
        },
      ],
    });
    preparePrivateUpload.mockResolvedValue({
      status: 200,
      data: { imageId: 'img-9', url: 'https://upload.example/' },
    });
    performImageUpload.mockResolvedValue({ status: 200 });

    const result = await uploadHomeBackground({ context: CONTEXT, groupId: 'g-1' });

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
      allowsEditing: true,
      aspect: [4, 3],
      mediaTypes: ['images'],
    });
    expect(mockManipulate).toHaveBeenCalledWith('file:///photos/big.jpg');
    expect(mockResize).toHaveBeenCalledWith({ width: 1080 });
    expect(preparePrivateUpload).toHaveBeenCalledWith({
      context: CONTEXT,
      groupId: 'g-1',
      kind: 'home-button-background',
      fileExtension: 'jpeg',
      contentType: 'image/jpeg',
      contentLength: 150_000,
      isHomeButtonBackground: true,
    });
    expect(performImageUpload).toHaveBeenCalledWith({
      plan: { imageId: 'img-9', url: 'https://upload.example/' },
      fileUrl: 'file:///tmp/manipulated.jpg',
      fileExtension: 'jpeg',
      contentLength: 150_000,
      context: CONTEXT,
    });
    expect(result).toEqual({ imageId: 'img-9' });
  });

  it('skips the resize step when the picked asset is already narrower than 1080px', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file:///photos/small.jpg', width: 800, height: 600, fileSize: 100 },
      ],
    });
    preparePrivateUpload.mockResolvedValue({
      status: 200,
      data: { imageId: 'img-1' },
    });
    performImageUpload.mockResolvedValue({ status: 200 });

    await uploadHomeBackground({ context: CONTEXT, groupId: 'g-1' });

    expect(mockResize).not.toHaveBeenCalled();
    expect(preparePrivateUpload).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'home-button-background', isHomeButtonBackground: true })
    );
  });

  it('throws when presign does not return a success status', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///photos/big.jpg', width: 2000, fileSize: 1000 }],
    });
    preparePrivateUpload.mockResolvedValue({ status: 422, data: {} });

    await expect(
      uploadHomeBackground({ context: CONTEXT, groupId: 'g-1' })
    ).rejects.toThrow('Could not prepare upload.');
    expect(performImageUpload).not.toHaveBeenCalled();
  });
});
