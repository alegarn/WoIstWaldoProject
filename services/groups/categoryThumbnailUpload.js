import * as ImagePicker from 'expo-image-picker';

import { preparePrivateUpload } from './groupUploadApi';
import { performImageUpload } from '../../utils/imagesRequests';

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
  const fileExtension = (asset.uri.split('.').pop() || 'jpg').toLowerCase();

  const presignResponse = await preparePrivateUpload({
    context,
    groupId,
    kind: 'category-thumbnail',
    fileExtension,
    contentType: `image/${fileExtension}`,
    contentLength: asset.fileSize ?? 0,
    isCategoryThumbnail: true,
  });
  if (presignResponse?.status !== 200 && presignResponse?.status !== 201) {
    throw new Error('Could not prepare upload.');
  }

  const uploadPlan = presignResponse.data;
  const uploadResponse = await performImageUpload({
    plan: uploadPlan,
    fileUrl: asset.uri,
    fileExtension,
    contentLength: asset.fileSize ?? 0,
    context,
  });
  if (uploadResponse?.status !== 200 && uploadResponse?.status !== 204) {
    throw new Error('Upload failed.');
  }

  return { imageId: uploadPlan.imageId };
}
