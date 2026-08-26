import * as ImagePicker from 'expo-image-picker';
import { SaveFormat } from 'expo-image-manipulator';

import { preparePrivateUpload } from './groupUploadApi';
import { performImageUpload } from '../../utils/imagesRequests';
import { resizeImage } from '../../utils/resizeImage';

const MAX_LONGEST_SIDE = 600;

// Opens the image picker and uploads the chosen asset as a private category thumbnail.
// Returns { imageId } on success, or null when the user cancels the picker.
// Throws on prepare/upload failure so the caller can surface an Alert.
//
// Caller owns the post-upload lifecycle: swap (deleteCategoryThumbnailFile + updateGroupCategory)
// or create-with-thumbnail (createGroupCategory with thumbnailImageId).
export async function uploadCategoryThumbnail({ context, groupId }) {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    mediaTypes: ['images'],
    quality: 0.5,
  });
  if (result?.canceled || !result?.assets?.length) {
    return null;
  }

  const asset = result.assets[0];

  const resized = await resizeImage({
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    maxLongestSide: MAX_LONGEST_SIDE,
    format: SaveFormat.WEBP,
    compress: 0.85,
  });
  const fileExtension = resized.fileExtension;

  const presignResponse = await preparePrivateUpload({
    context,
    groupId,
    kind: 'category-thumbnail',
    fileExtension,
    contentType: `image/${fileExtension}`,
    contentLength: resized.contentLength,
    isCategoryThumbnail: true,
  });
  if (presignResponse?.status !== 200 && presignResponse?.status !== 201) {
    throw new Error('Could not prepare upload.');
  }

  const uploadPlan = presignResponse.data;
  const uploadResponse = await performImageUpload({
    plan: uploadPlan,
    fileUrl: resized.uri,
    fileExtension,
    contentLength: resized.contentLength,
    context,
  });
  if (uploadResponse?.status !== 200 && uploadResponse?.status !== 204) {
    throw new Error('Upload failed.');
  }

  return { imageId: uploadPlan.imageId };
}
