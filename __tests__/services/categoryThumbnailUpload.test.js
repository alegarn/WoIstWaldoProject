jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
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

describe('uploadCategoryThumbnail', () => {
  const context = { token: 'Bearer x' };
  const groupId = 'g-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the user cancels the picker without firing presign', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });

    const result = await uploadCategoryThumbnail({ context, groupId });

    expect(result).toBeNull();
    expect(preparePrivateUpload).not.toHaveBeenCalled();
    expect(performImageUpload).not.toHaveBeenCalled();
  });

  it('presigns without categoryId, uploads, and returns the new imageId', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///thumb.webp', fileSize: 42 }],
    });
    preparePrivateUpload.mockResolvedValue({ status: 201, data: { imageId: 'img-9' } });
    performImageUpload.mockResolvedValue({ status: 200 });

    const result = await uploadCategoryThumbnail({ context, groupId });

    expect(result).toEqual({ imageId: 'img-9' });

    const presignArgs = preparePrivateUpload.mock.calls[0][0];
    expect(presignArgs).toMatchObject({
      context,
      groupId,
      kind: 'category-thumbnail',
      fileExtension: 'webp',
      contentType: 'image/webp',
      contentLength: 42,
      isCategoryThumbnail: true,
    });
    expect(presignArgs).not.toHaveProperty('categoryId');

    expect(performImageUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: { imageId: 'img-9' },
        fileUrl: 'file:///thumb.webp',
        fileExtension: 'webp',
        contentLength: 42,
        context,
      }),
    );
  });

  it('throws when presign returns a non-success status', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///thumb.png', fileSize: 1 }],
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
      assets: [{ uri: 'file:///thumb.png', fileSize: 1 }],
    });
    preparePrivateUpload.mockResolvedValue({ status: 201, data: { imageId: 'img-x' } });
    performImageUpload.mockResolvedValue({ status: 500 });

    await expect(
      uploadCategoryThumbnail({ context, groupId }),
    ).rejects.toThrow('Upload failed.');
  });
});
