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
import { uploadCategoryThumbnail } from '../../services/groups/categoryThumbnailUpload';

const SAVED_URI = 'file:///tmp/category-thumb.jpeg';

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
        release: jest.fn(),
      }),
      release: jest.fn(),
    };
    return context;
  });
}

describe('uploadCategoryThumbnail', () => {
  const context = { token: 'Bearer x' };
  const groupId = 'g-1';

  beforeEach(() => {
    jest.clearAllMocks();
    resetManipulatorChain();
    mockFileSizeFor.mockImplementation((uri) => (uri === SAVED_URI ? 4_321 : undefined));
  });

  it('returns null when the user cancels the picker without firing presign', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });

    const result = await uploadCategoryThumbnail({ context, groupId });

    expect(result).toBeNull();
    expect(preparePrivateUpload).not.toHaveBeenCalled();
    expect(performImageUpload).not.toHaveBeenCalled();
  });

  it('downscales to a 600px WebP, presigns with the rendered size and webp extension, and uploads the saved uri', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///thumb.webp', width: 2400, height: 1800, fileSize: 2_200_000 }],
    });
    preparePrivateUpload.mockResolvedValue({ status: 201, data: { imageId: 'img-9' } });
    performImageUpload.mockResolvedValue({ status: 200 });

    const result = await uploadCategoryThumbnail({ context, groupId });

    expect(result).toEqual({ imageId: 'img-9' });

    expect(mockResize).toHaveBeenCalledWith({ width: 600 });
    expect(mockSaveAsync).toHaveBeenCalledWith({ compress: 0.85, format: 'webp' });

    const presignArgs = preparePrivateUpload.mock.calls[0][0];
    expect(presignArgs).toMatchObject({
      context,
      groupId,
      kind: 'category-thumbnail',
      fileExtension: 'webp',
      contentType: 'image/webp',
      contentLength: 4_321,
      isCategoryThumbnail: true,
    });
    expect(presignArgs).not.toHaveProperty('categoryId');

    expect(performImageUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: { imageId: 'img-9' },
        fileUrl: SAVED_URI,
        fileExtension: 'webp',
        contentLength: 4_321,
        context,
      }),
    );
  });

  it('aborts before presign when the resized size cannot be determined', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///thumb.webp', width: 2400, height: 1800, fileSize: 2_200_000 }],
    });
    mockFileSizeFor.mockReturnValue(undefined);

    await expect(
      uploadCategoryThumbnail({ context, groupId }),
    ).rejects.toThrow('Could not determine resized image size.');
    expect(preparePrivateUpload).not.toHaveBeenCalled();
    expect(performImageUpload).not.toHaveBeenCalled();
  });

  it('throws when presign returns a non-success status', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///thumb.png', width: 640, height: 480, fileSize: 1 }],
    });
    preparePrivateUpload.mockResolvedValue({ status: 422, data: {} });

    await expect(
      uploadCategoryThumbnail({ context, groupId }),
    ).rejects.toThrow('Could not prepare upload.');
    expect(performImageUpload).not.toHaveBeenCalled();
  });

  it('throws when the PUT upload step fails', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///thumb.png', width: 640, height: 480, fileSize: 1 }],
    });
    preparePrivateUpload.mockResolvedValue({ status: 201, data: { imageId: 'img-x' } });
    performImageUpload.mockResolvedValue({ status: 500 });

    await expect(
      uploadCategoryThumbnail({ context, groupId }),
    ).rejects.toThrow('Upload failed.');
  });
});
