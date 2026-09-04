import * as ImagePicker from 'expo-image-picker';
import { SaveFormat } from 'expo-image-manipulator';

import { preparePrivateUpload } from './groupUploadApi';
import { performImageUpload } from '../../utils/imagesRequests';
import { resizeImage } from '../../utils/resizeImage';
import type { AuthContextLike } from '../billing/entitlements';

const MAX_LONGEST_SIDE = 600;
const WEBP_COMPRESS_QUALITY = 0.85;

export type CategoryThumbnailUploadOptions = {
  context: AuthContextLike;
  groupId: string;
};

export type CategoryThumbnailUploadResult = { imageId: string };

type PresignedUploadPlan = { imageId: string };

type PresignOptions = {
  context: AuthContextLike;
  groupId: string;
  kind: string;
  fileExtension: string;
  contentType: string;
  contentLength: number;
  isCategoryThumbnail: boolean;
};

type PresignResponse = {
  status: number;
  data: PresignedUploadPlan;
};

type PerformUploadOptions = {
  plan: PresignedUploadPlan;
  fileUrl: string;
  fileExtension: string;
  contentLength: number;
  context: AuthContextLike;
};

type UploadResponse = { status: number };

// The .js sources type every destructured option as required; only the fields
// below are sent by this service (the rest default to undefined at runtime).
const presignUpload = preparePrivateUpload as (options: PresignOptions) => Promise<PresignResponse | undefined>;
const uploadImage = performImageUpload as (options: PerformUploadOptions) => Promise<UploadResponse | undefined>;

// Opens the image picker and uploads the chosen asset as a private category thumbnail.
// Returns { imageId } on success, or null when the user cancels the picker.
// Throws on prepare/upload failure so the caller can surface an Alert.
//
// Caller owns the post-upload lifecycle: swap (deleteCategoryThumbnailFile + updateGroupCategory)
// or create-with-thumbnail (createGroupCategory with thumbnailImageId).
export async function uploadCategoryThumbnail({
  context,
  groupId,
}: CategoryThumbnailUploadOptions): Promise<CategoryThumbnailUploadResult | null> {
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
    compress: WEBP_COMPRESS_QUALITY,
  });
  const fileExtension = resized.fileExtension;

  const presignResponse = await presignUpload({
    context,
    groupId,
    kind: 'category-thumbnail',
    fileExtension,
    contentType: `image/${fileExtension}`,
    contentLength: resized.contentLength,
    isCategoryThumbnail: true,
  });
  if (presignResponse?.status !== 200 && presignResponse?.status !== 201) {
    const error = new Error('Could not prepare upload.') as Error & { status?: number };
    error.status = presignResponse?.status;
    throw error;
  }

  const uploadPlan = presignResponse.data;
  const uploadResponse = await uploadImage({
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
