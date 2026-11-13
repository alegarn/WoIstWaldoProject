jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

const mockFileSizeFor = jest.fn();

jest.mock('expo-file-system', () => ({
  File: function File(uri) {
    this.uri = uri;
    this.size = mockFileSizeFor(uri);
  },
}));

jest.mock('../../utils/imageMetadataScrub', () => ({
  scrubImageMetadata: jest.fn(),
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
import { scrubImageMetadata } from '../../utils/imageMetadataScrub';
import { uploadHomeBackground } from '../../services/groups/homeBackgroundUpload';

const CONTEXT = { token: 'Bearer t', userId: 'u-1' };
const PICKED_URI = 'file:///photos/big.jpg';
const SCRUBBED_URI = 'file:///tmp/manipulated.jpg';

describe('services/groups/homeBackgroundUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scrubImageMetadata.mockResolvedValue({
      uri: SCRUBBED_URI,
      width: 1080,
      height: 810,
    });
    mockFileSizeFor.mockImplementation((uri) =>
      uri === SCRUBBED_URI ? 150_000 : undefined
    );
  });

  it('returns null when the picker is cancelled', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });

    const result = await uploadHomeBackground({ context: CONTEXT, groupId: 'g-1' });

    expect(result).toBeNull();
    expect(scrubImageMetadata).not.toHaveBeenCalled();
    expect(preparePrivateUpload).not.toHaveBeenCalled();
    expect(performImageUpload).not.toHaveBeenCalled();
  });

  it('picks, scrubs with a 1080px downscale, presigns as home-button-background, uploads, and returns imageId', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: PICKED_URI,
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
    expect(scrubImageMetadata).toHaveBeenCalledWith({
      uri: PICKED_URI,
      format: 'jpeg',
      compress: 0.7,
      resize: { width: 1080 },
    });
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
      fileUrl: SCRUBBED_URI,
      fileExtension: 'jpeg',
      contentLength: 150_000,
      context: CONTEXT,
    });
    expect(result).toEqual({ imageId: 'img-9' });
  });

  it('skips the resize step when the picked asset is already narrower than 1080px but still scrubs', async () => {
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

    expect(scrubImageMetadata).toHaveBeenCalledWith({
      uri: 'file:///photos/small.jpg',
      format: 'jpeg',
      compress: 0.7,
      resize: undefined,
    });
    expect(preparePrivateUpload).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'home-button-background', isHomeButtonBackground: true })
    );
  });

  it('never uploads the picked asset uri — the upload always receives the scrubbed re-encoded file', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: PICKED_URI, width: 4032, height: 3024, fileSize: 2_000_000 },
      ],
    });
    preparePrivateUpload.mockResolvedValue({
      status: 200,
      data: { imageId: 'img-9', url: 'https://upload.example/' },
    });
    performImageUpload.mockResolvedValue({ status: 200 });

    await uploadHomeBackground({ context: CONTEXT, groupId: 'g-1' });

    expect(performImageUpload).toHaveBeenCalledTimes(1);
    const uploadArgs = performImageUpload.mock.calls[0][0];
    expect(uploadArgs.fileUrl).not.toBe(PICKED_URI);
    expect(uploadArgs.fileUrl).toBe(SCRUBBED_URI);
  });

  it('throws and never presigns when the scrubbed file size cannot be determined', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: PICKED_URI, width: 2000, fileSize: 2_000_000 }],
    });
    mockFileSizeFor.mockReturnValue(undefined);

    await expect(
      uploadHomeBackground({ context: CONTEXT, groupId: 'g-1' })
    ).rejects.toThrow('Could not determine rendered image size.');
    expect(preparePrivateUpload).not.toHaveBeenCalled();
    expect(performImageUpload).not.toHaveBeenCalled();
  });

  it('throws and never presigns when reading the scrubbed file size fails', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: PICKED_URI, width: 2000, fileSize: 2_000_000 }],
    });
    mockFileSizeFor.mockImplementation(() => {
      throw new Error('stat failed');
    });

    await expect(
      uploadHomeBackground({ context: CONTEXT, groupId: 'g-1' })
    ).rejects.toThrow('Could not determine rendered image size.');
    expect(preparePrivateUpload).not.toHaveBeenCalled();
    expect(performImageUpload).not.toHaveBeenCalled();
  });

  it('throws when presign does not return a success status', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: PICKED_URI, width: 2000, fileSize: 1000 }],
    });
    preparePrivateUpload.mockResolvedValue({ status: 422, data: {} });

    await expect(
      uploadHomeBackground({ context: CONTEXT, groupId: 'g-1' })
    ).rejects.toThrow('Could not prepare upload.');
    expect(performImageUpload).not.toHaveBeenCalled();
  });
});
