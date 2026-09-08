import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

import { preparePrivateUpload } from './groupUploadApi';
import { performImageUpload } from '../../utils/imagesRequests';

const MAX_WIDTH = 1080;

type HomeBackgroundUploadPlan = {
  imageId: string | number;
  url?: string | null;
  method?: string | null;
  headers?: Record<string, string> | null;
};

type HomeBackgroundPresignOptions = {
  context?: unknown;
  groupId?: string | number | null;
  kind: string;
  fileExtension: string;
  contentType: string;
  contentLength: number;
  isHomeButtonBackground: boolean;
};

// preparePrivateUpload lives in untyped groupUploadApi.js; this cast narrows
// it to the options this service actually sends (absent fields default to
// undefined at runtime). A groupUploadApi.d.ts should replace it eventually.
const presignUpload = preparePrivateUpload as (options: HomeBackgroundPresignOptions) => Promise<{ status?: number; data?: HomeBackgroundUploadPlan } | undefined>;

export async function uploadHomeBackground({ context, groupId }: {
  context?: unknown;
  groupId?: string | number | null;
}): Promise<{ imageId: string | number } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [4, 3],
    mediaTypes: ['images'],
  });
  if (result?.canceled || !result?.assets?.length) {
    return null;
  }

  const asset = result.assets[0];

  const manipulator = ImageManipulator.manipulate(asset.uri);
  if (asset.width && asset.width > MAX_WIDTH) {
    manipulator.resize({ width: MAX_WIDTH });
  }
  const rendered = await manipulator.renderAsync();
  const saved = await rendered.saveAsync({
    compress: 0.7,
    format: SaveFormat.JPEG,
  });
  const fileExtension = 'jpeg';

  let contentLength: number | null;
  try {
    contentLength = new File(saved.uri).size;
  } catch {
    contentLength = null;
  }
  if (!contentLength) {
    throw new Error('Could not determine rendered image size.');
  }

  const presignResponse = await presignUpload({
    context,
    groupId,
    kind: 'home-button-background',
    fileExtension,
    contentType: `image/${fileExtension}`,
    contentLength,
    isHomeButtonBackground: true,
  });
  if (presignResponse?.status !== 200 && presignResponse?.status !== 201) {
    const error = new Error('Could not prepare upload.') as Error & { status?: number };
    error.status = presignResponse?.status;
    throw error;
  }

  const uploadPlan = presignResponse.data as HomeBackgroundUploadPlan;
  const uploadResponse = await performImageUpload({
    plan: uploadPlan,
    fileUrl: saved.uri,
    fileExtension,
    contentLength,
    context,
  });
  if (uploadResponse?.status !== 200 && uploadResponse?.status !== 204) {
    throw new Error('Upload failed.');
  }

  return { imageId: uploadPlan.imageId };
}
